import { create } from 'zustand';
import { persistToken, setMode, getMode } from '../lib/storage';
import { STORAGE_KEYS } from '../constants/storage';
import { login, register, fetchProfile } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  mode: 'unauthenticated' | 'guest' | 'authenticated';
  user: User | null;
  token: string | null;
  initializing: boolean;
  setGuestMode: () => void;
  authenticate: (email: string, password: string, type: 'login' | 'register') => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: 'unauthenticated',
  user: null,
  token: null,
  initializing: true,
  setGuestMode: () => {
    set({ mode: 'guest', token: null, user: null });
    persistToken(null);
    setMode('guest');
  },
  authenticate: async (email, password, type) => {
    const request = type === 'login' ? login : register;
    const { data } = await request(email, password);
    persistToken(data.token);
    setMode('authenticated');
    set({ user: data.user, token: data.token, mode: 'authenticated' });
  },
  logout: () => {
    persistToken(null);
    setMode('unauthenticated');
    set({ mode: 'unauthenticated', token: null, user: null });
  },
  hydrate: async () => {
    if (get().token) {
      set({ initializing: false });
      return;
    }

    const savedMode = getMode();
    if (savedMode === 'guest') {
      set({ mode: 'guest', initializing: false });
      return;
    }

    const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.authToken) : null;
    if (storedToken) {
      try {
        const { data } = await fetchProfile();
        set({
          mode: 'authenticated',
          user: data.user,
          token: storedToken,
          initializing: false,
        });
        return;
      } catch {
        persistToken(null);
      }
    }

    set({ initializing: false, mode: 'unauthenticated' });
  },
}));
