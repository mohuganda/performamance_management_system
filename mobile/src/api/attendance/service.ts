import apiClient from '../client';
import { ClockRequest, ClockResponse, ClockListParams } from './types';

// Helper to normalize PascalCase keys (from Go backend) or snake_case/camelCase
function getField<T>(row: any, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key] as T;
    }
  }
  return undefined;
}

export const attendanceService = {
  async clock(payload: ClockRequest): Promise<ClockResponse> {
    const clockType = payload.clock_type || payload.action || 'in';
    const body: Record<string, any> = {
      clock_type: clockType,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy_meters: payload.accuracy_meters ?? 0,
      location_label: payload.location_label || '',
    };

    if (payload.out_of_station_request_id !== undefined && payload.out_of_station_request_id !== null) {
      body.out_of_station_request_id = payload.out_of_station_request_id;
    }

    if (payload.notes) {
      body.notes = payload.notes;
    }

    const res = await apiClient.post<any>('/mobile/attendance/clock', body);
    const row = res.data;
    const status = String(getField<string>(row, 'verification_status', 'VerificationStatus') ?? 'pending').toLowerCase();
    
    return {
      id: Number(getField<number>(row, 'id', 'ID')),
      action: String(getField<string>(row, 'clock_type', 'ClockType') ?? '').toLowerCase() as any,
      clocked_at: String(getField<string>(row, 'clocked_at', 'ClockedAt') ?? ''),
      latitude: Number(getField<number>(row, 'latitude', 'Latitude') ?? 0),
      longitude: Number(getField<number>(row, 'longitude', 'Longitude') ?? 0),
      accuracy_meters: getField<number>(row, 'accuracy_meters', 'AccuracyMeters'),
      notes: getField<string>(row, 'notes', 'Notes') || getField<string>(row, 'location_label', 'LocationLabel'),
      location_label: getField<string>(row, 'location_label', 'LocationLabel'),
      verification_status: status,
      distance_from_destination_meters: getField<number>(row, 'distance_from_destination_meters', 'DistanceFromDestinationMeters'),
      verified: status === 'verified_oos' || status === 'at_duty_station',
      within_geofence: status === 'verified_oos',
      out_of_station_request_id: getField<number>(row, 'out_of_station_request_id', 'OutOfStationRequestID', 'OutOfStationRequestId') ?? payload.out_of_station_request_id ?? null,
    };
  },

  async listClocks(params?: ClockListParams): Promise<ClockResponse[]> {
    const res = await apiClient.get<any[]>('/mobile/attendance/clocks', { params });
    if (!Array.isArray(res.data)) return [];
    
    return res.data.map((row: any): ClockResponse => {
      const status = String(getField<string>(row, 'verification_status', 'VerificationStatus') ?? 'pending').toLowerCase();
      const actionValue = (getField<string>(row, 'clock_type', 'ClockType') || getField<string>(row, 'action', 'Action') || '').toLowerCase();
      
      return {
        id: Number(getField<number>(row, 'id', 'ID')),
        action: actionValue as any,
        clocked_at: String(getField<string>(row, 'clocked_at', 'ClockedAt') ?? ''),
        latitude: Number(getField<number>(row, 'latitude', 'Latitude') ?? 0),
        longitude: Number(getField<number>(row, 'longitude', 'Longitude') ?? 0),
        accuracy_meters: getField<number>(row, 'accuracy_meters', 'AccuracyMeters'),
        notes: getField<string>(row, 'notes', 'Notes'),
        location_label: getField<string>(row, 'location_label', 'LocationLabel'),
        verification_status: status,
        distance_from_destination_meters: getField<number>(row, 'distance_from_destination_meters', 'DistanceFromDestinationMeters'),
        verified: status === 'verified_oos' || status === 'at_duty_station',
        within_geofence: status === 'verified_oos',
        out_of_station_request_id: getField<number>(row, 'out_of_station_request_id', 'OutOfStationRequestID', 'OutOfStationRequestId') ?? null,
      };
    });
  },
};

export default attendanceService;
