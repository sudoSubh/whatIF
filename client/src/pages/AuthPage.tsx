import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const [mode, setMode] = useState<Mode>(
        searchParams.get('mode') === 'register' ? 'register' :
            searchParams.get('token') ? 'reset' : 'login'
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [resetToken, setResetToken] = useState(searchParams.get('token') || '');
    const [message, setMessage] = useState('');

    // Reset tokens in URL leak via browser history & Referer headers. Strip
    // the query string immediately on mount; the token lives in component
    // state until the user submits it.
    useEffect(() => {
        if (searchParams.get('token')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [localLoading, setLocalLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // CAPTCHA state
    const [captchaChecked, setCaptchaChecked] = useState(false);
    const [captchaError, setCaptchaError] = useState(false);

    // Remember me state
    const [rememberMe, setRememberMe] = useState(false);

    const { login, register, guestLogin, isLoading, error, clearError } = useAuthStore();

    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestName, setGuestName] = useState('');

    const handleTryAsGuestClick = () => {
        setShowGuestModal(true);
        setGuestName('');
    };

    const handleGuestLoginSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setShowGuestModal(false);
        try {
            await guestLogin(guestName.trim() || undefined);
            navigate('/dashboard');
        } catch {
            // Error surfaced via store
        }
    };
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    // Password validation
    const validatePassword = (pwd: string): string | null => {
        if (pwd.length < 8) return 'Password must be at least 8 characters long.';
        if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
        if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
        if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'Password must contain at least one special character (!@#$...).';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setPasswordError('');

        // Validate CAPTCHA
        if (!captchaChecked) {
            setCaptchaError(true);
            return;
        }

        // Validate password for login/register/reset
        if (mode !== 'forgot') {
            const pwdError = validatePassword(password);
            if (pwdError) {
                setPasswordError(pwdError);
                return;
            }
        }

        try {
            if (mode === 'login') {
                // rememberMe is now honoured server-side: when true the JWT is
                // issued with a 30-day TTL instead of the default short window.
                await login(email, password, rememberMe);
                navigate('/dashboard');
            } else if (mode === 'register') {
                await register(email, password, name || undefined);
                navigate('/dashboard');
            } else if (mode === 'forgot') {
                setLocalLoading(true);
                try {
                    const data = await api.forgotPassword(email);
                    if (data.data) {
                        setMessage(data.data.message);
                        if (data.data.resetToken) {
                            setResetToken(data.data.resetToken);
                            setMode('reset');
                        }
                    }
                } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'An error occurred');
                } finally {
                    setLocalLoading(false);
                }
            } else if (mode === 'reset') {
                setLocalLoading(true);
                try {
                    const data = await api.resetPassword(resetToken, password);
                    if (data.data) {
                        setMessage(data.data.message);
                        setTimeout(() => {
                            setMode('login');
                            setMessage('');
                        }, 2000);
                    }
                } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'An error occurred');
                } finally {
                    setLocalLoading(false);
                }
            }
        } catch {
            setLocalLoading(false);
        }
    };

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setMessage('');
        setPasswordError('');
        setCaptchaChecked(false);
        setCaptchaError(false);
        clearError();
    };

    const getWelcomeTitle = () => {
        switch (mode) {
            case 'register': return 'Join the Future of Decision Making !';
            case 'forgot': return 'Secure Account Recovery !';
            case 'reset': return 'Create New Password !';
            default: return 'Welcome Back to the Future !';
        }
    };

    const getFormTitle = () => {
        switch (mode) {
            case 'register': return 'Create Account';
            case 'forgot': return 'Reset Password';
            case 'reset': return 'New Password';
            default: return 'Sign In';
        }
    };

    const getFormDescription = () => {
        switch (mode) {
            case 'register': return 'Start exploring infinite timelines.';
            case 'forgot': return 'Enter your email to receive recovery instructions.';
            case 'reset': return 'Choose a strong new password.';
            default: return 'Enter your credentials to access your account.';
        }
    };

    const getButtonText = () => {
        switch (mode) {
            case 'register': return 'Create Account';
            case 'forgot': return 'Send Recovery Link';
            case 'reset': return 'Reset Password';
            default: return 'Sign In';
        }
    };

    const loading = isLoading || localLoading;

    return (
        <div className={styles.container}>
            {/* Theme Toggle - Absolute Position by prateek*/}
            <button onClick={toggleTheme} className={styles.themeToggle} title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                {theme === 'light' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                )}
            </button>

            <div className={styles.card}>
                {/* Left Panel - Visual */}
                <div className={styles.leftPanel}>
                    {/* Decorative Circles */}
                    <div className={styles.decorCircle1}></div>
                    <div className={styles.decorCircle2}></div>
                    <div className={styles.decorCircle3}></div>

                    <div className={styles.leftContent}>
                        {/* Logo with Brand Name */}
                        <div className={styles.brandHeader}>
                            <div className={styles.logoWrapper}>
                                <img src="/icon.png" alt="WhatIF" className={styles.brandLogo} />
                            </div>
                            {/* ri ti k ra j<span className={styles.brandName}>WhatIF</span> */}
                        </div>

                        <h1 className={styles.welcomeTitle}>{getWelcomeTitle()}</h1>
                        <p className={styles.welcomeSubtitle}>
                            Experience the future before you choose it. AI-powered timeline simulation to help you make life's biggest decisions.
                        </p>
                    </div>

                    <div className={styles.trustBadge}>
                        <div className={styles.badgeIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <polyline points="9 12 11 14 15 10" />
                            </svg>
                        </div>
                        <div className={styles.badgeContent}>
                            <p className={styles.badgeTitle}>Powered by Gemini AI</p>
                            <p className={styles.badgeText}>Advanced future simulation technology</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className={styles.rightPanel}>
                    <div className={styles.formWrapper}>
                        <h2 className={styles.formTitle}>{getFormTitle()}</h2>
                        <p className={styles.formSubtitle}>{getFormDescription()}</p>

                        {error && <div className={styles.error}>{error}</div>}
                        {message && <div className={styles.success}>{message}</div>}

                        <form onSubmit={handleSubmit} className={styles.form}>
                            {mode === 'register' && (
                                <div className={styles.field}>
                                    <label className={styles.label}>Full Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="e.g. Prateek"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                            )}

                            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                                <div className={styles.field}>
                                    <label className={styles.label}>Email Address</label>
                                    <div className={styles.inputWrapper}>
                                        <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                            <polyline points="22,6 12,13 2,6" />
                                        </svg>
                                        <input
                                            type="email"
                                            className={`${styles.input} ${styles.inputWithIcon}`}
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'reset' && (
                                <div className={styles.field}>
                                    <label className={styles.label}>Reset Token</label>
                                    <div className={styles.inputWrapper}>
                                        <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                        </svg>
                                        <input
                                            type="text"
                                            className={`${styles.input} ${styles.inputWithIcon}`}
                                            placeholder="Enter your reset token"
                                            value={resetToken}
                                            onChange={(e) => setResetToken(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                                <div className={styles.field}>
                                    <div className={styles.labelRow}>
                                        <label className={styles.label}>
                                            {mode === 'reset' ? 'New Password' : 'Password'}
                                        </label>
                                        {mode === 'login' && (
                                            <button
                                                type="button"
                                                onClick={() => switchMode('forgot')}
                                                className={styles.forgotLink}
                                            >
                                                Forgot Password?
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.inputWrapper}>
                                        <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className={`${styles.input} ${styles.inputWithIcon} ${passwordError ? styles.inputError : ''}`}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                if (passwordError) setPasswordError('');
                                            }}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className={styles.passwordToggle}
                                        >
                                            {showPassword ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {passwordError && (
                                        <p className={styles.fieldError}>{passwordError}</p>
                                    )}
                                </div>
                            )}

                            {/* CAPTCHA */}
                            <div className={styles.captchaSection}>
                                <div
                                    className={`${styles.captchaBox} ${captchaError ? styles.captchaError : ''}`}
                                    onClick={() => {
                                        setCaptchaChecked(!captchaChecked);
                                        if (!captchaChecked) setCaptchaError(false);
                                    }}
                                >
                                    <div className={`${styles.captchaCheckbox} ${captchaChecked ? styles.captchaChecked : ''}`}>
                                        {captchaChecked && (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={styles.captchaText}>I'm not a robot</span>
                                    <img
                                        src="https://www.gstatic.com/recaptcha/api2/logo_48.png"
                                        alt="reCAPTCHA"
                                        className={styles.captchaLogo}
                                    />
                                </div>
                                {captchaError && (
                                    <p className={styles.captchaErrorText}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        Please verify you are human
                                    </p>
                                )}
                            </div>

                            {/* Remember Me - Only for Sign In */}
                            {mode === 'login' && (
                                <label className={styles.rememberMe}>
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className={styles.rememberCheckbox}
                                    />
                                    <span className={styles.rememberText}>Remember me for 30 days</span>
                                </label>
                            )}

                            <button type="submit" className={styles.submitBtn} disabled={loading}>
                                {loading ? (
                                    <div className={styles.spinner}></div>
                                ) : (
                                    <>
                                        {mode === 'forgot' && (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                            </svg>
                                        )}
                                        {getButtonText()}
                                        {mode !== 'forgot' && (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        )}
                                    </>
                                )}
                            </button>
                        </form>

                        {(mode === 'login' || mode === 'register') && (
                            <>
                                <div className={styles.guestDivider} aria-hidden="true">or</div>
                                <button
                                    type="button"
                                    onClick={handleTryAsGuestClick}
                                    disabled={loading}
                                    className={styles.guestBtn}
                                    aria-label="Try the app as a guest without signing up"
                                >
                                    Try as guest
                                </button>
                                <p className={styles.guestNote}>
                                    No sign-up needed. 60-minute session; data is deleted after 7 days.
                                </p>
                            </>
                        )}

                        <div className={styles.toggle}>
                            {mode === 'forgot' || mode === 'reset' ? (
                                <button onClick={() => switchMode('login')} className={styles.backLink}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="19" y1="12" x2="5" y2="12" />
                                        <polyline points="12 19 5 12 12 5" />
                                    </svg>
                                    Back to Sign In
                                </button>
                            ) : (
                                <p className={styles.toggleText}>
                                    {mode === 'login' ? "Don't have an account yet?" : "Already have an account?"}{' '}
                                    <button
                                        onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                        className={styles.toggleButton}
                                    >
                                        {mode === 'login' ? 'Sign Up' : 'Log In'}
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showGuestModal && (
                <div className={styles.modalOverlay} onClick={() => setShowGuestModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>Enter your name</h3>
                        <p className={styles.modalDescription}>
                            Please enter your name to customize your guest session.
                        </p>
                        <form onSubmit={handleGuestLoginSubmit} className={styles.modalForm}>
                            <input
                                type="text"
                                className="input"
                                placeholder="Your name (e.g. Alex)"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                maxLength={30}
                                autoFocus
                            />
                            <div className={styles.modalButtons}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowGuestModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    Continue
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
