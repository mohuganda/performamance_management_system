import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/storage';
import apiClient, { setAuthToken } from '../api/client';
import authService from '../api/auth/service';
import { AuthUser } from '../api/auth/types';
import { queryClient } from '../queryClient';
import { clearUserCache } from '../utils/userCache';
import { useSyncStore } from './syncStore';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  staffId: number | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<any>;
  completeLogin: (token: string, responseData: any) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hydrateToken: () => void;
  hasPermission: (code: string | string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      roles: [],
      permissions: [],
      staffId: null,
      isAuthenticated: false,
      authReady: false,

      hydrateToken: () => {
        const token = get().token;
        setAuthToken(token);
        set({ isAuthenticated: Boolean(token), authReady: true });
      },

      hasPermission: (code) => {
        const { permissions, roles } = get();
        if (roles.includes('super_admin') || roles.includes('admin')) return true;
        const codes = Array.isArray(code) ? code : [code];
        return codes.some((c) => permissions.includes(c));
      },

      completeLogin: (token, data) => {
        const prevUserId = get().user?.id || get().staffId;
        const newUserId = data.user?.id || data.staff_id;

        if (prevUserId && newUserId && String(prevUserId) !== String(newUserId)) {
          // If switching accounts without explicit logout: purge old user cache
          queryClient.clear();
          clearUserCache(prevUserId);
          useSyncStore.getState().clearAllQueues();
        }

        setAuthToken(token);
        set({
          token,
          user: data.user || null,
          roles: data.roles || [],
          permissions: data.permissions || [],
          staffId: data.staff_id || null,
          isAuthenticated: true,
        });
      },

      login: async (email, password) => {
        const result = await authService.login({ email, password });
        if (result.token && !result.requires_totp) {
          get().completeLogin(result.token, result);
        }
        return result;
      },

      refreshProfile: async () => {
        try {
          const res = await apiClient.get('/auth/me');
          const me = res.data;
          set({
            user: me.user || null,
            roles: me.roles || [],
            permissions: me.permissions || [],
            staffId: me.staff_id || null,
          });
        } catch (err) {
          console.error('Failed to refresh profile', err);
        }
      },

      logout: async () => {
        const currentUserId = get().user?.id || get().staffId;

        apiClient.post('/auth/logout', {}, { skipAuthHandler: true }).catch((err) => {
          console.warn('Background logout call failed:', err);
        });

        setAuthToken(null);

        // Wipe query cache so no user data remains in memory
        queryClient.clear();

        // Clear user-scoped local storage cache & legacy caches
        clearUserCache(currentUserId);

        // Clear any pending sync mutations belonging to this session
        useSyncStore.getState().clearAllQueues();

        set({
          token: null,
          user: null,
          roles: [],
          permissions: [],
          staffId: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'moh-pms-auth-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        roles: state.roles,
        permissions: state.permissions,
        staffId: state.staffId,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrateToken();
      },
    }
  )
);

