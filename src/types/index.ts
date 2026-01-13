/**
 * FlickSwipe Type Definitions
 * Core data models for the entire application
 */

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  id: string;
  displayName: string;
  avatarEmoji: string; // Fun emoji avatar for anonymous users
  createdAt: number;
  stats: UserStats;
}

export interface UserStats {
  totalSwipes: number;
  totalMatches: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  favoriteGenres: number[]; // Genre IDs from calibration
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
}

// ============================================================================
// ROOM TYPES
// ============================================================================

export interface Room {
  id: string;
  code: string; // 6-character shareable code
  name: string;
  hostId: string;
  members: RoomMember[];
  streamingServices: StreamingService[];
  matchThreshold: number; // 0.5 to 1.0 (50% to 100% consensus)
  status: RoomStatus;
  calibrationComplete: boolean;
  createdAt: number;
  currentSessionId: string | null;
  stats: RoomStats;
}

export interface RoomMember {
  id: string;
  displayName: string;
  avatarEmoji: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
  currentPoints: number; // Session points
}

export interface RoomStats {
  totalSessions: number;
  totalMatches: number;
  streak: number; // Consecutive sessions with at least 1 match
  lastSessionAt: number;
}

export type RoomStatus = 'waiting' | 'calibrating' | 'swiping' | 'complete';

// ============================================================================
// STREAMING SERVICES
// ============================================================================

export type StreamingService =
  | 'netflix'
  | 'prime'
  | 'disney'
  | 'hulu'
  | 'max'
  | 'peacock'
  | 'paramount'
  | 'apple';

export interface StreamingServiceInfo {
  id: StreamingService;
  name: string;
  color: string;
  icon: string;
}

// ============================================================================
// MOVIE TYPES (TMDB-based)
// ============================================================================

export interface Movie {
  id: number;
  title: string;
  originalTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  runtime?: number;
  adult: boolean;
  originalLanguage: string;
  // Extended data (fetched separately)
  trailerKey?: string | null;
  streamingOn?: StreamingService[];
}

export interface MovieDetails extends Movie {
  runtime: number;
  genres: Genre[];
  productionCompanies: ProductionCompany[];
  tagline: string;
  budget: number;
  revenue: number;
  status: string;
  credits?: Credits;
}

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

// ============================================================================
// TRAILER & REVIEW TYPES
// ============================================================================

export interface Trailer {
  id: string;
  key: string; // YouTube video key
  name: string;
  site: string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette';
  official: boolean;
}

export interface Review {
  id: string;
  author: string;
  authorDetails: AuthorDetails;
  content: string;
  createdAt: string;
  updatedAt: string;
  rating: number | null;
}

export interface AuthorDetails {
  name: string;
  username: string;
  avatarPath: string | null;
  rating: number | null;
}

// ============================================================================
// SWIPE & MATCH TYPES
// ============================================================================

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';
export type SwipeAction = 'pass' | 'like' | 'trailer' | 'reviews';

export interface Swipe {
  id: string;
  roomId: string;
  userId: string;
  movieId: number;
  action: SwipeAction;
  direction: SwipeDirection;
  timestamp: number;
}

export interface Match {
  id: string;
  roomId: string;
  movieId: number;
  movie: Movie;
  matchedBy: string[]; // User IDs who liked
  consensusPercentage: number;
  timestamp: number;
  isJackpot: boolean; // 100% consensus or special conditions
  rewardIntensity: RewardIntensity;
}

export type RewardIntensity = 'normal' | 'great' | 'epic' | 'legendary';

// ============================================================================
// GAMIFICATION TYPES
// ============================================================================

export interface PowerUp {
  id: string;
  type: PowerUpType;
  name: string;
  description: string;
  icon: string;
  usesRemaining: number;
}

export type PowerUpType =
  | 'undo'          // Undo last swipe
  | 'superlike'     // Counts as 2 likes
  | 'wildcard'      // Higher match chance movie
  | 'peek'          // See what others swiped
  | 'reroll';       // Get new movie suggestions

export interface PointEvent {
  type: 'swipe' | 'match' | 'streak' | 'badge' | 'powerup';
  points: number;
  description: string;
  timestamp: number;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface Session {
  id: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
  moviesShown: number[];
  matches: Match[];
  participants: string[];
  pointsAwarded: Record<string, number>;
}

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

export type RootStackParamList = {
  // Solo mode screens
  Onboarding: undefined;
  Home: undefined;
  SoloSwipeDeck: undefined;
  SoloWatchlist: undefined;

  // Group mode screens
  RoomCreateJoin: { mode: 'create' | 'join' } | undefined;
  RoomLobby: { roomId: string };
  Calibration: { roomId: string };
  SwipeDeck: { roomId: string };
  Watchlist: { roomId: string };

  // Shared screens
  Profile: undefined;
};

// ============================================================================
// CALLBACK TYPES
// ============================================================================

export interface SwipeCallbacks {
  onSwipeLeft: (movie: Movie) => void;
  onSwipeRight: (movie: Movie) => void;
  onSwipeUp: (movie: Movie) => void;
  onSwipeDown: (movie: Movie) => void;
  onCardChange: (index: number) => void;
}
