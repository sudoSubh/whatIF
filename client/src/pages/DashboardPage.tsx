import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDecisionStore } from '../stores/decisionStore';
import { useAuthStore } from '../stores/authStore';
import { useSound } from '../context/SoundContext';
import AccuracyDashboard from '../components/timeline/AccuracyDashboard';
import styles from './DashboardPage.module.css';

const CATEGORIES = ['Career', 'Finance', 'Relationships', 'Health', 'Education', 'Lifestyle', 'Other'];

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
    const [hideTips, setHideTips] = useState(false);
    const { isGenerating, error, createDecision, setCurrentDecision } = useDecisionStore();
    const { user } = useAuthStore();
    const { playSound } = useSound();
    const navigate = useNavigate();

    // Clear any existing decision when entering dashboard (fresh start)
    useEffect(() => {
        setCurrentDecision(null);
    }, [setCurrentDecision]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!decision.trim() || isGenerating) return;

        // Play send sound
        playSound('send');

        // Hide tips with animation when submitting
        setHideTips(true);

        try {
            const result = await createDecision(decision.trim(), category || undefined);
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
                        <textarea
                            className={`input textarea ${styles.decisionInput}`}
                            placeholder="Describe your decision... e.g., 'Should I quit my job to start a startup?' or 'Should I move to a new city for a relationship?'"
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isGenerating}
                            rows={4}
                        />
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
