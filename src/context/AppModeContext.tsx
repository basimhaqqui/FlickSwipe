/**
 * AppModeContext
 *
 * Central context for managing app mode (solo vs group),
 * user profile, and session state across the app.
 *
 * Solo mode is the default/quick-entry experience.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { User, Movie, Room, StreamingService } from '../types';
import {
  signInAnonymousUser,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
} from '../services/firebase';

// ============================================================================
// TYPES
// ============================================================================

export type AppMode = 'solo' | 'group';

export interface SoloSession {
  id: string;
  startedAt: number;
  swipeCount: number;
  likesCount: number;
  passCount: number;
  currentStreak: number; // Consecutive likes streak
  highestStreak: number;
  pointsEarned: number;
}

export interface DailyGoal {
  id: string;
  type: 'likes' | 'swipes' | 'streak' | 'watchlist';
  target: number;
  current: number;
  completed: boolean;
  reward: number;
}

export interface SoloStats {
  totalSwipes: number;
  totalLikes: number;
  totalPasses: number;
  currentDayStreak: number; // Days in a row with activity
  longestDayStreak: number;
  lastActiveDate: string;
  averageTasteMatch: number;
  topGenres: number[];
  perfectMatches: number; // 90%+ taste match likes
}

export interface AppModeContextType {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // User
  user: User | null;
  isLoading: boolean;
  isFirstLaunch: boolean;
  setIsFirstLaunch: (value: boolean) => void;

  // Solo state
  soloSession: SoloSession | null;
  soloStats: SoloStats;
  dailyGoals: DailyGoal[];
  soloWatchlist: Movie[];

  // Solo actions
  startSoloSession: () => void;
  endSoloSession: () => void;
  recordSoloSwipe: (movie: Movie, liked: boolean, tasteMatch: number) => void;
  addToSoloWatchlist: (movie: Movie, tasteMatch: number) => void;
  removeFromSoloWatchlist: (movieId: number) => void;
  updateDailyGoalProgress: (goalId: string, progress: number) => void;
  generateDailyGoals: () => void;

  // Group state (for seamless transition)
  currentRoom: Room | null;
  setCurrentRoom: (room: Room | null) => void;

  // Streaming preferences
  selectedServices: StreamingService[];
  setSelectedServices: (services: StreamingService[]) => void;

  // Quick Pick
  quickPickMovies: Movie[];
  setQuickPickMovies: (movies: Movie[]) => void;
  showQuickPick: boolean;
  setShowQuickPick: (show: boolean) => void;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  IS_FIRST_LAUNCH: '@flickswipe:first_launch',
  SOLO_STATS: '@flickswipe:solo_stats',
  SOLO_WATCHLIST: '@flickswipe:solo_watchlist',
  DAILY_GOALS: '@flickswipe:daily_goals',
  DAILY_GOALS_DATE: '@flickswipe:daily_goals_date',
  SELECTED_SERVICES: '@flickswipe:selected_services',
  TASTE_PROFILE: '@flickswipe:taste_profile',
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_SOLO_STATS: SoloStats = {
  totalSwipes: 0,
  totalLikes: 0,
  totalPasses: 0,
  currentDayStreak: 0,
  longestDayStreak: 0,
  lastActiveDate: '',
  averageTasteMatch: 0,
  topGenres: [],
  perfectMatches: 0,
};

const DEFAULT_DAILY_GOALS: DailyGoal[] = [
  {
    id: 'likes_5',
    type: 'likes',
    target: 5,
    current: 0,
    completed: false,
    reward: 50,
  },
  {
    id: 'swipes_20',
    type: 'swipes',
    target: 20,
    current: 0,
    completed: false,
    reward: 30,
  },
  {
    id: 'streak_3',
    type: 'streak',
    target: 3,
    current: 0,
    completed: false,
    reward: 75,
  },
];

// ============================================================================
// CONTEXT
// ============================================================================

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface AppModeProviderProps {
  children: ReactNode;
}

export const AppModeProvider: React.FC<AppModeProviderProps> = ({ children }) => {
  // Core state
  const [mode, setMode] = useState<AppMode>('solo');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  // Solo state
  const [soloSession, setSoloSession] = useState<SoloSession | null>(null);
  const [soloStats, setSoloStats] = useState<SoloStats>(DEFAULT_SOLO_STATS);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>(DEFAULT_DAILY_GOALS);
  const [soloWatchlist, setSoloWatchlist] = useState<Movie[]>([]);

  // Group state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  // Preferences
  const [selectedServices, setSelectedServices] = useState<StreamingService[]>([
    'netflix',
    'prime',
    'disney',
  ]);

  // Quick Pick
  const [quickPickMovies, setQuickPickMovies] = useState<Movie[]>([]);
  const [showQuickPick, setShowQuickPick] = useState(false);

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check first launch
      const firstLaunch = await AsyncStorage.getItem(STORAGE_KEYS.IS_FIRST_LAUNCH);
      setIsFirstLaunch(firstLaunch === null);

      // Load solo stats
      const savedStats = await AsyncStorage.getItem(STORAGE_KEYS.SOLO_STATS);
      if (savedStats) {
        setSoloStats(JSON.parse(savedStats));
      }

      // Load watchlist
      const savedWatchlist = await AsyncStorage.getItem(STORAGE_KEYS.SOLO_WATCHLIST);
      if (savedWatchlist) {
        setSoloWatchlist(JSON.parse(savedWatchlist));
      }

      // Load streaming preferences
      const savedServices = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SERVICES);
      if (savedServices) {
        setSelectedServices(JSON.parse(savedServices));
      }

      // Load/generate daily goals
      await loadOrGenerateDailyGoals();

      // Initialize user (anonymous auth)
      const newUser = await signInAnonymousUser();
      setUser(newUser);

      // Check and update day streak
      await checkDayStreak();

      setIsLoading(false);
    } catch (error) {
      console.error('Init error:', error);
      setIsLoading(false);
    }
  };

  // ========================================================================
  // DAY STREAK MANAGEMENT
  // ========================================================================

  const checkDayStreak = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    setSoloStats((prev) => {
      let newStreak = prev.currentDayStreak;

      if (prev.lastActiveDate === yesterday) {
        // Continue streak
        newStreak = prev.currentDayStreak + 1;
      } else if (prev.lastActiveDate !== today) {
        // Streak broken
        newStreak = 1;
      }

      return {
        ...prev,
        currentDayStreak: newStreak,
        longestDayStreak: Math.max(prev.longestDayStreak, newStreak),
        lastActiveDate: today,
      };
    });
  };

  // ========================================================================
  // DAILY GOALS
  // ========================================================================

  const loadOrGenerateDailyGoals = async () => {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_GOALS_DATE);

    if (savedDate === today) {
      const savedGoals = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_GOALS);
      if (savedGoals) {
        setDailyGoals(JSON.parse(savedGoals));
        return;
      }
    }

    // Generate new goals for today
    generateDailyGoals();
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_GOALS_DATE, today);
  };

  const generateDailyGoals = useCallback(() => {
    const goals: DailyGoal[] = [
      {
        id: `likes_${Date.now()}`,
        type: 'likes',
        target: 5 + Math.floor(Math.random() * 10),
        current: 0,
        completed: false,
        reward: 50 + Math.floor(Math.random() * 50),
      },
      {
        id: `swipes_${Date.now()}`,
        type: 'swipes',
        target: 20 + Math.floor(Math.random() * 30),
        current: 0,
        completed: false,
        reward: 30 + Math.floor(Math.random() * 20),
      },
      {
        id: `streak_${Date.now()}`,
        type: 'streak',
        target: 3 + Math.floor(Math.random() * 5),
        current: 0,
        completed: false,
        reward: 75 + Math.floor(Math.random() * 75),
      },
    ];

    setDailyGoals(goals);
    saveDailyGoals(goals);
  }, []);

  const saveDailyGoals = async (goals: DailyGoal[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_GOALS, JSON.stringify(goals));
  };

  const updateDailyGoalProgress = useCallback((goalId: string, progress: number) => {
    setDailyGoals((prev) => {
      const updated = prev.map((goal) => {
        if (goal.id === goalId) {
          const newCurrent = goal.current + progress;
          return {
            ...goal,
            current: newCurrent,
            completed: newCurrent >= goal.target,
          };
        }
        return goal;
      });

      saveDailyGoals(updated);
      return updated;
    });
  }, []);

  // ========================================================================
  // SOLO SESSION MANAGEMENT
  // ========================================================================

  const startSoloSession = useCallback(() => {
    const session: SoloSession = {
      id: `solo_${Date.now()}`,
      startedAt: Date.now(),
      swipeCount: 0,
      likesCount: 0,
      passCount: 0,
      currentStreak: 0,
      highestStreak: 0,
      pointsEarned: 0,
    };

    setSoloSession(session);
    setQuickPickMovies([]);
    setShowQuickPick(false);
  }, []);

  const endSoloSession = useCallback(() => {
    if (soloSession) {
      // Update overall stats
      setSoloStats((prev) => {
        const updated = {
          ...prev,
          totalSwipes: prev.totalSwipes + soloSession.swipeCount,
          totalLikes: prev.totalLikes + soloSession.likesCount,
          totalPasses: prev.totalPasses + soloSession.passCount,
        };

        AsyncStorage.setItem(STORAGE_KEYS.SOLO_STATS, JSON.stringify(updated));
        return updated;
      });
    }

    setSoloSession(null);
  }, [soloSession]);

  const recordSoloSwipe = useCallback(
    (movie: Movie, liked: boolean, tasteMatch: number) => {
      if (!soloSession) return;

      setSoloSession((prev) => {
        if (!prev) return prev;

        const newLikesCount = liked ? prev.likesCount + 1 : prev.likesCount;
        const newPassCount = liked ? prev.passCount : prev.passCount + 1;
        const newStreak = liked ? prev.currentStreak + 1 : 0;
        const basePoints = 5;
        const matchBonus = liked && tasteMatch >= 0.85 ? 25 : liked ? 10 : 0;

        return {
          ...prev,
          swipeCount: prev.swipeCount + 1,
          likesCount: newLikesCount,
          passCount: newPassCount,
          currentStreak: newStreak,
          highestStreak: Math.max(prev.highestStreak, newStreak),
          pointsEarned: prev.pointsEarned + basePoints + matchBonus,
        };
      });

      // Update daily goals
      const swipeGoal = dailyGoals.find((g) => g.type === 'swipes');
      if (swipeGoal && !swipeGoal.completed) {
        updateDailyGoalProgress(swipeGoal.id, 1);
      }

      if (liked) {
        const likesGoal = dailyGoals.find((g) => g.type === 'likes');
        if (likesGoal && !likesGoal.completed) {
          updateDailyGoalProgress(likesGoal.id, 1);
        }
      }

      // Track perfect matches
      if (liked && tasteMatch >= 0.9) {
        setSoloStats((prev) => ({
          ...prev,
          perfectMatches: prev.perfectMatches + 1,
        }));
      }

      // Check for Quick Pick trigger (15-30 swipes)
      if (
        soloSession &&
        soloSession.swipeCount >= 15 &&
        soloSession.likesCount >= 3 &&
        !showQuickPick
      ) {
        setShowQuickPick(true);
      }
    },
    [soloSession, dailyGoals, showQuickPick, updateDailyGoalProgress]
  );

  // ========================================================================
  // WATCHLIST MANAGEMENT
  // ========================================================================

  const addToSoloWatchlist = useCallback((movie: Movie, tasteMatch: number) => {
    setSoloWatchlist((prev) => {
      // Check if already in watchlist
      if (prev.some((m) => m.id === movie.id)) {
        return prev;
      }

      // Add with taste match score
      const movieWithMatch = {
        ...movie,
        tasteMatchScore: tasteMatch,
        addedAt: Date.now(),
      };

      const updated = [movieWithMatch, ...prev];

      // Save to storage
      AsyncStorage.setItem(STORAGE_KEYS.SOLO_WATCHLIST, JSON.stringify(updated));

      return updated;
    });
  }, []);

  const removeFromSoloWatchlist = useCallback((movieId: number) => {
    setSoloWatchlist((prev) => {
      const updated = prev.filter((m) => m.id !== movieId);
      AsyncStorage.setItem(STORAGE_KEYS.SOLO_WATCHLIST, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ========================================================================
  // PREFERENCES
  // ========================================================================

  const handleSetSelectedServices = useCallback((services: StreamingService[]) => {
    setSelectedServices(services);
    AsyncStorage.setItem(STORAGE_KEYS.SELECTED_SERVICES, JSON.stringify(services));
  }, []);

  const handleSetIsFirstLaunch = useCallback((value: boolean) => {
    setIsFirstLaunch(value);
    if (!value) {
      AsyncStorage.setItem(STORAGE_KEYS.IS_FIRST_LAUNCH, 'false');
    }
  }, []);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  const value: AppModeContextType = {
    mode,
    setMode,
    user,
    isLoading,
    isFirstLaunch,
    setIsFirstLaunch: handleSetIsFirstLaunch,
    soloSession,
    soloStats,
    dailyGoals,
    soloWatchlist,
    startSoloSession,
    endSoloSession,
    recordSoloSwipe,
    addToSoloWatchlist,
    removeFromSoloWatchlist,
    updateDailyGoalProgress,
    generateDailyGoals,
    currentRoom,
    setCurrentRoom,
    selectedServices,
    setSelectedServices: handleSetSelectedServices,
    quickPickMovies,
    setQuickPickMovies,
    showQuickPick,
    setShowQuickPick,
  };

  return (
    <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useAppMode = (): AppModeContextType => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return context;
};

export default AppModeContext;
