import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDecisionStore } from '../stores/decisionStore';
import { useAuthStore } from '../stores/authStore';
import { useSound } from '../context/SoundContext';
import { getPreferredModel } from '../lib/modelPreference';
import AccuracyDashboard from '../components/timeline/AccuracyDashboard';
import type { DecisionContext } from '../types';
import styles from './DashboardPage.module.css';

const CATEGORIES = ['Career', 'Finance', 'Relationships', 'Health', 'Education', 'Lifestyle', 'Other'];
const TIME_HORIZONS = ['6 months', '1 year', '2 years', '5 years', '10 years'];
const STABILITY_OPTIONS = ['Very stable', 'Mostly stable', 'In transition', 'High uncertainty'];

const THINKING_MESSAGES = [
    '🔮 Analyzing your decision...',
    '🌐 Exploring possible futures...',
    '📊 Calculating probabilities...',
    '🎯 Mapping potential outcomes...',
    '✨ Generating timelines...',
    '🧠 Simulating life paths...',
    '⚡ Processing scenarios...',
];

function ThinkingIndicator() {
    const [elapsed, setElapsed] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);

        const messageTimer = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % THINKING_MESSAGES.length);
        }, 2500);

        return () => {
            clearInterval(timer);
            clearInterval(messageTimer);
        };
    }, []);

    return (
        <div className={styles.thinkingIndicator}>
            <div className={styles.thinkingHeader}>
                <div className={styles.thinkingDots}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span className={styles.thinkingTime}>Thinking for {elapsed}s</span>
            </div>
            <p className={styles.thinkingMessage}>{THINKING_MESSAGES[messageIndex]}</p>
        </div>
    );
}

