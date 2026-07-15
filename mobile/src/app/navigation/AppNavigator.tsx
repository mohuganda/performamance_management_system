import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { User, Calendar, Clock, CheckSquare, Home } from 'lucide-react-native';
import { ProfileScreen } from '../../modules/profile/ProfileScreen';
import { LeaveScreen } from '../../modules/leave/LeaveScreen';
import { LeaveRequestScreen } from '../../modules/leave/LeaveRequestScreen';
import { LeaveHistoryScreen } from '../../modules/leave/LeaveHistoryScreen';
import { OosScreen } from '../../modules/out-of-station/OosScreen';
import { AttendanceScreen } from '../../modules/attendance/AttendanceScreen';
import { ApprovalsScreen } from '../../modules/approvals/ApprovalsScreen';
import { NotificationsScreen } from '../../modules/notifications/NotificationsScreen';
import { HomeScreen } from '../../modules/home/HomeScreen';
import { AccountScreen } from '../../modules/account/AccountScreen';
import { SettingsScreen } from '../../modules/settings/SettingsScreen';
import { AppStackParamList, AppTabParamList } from './types';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../hooks/useTheme';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabNavigator() {
  const { hasPermission } = useAuthStore();
  const { colors } = useTheme();

  const showApprovals = hasPermission([
    'leave.requests.approve',
    'oos.requests.approve',
    'dashboard.supervisor',
    'dashboard.department_head',
    'dashboard.hr',
  ]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary, // primary theme color
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0, // for Android
          shadowOpacity: 0, // for iOS
          paddingBottom: 10,
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          title: 'Home',
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
          title: 'Duty Attendance',
        }}
      />
      <Tab.Screen
        name="Leave"
        component={LeaveScreen}
        options={{
          tabBarLabel: 'Leave',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
          title: 'Leave Manager',
        }}
      />
      {showApprovals && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{
            tabBarLabel: 'Approvals',
            tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
            title: 'Approvals Inbox',
          }}
        />
      )}
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          title: 'My Account',
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="OutOfStation" component={OosScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="LeaveHistory" component={LeaveHistoryScreen} />
    </Stack.Navigator>
  );
}
