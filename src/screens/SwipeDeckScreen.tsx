/**
 * SwipeDeckScreen
 *
 * The main swiping interface where users swipe on movies.
 * Integrates all core components: deck, modals, gamification.
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

import { Movie, Room, Match, SwipeDirection } from '../types';
import { COLORS, GAMIFICATION } from '../constants';
import {
  subscribeToRoom,
  subscribeToMatches,
  recordSwipe,
  markMovieAsSeen,
  addToFavorites,
  getUserSwipedMovieIds,
  getCurrentUser,
} from '../services/firebase';
import { getSwipeMovies, prefetchMovieData } from '../services/tmdb';

import SwipeableDeck, { SwipeableDeckRef } from '../components/SwipeableDeck';
import TrailerModal from '../components/TrailerModal';
import ReviewsModal from '../components/ReviewsModal';
import MatchRevealModal from '../components/MatchRevealModal';
import StreakCounter from '../components/StreakCounter';
import PointsDisplay from '../components/PointsDisplay';

// ============================================================================
// INTERFACES
// ============================================================================

interface SwipeDeckScreenProps {
  route: { params: { roomId: string } };
  navigation: any;
}

// ============================================================================
// SWIPE DECK SCREEN COMPONENT
// ============================================================================

const SwipeDeckScreen: React.FC<SwipeDeckScreenProps> = ({ route, navigation }) => {
  const { roomId } = route.params;

  // State
  const [room, setRoom] = useState<Room | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);

  // Modal states
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const [reviewsMovie, setReviewsMovie] = useState<Movie | null>(null);
  const [matchToReveal, setMatchToReveal] = useState<Match | null>(null);

  // Refs
  const deckRef = useRef<SwipeableDeckRef>(null);
  const swipedMovieIds = useRef<Set<number>>(new Set());
  const moviePage = useRef(1);

  // Get current user
  const currentUser = getCurrentUser();
  const userId = currentUser?.uid || '';

  // ========================================================================
  // DATA FETCHING
  // ========================================================================

  // Subscribe to room updates
  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);
    });

    return unsubscribe;
  }, [roomId]);

  // Subscribe to matches
  useEffect(() => {
    const unsubscribe = subscribeToMatches(roomId, (match) => {
      // Trigger match reveal if we just matched
      if (match.matchedBy.includes(userId)) {
        // Find the movie data
        const movie = movies.find((m) => m.id === match.movieId);
        if (movie) {
          setMatchToReveal({ ...match, movie });
        }
      }
    });

    return unsubscribe;
  }, [roomId, userId, movies]);

  // Load initial movies
  useEffect(() => {
    loadMovies();
  }, [room]);

  const loadMovies = async () => {
    if (!room) return;

    try {
      setLoading(true);

      // Get user's already swiped movies
      const swiped = await getUserSwipedMovieIds(roomId, userId);
      swipedMovieIds.current = swiped;

      // Get favorite genres from room members (would come from calibration)
      const favoriteGenres = [28, 35, 18, 878, 27]; // Action, Comedy, Drama, Sci-Fi, Horror

      // Fetch movies
      const fetchedMovies = await getSwipeMovies({
        favoriteGenres,
        excludeMovieIds: swiped,
        page: moviePage.current,
      });

      setMovies(fetchedMovies);
      setLoading(false);

      // Prefetch details for first few movies
      prefetchMovieData(fetchedMovies.slice(0, 5).map((m) => m.id));
    } catch (error) {
      console.error('Error loading movies:', error);
      setLoading(false);
    }
  };

  const loadMoreMovies = useCallback(async () => {
    if (!room) return;

    moviePage.current += 1;

    try {
      const favoriteGenres = [28, 35, 18, 878, 27];
      const moreMovies = await getSwipeMovies({
        favoriteGenres,
        excludeMovieIds: swipedMovieIds.current,
        page: moviePage.current,
      });

      setMovies((prev) => [...prev, ...moreMovies]);
      prefetchMovieData(moreMovies.slice(0, 5).map((m) => m.id));
    } catch (error) {
      console.error('Error loading more movies:', error);
    }
  }, [room]);

  // ========================================================================
  // SWIPE HANDLERS
  // ========================================================================

  const handleSwipeLeft = useCallback(
    async (movie: Movie) => {
      swipedMovieIds.current.add(movie.id);
      setSwipeCount((c) => c + 1);
      setSessionPoints((p) => p + GAMIFICATION.POINTS_PER_SWIPE);

      await recordSwipe(roomId, userId, movie.id, 'pass', 'left');
    },
    [roomId, userId]
  );

  const handleSwipeRight = useCallback(
    async (movie: Movie) => {
      swipedMovieIds.current.add(movie.id);
      setSwipeCount((c) => c + 1);
      setSessionPoints((p) => p + GAMIFICATION.POINTS_PER_SWIPE);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await recordSwipe(roomId, userId, movie.id, 'like', 'right');
    },
    [roomId, userId]
  );

  const handleSwipeUp = useCallback(
    (movie: Movie) => {
      // Open trailer modal
      setTrailerMovie(movie);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleSwipeDown = useCallback(
    (movie: Movie) => {
      // Open reviews modal
      setReviewsMovie(movie);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleSeenIt = useCallback(
    async (movie: Movie) => {
      await markMovieAsSeen(roomId, userId, movie.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [roomId, userId]
  );

  const handleFavorite = useCallback(
    async (movie: Movie) => {
      await addToFavorites(userId, movie.id, movie);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [userId]
  );

  const handleCardChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // ========================================================================
  // UI HELPERS
  // ========================================================================

  const currentMovie = movies[currentIndex];
  const remainingCards = movies.length - currentIndex;

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
          <Text style={styles.loadingText}>Loading movies...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (movies.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[COLORS.background, COLORS.backgroundLight]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No movies found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your streaming services or preferences
          </Text>
          <Pressable
            style={styles.refreshButton}
            onPress={loadMovies}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
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
          <Text style={styles.roomName}>{room?.name || 'Swiping'}</Text>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.memberCountText}>
              {room?.members.length || 0} swiping
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <StreakCounter streak={room?.stats.streak || 0} compact />
        </View>
      </Animated.View>

      {/* Session stats */}
      <Animated.View entering={FadeInUp.delay(100)} style={styles.sessionStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{swipeCount}</Text>
          <Text style={styles.statLabel}>Swiped</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{remainingCards}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.tertiary }]}>
            +{sessionPoints}
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

      {/* Watchlist button */}
      <Pressable
        style={styles.watchlistButton}
        onPress={() => navigation.navigate('Watchlist', { roomId })}
      >
        <Ionicons name="list" size={20} color="#FFF" />
        <Text style={styles.watchlistButtonText}>Matches</Text>
      </Pressable>

      {/* Modals */}
      <TrailerModal
        visible={!!trailerMovie}
        movie={trailerMovie}
        onClose={() => setTrailerMovie(null)}
        onSwipeRight={() => {
          if (trailerMovie) {
            handleSwipeRight(trailerMovie);
            deckRef.current?.swipeRight();
          }
        }}
        onSwipeLeft={() => {
          if (trailerMovie) {
            handleSwipeLeft(trailerMovie);
            deckRef.current?.swipeLeft();
          }
        }}
      />

      <ReviewsModal
        visible={!!reviewsMovie}
        movie={reviewsMovie}
        onClose={() => setReviewsMovie(null)}
        onSwipeRight={() => {
          if (reviewsMovie) {
            handleSwipeRight(reviewsMovie);
            deckRef.current?.swipeRight();
          }
        }}
        onSwipeLeft={() => {
          if (reviewsMovie) {
            handleSwipeLeft(reviewsMovie);
            deckRef.current?.swipeLeft();
          }
        }}
      />

      <MatchRevealModal
        visible={!!matchToReveal}
        match={matchToReveal}
        members={room?.members || []}
        onClose={() => setMatchToReveal(null)}
        onWatchNow={() => {
          // Would open streaming service link
          setMatchToReveal(null);
        }}
        onAddToWatchlist={() => {
          if (matchToReveal) {
            addToFavorites(userId, matchToReveal.movieId, matchToReveal.movie);
          }
          setMatchToReveal(null);
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

  // Loading & Empty
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
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
  roomName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  memberCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  headerRight: {},

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
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  watchlistButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default SwipeDeckScreen;
