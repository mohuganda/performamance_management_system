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

export interface StaffSupervisor {
  sequence?: number;
  supervisor_staff_id?: number;
  supervisor_name: string;
  supervisor_job_title?: string;
}

export interface EffectiveDutyStation {
  latitude: number;
  longitude: number;
  label: string;
  radius_meters: number;
  source: string;
}

export interface StaffDetail {
  staff_id: number;
  ihris_pid: string;
  name: string;
  firstname?: string;
  surname?: string;
  nin?: string;
  gender?: string;
  email?: string;
  mobile?: string;
  cadre?: string;
  region?: string;
  job_title?: string;
  facility_id?: number;
  facility_name?: string;
  facility_latitude?: number;
  facility_longitude?: number;
  institution_type?: string;
  department_name?: string;
  hr_department_name?: string;
  district_name?: string;
  employment_terms?: string;
  supervisor_name?: string;
  supervisors?: StaffSupervisor[];
  ihris_last_sync_at?: string;
  effective_duty_station?: EffectiveDutyStation;
  salary_grade?: string;
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
