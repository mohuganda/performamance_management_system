export interface ClockRequest {
  action?: 'in' | 'out';
  clock_type?: 'in' | 'out';
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  notes?: string;
  clocked_at?: string;
  location_label?: string;
  out_of_station_request_id?: number | null;
}

export interface ClockResponse {
  id: number;
  entry_id?: string;
  staff_id?: number;
  action: 'in' | 'out';
  clock_type?: 'in' | 'out';
  clock_date?: string;
  clocked_at: string;
  created_at?: string;
  updated_at?: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  source?: string;
  verified?: boolean;
  within_geofence?: boolean;
  notes?: string;
  location_label?: string;
  verification_status?: string;
  distance_from_destination_meters?: number;
  location_accuracy_percent?: number;
  out_of_station_request_id?: number | null;
  isOfflinePending?: boolean;
}

export interface ClockListParams {
  from?: string;
  to?: string;
}
