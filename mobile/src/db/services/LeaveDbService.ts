import { database } from '../index';
import LeaveRequestModel from '../models/LeaveRequest';
import LeaveTypeModel from '../models/LeaveTypeModel';
import LeaveBalanceModel from '../models/LeaveBalanceModel';
import { LeaveRequest, LeaveType, LeaveBalance, LeaveSubmissionPayload } from '../../api/leave/types';

export class LeaveDbService {
  /**
   * Syncs fetched leave requests to the local DB.
   * Prevents overwriting local requests that are marked as 'pending_sync'.
   */
  static async syncLeaveRequests(apiRequests: LeaveRequest[]) {
    await database.write(async () => {
      const collection = database.collections.get<LeaveRequestModel>('leave_requests');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map(allLocal.map(req => [req.remoteId, req]));
      const ops: any[] = [];

      for (const apiReq of apiRequests) {
        const local = localMap.get(apiReq.id);
        
        if (local) {
          // Update existing
          ops.push(
            local.prepareUpdate(req => {
              req.leaveTypeId = apiReq.leave_type_id;
              req.startDate = apiReq.start_date;
              req.endDate = apiReq.end_date;
              req.status = apiReq.status;
              req.reason = apiReq.reason;
              req.medicalReportUrl = apiReq.medical_report_url || null;
              req.daysRequested = apiReq.days_requested || null;
            })
          );
          localMap.delete(apiReq.id);
        } else {
          // Insert new
          ops.push(
            collection.prepareCreate(req => {
              req.remoteId = apiReq.id;
              req.leaveTypeId = apiReq.leave_type_id;
              req.startDate = apiReq.start_date;
              req.endDate = apiReq.end_date;
              req.status = apiReq.status;
              req.reason = apiReq.reason;
              req.medicalReportUrl = apiReq.medical_report_url || null;
              req.daysRequested = apiReq.days_requested || null;
            })
          );
        }
      }

      // Handle deletions: remove local requests that aren't in API, EXCEPT pending_sync ones
      for (const [_, local] of localMap) {
        if (local.status !== 'pending_sync') {
          ops.push(local.prepareDestroyPermanently());
        }
      }

      await database.batch(...ops);
    });
  }

  /**
   * Adds an optimistic leave request locally with 'pending_sync' status.
   */
  static async addOptimisticRequest(payload: LeaveSubmissionPayload): Promise<LeaveRequestModel> {
    let newRequest: LeaveRequestModel;
    await database.write(async () => {
      const collection = database.collections.get<LeaveRequestModel>('leave_requests');
      newRequest = await collection.create(req => {
        req.remoteId = null; // null indicates it hasn't synced to server
        req.leaveTypeId = payload.leave_type_id;
        req.startDate = payload.start_date;
        req.endDate = payload.end_date;
        req.status = 'pending_sync';
        req.reason = payload.reason;
        req.medicalReportUrl = payload.medical_report_url || null;
      });
    });
    return newRequest!;
  }

  /**
   * Syncs leave types mapping.
   */
  static async syncLeaveTypes(apiTypes: LeaveType[]) {
    await database.write(async () => {
      const collection = database.collections.get<LeaveTypeModel>('leave_types');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map(allLocal.map(t => [t.remoteId, t]));
      const ops: any[] = [];

      for (const apiType of apiTypes) {
        const local = localMap.get(apiType.id);
        
        if (local) {
          ops.push(
            local.prepareUpdate(t => {
              t.name = apiType.name;
              t.code = apiType.code;
              t.advanceNoticeDays = apiType.advance_notice_days || null;
              t.medicalReportAfterDays = apiType.medical_report_after_days || null;
            })
          );
          localMap.delete(apiType.id);
        } else {
          ops.push(
            collection.prepareCreate(t => {
              t.remoteId = apiType.id;
              t.name = apiType.name;
              t.code = apiType.code;
              t.advanceNoticeDays = apiType.advance_notice_days || null;
              t.medicalReportAfterDays = apiType.medical_report_after_days || null;
            })
          );
        }
      }

      for (const [_, local] of localMap) {
        ops.push(local.prepareDestroyPermanently());
      }

      await database.batch(...ops);
    });
  }

  /**
   * Syncs leave balances.
   */
  static async syncLeaveBalances(apiBalances: LeaveBalance[]) {
    await database.write(async () => {
      const collection = database.collections.get<LeaveBalanceModel>('leave_balances');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map(allLocal.map(b => [b.leaveTypeId, b]));
      const ops: any[] = [];

      for (const apiBal of apiBalances) {
        const local = localMap.get(apiBal.leave_type_id);
        
        if (local) {
          ops.push(
            local.prepareUpdate(b => {
              b.remoteId = apiBal.id || null;
              b.entitledDays = apiBal.entitled_days;
              b.usedDays = apiBal.used_days;
              b.carriedOverDays = apiBal.carried_over_days;
            })
          );
          localMap.delete(apiBal.leave_type_id);
        } else {
          ops.push(
            collection.prepareCreate(b => {
              b.remoteId = apiBal.id || null;
              b.leaveTypeId = apiBal.leave_type_id;
              b.entitledDays = apiBal.entitled_days;
              b.usedDays = apiBal.used_days;
              b.carriedOverDays = apiBal.carried_over_days;
            })
          );
        }
      }

      for (const [_, local] of localMap) {
        ops.push(local.prepareDestroyPermanently());
      }

      await database.batch(...ops);
    });
  }
}
