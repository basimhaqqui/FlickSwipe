/**
 * TasteProfile Service
 *
 * Calculates personalized "Taste Match" percentages for movies
 * based on user calibration, past swipes, and viewing history.
 *
 * Uses a weighted scoring system:
 * - Genre preferences (40%)
 * - Rating alignment (20%)
 * - Year preferences (15%)
 * - Popularity fit (10%)
 * - Similar movies liked (15%)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Movie } from '../types';
import { GENRES } from '../constants';

// ============================================================================
// TYPES
// ============================================================================

export interface TasteProfile {
  // Genre scores (-1 to 1, negative = dislike, positive = like)
  genreScores: Record<number, number>;

  // Preferred rating range
  preferredRatingMin: number;
  preferredRatingMax: number;

  // Preferred decade/era
  preferredYearMin: number;
  preferredYearMax: number;

  // Popularity preference (0 = mainstream, 1 = hidden gems)
  hiddenGemPreference: number;

  // Liked movie IDs for similarity matching
  likedMovieIds: number[];

  // Passed movie IDs
  passedMovieIds: number[];

  // Calibration complete flag
  calibrationComplete: boolean;

  // Total interactions for confidence
  totalInteractions: number;

  // Last updated
  updatedAt: number;
}

export interface TasteMatchResult {
  score: number; // 0-100
  breakdown: {
    genreMatch: number;
    ratingMatch: number;
    yearMatch: number;
    popularityMatch: number;
    similarityBonus: number;
  };
  confidence: 'low' | 'medium' | 'high';
  highlights: string[]; // Reasons for match
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = '@flickswipe:taste_profile';

const DEFAULT_PROFILE: TasteProfile = {
  genreScores: {},
  preferredRatingMin: 5.0,
  preferredRatingMax: 10.0,
  preferredYearMin: 1990,
  preferredYearMax: new Date().getFullYear(),
  hiddenGemPreference: 0.3,
  likedMovieIds: [],
  passedMovieIds: [],
  calibrationComplete: false,
  totalInteractions: 0,
  updatedAt: Date.now(),
};

// Weights for scoring components
const WEIGHTS = {
  genre: 0.40,
  rating: 0.20,
  year: 0.15,
  popularity: 0.10,
  similarity: 0.15,
};

// Popular/hidden gem thresholds
const POPULARITY_THRESHOLD = {
  mainstream: 100, // >100 popularity = mainstream
  hiddenGem: 30,   // <30 popularity = hidden gem
};

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

let cachedProfile: TasteProfile | null = null;

/**
 * Load taste profile from storage
 */
export async function loadTasteProfile(): Promise<TasteProfile> {
  if (cachedProfile) {
    return cachedProfile;
  }

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      cachedProfile = JSON.parse(saved);
      return cachedProfile!;
    }
  } catch (error) {
    console.error('Error loading taste profile:', error);
  }

  cachedProfile = { ...DEFAULT_PROFILE };
  return cachedProfile;
}

/**
 * Save taste profile to storage
 */
export async function saveTasteProfile(profile: TasteProfile): Promise<void> {
  try {
    cachedProfile = profile;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Error saving taste profile:', error);
  }
}

/**
 * Reset taste profile
 */
