export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface ApiErrorDetail {
  detail: string | Array<{ msg: string; loc: (string | number)[] }>;
}
