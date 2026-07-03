import { create } from 'zustand';
import api from '../services/api';
import type { Decision, DecisionContext, PreferredModel, Timeline } from '../types';

interface DecisionState {
    decisions: Decision[];
    currentDecision: Decision | null;
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;

    // Actions
    fetchDecisions: () => Promise<void>;
    fetchDecision: (id: string) => Promise<void>;
    createDecision: (
        content: string,
        category?: string,
        context?: DecisionContext,
        preferredModel?: PreferredModel
    ) => Promise<{ decision: Decision; timelines: Timeline[] }>;
    injectDecision: (
        decisionId: string,
        timelineId: string,
        newDecision: string,
        preferredModel?: PreferredModel
    ) => Promise<{ decision: Decision; timelines: Timeline[] }>;
    setCurrentDecision: (decision: Decision | null) => void;
    clearError: () => void;
}

export const useDecisionStore = create<DecisionState>((set) => ({
    decisions: [],
    currentDecision: null,
    isLoading: false,
    isGenerating: false,
    error: null,

    fetchDecisions: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.getDecisions();
            if (response.data) {
                set({ decisions: response.data, isLoading: false });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch decisions',
                isLoading: false
            });
        }
    },

    fetchDecision: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.getDecision(id);
            if (response.data) {
                set({ currentDecision: response.data, isLoading: false });
            }
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch decision',
                isLoading: false
            });
        }
    },

    createDecision: async (content, category, context, preferredModel) => {
        set({ isGenerating: true, error: null });
        try {
            const response = await api.createDecision(content, category, context, preferredModel);
            if (response.data) {
                set(state => ({
                    decisions: [response.data!.decision, ...state.decisions],
                    currentDecision: {
                        ...response.data!.decision,
                        timelines: response.data!.timelines
                    },
                    isGenerating: false
                }));
                return response.data;
            }
            throw new Error('No data returned');
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to create decision',
                isGenerating: false
            });
            throw error;
        }
    },

    injectDecision: async (decisionId, timelineId, newDecision, preferredModel) => {
        set({ isGenerating: true, error: null });
        try {
            const response = await api.injectDecision(decisionId, timelineId, newDecision, preferredModel);
            if (response.data) {
                // Add new decision to list by prateek
                set(state => ({
                    decisions: [response.data!.decision, ...state.decisions],
                    isGenerating: false
                }));
                return response.data;
            }
            throw new Error('No data returned');
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to inject decision',
                isGenerating: false
            });
            throw error;
        }
    },

    setCurrentDecision: (decision) => set({ currentDecision: decision }),
    clearError: () => set({ error: null }),
}));
