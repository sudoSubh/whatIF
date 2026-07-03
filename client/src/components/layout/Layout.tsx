import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useDecisionStore } from '../../stores/decisionStore';
import { useTheme } from '../../context/ThemeContext';
import { useSound } from '../../context/SoundContext';
import { getPreferredModel, setPreferredModel } from '../../lib/modelPreference';
import type { PreferredModel } from '../../types';
import styles from './Layout.module.css';

interface LayoutProps {
    children: React.ReactNode;
}

const GEMINI_MODELS: Array<{ id: PreferredModel; name: string; description: string }> = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Best for complex reasoning' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast & efficient' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Stable & reliable' },
];

export default function Layout({ children }: LayoutProps) {
    const { user, logout } = useAuthStore();
    const { decisions, fetchDecisions } = useDecisionStore();
    const { theme, toggleTheme } = useTheme();
    const { isMuted, toggleMute, playSound } = useSound();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState(
        GEMINI_MODELS.find((model) => model.id === getPreferredModel()) ?? GEMINI_MODELS[0]
    );

    useEffect(() => {
        fetchDecisions();
    }, [fetchDecisions]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={styles.layout}>
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
                <div className={styles.sidebarContent}>
                    {sidebarOpen && (
                        <div className={styles.modelSection}>
                            <div className={styles.modelDropdownWrapper}>
                                <button
                                    className={styles.modelDropdownBtn}
                                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                                >
                                    <span>{selectedModel.name}</span>
                                    <span className={styles.dropdownArrow}>▾</span>
                                </button>
                                {modelDropdownOpen && (
                                    <div className={styles.modelDropdown}>
                                        {GEMINI_MODELS.map((model) => (
                                            <button
                                                key={model.id}
                                                className={`${styles.modelOption} ${selectedModel.id === model.id ? styles.modelSelected : ''}`}
                                                onClick={() => {
                                                    playSound('click');
                                                    setSelectedModel(model);
                                                    setModelDropdownOpen(false);
                                                    setPreferredModel(model.id);
                                                }}
                                            >
                                                <span className={styles.modelName}>{model.name}</span>
                                                <span className={styles.modelDesc}>{model.description}</span>
                                                {selectedModel.id === model.id && <span className={styles.modelCheck}>✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        className={styles.newChatBtn}
                        onClick={() => {
                            playSound('click');
                            navigate('/dashboard');
                        }}
                        title="New Decision"
                    >
                        {sidebarOpen ? (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                New Decision
                            </>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        )}
                    </button>

                    {sidebarOpen && (
                        <div className={styles.historySection}>
                            <h3 className={styles.historyTitle}>Your Decisions</h3>
                            <div className={styles.historyList}>
                                {decisions.map((d) => (
                                    <button
                                        key={d.id}
                                        className={styles.historyItem}
                                        onClick={() => {
                                            playSound('click');
                                            navigate(`/decision/${d.id}`);
                                        }}
                                        title={d.content}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <span className={styles.historyText}>{d.content.substring(0, 30)}...</span>
                                    </button>
                                ))}
                                {decisions.length === 0 && (
                                    <p className={styles.historyEmpty}>No decisions yet</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.sidebarFooter}>
                    {sidebarOpen ? (
                        <>
                            <Link to="/profile" className={styles.profileLink}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span className={styles.userName}>{user?.name || user?.email?.split('@')[0]}</span>
                            </Link>
                            <button
                                onClick={() => {
                                    playSound('click');
                                    toggleMute();
                                }}
                                className={styles.muteBtn}
                                title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                            >
                                {isMuted ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <line x1="23" y1="9" x2="17" y2="15" />
                                        <line x1="17" y1="9" x2="23" y2="15" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                    </svg>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    playSound('click');
                                    logout();
                                }}
                                className={styles.logoutBtn}
                                title="Logout"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/profile" className={styles.iconBtn} title="Profile">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </Link>
                            <button
                                onClick={() => {
                                    playSound('click');
                                    toggleMute();
                                }}
                                className={styles.iconBtn}
                                title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                            >
                                {isMuted ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <line x1="23" y1="9" x2="17" y2="15" />
                                        <line x1="17" y1="9" x2="23" y2="15" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                    </svg>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    playSound('click');
                                    logout();
                                }}
                                className={styles.iconBtn}
                                title="Logout"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>

                <button
                    className={styles.sidebarToggle}
                    onClick={() => {
                        playSound('click');
                        setSidebarOpen(!sidebarOpen);
                    }}
                    title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {sidebarOpen ? (
                            <polyline points="15 18 9 12 15 6" />
                        ) : (
                            <polyline points="9 18 15 12 9 6" />
                        )}
                    </svg>
                </button>
            </aside>

            {sidebarOpen && <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

            <div className={styles.mainWrapper}>
                <header className={styles.header}>
                    <button
                        className={styles.mobileMenuBtn}
                        onClick={() => {
                            playSound('click');
                            setSidebarOpen(!sidebarOpen);
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>

                    <Link to="/dashboard" className={styles.headerLogo}>
                        <img src="/icon.png" alt="WhatIF" className={styles.headerLogoImg} />
                    </Link>

                    <button
                        onClick={() => {
                            playSound('click');
                            toggleTheme();
                        }}
                        className={styles.themeToggle}
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                    >
                        {theme === 'light' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                        )}
                    </button>
                </header>

                <main className={styles.main}>{children}</main>

                <footer className={styles.footer}>
                    <div className={styles.footerInner}>
                        <div className={styles.footerLead}>
                            <span className={styles.footerBrand}>WhatIF</span>
                            <span className={styles.footerTag}>Cognitive timeline simulator</span>
                        </div>
                        <p className={styles.footerCopy}>
                            Explore branching futures, compare trade-offs, and pressure-test your choices before you commit.
                        </p>
                        <div className={styles.footerMeta}>
                            <span>Powered by Gemini</span>
                            <span className={styles.footerDivider}>|</span>
                            <span>Built for bold decisions</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
