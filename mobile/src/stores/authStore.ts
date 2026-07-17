import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import apiClient, { setAuthToken } from '../api/client';
import authService from '../api/auth/service';
import { queryClient } from '../app/queryClient';

const storage = createMMKV({ id: 'moh-pms-auth' });
const mmkvStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: (name: string) => storage.getString(name) ?? null,
  removeItem: (name: string) => storage.remove(name),
};

import { AuthUser } from '../api/auth/types';

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
        // Invalidate cached data immediately
        queryClient.clear();

        // Fire and forget server logout call in the background
        apiClient.post('/auth/logout', {}, { skipAuthHandler: true }).catch((err) => {
          console.warn('Background logout call failed:', err);
        });

        // Instantly transition local state to unauthenticated
        setAuthToken(null);
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
      storage: createJSONStorage(() => mmkvStorage),
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
