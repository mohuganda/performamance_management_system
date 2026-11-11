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
  action: 'in' | 'out';
  clocked_at: string;
  created_at?: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  verified?: boolean;
  within_geofence?: boolean;
  notes?: string;
  location_label?: string;
  verification_status?: string;
  distance_from_destination_meters?: number;
  out_of_station_request_id?: number | null;
}

export interface ClockListParams {
  from?: string;
  to?: string;
}
