export type AuthStackParamList = {
  Login: undefined;
  Activate: { token?: string } | undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Notifications: undefined;
  Settings: undefined;
  OutOfStation: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Attendance: undefined;
  Leave: undefined;
  Approvals: undefined;
  Account: undefined;
};
