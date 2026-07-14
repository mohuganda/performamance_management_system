# React Native Mobile App Implementation Plan — MoH Uganda PMS

Build a production-quality, offline-first React Native (CLI-based) mobile application for the **Ministry of Health Uganda Performance Management System**. The mobile app will replicate the web app's style tokens, atomic design layout, and business logic while offering offline data caching and request synchronization.

## Technical Alignment Summary

*   **Framework**: Pure React Native CLI (project folder: `/Volumes/Data/Projects/MoH/performamance_management_system/mobile`).
*   **Styling**: Nativewind v4 (Tailwind v3 engine for React Native).

*   **Offline-First Strategy**: Read caching via React Query + MMKV; write operations queued in a custom Zustand `syncStore` and processed via foreground synchronization.
*   **GPS Geofencing**: One-shot high-accuracy geolocation capture at the clock-in/out event via `react-native-geolocation-service`.
*   **Maps**: `react-native-maps` with Google Maps API key configured for Android, and standard Apple Maps for iOS.

---

## Detailed Phased Implementation Roadmap

### Phase 1: Project Setup, Metro/Babel configuration & Core Assets

#### 1. Project Initialization & CLI Setup
Initialize the project folder inside the parent directory:
```bash
npx react-native@latest init mobile --directory /Volumes/Data/Projects/MoH/performamance_management_system/mobile --skip-install
```
Clean up default assets, and construct the standard folder tree:
```text
src/
├── app/
│   ├── navigation/
│   └── providers/
├── api/
│   ├── client.ts
│   └── services/
├── theme/
│   └── colors.ts
├── components/
│   ├── atoms/
│   ├── molecules/
│   └── organisms/
├── modules/
│   ├── auth/
│   ├── profile/
│   ├── leave/
│   ├── out-of-station/
│   ├── attendance/
│   ├── approvals/
│   └── notifications/
├── stores/
└── utils/
```

#### 2. Dependency Specification
Add dependencies inside `package.json`:
*   **Navigation**: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`
*   **State & Client**: `zustand`, `@tanstack/react-query`, `axios`, `zod`
*   **Storage & Offline**: `react-native-mmkv` (as Zustand's persistent storage engine), `@react-native-community/netinfo`
*   **Hardware / Native**: `react-native-geolocation-service`, `react-native-maps`
*   **Styles & Icons**: `nativewind`, `tailwindcss` (v4), `lucide-react-native`
*   **Date & Utility**: `date-fns`, `react-native-modal-datetime-picker` (replaces standard DatePicker)
*   **Localization**: `i18next`, `react-i18next`

#### 3. Styling Engine & Compiler Config
Create `global.css` inside the root:
```css
@import "tailwindcss";
```
Wrap the Metro config (`metro.config.js`) with the Nativewind wrapper:
```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = mergeConfig(getDefaultConfig(__dirname), {
  // Metro configuration adjustments
});

module.exports = withNativeWind(config, { input: './global.css' });
```
Add the Babel compiler plugin inside `babel.config.js`:
```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['nativewind/babel'],
};
```
Initialize the theme variables in `src/theme/colors.ts` using the exact color codes from the frontend project:
```typescript
export const colors = {
  ui: {
    bg: '#F4F4F5',
    surface: '#FFFFFF',
    text: '#18181B',
    muted: '#71717A',
    border: '#E4E4E7',
    subtle: '#FAFAFA',
  },
  national: {
    black: '#1A1A1A',
    yellow: '#FCDC04',
    red: '#D90000',
  },
  success: '#15803D',
  warning: '#B45309',
  error: '#D90000',
} as const;

export const statusColors = {
  on_track: '#15803D',
  at_risk: '#B45309',
  off_track: '#D90000',
  below_target: '#B45309',
  exceeds_target: '#15803D',
} as const;
```

---

### Phase 2: Authentication & Profile Screens

#### 1. State Management (Zustand + MMKV)
Implement `src/stores/authStore.ts` utilizing MMKV for synchronous persistence:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'moh-pms-auth' });
const zustandStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: (name: string) => storage.getString(name) ?? null,
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  token: string | null;
  user: any | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: any) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setSession: (token, user) => set({ token, user, isAuthenticated: true }),
      clearSession: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
```