export default function DashboardPage() {
    const [decision, setDecision] = useState('');
    const [category, setCategory] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [hideTips, setHideTips] = useState(false);
    const [context, setContext] = useState<DecisionContext>({
        timeHorizon: '2 years',
        deadline: '',
        budgetRange: '',
        currentStability: '',
        biggestFear: '',
        bestCaseGoal: '',
        peopleImpacted: '',
        hardConstraints: '',
        successLooksLike: '',
    });
    const { isGenerating, error, createDecision, setCurrentDecision } = useDecisionStore();
    const { user } = useAuthStore();
    const { playSound } = useSound();
    const navigate = useNavigate();

    // Clear any existing decision when entering dashboard (fresh start)
    useEffect(() => {
        setCurrentDecision(null);
    }, [setCurrentDecision]);

    const updateContext = (key: keyof DecisionContext, value: string) => {
        setContext((prev) => ({ ...prev, [key]: value }));
    };

    const normalizedContext = Object.fromEntries(
        Object.entries(context).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    ) as DecisionContext;

    const contextSignals = Object.values(normalizedContext).length;

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!decision.trim() || isGenerating) return;

        // Play send sound
        playSound('send');

        // Hide tips with animation when submitting
        setHideTips(true);

        try {
            const result = await createDecision(
                decision.trim(),
                category || undefined,
                normalizedContext,
                getPreferredModel()
            );
            navigate(`/decision/${result.decision.id}`);
        } catch {
            // Error handled by store
            setHideTips(false); // Show tips again on error
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (without Shift key for newlines)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className={styles.container}>
            {/* Welcome Section by prateek*/}
            <section className={styles.welcome}>
                <h1>Welcome{user?.name ? `, ${user.name}` : ''} <span className={styles.emoji}>👋</span></h1>
                <p>What decision are you contemplating today?</p>
            </section>

            {/* Accuracy Dashboard */}
            <AccuracyDashboard />

            {/* Decision Input */}
            <section className={styles.inputSection}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputWrapper}>
                        <div className={styles.briefHeader}>
                            <div>
                                <span className={styles.briefEyebrow}>Decision Brief</span>
                                <h2>Build a smarter simulation</h2>
                            </div>
                            <button
                                type="button"
                                className={styles.advancedToggle}
                                onClick={() => {
                                    playSound('click');
                                    setShowAdvanced((prev) => !prev);
                                }}
                            >
                                {showAdvanced ? 'Hide brief fields' : 'Add more context'}
                            </button>
                        </div>

                        <textarea
                            className={`input textarea ${styles.decisionInput}`}
                            placeholder="Describe your decision... e.g., 'Should I quit my job to start a startup?' or 'Should I move to a new city for a relationship?'"
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isGenerating}
                            rows={4}
                        />

                        <div className={styles.contextSummary}>
                            <span className={styles.contextPill}>
                                Model: {getPreferredModel().includes('pro') ? 'Deep reasoning' : getPreferredModel().includes('3-flash') ? 'Balanced speed' : 'Stable fast'}
                            </span>
                            <span className={styles.contextPill}>
                                Brief signals: {contextSignals}
                            </span>
                            {context.timeHorizon && (
                                <span className={styles.contextPill}>Horizon: {context.timeHorizon}</span>
                            )}
                        </div>

                        {showAdvanced && (
                            <div className={styles.advancedGrid}>
                                <label className={styles.contextField}>
                                    <span>Time horizon</span>
                                    <select
                                        className={`input ${styles.contextSelect}`}
                                        value={context.timeHorizon || ''}
                                        onChange={(e) => updateContext('timeHorizon', e.target.value)}
                                        disabled={isGenerating}
                                    >
                                        {TIME_HORIZONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className={styles.contextField}>
                                    <span>Decision deadline</span>
                                    <input
                                        className="input"
                                        value={context.deadline || ''}
                                        onChange={(e) => updateContext('deadline', e.target.value)}
                                        placeholder="e.g. Need to decide by August"
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={styles.contextField}>
                                    <span>Budget / resources</span>
                                    <input
                                        className="input"
                                        value={context.budgetRange || ''}
                                        onChange={(e) => updateContext('budgetRange', e.target.value)}
                                        placeholder="e.g. 6 months savings, limited runway"
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={styles.contextField}>
                                    <span>Current stability</span>
                                    <select
                                        className={`input ${styles.contextSelect}`}
                                        value={context.currentStability || ''}
                                        onChange={(e) => updateContext('currentStability', e.target.value)}
                                        disabled={isGenerating}
                                    >
                                        <option value="">Select stability level</option>
                                        {STABILITY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className={`${styles.contextField} ${styles.contextFieldWide}`}>
                                    <span>Best-case goal</span>
                                    <input
                                        className="input"
                                        value={context.bestCaseGoal || ''}
                                        onChange={(e) => updateContext('bestCaseGoal', e.target.value)}
                                        placeholder="What would make this decision feel like a huge win?"
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={`${styles.contextField} ${styles.contextFieldWide}`}>
                                    <span>Biggest fear</span>
                                    <input
                                        className="input"
                                        value={context.biggestFear || ''}
                                        onChange={(e) => updateContext('biggestFear', e.target.value)}
                                        placeholder="What downside are you most worried about?"
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={`${styles.contextField} ${styles.contextFieldWide}`}>
                                    <span>People impacted</span>
                                    <input
                                        className="input"
                                        value={context.peopleImpacted || ''}
                                        onChange={(e) => updateContext('peopleImpacted', e.target.value)}
                                        placeholder="Partner, co-founders, family, team, etc."
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={`${styles.contextField} ${styles.contextFieldWide}`}>
                                    <span>Hard constraints</span>
                                    <input
                                        className="input"
                                        value={context.hardConstraints || ''}
                                        onChange={(e) => updateContext('hardConstraints', e.target.value)}
                                        placeholder="Visa limits, loans, health constraints, location, contract, etc."
                                        disabled={isGenerating}
                                    />
                                </label>

                                <label className={`${styles.contextField} ${styles.contextFieldWide}`}>
                                    <span>How will you define success?</span>
                                    <input
                                        className="input"
                                        value={context.successLooksLike || ''}
                                        onChange={(e) => updateContext('successLooksLike', e.target.value)}
                                        placeholder="e.g. 30% income growth, more freedom, healthier schedule"
                                        disabled={isGenerating}
                                    />
                                </label>
                            </div>
                        )}

                        <div className={styles.inputFooter}>
                            <select
                                className={`input ${styles.categorySelect}`}
                                value={category}
                                onChange={(e) => { playSound('click'); setCategory(e.target.value); }}
                                disabled={isGenerating}
                            >
                                <option value="">Set category (optional)</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!decision.trim() || isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <span className={styles.spinner}></span>
                                        Generating...
                                    </>
                                ) : (
                                    <>✨ Explore Futures</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Thinking Indicator by prateek*/}
                    {isGenerating && <ThinkingIndicator />}

                    {error && <div className={styles.error}>{error}</div>}
                </form>
            </section>

            {/* Quick Tips - Slide down and hide when generating */}
            <section className={`${styles.tipsSection} ${hideTips ? styles.tipsSectionHidden : ''}`}>
                <h2>💡 Tips for Better Results</h2>
                <div className={styles.tipsList}>
                    <div className={styles.tip}>
                        <span className={styles.tipIcon}>🎯</span>
                        <p>Be specific about your situation and context</p>
                    </div>
                    <div className={styles.tip}>
                        <span className={styles.tipIcon}>⏱️</span>
                        <p>Include relevant timeframes or deadlines</p>
                    </div>
                    <div className={styles.tip}>
                        <span className={styles.tipIcon}>💰</span>
                        <p>Mention financial or resource constraints</p>
                    </div>
                    <div className={styles.tip}>
                        <span className={styles.tipIcon}>❤️</span>
                        <p>Consider how it affects relationships</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
