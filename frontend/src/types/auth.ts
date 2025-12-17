// Authentication and User Types

export type UserRole = 'viewer' | 'operator' | 'developer' | 'admin';

export interface User {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  use_custom_permissions?: boolean;
  custom_permissions?: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  user: User;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface PasswordResetRequest {
  new_password: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  username: string;
  action: string;
  resource_type: string;
  resource_name?: string;
  namespace?: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}
