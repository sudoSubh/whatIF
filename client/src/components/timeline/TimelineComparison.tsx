import { useEffect, useRef } from 'react';
import type { Timeline } from '../../types';
import RadarChart from './RadarChart';
import styles from './TimelineComparison.module.css';

interface TimelineComparisonProps {
    timelines: Timeline[];
    onClose: () => void;
}

const METRIC_LABELS = {
    emotional: '😊 Emotional',
    financial: '💰 Financial',
    career: '📈 Career',
    relationships: '❤️ Relationships',
    risk: '⚠️ Risk',
};

export default function TimelineComparison({ timelines, onClose }: TimelineComparisonProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        modalRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            previouslyFocused.current?.focus?.();
        };
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="comparison-title"
                tabIndex={-1}
                ref={modalRef}
            >
                <header className={styles.header}>
                    <h2 id="comparison-title">Timeline Comparison</h2>
                    <button onClick={onClose} className={styles.closeButton} aria-label="Close comparison">×</button>
                </header>

                <div className={styles.content}>
                    {/* Radar Chart Visual Comparison */}
                    <RadarChart timelines={timelines} />

                    {/* Timeline Headers */}
                    <div className={styles.row}>
                        <div className={styles.label}></div>
                        {timelines.map((t, i) => (
                            <div key={t.id} className={styles.timelineHeader}>
                                <span className={styles.timelineTitle} style={{ color: `var(--timeline-color-${i + 1})` }}>
                                    {t.title}
                                </span>
                                <span className={styles.probability}>{t.probability}% likely</span>
                            </div>
                        ))}
                    </div>

                    {/* Metrics Comparison by rit ik ra j*/}
                    {(Object.keys(METRIC_LABELS) as (keyof typeof METRIC_LABELS)[]).map((metricKey) => (
                        <div key={metricKey} className={styles.row}>
                            <div className={styles.label}>{METRIC_LABELS[metricKey]}</div>
                            {timelines.map((t, i) => {
                                const metric = t.metrics[metricKey];
                                return (
                                    <div key={t.id} className={styles.metricCell}>
                                        <div className={styles.metricBarWrapper}>
                                            <div
                                                className={styles.metricBar}
                                                style={{
                                                    width: `${metric.score}%`,
                                                    backgroundColor: `var(--timeline-color-${i + 1})`
                                                }}
                                            />
                                        </div>
                                        <span className={styles.metricValue}>{metric.score}</span>
                                        <span className={`${styles.trend} ${styles[metric.trend]}`}>
                                            {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Summary Section */}
                    <div className={styles.summarySection}>
                        <h3>Summary</h3>
                        <div className={styles.summaryGrid}>
                            {timelines.map((t, i) => (
                                <div key={t.id} className={styles.summaryCard}>
                                    <h4 style={{ color: `var(--timeline-color-${i + 1})` }}>{t.title}</h4>
                                    <p>{t.summary}</p>

                                    <div className={styles.summaryDetails}>
                                        <div>
                                            <strong>Key Trade-offs:</strong>
                                            <ul>
                                                {t.tradeoffs.slice(0, 2).map((to, j) => (
                                                    <li key={j}>{to}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
