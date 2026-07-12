import apiClient from '../client'

export interface LoginResponse {
  token?: string
  token_type?: string
  expires_in_minutes?: number
  user?: {
    id: number
    Name: string
    Email: string
    Role: string
  }
  roles?: string[]
  permissions?: string[]
  must_change_password?: boolean
  requires_totp?: boolean
  login_challenge?: string
}

export interface ActivationPreview {
  email: string
  staff_id: number
  staff_name: string
  has_account: boolean
  expires_at: string
}

export interface TotpEnrollResult {
  secret: string
  otpauth_url: string
  qr_code_data_url: string
}

export interface MeAccountInfo {
  is_active?: boolean
  must_change_password?: boolean
  last_login_at?: string | null
  password_changed_at?: string | null
  totp_enabled?: boolean
  activation_completed_at?: string | null
}

export interface StaffProfileDetail {
  staff_id: number
  ihris_pid: string
  name: string
  firstname?: string
  surname?: string
  othername?: string
  nin?: string
  gender?: string
  email?: string
  mobile?: string
  telephone?: string
  cadre?: string
  region?: string
  job_title?: string
  facility_name?: string
  institution_type?: string
  department_name?: string
  hr_department_name?: string
  division?: string
  section?: string
  unit?: string
  district_name?: string
  employment_terms?: string
  salary_grade?: string
  supervisor_name?: string
  ihris_last_sync_at?: string
}

export interface MeResponse {
  user: {
    id: number
    Name: string
    Email: string
    Role?: string
    IsActive?: boolean
    MustChangePassword?: boolean
    LastLoginAt?: string | null
    PasswordChangedAt?: string | null
    ProfilePhoto?: string | null
    SignatureImage?: string | null
    SignatureUpdatedAt?: string | null
    profile_photo?: string | null
    signature_image?: string | null
    signature_updated_at?: string | null
  }
  roles: string[]
  permissions: string[]
  staff_id: number | null
  staff?: StaffProfileDetail | null
  account?: MeAccountInfo
}

export interface UpdateProfilePayload {
  profile_photo?: string
  signature_image?: string
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password })
    return data
  },
  me: async (): Promise<MeResponse> => {
    const { data } = await apiClient.get<MeResponse>('/auth/me')
    return data
  },
  updateProfile: async (payload: UpdateProfilePayload) => {
    const { data } = await apiClient.put('/auth/profile', payload)
    return data
  },
  logout: async () => {
    await apiClient.post('/auth/logout', {}, { skipAuthHandler: true })
  },
  refresh: async (): Promise<{ token: string; token_type: string }> => {
    const { data } = await apiClient.post<{ token: string; token_type: string }>('/auth/refresh')
    return data
  },
  requestActivation: async (email: string) => {
    const { data } = await apiClient.post<{ message: string }>('/auth/request-activation', { email })
    return data
  },
  previewActivation: async (token: string): Promise<ActivationPreview> => {
    const { data } = await apiClient.get<ActivationPreview>(`/auth/activation/${encodeURIComponent(token)}`)
    return data
  },
  completeActivation: async (payload: {
    token: string
    password: string
    name?: string
  }): Promise<LoginResponse & { needs_profile_setup?: boolean }> => {
    const { data } = await apiClient.post('/auth/activation/complete', payload)
    return data
  },
  loginTotp: async (loginChallenge: string, code: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login/totp', {
      login_challenge: loginChallenge,
      code,
    })
    return data
  },
  totpStatus: async (): Promise<{ enabled: boolean; confirmed_at?: string | null }> => {
    const { data } = await apiClient.get('/auth/totp/status')
    return data
  },
  totpEnroll: async (): Promise<TotpEnrollResult> => {
    const { data } = await apiClient.post<TotpEnrollResult>('/auth/totp/enroll')
    return data
  },
  totpConfirm: async (code: string) => {
    const { data } = await apiClient.post<{ message: string }>('/auth/totp/confirm', { code })
    return data
  },
  totpDisable: async (code: string) => {
    const { data } = await apiClient.post<{ message: string }>('/auth/totp/disable', { code })
    return data
  },
}
