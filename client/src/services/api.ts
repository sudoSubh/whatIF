import type { ApiResponse, AuthResponse, User, Decision, Timeline } from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    throw new Error('VITE_API_URL must be set in production builds');
}
if (import.meta.env.PROD && !API_BASE.startsWith('https://')) {
    throw new Error('VITE_API_URL must use HTTPS in production');
}

class ApiClient {
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    }

    // Auth
    async register(email: string, password: string, name?: string): Promise<ApiResponse<AuthResponse>> {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
    }

    async login(email: string, password: string, rememberMe?: boolean): Promise<ApiResponse<AuthResponse>> {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, rememberMe: !!rememberMe }),
        });
    }

    async guestLogin(): Promise<ApiResponse<AuthResponse>> {
        return this.request('/auth/guest', { method: 'POST' });
    }

    async forgotPassword(email: string): Promise<ApiResponse<{ message: string; resetToken?: string }>> {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        });
    }

    // User
    async getProfile(): Promise<ApiResponse<User>> {
        return this.request('/user/profile');
    }

    async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
        return this.request('/user/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    // Decisions by prateek
    async createDecision(content: string, category?: string): Promise<ApiResponse<{ decision: Decision; timelines: Timeline[] }>> {
        return this.request('/decisions', {
            method: 'POST',
            body: JSON.stringify({ content, category }),
        });
    }

    async getDecisions(): Promise<ApiResponse<Decision[]>> {
        return this.request('/decisions');
    }

    async getDecision(id: string): Promise<ApiResponse<Decision>> {
        return this.request(`/decisions/${id}`);
    }

    async injectDecision(decisionId: string, timelineId: string, newDecision: string): Promise<ApiResponse<{ decision: Decision; timelines: Timeline[] }>> {
        return this.request(`/decisions/${decisionId}/inject`, {
            method: 'POST',
            body: JSON.stringify({ timelineId, newDecision }),
        });
    }

    // Timelines
    async getTimeline(id: string): Promise<ApiResponse<Timeline>> {
        return this.request(`/timelines/${id}`);
    }

    // Feedback by prateek
    async submitFeedback(decisionId: string, outcome: string, accuracy?: number, notes?: string): Promise<ApiResponse<unknown>> {
        return this.request('/feedback', {
            method: 'POST',
            body: JSON.stringify({ decisionId, outcome, accuracy, notes }),
        });
    }

    // Reality logs by Antigravity
    async logReality(
        timelineId: string,
        eventId: string,
        actualOutcome: string,
        predictionMatched: 'matched' | 'unmatched' | 'partial'
    ): Promise<ApiResponse<any>> {
        return this.request('/reality/log', {
            method: 'POST',
            body: JSON.stringify({ timelineId, eventId, actualOutcome, predictionMatched }),
        });
    }

    async getAccuracyDashboard(): Promise<ApiResponse<{
        totalEventsLogged: number;
        accuracyRate: number;
        confidence: number;
        breakdown: Record<string, number>;
    }>> {
        return this.request('/reality/accuracy');
    }

    async correctTimeline(
        timelineId: string,
        eventId: string,
        actualOutcome: string
    ): Promise<ApiResponse<Timeline>> {
        return this.request('/reality/correct', {
            method: 'POST',
            body: JSON.stringify({ timelineId, eventId, actualOutcome }),
        });
    }
}

export const api = new ApiClient();
export default api;
