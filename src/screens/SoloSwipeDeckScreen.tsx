/**
 * SoloSwipeDeckScreen
 *
 * The main solo swiping interface with personalized recommendations.
 * Every right-swipe is an instant personal "match" with variable rewards.
 *
 * Features:
 * - Taste match percentages on every card
 * - Instant dopamine hits on likes
 * - Quick Pick Tonight after 15-30 swipes
 * - Daily goals tracking
 * - Streak bonuses
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS } from '../constants';
import { useAppMode } from '../context/AppModeContext';
import {
  getSwipeMovies,
  getTrendingMovies,
  prefetchMovieData,
} from '../services/tmdb';
import {
  calculateTasteMatch,
  quickTasteMatch,
  recordSwipeForTaste,
  batchCalculateTasteMatch,
} from '../services/tasteProfile';

import SwipeableDeck, { SwipeableDeckRef } from '../components/SwipeableDeck';
import TrailerModal from '../components/TrailerModal';
import ReviewsModal from '../components/ReviewsModal';
import SoloMatchReveal from '../components/SoloMatchReveal';
import QuickPickModal from '../components/QuickPickModal';
import StreakCounter from '../components/StreakCounter';
import PointsDisplay from '../components/PointsDisplay';

// ============================================================================
// INTERFACES
// ============================================================================

interface SoloSwipeDeckScreenProps {
  navigation: any;
}

interface MovieWithTaste extends Movie {
  tasteScore: number;
  highlights: string[];
}

// ============================================================================
// SOLO SWIPE DECK SCREEN COMPONENT
// ============================================================================

const SoloSwipeDeckScreen: React.FC<SoloSwipeDeckScreenProps> = ({ navigation }) => {
  // Context
  const {
    soloSession,
    startSoloSession,
    endSoloSession,
    recordSoloSwipe,
    addToSoloWatchlist,
    soloStats,
    dailyGoals,
    showQuickPick,
    setShowQuickPick,
    setQuickPickMovies,
    quickPickMovies,
  } = useAppMode();

  // State
  const [movies, setMovies] = useState<MovieWithTaste[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tasteScores, setTasteScores] = useState<Map<number, number>>(new Map());
  const [likedMovies, setLikedMovies] = useState<Movie[]>([]);

  // Modal states
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const [reviewsMovie, setReviewsMovie] = useState<Movie | null>(null);
  const [revealMovie, setRevealMovie] = useState<MovieWithTaste | null>(null);
  const [currentTasteScore, setCurrentTasteScore] = useState(0);

  // Refs
  const deckRef = useRef<SwipeableDeckRef>(null);
  const swipedMovieIds = useRef<Set<number>>(new Set());
  const moviePage = useRef(1);

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  useEffect(() => {
    startSoloSession();
    loadMovies();

    return () => {
      endSoloSession();
    };
  }, []);

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  const loadMovies = async () => {
    try {
      setLoading(true);

      // Fetch trending movies
      const fetchedMovies = await getTrendingMovies('week', moviePage.current);

      // Calculate taste scores for all movies
      const scores = await batchCalculateTasteMatch(fetchedMovies);
      setTasteScores(scores);

      // Enhance movies with taste data
      const enhancedMovies: MovieWithTaste[] = await Promise.all(
        fetchedMovies.map(async (movie) => {
          const tasteResult = await calculateTasteMatch(movie);
          return {
            ...movie,
            tasteScore: tasteResult.score,
            highlights: tasteResult.highlights,
          };
        })
      );

      // Sort by taste score for better experience
      const sorted = enhancedMovies.sort((a, b) => {
        // Mix high and medium scores for variety
        const scoreA = a.tasteScore + (Math.random() * 10 - 5);
        const scoreB = b.tasteScore + (Math.random() * 10 - 5);
        return scoreB - scoreA;
      });

      setMovies(sorted);
      setLoading(false);

      // Prefetch details for first few
      prefetchMovieData(sorted.slice(0, 5).map((m) => m.id));
    } catch (error) {
      console.error('Error loading movies:', error);
      setLoading(false);
    }
  };

  const loadMoreMovies = useCallback(async () => {
    moviePage.current += 1;

    try {
      const moreMovies = await getTrendingMovies('week', moviePage.current);

      // Filter out already seen
      const filtered = moreMovies.filter(
        (m) => !swipedMovieIds.current.has(m.id)
      );

      // Enhance with taste scores
      const enhanced: MovieWithTaste[] = await Promise.all(
        filtered.map(async (movie) => {
          const tasteResult = await calculateTasteMatch(movie);
          return {
            ...movie,
            tasteScore: tasteResult.score,
            highlights: tasteResult.highlights,
          };
        })
      );

      // Update scores map
      enhanced.forEach((m) => {
        tasteScores.set(m.id, m.tasteScore);
      });

      setMovies((prev) => [...prev, ...enhanced]);
      prefetchMovieData(enhanced.slice(0, 5).map((m) => m.id));
    } catch (error) {
      console.error('Error loading more movies:', error);
    }
  }, []);

  // ========================================================================
  // SWIPE HANDLERS
  // ========================================================================

  const handleSwipeLeft = useCallback(
    async (movie: Movie) => {
      const movieWithTaste = movie as MovieWithTaste;
      swipedMovieIds.current.add(movie.id);

      // Record for taste profile
      await recordSwipeForTaste(movie, false);

      // Record in session
      recordSoloSwipe(movie, false, movieWithTaste.tasteScore || 50);
    },
    [recordSoloSwipe]
  );

  const handleSwipeRight = useCallback(
    async (movie: Movie) => {
      const movieWithTaste = movie as MovieWithTaste;
      swipedMovieIds.current.add(movie.id);

      const tasteScore = movieWithTaste.tasteScore || (await quickTasteMatch(movie));

      // Record for taste profile
      await recordSwipeForTaste(movie, true);

      // Record in session
      recordSoloSwipe(movie, true, tasteScore);

      // Add to watchlist
      addToSoloWatchlist(movie, tasteScore);

      // Track liked movies for Quick Pick
      setLikedMovies((prev) => [...prev, movie]);

      // Update taste score in state
      setCurrentTasteScore(tasteScore);

      // Show celebration
      setRevealMovie({
        ...movie,
        tasteScore,
        highlights: movieWithTaste.highlights || [],
      });
    },
    [recordSoloSwipe, addToSoloWatchlist]
  );

  const handleSwipeUp = useCallback((movie: Movie) => {
    setTrailerMovie(movie);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSwipeDown = useCallback((movie: Movie) => {
    setReviewsMovie(movie);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCardChange = useCallback(
    (index: number) => {
      setCurrentIndex(index);

      // Check for Quick Pick trigger
      if (
        soloSession &&
        soloSession.swipeCount >= 15 &&
        soloSession.likesCount >= 3 &&
        !showQuickPick &&
        (soloSession.swipeCount === 15 ||
          soloSession.swipeCount === 25 ||
          soloSession.swipeCount === 40)
      ) {
        setQuickPickMovies(likedMovies.slice(-10));
        setShowQuickPick(true);
      }
    },
    [soloSession, showQuickPick, likedMovies]
  );

  const handleSeenIt = useCallback((movie: Movie) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Mark as seen - would update storage
  }, []);

  const handleFavorite = useCallback(
    async (movie: Movie) => {
      const tasteScore = await quickTasteMatch(movie);
      addToSoloWatchlist(movie, tasteScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [addToSoloWatchlist]
  );

  // ========================================================================
  // UI HELPERS
  // ========================================================================

  const currentMovie = movies[currentIndex] as MovieWithTaste;
  const remainingCards = movies.length - currentIndex;

  // Daily goals progress
  const completedGoals = dailyGoals.filter((g) => g.completed).length;

  // ========================================================================
  // RENDER
  // ========================================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[COLORS.background, COLORS.backgroundLight]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding movies for you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Solo Swipe</Text>
          <View style={styles.dailyProgress}>
            <Ionicons
              name={completedGoals === dailyGoals.length ? 'checkmark-circle' : 'flag'}
              size={12}
              color={completedGoals === dailyGoals.length ? COLORS.success : COLORS.tertiary}
            />
            <Text style={styles.dailyProgressText}>
              {completedGoals}/{dailyGoals.length} goals
            </Text>
          </View>
        </View>

        <View style={styles.headerStats}>
          <StreakCounter streak={soloStats.currentDayStreak} compact />
        </View>
      </Animated.View>

      {/* Session stats */}
      <Animated.View entering={FadeInUp.delay(100)} style={styles.sessionStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{soloSession?.swipeCount || 0}</Text>
          <Text style={styles.statLabel}>Swiped</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.like }]}>
            {soloSession?.likesCount || 0}
          </Text>
          <Text style={styles.statLabel}>Liked</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.streakValue}>
            <Ionicons
              name="flame"
              size={16}
              color={soloSession?.currentStreak && soloSession.currentStreak >= 3
                ? COLORS.primary
                : COLORS.textMuted
              }
            />
            <Text
              style={[
                styles.statValue,
                soloSession?.currentStreak && soloSession.currentStreak >= 3 && {
                  color: COLORS.primary,
                },
              ]}
            >
              {soloSession?.currentStreak || 0}
            </Text>
          </View>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.tertiary }]}>
            +{soloSession?.pointsEarned || 0}
          </Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
      </Animated.View>

      {/* Swipe deck */}
      <Animated.View entering={SlideInDown.delay(200)} style={styles.deckContainer}>
        <SwipeableDeck
          ref={deckRef}
          movies={movies.slice(currentIndex)}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onSwipeUp={handleSwipeUp}
          onSwipeDown={handleSwipeDown}
          onCardChange={handleCardChange}
          onSeenIt={handleSeenIt}
          onFavorite={handleFavorite}
          onNeedMoreCards={loadMoreMovies}
        />
      </Animated.View>

      {/* Bottom action buttons */}
      <Animated.View entering={FadeInUp.delay(300)} style={styles.bottomActions}>
        <Pressable
          style={[styles.bottomButton, styles.passButtonBottom]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deckRef.current?.swipeLeft();
          }}
        >
          <Ionicons name="close" size={32} color={COLORS.pass} />
        </Pressable>

        <Pressable
          style={[styles.bottomButton, styles.undoButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            deckRef.current?.undo();
          }}
        >
          <Ionicons name="arrow-undo" size={24} color={COLORS.tertiary} />
        </Pressable>

        <Pressable
          style={[styles.bottomButton, styles.likeButtonBottom]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deckRef.current?.swipeRight();
          }}
        >
          <Ionicons name="heart" size={32} color={COLORS.like} />
        </Pressable>
      </Animated.View>

      {/* Watchlist shortcut */}
      <Pressable
        style={styles.watchlistButton}
        onPress={() => navigation.navigate('SoloWatchlist')}
      >
        <Ionicons name="bookmark" size={18} color="#FFF" />
        <Text style={styles.watchlistButtonText}>
          {soloSession?.likesCount || 0} saved
        </Text>
      </Pressable>

      {/* Modals */}
      <TrailerModal
        visible={!!trailerMovie}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
        onSwipeRight={() => {
          if (trailerMovie) handleSwipeRight(trailerMovie);
        }}
        onSwipeLeft={() => {
          if (trailerMovie) handleSwipeLeft(trailerMovie);
        }}
      />

      <ReviewsModal
        visible={!!reviewsMovie}
        movie={reviewsMovie}
        onClose={() => setReviewsMovie(null)}
        onSwipeRight={() => {
          if (reviewsMovie) handleSwipeRight(reviewsMovie);
        }}
        onSwipeLeft={() => {
          if (reviewsMovie) handleSwipeLeft(reviewsMovie);
        }}
      />

      <SoloMatchReveal
        visible={!!revealMovie}
        movie={revealMovie}
        tasteMatchScore={currentTasteScore}
        currentStreak={soloSession?.currentStreak || 0}
        onComplete={() => setRevealMovie(null)}
      />

      <QuickPickModal
        visible={showQuickPick}
        movies={quickPickMovies}
        tasteScores={tasteScores}
        onClose={() => setShowQuickPick(false)}
        onWatchNow={(movie) => {
          // Open streaming link
        }}
        onSaveForLater={(movie) => {
          const score = tasteScores.get(movie.id) || 70;
          addToSoloWatchlist(movie, score);
        }}
        onKeepSwiping={() => {
          setShowQuickPick(false);
        }}
      />
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  dailyProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dailyProgressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  headerStats: {},

  // Session stats
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  streakValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Deck
  deckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  bottomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 2,
  },
  passButtonBottom: {
    width: 64,
    height: 64,
    borderColor: COLORS.pass,
    backgroundColor: COLORS.pass + '15',
  },
  likeButtonBottom: {
    width: 64,
    height: 64,
    borderColor: COLORS.like,
    backgroundColor: COLORS.like + '15',
  },
  undoButton: {
    width: 48,
    height: 48,
    borderColor: COLORS.tertiary,
    backgroundColor: COLORS.tertiary + '15',
  },

  // Watchlist button
  watchlistButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  watchlistButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default SoloSwipeDeckScreen;
