import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { User, Calendar, MapPin, Clock, CheckSquare, Bell } from 'lucide-react-native';
import { ProfileScreen } from '../../modules/profile/ProfileScreen';
import { LeaveScreen } from '../../modules/leave/LeaveScreen';
import { OosScreen } from '../../modules/out-of-station/OosScreen';
import { AttendanceScreen } from '../../modules/attendance/AttendanceScreen';
import { ApprovalsScreen } from '../../modules/approvals/ApprovalsScreen';
import { NotificationsScreen } from '../../modules/notifications/NotificationsScreen';
import { AppTabParamList } from './types';
import { useAuthStore } from '../../stores/authStore';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppNavigator() {
  const { hasPermission } = useAuthStore();

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
        tabBarActiveTintColor: colors.primary.DEFAULT, // primary black
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.ui.text,
          fontSize: 18,
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          title: 'Staff Profile',
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
      <Tab.Screen
        name="OutOfStation"
        component={OosScreen}
        options={{
          tabBarLabel: 'OOS',
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
          title: 'Out of Station',
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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          title: 'Alerts & Notifications',
        }}
      />
    </Tab.Navigator>
  );
}
