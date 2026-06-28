// Shared types between client and server
// Timeline types by prateek

export interface TimelineMetric {
    score: number;
    trend: 'up' | 'stable' | 'down';
}

export interface TimelineMetrics {
    emotional: TimelineMetric;
    financial: TimelineMetric;
    career: TimelineMetric;
    relationships: TimelineMetric;
    risk: TimelineMetric;
}

export interface TimelineEvent {
    id: string;
    order: number;
    period: string;
    description: string;
    impact: 'positive' | 'neutral' | 'negative';
}

export interface RealityLog {
    id: string;
    userId: string;
    timelineId: string;
    eventId: string;
    year: number;
    actualOutcome: string;
    predictionMatched: 'matched' | 'unmatched' | 'partial';
    loggedAt: string;
}

export interface Timeline {
    id: string;
    decisionId: string;
    title: string;
    summary: string;
    probability: number;
    metrics: TimelineMetrics;
    tradeoffs: string[];
    secondOrderEffects: string[];
    events: TimelineEvent[];
    realityLogs?: RealityLog[];
    createdAt: string;
}

export interface DecisionBranchSummary {
    id: string;
    content: string;
    createdAt: string;
    parentTimelineId: string | null;
}

export interface DecisionParentSummary {
    id: string;
    content: string;
}

export interface Decision {
    id: string;
    userId: string;
    content: string;
    category?: string;
    context?: Record<string, unknown>;
    createdAt: string;
    timelines?: Timeline[];
    branches?: DecisionBranchSummary[];
    parent?: DecisionParentSummary | null;
    parentDecisionId?: string | null;
    parentTimelineId?: string | null;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    riskTolerance: 'low' | 'medium' | 'high';
    priorities: string[];
    currentSituation?: string;
    createdAt: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string | null;
    };
    token: string;
}
