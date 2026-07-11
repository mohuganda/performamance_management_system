import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/api/services/auth'
import { setAuthToken } from '@/api/client'
import { resolveDashboardPermission } from '@/app/navigation/navItems'

export type UserRole =
  | 'health_worker'
  | 'supervisor'
  | 'department_head'
  | 'hr_manager'
  | 'admin'
  | 'director'
  | 'executive'

interface AuthState {
  token: string | null
  role: UserRole
  roles: string[]
  permissions: string[]
  staffId: number | null
  displayName: string
  email: string
  profilePhoto: string | null
  quarter: string
  isAuthenticated: boolean
  authReady: boolean
  login: (email: string, password: string) => Promise<void>
  clearSession: () => void
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  refreshProfile: () => Promise<void>
  setQuarter: (quarter: string) => void
  hydrateToken: () => void
  hasPermission: (code: string | string[]) => boolean
}

function mapRoleFromPermissions(permissions: string[]): UserRole {
  const resolved = resolveDashboardPermission(permissions)
  if (resolved === 'executive') return 'executive' as UserRole
  if (resolved === 'director') return 'director' as UserRole
  return resolved as UserRole
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: 'health_worker',
      roles: [],
      permissions: [],
      staffId: null,
      displayName: 'MoH User',
      email: '',
      profilePhoto: null,
      quarter: 'Q1 (July - September 2026)',
      isAuthenticated: false,
      authReady: false,

      hydrateToken: () => {
        const token = get().token
        setAuthToken(token)
        set({ isAuthenticated: Boolean(token), authReady: true })
      },

      hasPermission: (code) => {
        const { permissions, roles } = get()
        if (roles.includes('super_admin')) return true
        const codes = Array.isArray(code) ? code : [code]
        return codes.some((c) => permissions.includes(c))
      },

      refreshProfile: async () => {
        const me = await authService.me()
        const permissions: string[] = me.permissions ?? []
        const photo =
          me.user?.ProfilePhoto ?? me.user?.profile_photo ?? null
        set({
          displayName: me.user?.Name || get().displayName,
          email: me.user?.Email || get().email,
          profilePhoto: photo,
          roles: me.roles ?? [],
          permissions,
          staffId: me.staff_id ?? null,
          role: mapRoleFromPermissions(permissions),
        })
      },

      login: async (email, password) => {
        const result = await authService.login(email, password)
        setAuthToken(result.token)
        const permissions = result.permissions ?? []
        set({
          token: result.token,
          email: result.user.Email,
          displayName: result.user.Name || 'MoH User',
          roles: result.roles ?? [],
          permissions,
          isAuthenticated: true,
          authReady: true,
          role: mapRoleFromPermissions(permissions),
        })
        try {
          await get().refreshProfile()
        } catch {
          // profile refresh is best-effort after login
        }
      },

      clearSession: () => {
        setAuthToken(null)
        set({
          token: null,
          isAuthenticated: false,
          email: '',
          profilePhoto: null,
          roles: [],
          permissions: [],
          staffId: null,
        })
      },

      logout: async () => {
        const hadToken = Boolean(get().token)
        if (hadToken) {
          try {
            await authService.logout()
          } catch {
            // server logout is best-effort (token may already be expired)
          }
        }
        get().clearSession()
      },

      refreshSession: async () => {
        const result = await authService.refresh()
        setAuthToken(result.token)
        set({ token: result.token, isAuthenticated: true })
      },

      setQuarter: (quarter) => set({ quarter }),
    }),
    {
      name: 'moh-pms-auth',
      partialize: (state) => ({
        token: state.token,
        role: state.role,
        roles: state.roles,
        permissions: state.permissions,
        staffId: state.staffId,
        displayName: state.displayName,
        email: state.email,
        profilePhoto: state.profilePhoto,
        quarter: state.quarter,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrateToken()
      },
    },
  ),
)

interface UiState {
  adminMenuOpen: boolean
  setAdminMenuOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  adminMenuOpen: false,
  setAdminMenuOpen: (open) => set({ adminMenuOpen: open }),
}))
