import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'VOLUNTEER' | 'ADMIN';
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'odan-auth',
    }
  )
);

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

interface TimerState {
  isRunning: boolean;
  seconds: number;
  ticketId: string | null;
  startTimer: (ticketId: string) => void;
  stopTimer: () => number;
  tick: () => void;
  resetTimer: () => void;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  isRunning: false,
  seconds: 0,
  ticketId: null,
  startTimer: (ticketId) => set({ isRunning: true, ticketId, seconds: 0 }),
  stopTimer: () => {
    const { seconds } = get();
    set({ isRunning: false });
    return seconds;
  },
  tick: () => set((state) => ({ seconds: state.seconds + 1 })),
  resetTimer: () => set({ isRunning: false, seconds: 0, ticketId: null }),
}));
