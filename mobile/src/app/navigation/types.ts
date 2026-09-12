export type AuthStackParamList = {
  Login: undefined;
  Activate: { token?: string } | undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Notifications: undefined;
  Settings: undefined;
  OutOfStation: { initialTab?: 'history' | 'apply' | 'approvals' } | undefined;
  OutOfStationDetails: { requestId: number | string };
  LeaveRequest: { editMode?: boolean; localRecordId?: string } | undefined;
  LeaveHistory: undefined;
  SyncIssues: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Attendance: undefined;
  Leave: undefined;
  Approvals: undefined;
  Account: undefined;
};
