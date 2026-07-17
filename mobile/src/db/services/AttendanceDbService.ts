import { database } from '../index';
import AttendanceLog from '../models/AttendanceLog';
import { ClockResponse, ClockRequest } from '../../api/attendance/types';

export class AttendanceDbService {
  /**
   * Syncs fetched clock requests to the local DB.
   * Prevents overwriting local requests that are pending sync (where remoteId is null).
   */
  static async syncClocks(apiClocks: ClockResponse[]) {
    await database.write(async () => {
      const collection = database.collections.get<AttendanceLog>('attendance_logs');
      const allLocal = await collection.query().fetch();
      
      const localMap = new Map();
      
      for (const log of allLocal) {
        if (log.remoteId !== null) {
          localMap.set(log.remoteId, log);
        }
      }

      const ops: any[] = [];

      for (const apiClock of apiClocks) {
        const local = localMap.get(apiClock.id);
        
        if (local) {
          ops.push(
            local.prepareUpdate((log: AttendanceLog) => {
              log.action = apiClock.action;
              log.clockedAt = apiClock.clocked_at;
              log.createdAt = apiClock.created_at || null;
              log.latitude = apiClock.latitude;
              log.longitude = apiClock.longitude;
              log.accuracyMeters = apiClock.accuracy_meters || null;
              log.verified = apiClock.verified ?? null;
              log.withinGeofence = apiClock.within_geofence ?? null;
              log.notes = apiClock.notes || null;
              log.locationLabel = apiClock.location_label || null;
              log.verificationStatus = apiClock.verification_status || null;
              log.distanceFromDestinationMeters = apiClock.distance_from_destination_meters ?? null;
            })
          );
          localMap.delete(apiClock.id);
        } else {
          ops.push(
            collection.prepareCreate((log: AttendanceLog) => {
              log.remoteId = apiClock.id;
              log.action = apiClock.action;
              log.clockedAt = apiClock.clocked_at;
              log.createdAt = apiClock.created_at || null;
              log.latitude = apiClock.latitude;
              log.longitude = apiClock.longitude;
              log.accuracyMeters = apiClock.accuracy_meters || null;
              log.verified = apiClock.verified ?? null;
              log.withinGeofence = apiClock.within_geofence ?? null;
              log.notes = apiClock.notes || null;
              log.locationLabel = apiClock.location_label || null;
              log.verificationStatus = apiClock.verification_status || null;
              log.distanceFromDestinationMeters = apiClock.distance_from_destination_meters ?? null;
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
   * Adds an optimistic clock locally with no remoteId.
   */
  static async addOptimisticClock(payload: ClockRequest): Promise<AttendanceLog> {
    let newLog: AttendanceLog;
    await database.write(async () => {
      const collection = database.collections.get<AttendanceLog>('attendance_logs');
      newLog = await collection.create((log: AttendanceLog) => {
        log.remoteId = null; // null indicates it hasn't synced to server
        log.action = payload.action;
        log.clockedAt = payload.clocked_at || new Date().toISOString();
        log.createdAt = new Date().toISOString();
        log.latitude = payload.latitude;
        log.longitude = payload.longitude;
        log.accuracyMeters = payload.accuracy_meters || null;
        log.verified = null;
        log.withinGeofence = null;
        log.notes = payload.notes || null;
        log.locationLabel = payload.location_label || null;
        log.verificationStatus = 'pending';
        log.distanceFromDestinationMeters = null;
      });
    });
    return newLog!;
  }
}
