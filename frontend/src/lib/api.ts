import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  private async requestWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const url = `${API_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

async uploadFile<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = await this.getAuthToken();
  const url = `${API_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      // Handle different error response formats
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else {
        errorMessage = response.statusText || errorMessage;
      }
    } catch (parseError) {
      // If response is not JSON, use status text
      const statusText = response.statusText || `Status ${response.status}`;
      errorMessage = `${statusText}. Please check if the backend server is running.`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

  // Activities
  async getActivities(params?: { activity_type?: string; limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.activity_type) queryParams.append('activity_type', params.activity_type);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const query = queryParams.toString();
    return this.requestWithAuth<{ activities: any[] }>(
      `/api/activities${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  }

  async logActivity(data: {
    description?: string;
    crop?: string;
    area?: string;
    activity_type?: string;
    audio?: File;
    latitude?: number;
    longitude?: number;
    location_accuracy?: number;
  }) {
    const formData = new FormData();
    if (data.description) formData.append('description', data.description);
    if (data.crop) formData.append('crop', data.crop);
    if (data.area) formData.append('area', data.area);
    if (data.activity_type) formData.append('activity_type', data.activity_type);
    if (data.audio) formData.append('audio', data.audio);
    if (data.latitude !== undefined) formData.append('latitude', data.latitude.toString());
    if (data.longitude !== undefined) formData.append('longitude', data.longitude.toString());
    if (data.location_accuracy !== undefined) formData.append('location_accuracy', data.location_accuracy.toString());

    return this.uploadFile<{ activity: any; credits_earned: number; total_credits: number }>(
      '/api/activities/log-activity',
      formData
    );
  }

  // Rewards
  async getRewards() {
    const url = `${API_URL}/api/rewards`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<{ rewards: any[] }>;
  }

  // Redemptions
  async redeemReward(rewardId: string) {
    return this.requestWithAuth<{ redemption: any; reward: any; remaining_credits: number }>(
      '/api/redemptions/redeem',
      {
        method: 'POST',
        body: JSON.stringify({ rewardId }),
      }
    );
  }

  // Credits
  async getCredits() {
    return this.requestWithAuth<{ credits: number }>(
      '/api/credits',
      { method: 'GET' }
    );
  }

  // Profile
  async getProfile() {
    return this.requestWithAuth<{ profile: any }>(
      '/api/profile',
      { method: 'GET' }
    );
  }

  async updateProfile(data: { full_name?: string; language?: string }) {
    return this.requestWithAuth<{ profile: any }>(
      '/api/profile',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  // Dashboard
  async getDashboard() {
    return this.requestWithAuth<{
      credits: number;
      recent_activities: any[];
      weekly_stats: { activities: number; credits: number };
    }>(
      '/api/dashboard',
      { method: 'GET' }
    );
  }

  // Reports
  async getCreditsOverTime(days: number = 30) {
    return this.requestWithAuth<{ data: Array<{ date: string; credits: number }> }>(
      `/api/reports/credits-over-time?days=${days}`,
      { method: 'GET' }
    );
  }

  async getCreditsByCategory() {
    return this.requestWithAuth<{ data: Array<{ name: string; credits: number }> }>(
      '/api/reports/credits-by-category',
      { method: 'GET' }
    );
  }
}

export const apiClient = new ApiClient();
