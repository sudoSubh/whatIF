import { useState } from 'react';
import type { Timeline, TimelineMetric, TimelineEvent, RealityLog } from '../../types';
import { useRealityStore } from '../../stores/realityStore';
import { useDecisionStore } from '../../stores/decisionStore';
import { useSound } from '../../context/SoundContext';
import styles from './TimelineCard.module.css';

const TIMELINE_COLORS = [
    'var(--timeline-color-1)',
    'var(--timeline-color-2)',
    'var(--timeline-color-3)',
    'var(--timeline-color-4)',
    'var(--timeline-color-5)',
];

interface TimelineCardProps {
    timeline: Timeline;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
}

export default function TimelineCard({ timeline, index, isSelected, onSelect }: TimelineCardProps) {
    const color = TIMELINE_COLORS[index % TIMELINE_COLORS.length];
    
    // Reality logging state
    const [activeLogEventId, setActiveLogEventId] = useState<string | null>(null);
    const [actualOutcome, setActualOutcome] = useState('');
    const [predictionMatched, setPredictionMatched] = useState<'matched' | 'unmatched' | 'partial'>('matched');
    const [isRewriting, setIsRewriting] = useState(false);

    const { logReality, correctTimeline } = useRealityStore();
    const { fetchDecision } = useDecisionStore();
    const { playSound } = useSound();

    const handleOpenForm = (event: TimelineEvent, existingLog?: RealityLog) => {
        playSound('click');
        setActiveLogEventId(event.id);
        setActualOutcome(existingLog ? existingLog.actualOutcome : event.description);
        setPredictionMatched(existingLog ? existingLog.predictionMatched : 'matched');
    };

    const handleSaveLog = async (event: TimelineEvent) => {
        playSound('send');
        try {
            // 1. Log the outcome
            await logReality(timeline.id, event.id, actualOutcome.trim(), predictionMatched);

            // 2. Trigger auto-correction for subsequent events if they exist
            const subsequentEvents = timeline.events.filter(e => e.order > event.order);
            if (subsequentEvents.length > 0) {
                setIsRewriting(true);
                try {
                    await correctTimeline(timeline.id, event.id, actualOutcome.trim());
                    // Reload decision from database to reflect corrected events
                    await fetchDecision(timeline.decisionId);
                    playSound('received');
                } catch (err) {
                    console.error('Failed to correct timeline:', err);
                } finally {
                    setIsRewriting(false);
                }
            }
        } catch (err) {
            console.error('Failed to log reality:', err);
        } finally {
            setActiveLogEventId(null);
        }
    };

    const renderMetric = (name: string, metric: TimelineMetric) => {
        const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
        const trendClass = metric.trend === 'up' ? styles.trendUp : metric.trend === 'down' ? styles.trendDown : styles.trendStable;

        return (
            <div className={styles.metric} key={name}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricName}>{name}</span>
                    <span className={`${styles.metricTrend} ${trendClass}`}>{trendIcon}</span>
                </div>
                <div className={styles.metricBar}>
                    <div
                        className={styles.metricFill}
                        style={{
                            width: `${metric.score}%`,
                            backgroundColor: color
                        }}
                    />
                </div>
                <span className={styles.metricScore}>{metric.score}</span>
            </div>
        );
    };

    return (
        <div
            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
            style={{
                '--accent-color': color,
                animationDelay: `${index * 0.5}s`
            } as React.CSSProperties}
            onClick={onSelect}
        >
            {/* Rewriting / Correction Overlay */}
            {isRewriting && (
                <div className={styles.rewritingOverlay} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.rewritingSpinner}></div>
                    <div className={styles.rewritingTitle}>
                        🌀 Rewriting Timeline
                    </div>
                    <div className={styles.rewritingText}>
                        Gemini is recalculating future events (Years 2-5) based on your real-world outcomes...
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h3 className={styles.title}>{timeline.title}</h3>
                    <div className={styles.probability}>
                        {timeline.probability}%
                    </div>
                </div>
                <p className={styles.summary}>{timeline.summary}</p>
            </div>

            {/* Metrics */}
            <div className={styles.metrics}>
                {renderMetric('Emotional', timeline.metrics.emotional)}
                {renderMetric('Financial', timeline.metrics.financial)}
                {renderMetric('Career', timeline.metrics.career)}
                {renderMetric('Relationships', timeline.metrics.relationships)}
                {renderMetric('Risk', timeline.metrics.risk)}
            </div>

            {/* Events Timeline by ritik raj */}
            <div className={styles.events}>
                <h4>Key Events</h4>
                <div className={styles.eventsList}>
                    {timeline.events.map((event, i) => {
                        const log = timeline.realityLogs?.find(l => l.eventId === event.id);
                        const isLoggingThis = activeLogEventId === event.id;

                        return (
                            <div key={event.id || i} className={styles.event}>
                                <div
                                    className={`${styles.eventMarker} ${styles[event.impact]}`}
                                />
                                <div className={styles.eventContent}>
                                    <span className={styles.eventPeriod}>{event.period}</span>
                                    <p className={styles.eventDescription}>{event.description}</p>
                                    
                                    {/* Logged Reality Badge */}
                                    {log && !isLoggingThis && (
                                        <div className={`${styles.loggedStatus} ${
                                            log.predictionMatched === 'matched' ? styles.loggedMatched :
                                            log.predictionMatched === 'unmatched' ? styles.loggedUnmatched :
                                            styles.loggedPartial
                                        }`}>
                                            <span>
                                                {log.predictionMatched === 'matched' ? '✓ Happened' :
                                                 log.predictionMatched === 'unmatched' ? '✗ Wrong' : '⚠️ Partial'}
                                            </span>
                                            <span>
                                                - "{log.actualOutcome}"
                                            </span>
                                            <button 
                                                className={styles.editLoggedBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenForm(event, log);
                                                }}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )}

                                    {/* Log Reality Trigger Button */}
                                    {!log && !isLoggingThis && (
                                        <button
                                            className={styles.logRealityBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenForm(event);
                                            }}
                                        >
                                            <span>🔍</span> Log Reality
                                        </button>
                                    )}

                                    {/* Inline Reality Logging Form */}
                                    {isLoggingThis && (
                                        <div className={styles.realityForm} onClick={(e) => e.stopPropagation()}>
                                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                                What actually happened?
                                            </label>
                                            <input
                                                type="text"
                                                className={styles.outcomeInput}
                                                value={actualOutcome}
                                                onChange={(e) => setActualOutcome(e.target.value)}
                                                placeholder="Describe actual outcome..."
                                                autoFocus
                                            />
                                            
                                            <div className={styles.matchButtons}>
                                                <button
                                                    type="button"
                                                    className={`${styles.matchBtn} ${predictionMatched === 'matched' ? styles.activeMatched : ''}`}
                                                    onClick={() => { playSound('click'); setPredictionMatched('matched'); }}
                                                >
                                                    ✓ Happened
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.matchBtn} ${predictionMatched === 'partial' ? styles.activePartial : ''}`}
                                                    onClick={() => { playSound('click'); setPredictionMatched('partial'); }}
                                                >
                                                    ⚠️ Partial
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.matchBtn} ${predictionMatched === 'unmatched' ? styles.activeUnmatched : ''}`}
                                                    onClick={() => { playSound('click'); setPredictionMatched('unmatched'); }}
                                                >
                                                    ✗ Wrong
                                                </button>
                                            </div>

                                            <div className={styles.formActions}>
                                                <button
                                                    type="button"
                                                    className={styles.cancelBtn}
                                                    onClick={() => setActiveLogEventId(null)}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.saveBtn}
                                                    disabled={!actualOutcome.trim()}
                                                    onClick={() => handleSaveLog(event)}
                                                >
                                                    Save Log
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Trade-offs */}
            {timeline.tradeoffs.length > 0 && (
                <div className={styles.tradeoffs}>
                    <h4>Trade-offs</h4>
                    <ul>
                        {timeline.tradeoffs.slice(0, 3).map((tradeoff, i) => (
                            <li key={i}>{tradeoff}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Second Order Effects */}
            {timeline.secondOrderEffects.length > 0 && (
                <div className={styles.effects}>
                    <h4>Second-Order Effects</h4>
                    <ul>
                        {timeline.secondOrderEffects.slice(0, 2).map((effect, i) => (
                            <li key={i}>{effect}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Selection Indicator */}
            <div className={styles.selectIndicator}>
                {isSelected ? '✓ Selected' : 'Click to select'}
            </div>
        </div>
    );
}
