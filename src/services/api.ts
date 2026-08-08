const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
      full_name: string | null;
      is_active: boolean;
    };
    token: string;
  };
}

export interface ApiError {
  error: string;
  message?: string;
}

import { storage } from '../utils/storage';

class ApiService {
  private getAuthToken(): string | null {
    return storage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'An error occurred');
    }

    return data;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  logout() {
    storage.removeItem('auth_token');
    storage.removeItem('user');
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
}

export const apiService = new ApiService();