export async function resetTasteProfile(): Promise<void> {
  cachedProfile = { ...DEFAULT_PROFILE };
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// PROFILE UPDATES
// ============================================================================

/**
 * Record a swipe and update taste profile
 */
export async function recordSwipeForTaste(
  movie: Movie,
  liked: boolean
): Promise<void> {
  const profile = await loadTasteProfile();

  // Update genre scores
  movie.genreIds.forEach((genreId) => {
    const currentScore = profile.genreScores[genreId] || 0;
    const delta = liked ? 0.1 : -0.1;
    profile.genreScores[genreId] = Math.max(-1, Math.min(1, currentScore + delta));
  });

  // Update rating preferences
  if (liked) {
    const rating = movie.voteAverage;
    // Expand preferred range towards this rating
    if (rating < profile.preferredRatingMin) {
      profile.preferredRatingMin = profile.preferredRatingMin * 0.9 + rating * 0.1;
    }
    if (rating > profile.preferredRatingMax) {
      profile.preferredRatingMax = profile.preferredRatingMax * 0.9 + rating * 0.1;
    }
  }

  // Update year preferences
  if (liked && movie.releaseDate) {
    const year = parseInt(movie.releaseDate.split('-')[0], 10);
    if (!isNaN(year)) {
      if (year < profile.preferredYearMin) {
        profile.preferredYearMin = Math.floor(profile.preferredYearMin * 0.9 + year * 0.1);
      }
      if (year > profile.preferredYearMax) {
        profile.preferredYearMax = Math.ceil(profile.preferredYearMax * 0.9 + year * 0.1);
      }
    }
  }

  // Update hidden gem preference
  const isHiddenGem = movie.popularity < POPULARITY_THRESHOLD.hiddenGem;
  if (liked && isHiddenGem) {
    profile.hiddenGemPreference = Math.min(1, profile.hiddenGemPreference + 0.05);
  } else if (liked && movie.popularity > POPULARITY_THRESHOLD.mainstream) {
    profile.hiddenGemPreference = Math.max(0, profile.hiddenGemPreference - 0.03);
  }

  // Track liked/passed movies
  if (liked) {
    if (!profile.likedMovieIds.includes(movie.id)) {
      profile.likedMovieIds.push(movie.id);
      // Keep last 500 likes
      if (profile.likedMovieIds.length > 500) {
        profile.likedMovieIds = profile.likedMovieIds.slice(-500);
      }
    }
  } else {
    if (!profile.passedMovieIds.includes(movie.id)) {
      profile.passedMovieIds.push(movie.id);
      // Keep last 200 passes
      if (profile.passedMovieIds.length > 200) {
        profile.passedMovieIds = profile.passedMovieIds.slice(-200);
      }
    }
  }

  profile.totalInteractions += 1;
  profile.updatedAt = Date.now();

  await saveTasteProfile(profile);
}

/**
 * Mark calibration as complete
 */
export async function completeCalibration(
  likedGenres: number[],
  dislikedGenres: number[]
): Promise<void> {
  const profile = await loadTasteProfile();

  // Set strong initial preferences from calibration
  likedGenres.forEach((genreId) => {
    profile.genreScores[genreId] = 0.7;
  });

  dislikedGenres.forEach((genreId) => {
    profile.genreScores[genreId] = -0.5;
  });

  profile.calibrationComplete = true;
  profile.updatedAt = Date.now();

  await saveTasteProfile(profile);
}

// ============================================================================
// TASTE MATCH CALCULATION
// ============================================================================

/**
 * Calculate taste match percentage for a movie
 */
export async function calculateTasteMatch(movie: Movie): Promise<TasteMatchResult> {
  const profile = await loadTasteProfile();

  const breakdown = {
    genreMatch: calculateGenreMatch(movie, profile),
    ratingMatch: calculateRatingMatch(movie, profile),
    yearMatch: calculateYearMatch(movie, profile),
    popularityMatch: calculatePopularityMatch(movie, profile),
    similarityBonus: calculateSimilarityBonus(movie, profile),
  };

  // Calculate weighted score
  const rawScore =
    breakdown.genreMatch * WEIGHTS.genre +
    breakdown.ratingMatch * WEIGHTS.rating +
    breakdown.yearMatch * WEIGHTS.year +
    breakdown.popularityMatch * WEIGHTS.popularity +
    breakdown.similarityBonus * WEIGHTS.similarity;

  // Add randomness for unpredictability (variable rewards!)
  const randomFactor = 0.95 + Math.random() * 0.10; // 0.95-1.05
  const finalScore = Math.min(100, Math.max(0, rawScore * randomFactor));

  // Determine confidence
  const confidence = getConfidenceLevel(profile);

  // Generate highlights
  const highlights = generateHighlights(movie, breakdown, profile);

  return {
    score: Math.round(finalScore),
    breakdown,
    confidence,
    highlights,
  };
}

/**
 * Quick taste match (lighter calculation for batch processing)
 */
export async function quickTasteMatch(movie: Movie): Promise<number> {
  const profile = await loadTasteProfile();

  // Simplified calculation
  const genreScore = calculateGenreMatch(movie, profile) * 0.6;
  const ratingScore = calculateRatingMatch(movie, profile) * 0.25;
  const randomBoost = Math.random() * 15; // Add variability

  return Math.min(99, Math.max(45, genreScore + ratingScore + randomBoost));
}

// ============================================================================
// SCORING HELPERS
// ============================================================================

function calculateGenreMatch(movie: Movie, profile: TasteProfile): number {
  if (movie.genreIds.length === 0) return 50;

  let totalScore = 0;
  let matchedGenres = 0;

  movie.genreIds.forEach((genreId) => {
    const genreScore = profile.genreScores[genreId] ?? 0;
    // Convert -1 to 1 range to 0-100
    totalScore += (genreScore + 1) * 50;
    matchedGenres += 1;
  });

  if (matchedGenres === 0) return 50;

  // Base score from genre preferences
  let score = totalScore / matchedGenres;

  // Bonus for multiple liked genres
  const likedGenreCount = movie.genreIds.filter(
    (id) => (profile.genreScores[id] ?? 0) > 0.3
  ).length;

  if (likedGenreCount >= 2) {
    score += 10;
  }

  return Math.min(100, score);
}

function calculateRatingMatch(movie: Movie, profile: TasteProfile): number {
  const rating = movie.voteAverage;

  // Check if within preferred range
  if (rating >= profile.preferredRatingMin && rating <= profile.preferredRatingMax) {
    // Perfect fit
    return 90 + Math.random() * 10;
  }

  // Calculate distance from preferred range
  const distanceBelow = Math.max(0, profile.preferredRatingMin - rating);
  const distanceAbove = Math.max(0, rating - profile.preferredRatingMax);
  const distance = distanceBelow + distanceAbove;

  // Penalize based on distance (max penalty at 3 points away)
  const penalty = Math.min(50, distance * 15);

  return Math.max(30, 85 - penalty);
}

function calculateYearMatch(movie: Movie, profile: TasteProfile): number {
  if (!movie.releaseDate) return 60;

  const year = parseInt(movie.releaseDate.split('-')[0], 10);
  if (isNaN(year)) return 60;

  // Check if within preferred range
  if (year >= profile.preferredYearMin && year <= profile.preferredYearMax) {
    return 85 + Math.random() * 15;
  }

  // Calculate distance from preferred range
  const distanceBefore = Math.max(0, profile.preferredYearMin - year);
  const distanceAfter = Math.max(0, year - profile.preferredYearMax);
  const distance = distanceBefore + distanceAfter;

  // Penalize based on distance (decades matter)
  const penalty = Math.min(40, Math.floor(distance / 5) * 8);

  return Math.max(40, 80 - penalty);
}

function calculatePopularityMatch(movie: Movie, profile: TasteProfile): number {
  const popularity = movie.popularity;

  // Normalize popularity (log scale makes more sense)
  const normalizedPop = Math.min(1, Math.log10(popularity + 1) / 3);

  // Compare with user's hidden gem preference
  const prefDistance = Math.abs(normalizedPop - (1 - profile.hiddenGemPreference));

  // Closer to preference = higher score
  return Math.max(50, 100 - prefDistance * 50);
}

function calculateSimilarityBonus(movie: Movie, profile: TasteProfile): number {
  // Check if user liked similar movies (same genres)
  const movieGenreSet = new Set(movie.genreIds);

  // This is a simplified similarity check
  // In production, you'd use collaborative filtering or content-based similarity
  let similarityScore = 50;

  // Bonus if multiple top genres overlap
  const topGenres = Object.entries(profile.genreScores)
    .filter(([_, score]) => score > 0.5)
    .map(([id]) => parseInt(id, 10));

  const overlap = topGenres.filter((g) => movieGenreSet.has(g)).length;

  if (overlap >= 2) {
    similarityScore += 30;
  } else if (overlap >= 1) {
    similarityScore += 15;
  }

  return Math.min(100, similarityScore);
}

function getConfidenceLevel(profile: TasteProfile): 'low' | 'medium' | 'high' {
  if (profile.totalInteractions < 10) return 'low';
  if (profile.totalInteractions < 50) return 'medium';
  return 'high';
}

function generateHighlights(
  movie: Movie,
  breakdown: TasteMatchResult['breakdown'],
  profile: TasteProfile
): string[] {
  const highlights: string[] = [];

  // Genre highlight
  if (breakdown.genreMatch >= 80) {
    const topGenre = movie.genreIds.find(
      (id) => (profile.genreScores[id] ?? 0) > 0.5
    );
    if (topGenre && GENRES[topGenre]) {
      highlights.push(`You love ${GENRES[topGenre]} movies!`);
    }
  }

  // Rating highlight
  if (breakdown.ratingMatch >= 85 && movie.voteAverage >= 7.5) {
    highlights.push('Critically acclaimed');
  }

  // Hidden gem highlight
  if (movie.popularity < POPULARITY_THRESHOLD.hiddenGem && profile.hiddenGemPreference > 0.5) {
    highlights.push('Hidden gem for you!');
  }

  // Similarity highlight
  if (breakdown.similarityBonus >= 70) {
    highlights.push('Similar to movies you liked');
  }

  return highlights.slice(0, 2);
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Calculate taste matches for multiple movies
 */
export async function batchCalculateTasteMatch(
  movies: Movie[]
): Promise<Map<number, number>> {
  const results = new Map<number, number>();

  for (const movie of movies) {
    const score = await quickTasteMatch(movie);
    results.set(movie.id, score);
  }

  return results;
}

/**
 * Sort movies by taste match
 */
export async function sortByTasteMatch(movies: Movie[]): Promise<Movie[]> {
  const scores = await batchCalculateTasteMatch(movies);

  return [...movies].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? 50;
    const scoreB = scores.get(b.id) ?? 50;
    return scoreB - scoreA;
  });
}

