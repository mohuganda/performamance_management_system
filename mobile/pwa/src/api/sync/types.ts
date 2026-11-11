export interface QueuedMutation {
  id: string;
  type: 'CLOCK' | 'LEAVE_REQUEST' | 'OOS_REQUEST' | 'APPROVAL_ACTION' | 'PROFILE_UPDATE' | 'MARK_NOTIFICATION_READ' | 'MARK_ALL_NOTIFICATIONS_READ';
  endpoint: string;
  payload: any;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  localRecordId?: string;
  modelTable?: string;
}
