/**
 * FlickSwipe Constants
 * App-wide configuration and magic numbers
 */

import { StreamingServiceInfo, Badge } from '../types';

// ============================================================================
// THEME COLORS
// ============================================================================

export const COLORS = {
  // Primary brand colors
  primary: '#FF6B6B',      // Coral red - main accent
  secondary: '#4ECDC4',    // Teal - secondary accent
  tertiary: '#FFE66D',     // Yellow - highlights/rewards

  // Background colors (dark mode optimized)
  background: '#0A0A0F',
  backgroundLight: '#12121A',
  backgroundCard: '#1A1A24',
  backgroundModal: '#0D0D12',

  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',

  // Action colors
  like: '#00D68F',         // Green for like/right swipe
  pass: '#FF4757',         // Red for pass/left swipe
  trailer: '#6C5CE7',      // Purple for trailer/up swipe
  reviews: '#FDCB6E',      // Gold for reviews/down swipe

  // Status colors
  success: '#00D68F',
  warning: '#FFB700',
  error: '#FF4757',
  info: '#00B4D8',

  // Gradient colors for rewards
  gradientGold: ['#FFD700', '#FFA500', '#FF8C00'],
  gradientPurple: ['#667EEA', '#764BA2'],
  gradientFire: ['#FF6B6B', '#FF8E53', '#FF4757'],
  gradientLegendary: ['#FFD700', '#FF6B6B', '#6C5CE7', '#00D68F'],
} as const;

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

export const ANIMATION = {
  // Swipe thresholds
  SWIPE_THRESHOLD: 120,           // Minimum distance to trigger swipe
  SWIPE_VELOCITY_THRESHOLD: 500,  // Velocity that auto-triggers swipe
  ROTATION_MULTIPLIER: 0.1,       // Degrees of rotation per pixel
  MAX_ROTATION: 25,               // Maximum card rotation in degrees

  // Timing (in ms)
  SPRING_CONFIG: {
    damping: 15,
    stiffness: 120,
    mass: 0.8,
  },
  FLING_DURATION: 300,
  SNAP_DURATION: 200,
  MATCH_REVEAL_DELAY: 500,
  CONFETTI_DURATION: 3000,

  // Scale factors
  CARD_SCALE_RATIO: 0.05,         // Scale reduction per card in stack
  STACK_OFFSET_Y: 8,              // Y offset per card in stack
  STACK_VISIBLE_CARDS: 3,         // Number of cards visible in stack
} as const;

// ============================================================================
// GAMIFICATION CONSTANTS
// ============================================================================

export const GAMIFICATION = {
  // Points
  POINTS_PER_SWIPE: 5,
  POINTS_MATCH_BASE: 20,
  POINTS_MATCH_MULTIPLIER: 10,    // Per additional member who matched
  POINTS_JACKPOT_BONUS: 100,
  POINTS_STREAK_BONUS: 50,
  POINTS_BADGE_BONUS: 25,

  // Thresholds
  DEFAULT_MATCH_THRESHOLD: 0.7,   // 70% consensus
  JACKPOT_THRESHOLD: 1.0,         // 100% consensus

  // Streaks
  STREAK_NOTIFICATION_HOURS: 24,  // Hours before streak warning

  // Power-ups
  DRY_SPELL_THRESHOLD: 15,        // Movies without match before power-up
  WILDCARD_PROBABILITY: 0.05,     // 5% chance of wildcard movie

  // Match reveal intensities
  REWARD_THRESHOLDS: {
    normal: 0.7,
    great: 0.85,
    epic: 0.95,
    legendary: 1.0,
  },
} as const;

// ============================================================================
// STREAMING SERVICES
// ============================================================================

export const STREAMING_SERVICES: StreamingServiceInfo[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    color: '#E50914',
    icon: 'play-circle',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    color: '#00A8E1',
    icon: 'play-circle',
  },
  {
    id: 'disney',
    name: 'Disney+',
    color: '#113CCF',
    icon: 'play-circle',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    color: '#1CE783',
    icon: 'play-circle',
  },
  {
    id: 'max',
    name: 'Max',
    color: '#002BE7',
    icon: 'play-circle',
  },
  {
    id: 'peacock',
    name: 'Peacock',
    color: '#000000',
    icon: 'play-circle',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    color: '#0064FF',
    icon: 'play-circle',
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    color: '#000000',
    icon: 'play-circle',
  },
];

// ============================================================================
// BADGES
// ============================================================================

export const AVAILABLE_BADGES: Omit<Badge, 'earnedAt'>[] = [
  {
    id: 'first_match',
    name: 'First Match',
    description: 'Found your first group match!',
    icon: '🎬',
  },
  {
    id: 'consensus_king',
    name: 'Consensus King',
    description: 'Achieved 100% group consensus',
    icon: '👑',
  },
  {
    id: 'hidden_gem',
    name: 'Hidden Gem Hunter',
    description: 'Matched on a movie with <100K votes',
    icon: '💎',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Swiped 50 movies in one session',
    icon: '⚡',
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintained a 7-day streak',
    icon: '🔥',
  },
  {
    id: 'movie_buff',
    name: 'Movie Buff',
    description: 'Matched on 50 movies total',
    icon: '🎭',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'One of the first 1000 users',
    icon: '🐦',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Joined 10 different rooms',
    icon: '🦋',
  },
];

// ============================================================================
// AVATAR EMOJIS
// ============================================================================

export const AVATAR_EMOJIS = [
  '🎬', '🎭', '🎪', '🎨', '🎤', '🎧', '🎵', '🎸',
  '🦊', '🐱', '🐶', '🐼', '🦁', '🐯', '🦋', '🦄',
  '🌟', '⭐', '✨', '🌙', '☀️', '🌈', '🔥', '💫',
  '🍿', '🎥', '📽️', '🎞️', '🎦', '📺', '🎮', '🕹️',
];

// ============================================================================
// TMDB CONFIGURATION
// ============================================================================

export const TMDB = {
  BASE_URL: 'https://api.themoviedb.org/3',
  IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
  POSTER_SIZE: 'w500',
  BACKDROP_SIZE: 'w1280',
  PROFILE_SIZE: 'w185',

  // Default genres for calibration
  CALIBRATION_GENRES: [28, 12, 16, 35, 80, 18, 14, 27, 10749, 878, 53],
  CALIBRATION_MOVIE_COUNT: 15,

  // Movies per page in deck
  MOVIES_PER_FETCH: 20,
  PREFETCH_THRESHOLD: 5,
} as const;

// ============================================================================
// GENRE MAPPING
// ============================================================================

export const GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

// ============================================================================
// FIREBASE COLLECTIONS
// ============================================================================

export const COLLECTIONS = {
  USERS: 'users',
  ROOMS: 'rooms',
  SWIPES: 'swipes',
  MATCHES: 'matches',
  SESSIONS: 'sessions',
} as const;

// ============================================================================
// ROOM CODE GENERATION
// ============================================================================

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

export const LAYOUT = {
  CARD_WIDTH_RATIO: 0.85,         // Card width as ratio of screen width
  CARD_ASPECT_RATIO: 1.5,         // Height/Width ratio (movie poster standard)
  BOTTOM_BUTTONS_HEIGHT: 80,
  HEADER_HEIGHT: 60,
  SAFE_AREA_PADDING: 16,
} as const;