/**
 * Get top N movies by taste match from a list
 */
export async function getTopTasteMatches(
  movies: Movie[],
  count: number
): Promise<Movie[]> {
  const sorted = await sortByTasteMatch(movies);
  return sorted.slice(0, count);
}

// ============================================================================
// PROFILE INSIGHTS
// ============================================================================

/**
 * Get user's top genres
 */
export async function getTopGenres(count: number = 5): Promise<{ id: number; name: string; score: number }[]> {
  const profile = await loadTasteProfile();

  const sorted = Object.entries(profile.genreScores)
    .map(([id, score]) => ({
      id: parseInt(id, 10),
      name: GENRES[parseInt(id, 10)] || 'Unknown',
      score,
    }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);

  return sorted.slice(0, count);
}

/**
 * Get profile summary for display
 */
export async function getProfileSummary(): Promise<{
  totalLikes: number;
  totalPasses: number;
  topGenres: string[];
  ratingRange: string;
  yearRange: string;
  personality: string;
}> {
  const profile = await loadTasteProfile();

  const topGenres = await getTopGenres(3);

  // Determine personality type based on preferences
  let personality = 'Explorer';
  if (profile.hiddenGemPreference > 0.6) {
    personality = 'Hidden Gem Hunter';
  } else if (profile.preferredRatingMin > 7) {
    personality = 'Critic';
  } else if (profile.preferredYearMax - profile.preferredYearMin < 20) {
    personality = 'Era Specialist';
  }

  return {
    totalLikes: profile.likedMovieIds.length,
    totalPasses: profile.passedMovieIds.length,
    topGenres: topGenres.map((g) => g.name),
    ratingRange: `${profile.preferredRatingMin.toFixed(1)} - ${profile.preferredRatingMax.toFixed(1)}`,
    yearRange: `${profile.preferredYearMin} - ${profile.preferredYearMax}`,
    personality,
  };
}