#### 2. Axios Client Setup
Configure `src/api/client.ts` to automatically inject authorization headers and redirect users on `401 Unauthorized` responses:
```typescript
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const apiClient = axios.create({
  baseURL: 'http://localhost:3030/api/v1', // backend url endpoint
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
```

#### 3. Core UI Elements (Replicating Web Style)
*   **Atoms**:
    *   `Button.tsx`: Rounded-lg primary/secondary layouts styled using Nativewind `className="bg-[#15803D] px-4 py-3 rounded-lg flex-row justify-center items-center"`.
    *   `Input.tsx`: Floating label or standard bordered text fields with error styles.
    *   `Card.tsx`: Shadowed white background container cards (`className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"`).
*   **Screens**:
    *   `LoginScreen.tsx`: Validated forms with Zod, calling `/api/v1/auth/login`. Handles TOTP requirements by navigating to the TOTP code validation screen.
    *   `ActivateScreen.tsx`: Setup page for password configuration and TOTP QR enrollment.
    *   `ProfileScreen.tsx`: Displays biodata (Surname, Firstname, IPPS), contract terms, facility mapping, and lists the sequential approvals supervisors hierarchy retrieved from the user session.

---

### Phase 3: Offline Sync Engine & GPS Configuration

#### 1. Native Configuration for GPS
*   **Android (`AndroidManifest.xml`)**:
    ```xml
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    ```
*   **iOS (`Info.plist`)**:
    ```xml
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>MoH Uganda PMS requires location access to clock-in at your duty station.</string>
    ```

#### 2. Network Status Monitor (`src/utils/network.ts`)
Create a provider subscribing to NetInfo updates and triggering the queue sync wrapper:
```typescript
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';

export function initNetworkListener() {
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      useSyncStore.getState().processQueue();
    }
  });
}
```

#### 3. Sync Store Implementation (`src/stores/syncStore.ts`)
Create a persistent queue manager storing unsynced writes:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import apiClient from '../api/client';

const syncStorage = new MMKV({ id: 'moh-pms-sync' });
const storageWrapper = {
  setItem: (name: string, value: string) => syncStorage.set(name, value),
  getItem: (name: string) => syncStorage.getString(name) ?? null,
  removeItem: (name: string) => syncStorage.delete(name),
};

export interface QueuedMutation {
  id: string;
  type: 'CLOCK' | 'LEAVE_REQUEST' | 'OOS_REQUEST';
  endpoint: string;
  payload: any;
}

interface SyncState {
  queue: QueuedMutation[];
  isSyncing: boolean;
  addMutation: (mutation: Omit<QueuedMutation, 'id'>) => void;
  processQueue: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      addMutation: (mutation) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ queue: [...state.queue, { ...mutation, id }] }));
        get().processQueue(); // attempt sync immediately if online
      },
      processQueue: async () => {
        const { queue, isSyncing } = get();
        if (queue.length === 0 || isSyncing) return;
        set({ isSyncing: true });

        const remainingQueue = [...queue];
        for (const mutation of queue) {
          try {
            await apiClient.post(mutation.endpoint, mutation.payload);
            remainingQueue.shift(); // remove item from top of queue on success
            set({ queue: [...remainingQueue] });
          } catch (err) {
            console.error('Failed to sync offline mutation', mutation.id, err);
            break; // Stop execution of the queue to keep order; retry on next connectivity change
          }
        }
        set({ isSyncing: false });
      },
    }),
    {
      name: 'sync-queue-storage',
      storage: createJSONStorage(() => storageWrapper),
    }
  )
);
```

---

### Phase 4: Leave Management Module

#### 1. Local Cache Setup with TanStack Query
Fetch leave configuration, balances, and request histories:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export function useLeaveBalances() {
  return useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/leave/balances');
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
}
```

#### 2. Offline Request Queueing
Within the `LeaveRequestScreen.tsx` screen, when submission is triggered:
```typescript
import { useSyncStore } from '../../stores/syncStore';
import NetInfo from '@react-native-community/netinfo';

const handleSubmit = async (formData: any) => {
  const connection = await NetInfo.fetch();
  if (!connection.isConnected) {
    // Save to local offline queue
    useSyncStore.getState().addMutation({
      type: 'LEAVE_REQUEST',
      endpoint: '/mobile/leave/requests',
      payload: formData,
    });
    alert('You are offline. Request queued for synchronization.');
    return;
  }
  // Otherwise, run API call directly
  await apiClient.post('/mobile/leave/requests', formData);
  alert('Leave request submitted successfully.');
};
```

