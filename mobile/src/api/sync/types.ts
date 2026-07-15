export interface QueuedMutation {
  id: string;
  type: 'CLOCK' | 'LEAVE_REQUEST' | 'OOS_REQUEST';
  endpoint: string;
  payload: any;
}
