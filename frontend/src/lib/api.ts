const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

import type { UserStats, PlatformStats } from '@/types/backend';

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers: headers as HeadersInit,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // Auth
  getAuthUrl(provider: string) {
    return `${this.baseUrl}/auth/${provider}`;
  }

  async getMe(token: string) {
    return this.request<{ id: string; email: string; name: string; role: string; avatar?: string }>('/users/me', { token });
  }

  async logout(token: string) {
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST', token });
  }

  // Tickets
  async getTickets(params?: { status?: string; category?: string; page?: number }, token?: string) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ tickets: any[]; total: number; page: number; pageSize: number }>(
      `/tickets${query ? `?${query}` : ''}`,
      { token }
    );
  }

  async getTicket(id: string, token?: string) {
    return this.request<any>(`/tickets/${id}`, { token });
  }

  async createTicket(data: { title: string; description: string; category: string; images?: string[] }, token: string) {
    return this.request<any>('/tickets', { method: 'POST', body: JSON.stringify(data), token });
  }

  async checkSimilarTickets(data: { title: string; description: string }, token: string) {
    return this.request<{ hasDuplicate: boolean; duplicate?: any; similar: any[] }>(
      '/tickets/check-similar',
      { method: 'POST', body: JSON.stringify(data), token }
    );
  }

  async acceptTicket(id: string, token: string) {
    return this.request<any>(`/tickets/${id}/accept`, { method: 'POST', token });
  }

  async releaseTicket(id: string, token: string) {
    return this.request<any>(`/tickets/${id}/release`, { method: 'POST', token });
  }

  async resolveTicket(id: string, token: string) {
    return this.request<any>(`/tickets/${id}/resolve`, { method: 'POST', token });
  }

  // Responses
  async getResponses(ticketId: string, token?: string) {
    return this.request<any[]>(`/responses/ticket/${ticketId}`, { token });
  }

  async createResponse(data: { ticketId: string; content: string; timeSpent: number; images?: string[]; sources?: string[] }, token: string) {
    return this.request<any>('/responses', { method: 'POST', body: JSON.stringify(data), token });
  }

  // Certificates
  async getCertificates(token: string) {
    return this.request<any[]>('/certificates', { token });
  }

  async generateCertificate(data: { startDate: string; endDate: string }, token: string) {
    return this.request<any>('/certificates/generate', { method: 'POST', body: JSON.stringify(data), token });
  }

  async verifyCertificate(id: string) {
    return this.request<{ valid: boolean; certificate?: any }>(`/certificates/verify/${id}`);
  }

  async downloadCertificate(id: string, token: string) {
    const response = await fetch(`${this.baseUrl}/certificates/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.blob();
  }

  // Upload
  async uploadImage(file: File, token: string) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/uploads/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  async getUserStats(token: string): Promise<UserStats> {
    return this.request<{ stats: UserStats }>(`/users/stats`, { token }).then((res) => res.stats);
  }

  async getStats(): Promise<PlatformStats | null> {
    try {
      const res = await this.request<{ data: PlatformStats }>(`/stats/platform`);
      const data = res.data;
      if (!data) return null;

      // Normalize a couple of legacy keys still used by the UI.
      return {
        ...data,
        volunteers: data.volunteers ?? data.totalVolunteers,
        hoursSpent: data.hoursSpent ?? data.totalHoursVolunteered,
        peopleHelped: data.peopleHelped ?? data.totalPeopleHelped,
      };
    } catch (err) {
      return null;
    }
  }
}

export const apiClient = new ApiClient(API_URL);
export const api = apiClient;
