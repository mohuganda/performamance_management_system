export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  requires_totp?: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    profile_photo?: string | null;
  };
  roles?: string[];
  permissions?: string[];
  staff_id?: number | null;
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
