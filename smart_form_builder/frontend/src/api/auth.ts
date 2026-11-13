import api from './axios';
import { User, SignupPayload, LoginResponse } from '@/types/auth';

export const signup = async (payload: SignupPayload): Promise<User> => {
  const response = await api.post<User>('/auth/signup', payload);
  return response.data;
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await api.post<LoginResponse>('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/auth/me');
  return response.data;
};
