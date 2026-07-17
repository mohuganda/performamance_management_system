import { database } from '../index';
import OosRequestModel from '../models/OosRequest';
import { OosRequest, OosSubmissionPayload } from '../../api/out-of-station/types';

export class OosDbService {
  /**
   * Syncs fetched OOS requests to the local DB.
   * Prevents overwriting local requests that are pending sync (where remoteId is null).
   */
  static async syncRequests(apiRequests: OosRequest[]) {
    await database.write(async () => {
      const collection = database.collections.get<OosRequestModel>('oos_requests');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map();
      
      for (const req of allLocal) {
        if (req.remoteId !== null) {
          localMap.set(req.remoteId, req);
        }
      }

      const ops: any[] = [];

      for (const apiReq of apiRequests) {
        const local = localMap.get(apiReq.id);
        
        if (local) {
          ops.push(
            local.prepareUpdate((req: OosRequestModel) => {
              req.reasonId = apiReq.reason_id;
              req.startDate = apiReq.start_date;
              req.endDate = apiReq.end_date;
              req.remarks = apiReq.remarks || null;
              req.expectedDeliverables = apiReq.expected_deliverables || null;
              req.attachmentUrl = apiReq.attachment_url || null;
              req.destinationName = apiReq.destination_name;
              req.destinationAddress = apiReq.destination_address || null;
              req.destinationLatitude = apiReq.destination_latitude;
              req.destinationLongitude = apiReq.destination_longitude;
              req.geofenceRadiusMeters = apiReq.geofence_radius_meters;
              req.status = apiReq.status;
              req.createdAt = apiReq.created_at || null;
              req.submittedAt = apiReq.submitted_at || null;
              req.staffName = apiReq.staff_name || null;
            })
          );
          localMap.delete(apiReq.id);
        } else {
          ops.push(
            collection.prepareCreate((req: OosRequestModel) => {
              req.remoteId = apiReq.id;
              req.reasonId = apiReq.reason_id;
              req.startDate = apiReq.start_date;
              req.endDate = apiReq.end_date;
              req.remarks = apiReq.remarks || null;
              req.expectedDeliverables = apiReq.expected_deliverables || null;
              req.attachmentUrl = apiReq.attachment_url || null;
              req.destinationName = apiReq.destination_name;
              req.destinationAddress = apiReq.destination_address || null;
              req.destinationLatitude = apiReq.destination_latitude;
              req.destinationLongitude = apiReq.destination_longitude;
              req.geofenceRadiusMeters = apiReq.geofence_radius_meters;
              req.status = apiReq.status;
              req.createdAt = apiReq.created_at || null;
              req.submittedAt = apiReq.submitted_at || null;
              req.staffName = apiReq.staff_name || null;
            })
          );
        }
      }

      // Handle deletions: remove local requests that aren't in API, EXCEPT those with remoteId === null (pending sync)
      for (const [_, local] of localMap) {
        ops.push(local.prepareDestroyPermanently());
      }

      await database.batch(...ops);
    });
  }

  /**
   * Adds an optimistic OOS request locally with no remoteId.
   */
  static async addOptimisticRequest(payload: OosSubmissionPayload): Promise<OosRequestModel> {
    let newReq: OosRequestModel;
    await database.write(async () => {
      const collection = database.collections.get<OosRequestModel>('oos_requests');
      newReq = await collection.create((req: OosRequestModel) => {
        req.remoteId = null; // null indicates it hasn't synced to server
        req.reasonId = payload.reason_id;
        req.startDate = payload.start_date;
        req.endDate = payload.end_date;
        req.remarks = payload.remarks || null;
        req.expectedDeliverables = payload.expected_deliverables || null;
        req.attachmentUrl = payload.attachment_url || null;
        req.destinationName = payload.destination_name;
        req.destinationAddress = payload.destination_address || null;
        req.destinationLatitude = payload.destination_latitude;
        req.destinationLongitude = payload.destination_longitude;
        req.geofenceRadiusMeters = payload.geofence_radius_meters ?? 500;
        req.status = 'pending_sync';
        req.createdAt = new Date().toISOString();
        req.submittedAt = new Date().toISOString();
        req.staffName = null;
      });
    });
    return newReq!;
  }
}
