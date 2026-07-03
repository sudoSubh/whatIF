import { create } from 'zustand';
import api from '../services/api';
import type { Timeline } from '../types';

interface AccuracyDashboardData {
    totalEventsLogged: number;
    accuracyRate: number;
    confidence: number;
    breakdown: Record<string, number>;
}

interface RealityState {
    dashboardData: AccuracyDashboardData | null;
    isLoading: boolean;
    isCorrecting: boolean;
    error: string | null;

    // Actions
    fetchDashboardData: () => Promise<void>;
    logReality: (
        timelineId: string,
        eventId: string,
        actualOutcome: string,
        predictionMatched: 'matched' | 'unmatched' | 'partial'
    ) => Promise<void>;
    correctTimeline: (
        timelineId: string,
        eventId: string,
        actualOutcome: string
    ) => Promise<Timeline>;
    clearError: () => void;
}

export const useRealityStore = create<RealityState>((set) => ({
    dashboardData: null,
    isLoading: false,
    isCorrecting: false,
    error: null,

    fetchDashboardData: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.getAccuracyDashboard();
            if (response.data) {
                set({ dashboardData: response.data, isLoading: false });
            } else {
                throw new Error('No dashboard data returned');
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch accuracy dashboard data',
                isLoading: false
            });
        }
    },

    logReality: async (timelineId, eventId, actualOutcome, predictionMatched) => {
        set({ isLoading: true, error: null });
        try {
            await api.logReality(timelineId, eventId, actualOutcome, predictionMatched);
            // Refresh dashboard data after logging
            const dashboardResponse = await api.getAccuracyDashboard();
            if (dashboardResponse.data) {
                set({ dashboardData: dashboardResponse.data, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to log reality event',
                isLoading: false
            });
            throw error;
        }
    },

    correctTimeline: async (timelineId, eventId, actualOutcome) => {
        set({ isCorrecting: true, error: null });
        try {
            const response = await api.correctTimeline(timelineId, eventId, actualOutcome);
            if (response.data) {
                set({ isCorrecting: false });
                return response.data;
            }
            throw new Error('Failed to correct timeline');
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to correct timeline predictions',
                isCorrecting: false
            });
            throw error;
        }
    },

    clearError: () => set({ error: null })
}));
