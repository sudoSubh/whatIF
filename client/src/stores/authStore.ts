import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { isGuestTokenValid } from '../lib/jwt';
import type { User } from '../types';

const GUEST_TOKEN_KEY = 'whatif_guest_token';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    guestLogin: (name?: string) => Promise<void>;
    logout: () => void;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: Partial<User>) => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,
            error: null,

            login: async (email, password, rememberMe) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.login(email, password, rememberMe);
                    if (response.data) {
                        api.setToken(response.data.token);
                        set({
                            token: response.data.token,
                            user: response.data.user as unknown as User,
                            isLoading: false
                        });
                        // Fetch full profile
                        await get().fetchProfile();
                    }
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Login failed',
                        isLoading: false
                    });
                    throw error;
                }
            },

            register: async (email, password, name) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.register(email, password, name);
                    if (response.data) {
                        // The user has committed to a real account; any previously
                        // cached guest token is no longer useful and shouldn't
                        // resurface if they later click "Try as guest".
                        localStorage.removeItem(GUEST_TOKEN_KEY);
                        api.setToken(response.data.token);
                        set({
                            token: response.data.token,
                            user: response.data.user as unknown as User,
                            isLoading: false
                        });
                        await get().fetchProfile();
                    }
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Registration failed',
                        isLoading: false
                    });
                    throw error;
                }
            },

            guestLogin: async (name?: string) => {
                set({ isLoading: true, error: null });

                // Reuse a still-valid guest token from a previous session, but ONLY if
                // no custom guest name is being requested.
                const cachedGuestToken = localStorage.getItem(GUEST_TOKEN_KEY);
                if (!name && isGuestTokenValid(cachedGuestToken)) {
                    api.setToken(cachedGuestToken);
                    set({ token: cachedGuestToken });
                    try {
                        await get().fetchProfile();
                        // Profile resolved: token still works server-side.
                        if (get().user) {
                            set({ isLoading: false });
                            return;
                        }
                    } catch {
                        // Profile call failed — server-side state may have been
                        // wiped (e.g. by the 7-day guest sweep). Fall through
                        // and mint a fresh guest below.
                    }
                    // If we got here, the cached token is unusable.
                    localStorage.removeItem(GUEST_TOKEN_KEY);
                    api.setToken(null);
                    set({ token: null, user: null });
                } else if (name) {
                    // Wiping old guest credentials if user wants to log in with a new name
                    localStorage.removeItem(GUEST_TOKEN_KEY);
                    api.setToken(null);
                    set({ token: null, user: null });
                }

                try {
                    const response = await api.guestLogin(name);
                    if (response.data) {
                        api.setToken(response.data.token);
                        localStorage.setItem(GUEST_TOKEN_KEY, response.data.token);
                        set({
                            token: response.data.token,
                            user: response.data.user as unknown as User,
                            isLoading: false,
                        });
                        await get().fetchProfile();
                    }
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Guest sign-in failed',
                        isLoading: false,
                    });
                    throw error;
                }
            },

            logout: () => {
                api.setToken(null);
                set({ user: null, token: null, error: null });
            },

            fetchProfile: async () => {
                try {
                    const response = await api.getProfile();
                    if (response.data) {
                        set({ user: response.data });
                    }
                } catch (error) {
                    if (import.meta.env.DEV) console.error('Failed to fetch profile:', error);
                }
            },

            updateProfile: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.updateProfile(data);
                    if (response.data) {
                        set({ user: response.data, isLoading: false });
                    }
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : 'Update failed',
                        isLoading: false
                    });
                    throw error;
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ token: state.token }),
        }
    )
);
