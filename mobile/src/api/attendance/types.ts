export interface ClockRequest {
  action: 'in' | 'out';
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  notes?: string;
  clocked_at?: string;
  location_label?: string;
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
}

export interface ClockListParams {
  from?: string;
  to?: string;
}
