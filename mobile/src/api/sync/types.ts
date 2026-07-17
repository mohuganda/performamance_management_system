export interface QueuedMutation {
  id: string;
  type: 'CLOCK' | 'LEAVE_REQUEST' | 'OOS_REQUEST' | 'APPROVAL_ACTION' | 'PROFILE_UPDATE';
  endpoint: string;
  payload: any;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}