#### 3. Screens
*   `LeaveBalancesScreen`: Shows visual cards styled with Nativewind progress circles representing remaining/used balance limits.
*   `LeaveRequestScreen`: Multi-step form selecting leave type, start/end dates, medical documents (via local file attachments), and reason.
*   `LeaveHistoryScreen`: Renders statements with statuses (`draft`, `pending`, `approved`, `rejected`), including sequence details (e.g. "Approved by Supervisor 1/2").

---

### Phase 5: Out of Station (OOS) & GPS Geofenced Attendance

#### 1. Out of Station Request with Interactive Map
*   **Package**: `react-native-maps`
*   **Workflow**: Inside `OosRequestScreen.tsx`, the user searches for or drops a pin on the map. The app extracts the geographical variables `destination_latitude` and `destination_longitude` along with address names.
*   **Offline Queueing**: Requests validate destination details using Zod locally and queue coordinates for backend upload when offline.

#### 2. GPS Verification Engine (`src/utils/haversine.ts`)
Compute distance locally to compare against geofence parameters (default 500m):
```typescript
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // returns distance in meters
}
```

#### 3. Clock In/Out verification with high-accuracy GPS
In `ClockInOutScreen.tsx`, when the user triggers the check-in:
1.  **Geolocation Check**: Obtain current location using `react-native-geolocation-service` in high-accuracy configuration:
    ```typescript
    import Geolocation from 'react-native-geolocation-service';

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // Proceed to check bounds
      },
      (error) => console.log(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    ```
2.  **Evaluate Geofence**:
    *   Compare current location against the approved OOS coordinates (obtained from `/mobile/out-of-station/requests` cached locally via TanStack Query).
    *   If current position is within the geofenced radius, assign `verification_status` to `"verified_oos"`.
    *   If coordinates are outside the bounds, assign status to `"outside_geofence"`.
    *   If no OOS is active, default status to `"at_duty_station"`.
3.  **Submit or Queue**: Send payload to `/mobile/attendance/clock` or append to `syncStore` if offline.

---

### Phase 6: Approvals Queue & System Notifications

#### 1. Approvals Screen Layout
*   **API**: `/mobile/approvals/inbox` (combining Leave, Out-Of-Station, and Appraisals requests into a single list).
*   **Design**: Replicate the supervisor approvals dashboard with simple tabs. Displays summary cards (e.g. applicant name, date range, destination details, attachments).
*   **Action**: Approve/Reject buttons with comments fields mapping to:
    *   `/mobile/leave/approvals/{id}`
    *   `/mobile/out-of-station/approvals/{id}`

#### 2. Notifications Screen Layout
*   **API**: `/notifications` (read/unread summaries).
*   **Design**: List layout showing alert category icons (e.g. Clock, Calendar, Warning) using Lucide React Native, bold/normal text for unread states, and a single-tap action to mark notifications as read (`POST /api/v1/notifications/{id}/read`).

---

## Verification Plan

### Simulated Offline & Online Verification (automated scripts)
Run unit tests mock verifying:
1.  `syncStore` queue serialization and correct storage in MMKV.
2.  Sequential query triggers when `NetInfo` state transitions from `false` to `true`.
3.  `haversine.ts` accuracy against distance benchmarks.

### Manual Verification
1.  **Login & Session**: Sign in using credentials (`worker@moh.go.ug` / `Demo@Moh2026!`). Close and relaunch the app; verify the profile screen populates instantly from MMKV session records.
2.  **Offline writes logic**: Go to airplane mode.
    *   Request a Leave range. Verify that the UI displays a "Request saved locally (offline)" indicator.
    *   Perform a check-in clock action. Verify it is saved locally.
3.  **Re-connect & Sync**: Turn off airplane mode.
    *   Check that the UI connection banner updates from "Offline" to "Connected".
    *   Verify that backend endpoints receive the requests in the correct chronological order.
4.  **Geofence Validation**: Trigger simulated coordinate updates in emulator:
    *   Verify that clocking-in within 200m of OOS yields `verified_oos` status on backend.
    *   Verify that clocking-in 1km away yields `outside_geofence`.
