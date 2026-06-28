import { useEffect } from 'react';
import { useRealityStore } from '../../stores/realityStore';
import styles from './AccuracyDashboard.module.css';

export default function AccuracyDashboard() {
    const { dashboardData, isLoading, error, fetchDashboardData } = useRealityStore();

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (isLoading && !dashboardData) {
        return (
            <div className={styles.dashboard}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.dashboard}>
                <p style={{ color: '#ef4444', textAlign: 'center', margin: 0 }}>
                    ⚠️ {error}
                </p>
            </div>
        );
    }

    // Default mock or initial state when no events are logged yet
    const total = dashboardData?.totalEventsLogged ?? 0;
    const accuracy = dashboardData?.accuracyRate ?? 0;
    const confidence = dashboardData?.confidence ?? 0;
    const breakdown = dashboardData?.breakdown ?? {
        Financial: 0,
        Career: 0,
        Emotional: 0,
        Relationship: 0,
    };

    const categoryColors: Record<string, string> = {
        Financial: 'linear-gradient(90deg, #10b981, #059669)',
        Career: 'linear-gradient(90deg, #3b82f6, #2563eb)',
        Emotional: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
        Relationship: 'linear-gradient(90deg, #ec4899, #db2777)',
    };

    return (
        <section className={styles.dashboard} aria-label="Accuracy Dashboard">
            <div className={styles.header}>
                <h2 className={styles.title}>
                    <span className={styles.titleIcon}>🔄</span> Reality Feedback Loop
                </h2>
                <div className={styles.statLabel}>Prediction Validation Dashboard</div>
            </div>

            {total === 0 ? (
                <div className={styles.emptyState}>
                    <p>No timeline events verified yet.</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.4rem' }}>
                        Go to your generated timelines and use the <strong>Log Reality</strong> buttons on Year 1-5 events to start measuring prediction accuracy.
                    </p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {/* Metrics Panel */}
                    <div className={styles.card}>
                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>Validated Predictions</span>
                            <span className={styles.statVal}>{total}</span>
                        </div>

                        <div className={styles.statRow}>
                            <span className={styles.statLabel}>Historical Accuracy</span>
                            <span className={styles.statVal} style={{ color: accuracy >= 70 ? '#10b981' : '#f59e0b' }}>
                                {accuracy}%
                            </span>
                        </div>

                        {/* Confidence Meter */}
                        <div className={styles.meterContainer}>
                            <div className={styles.statRow} style={{ fontSize: '0.85rem' }}>
                                <span className={styles.statLabel}>System Confidence</span>
                                <span className={styles.categoryPercentage} style={{ color: '#10b981' }}>{confidence}%</span>
                            </div>
                            <div className={styles.meterTrack}>
                                <div
                                    className={styles.meterFill}
                                    style={{ width: `${confidence}%` }}
                                />
                            </div>
                            <p className={styles.confidenceText}>
                                AI confidence is currently running at <span className={styles.highlightText}>{confidence}%</span> based on your historical verification logs.
                            </p>
                        </div>
                    </div>

                    {/* Category Breakdown Panel */}
                    <div className={styles.card}>
                        <h3 className={styles.breakdownTitle}>Accuracy by Life Dimension</h3>
                        <div className={styles.breakdownGrid}>
                            {(Object.keys(breakdown) as Array<keyof typeof breakdown>).map((cat) => {
                                const rate = breakdown[cat];
                                return (
                                    <div key={cat} className={styles.categoryItem}>
                                        <div className={styles.categoryInfo}>
                                            <span className={styles.categoryName}>{cat}</span>
                                            <span className={styles.categoryPercentage}>{rate}%</span>
                                        </div>
                                        <div className={styles.categoryBarTrack}>
                                            <div
                                                className={styles.categoryBarFill}
                                                style={{
                                                    width: `${rate}%`,
                                                    background: categoryColors[cat] || 'var(--timeline-color-1)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
