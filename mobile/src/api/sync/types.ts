export interface QueuedMutation {
  id: string;
  type: 'CLOCK' | 'LEAVE_REQUEST' | 'OOS_REQUEST' | 'APPROVAL_ACTION';
  endpoint: string;
  payload: any;
}
