export type AuthStackParamList = {
  Login: undefined;
  Activate: { token?: string } | undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Leave: undefined;
  OutOfStation: undefined;
  Attendance: undefined;
  Approvals: undefined;
  Notifications: undefined;
};
