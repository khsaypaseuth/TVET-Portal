const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

import { storage } from '../utils/storage';

export interface ActivityListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
}

function toQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  return q.toString();
}

export interface User {
  id: number;
  username: string;
  staff_code?: string;
  email: string;
  role: string;
  role_code?: string;
  role_id?: number;
  role_name_en?: string | null;
  role_name_lo?: string | null;
  full_name: string | null;
  first_name_lo?: string | null;
  last_name_lo?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  phone?: string | null;
  bio?: string | null;
  country?: string | null;
  city?: string | null;
  postal_code?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  avatar_path?: string | null;
  position_id?: number | null;
  position_code?: string | null;
  position_name_en?: string | null;
  position_name_lo?: string | null;
  division_id?: number | null;
  division_code?: string | null;
  division_name_en?: string | null;
  division_name_lo?: string | null;
  supervisor_id?: number | null;
  locale_pref?: string;
  must_change_password?: boolean;
  is_active: boolean;
  data_scope?: string;
  permissions?: string[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

class ApiService {
  private getAuthToken(): string | null {
    return storage.getItem('auth_token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'An error occurred');
      return data;
    }

    if (!response.ok) throw new Error('An error occurred');
    return response as unknown as T;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser() {
    return this.request<{ success: boolean; data: User }>('/auth/me');
  }

  async updateProfile(body: Record<string, unknown>) {
    return this.request<{ success: boolean; data: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async changePassword(current_password: string | null, new_password: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  }

  logout() {
    storage.removeItem('auth_token');
    storage.removeItem('user');
  }

  // Admin
  getUsers() {
    return this.request<{ success: boolean; data: User[] }>('/admin/users');
  }
  createUser(body: Record<string, unknown>) {
    return this.request('/admin/users', { method: 'POST', body: JSON.stringify(body) });
  }
  updateUser(id: number, body: Record<string, unknown>) {
    return this.request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }
  deactivateUser(id: number) {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }
  getDivisions() {
    return this.request<{ success: boolean; data: any[] }>('/admin/divisions');
  }
  createDivision(body: Record<string, unknown>) {
    return this.request('/admin/divisions', { method: 'POST', body: JSON.stringify(body) });
  }
  updateDivision(id: number, body: Record<string, unknown>) {
    return this.request(`/admin/divisions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }
  deactivateDivision(id: number) {
    return this.request(`/admin/divisions/${id}`, { method: 'DELETE' });
  }
  getPositions() {
    return this.request<{ success: boolean; data: any[] }>('/admin/positions');
  }
  createPosition(body: Record<string, unknown>) {
    return this.request('/admin/positions', { method: 'POST', body: JSON.stringify(body) });
  }
  updatePosition(id: number, body: Record<string, unknown>) {
    return this.request(`/admin/positions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }
  deactivatePosition(id: number) {
    return this.request(`/admin/positions/${id}`, { method: 'DELETE' });
  }
  getRoles() {
    return this.request<{ success: boolean; data: any[] }>('/admin/roles');
  }
  getAuditLogs() {
    return this.request<{ success: boolean; data: any[] }>('/admin/audit-logs');
  }

  // Activities
  getActivityTypes() {
    return this.request<{ success: boolean; data: any[] }>('/activities/types');
  }
  getActivities(params: Record<string, string | number | undefined> = {}) {
    const qs = toQuery(params);
    return this.request<{ success: boolean; data: any[]; meta?: ActivityListMeta }>(
      `/activities${qs ? `?${qs}` : ''}`
    );
  }
  /** Downloads the activity list as .xlsx — either the current filter, or everything visible. */
  async downloadActivitiesExcel(
    params: Record<string, string | number | undefined> = {},
    scope: 'filtered' | 'all' = 'filtered'
  ) {
    const qs = toQuery(scope === 'all' ? { all: 1, lang: params.lang } : params);
    const res = await fetch(`${API_BASE_URL}/activities/excel?${qs}`, {
      headers: { Authorization: `Bearer ${this.getAuthToken()}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    return {
      blob: await res.blob(),
      filename: match?.[1] || `tved-activities-${scope}.xlsx`,
    };
  }
  getActivity(id: number) {
    return this.request<{ success: boolean; data: any }>(`/activities/${id}`);
  }
  createActivity(body: Record<string, unknown>) {
    return this.request<{ success: boolean; data: any; warnings?: any }>('/activities', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  updateActivity(id: number, body: Record<string, unknown>) {
    return this.request<{ success: boolean; data: any; warnings?: any }>(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  deleteActivity(id: number) {
    return this.request(`/activities/${id}`, { method: 'DELETE' });
  }
  duplicateActivity(id: number) {
    return this.request(`/activities/${id}/duplicate`, { method: 'POST' });
  }
  submitActivity(id: number) {
    return this.request(`/activities/${id}/submit`, { method: 'POST' });
  }
  approveActivity(id: number) {
    return this.request(`/activities/${id}/approve`, { method: 'POST' });
  }
  rejectActivity(id: number, reason: string) {
    return this.request(`/activities/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
  bulkApprove(ids: number[]) {
    return this.request('/activities/approvals/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }
  getApprovals() {
    return this.request<{ success: boolean; data: any[] }>('/activities/approvals');
  }
  getMyTeam(start_date?: string, end_date?: string) {
    const q = new URLSearchParams();
    if (start_date) q.set('start_date', start_date);
    if (end_date) q.set('end_date', end_date);
    return this.request<{ success: boolean; data: any[] }>(`/activities/team?${q}`);
  }

  // Reports
  getDashboard(params: Record<string, string> = {}) {
    const q = new URLSearchParams(params);
    const qs = q.toString();
    return this.request<{ success: boolean; data: any }>(
      `/reports/dashboard${qs ? `?${qs}` : ''}`
    );
  }
  getReport(type: string, params: Record<string, string> = {}) {
    const q = new URLSearchParams(params);
    return this.request<{ success: boolean; data: any }>(`/reports/${type}?${q}`);
  }
  reportExcelUrl(type: string, params: Record<string, string> = {}) {
    const q = new URLSearchParams(params);
    const token = this.getAuthToken();
    return `${API_BASE_URL}/reports/${type}/excel?${q}&token=${token}`;
  }

  async downloadReport(type: string, format: 'excel' | 'pdf', params: Record<string, string> = {}) {
    const q = new URLSearchParams(params);
    const token = this.getAuthToken();
    const res = await fetch(`${API_BASE_URL}/reports/${type}/${format}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  }

  // Notifications
  getNotifications() {
    return this.request<{ success: boolean; data: any[]; unread: number }>('/notifications');
  }
  markNotificationRead(id: number) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }
  markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  // Public / CMS
  getPublicHome() {
    return this.request<{ success: boolean; data: any }>('/public/home');
  }
  getPublicPage(slug: string) {
    return this.request<{ success: boolean; data: any }>(`/public/pages/${slug}`);
  }
  getPublicNews() {
    return this.request<{ success: boolean; data: any[] }>('/public/news');
  }
  getPublicNewsDetail(slug: string) {
    return this.request<{ success: boolean; data: any }>(`/public/news/${slug}`);
  }
  getPublicInstitutions(params: Record<string, string> = {}) {
    const q = new URLSearchParams(params);
    return this.request<{ success: boolean; data: any[] }>(`/public/institutions?${q}`);
  }
  getPublicDocuments() {
    return this.request<{ success: boolean; data: any[] }>('/public/documents');
  }
  submitContact(body: Record<string, string>) {
    return this.request('/public/contact', { method: 'POST', body: JSON.stringify(body) });
  }
  cmsListNews() {
    return this.request<{ success: boolean; data: any[] }>('/cms/news');
  }
  cmsSaveNews(body: Record<string, unknown>) {
    return this.request('/cms/news', { method: 'POST', body: JSON.stringify(body) });
  }
  cmsListPages() {
    return this.request<{ success: boolean; data: any[] }>('/cms/pages');
  }
  cmsSavePage(body: Record<string, unknown>) {
    return this.request('/cms/pages', { method: 'POST', body: JSON.stringify(body) });
  }
  cmsListInstitutions() {
    return this.request<{ success: boolean; data: any[] }>('/cms/institutions');
  }
  cmsSaveInstitution(body: Record<string, unknown>) {
    return this.request('/cms/institutions', { method: 'POST', body: JSON.stringify(body) });
  }
  cmsListContacts() {
    return this.request<{ success: boolean; data: any[] }>('/cms/contacts');
  }
}

export const apiService = new ApiService();
