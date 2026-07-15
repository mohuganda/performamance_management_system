export interface ClockRequest {
  action: 'in' | 'out';
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  notes?: string;
}

export interface ClockResponse {
  id: number;
  action: 'in' | 'out';
  clocked_at: string;
  created_at?: string;
  latitude: number;
  longitude: number;
  verified?: boolean;
  within_geofence?: boolean;
  notes?: string;
}

export interface ClockListParams {
  from?: string;
  to?: string;
}
