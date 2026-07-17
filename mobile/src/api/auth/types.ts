export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  Name: string;
  Email: string;
  Role: string;
  IsActive?: boolean;
  LastLoginAt?: string | null;
  MustChangePassword?: boolean;
  PasswordChangedAt?: string | null;
  ProfilePhoto?: string | null;
  SignatureImage?: string | null;
  SignatureUpdatedAt?: string | null;
  TotpEnabled?: boolean;
}

export interface StaffDetail {
  staff_id: number;
  ihris_pid: string;
  name: string;
  firstname?: string;
  surname?: string;
  nin?: string;
  mobile?: string;
  job_title?: string;
  facility_name?: string;
  institution_type?: string;
  district_name?: string;
  cadre?: string;
  department_name?: string;
  salary_grade?: string;
  gender?: string;
  ipps?: string;
  Contracts?: any[];
  contracts?: any[];
}

export interface AccountInfo {
  activation_completed_at?: string | null;
  is_active?: boolean;
  last_login_at?: string | null;
  must_change_password?: boolean;
  password_changed_at?: string | null;
  totp_enabled?: boolean;
}

export interface LoginResponse {
  token?: string;
  requires_totp?: boolean;
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
  staff_id?: number | null;
}

export interface UpdateProfilePayload {
  profile_photo?: string;
  signature_image?: string;
}

export interface MeResponse {
  account?: AccountInfo;
  permissions?: string[];
  roles?: string[];
  staff?: StaffDetail;
  staff_id?: number | null;
  user?: AuthUser;
}

export interface RequestActivationRequest {
  email: string;
}

export interface RequestActivationResponse {
  message?: string;
}

export interface CompleteActivationRequest {
  email: string;
  token: string;
  password: string;
}

export interface CompleteActivationResponse {
  message?: string;
}
