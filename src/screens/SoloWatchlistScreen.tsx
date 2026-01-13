/**
 * SoloWatchlistScreen
 *
 * Personal watchlist from solo mode right-swipes.
 * Features streaming links, taste match scores, and group invite.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideOutRight,
  Layout,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS, STREAMING_SERVICES } from '../constants';
import { useAppMode } from '../context/AppModeContext';
import { getPosterUrl, getReleaseYear } from '../services/tmdb';

// ============================================================================
// CONSTANTS
// ============================================================================

type SortOption = 'recent' | 'match' | 'rating' | 'year';
type FilterOption = 'all' | 'perfect' | 'unwatched';

// ============================================================================
// INTERFACES
// ============================================================================

interface SoloWatchlistScreenProps {
  navigation: any;
}

interface MovieWithMeta extends Movie {
  tasteMatchScore?: number;
  addedAt?: number;
  watched?: boolean;
}

// ============================================================================
// WATCHLIST ITEM COMPONENT
// ============================================================================

interface WatchlistItemProps {
  movie: MovieWithMeta;
  onWatch: () => void;
  onRemove: () => void;
  onToggleWatched: () => void;
  index: number;
}

const WatchlistItem: React.FC<WatchlistItemProps> = ({
  movie,
  onWatch,
  onRemove,
  onToggleWatched,
  index,
}) => {
  const posterUrl = getPosterUrl(movie.posterPath, 'w185');
  const releaseYear = getReleaseYear(movie.releaseDate);
  const tasteScore = (movie as any).tasteMatchScore || 70;

  // Get match color
  const getMatchColor = () => {
    if (tasteScore >= 90) return '#FFD700';
    if (tasteScore >= 80) return COLORS.like;
    if (tasteScore >= 70) return COLORS.tertiary;
    return COLORS.textSecondary;
  };

  const matchColor = getMatchColor();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify()}
      exiting={SlideOutRight.duration(200)}
      layout={Layout.springify()}
      style={[styles.itemContainer, movie.watched && styles.itemWatched]}
    >
      {/* Poster */}
      <Image source={{ uri: posterUrl }} style={styles.itemPoster} />

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {movie.title}
        </Text>

        <View style={styles.itemMeta}>
          <Text style={styles.itemYear}>{releaseYear}</Text>
          <View style={styles.itemRating}>
            <Ionicons name="star" size={11} color={COLORS.tertiary} />
            <Text style={styles.itemRatingText}>
              {movie.voteAverage.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Taste match */}
        <View style={styles.itemTasteRow}>
          <View style={[styles.itemTasteBadge, { borderColor: matchColor }]}>
            <Text style={[styles.itemTasteScore, { color: matchColor }]}>
              {tasteScore}%
            </Text>
            <Text style={styles.itemTasteLabel}>match</Text>
          </View>
          {tasteScore >= 90 && (
            <View style={styles.perfectBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.perfectText}>Perfect</Text>
            </View>
          )}
        </View>

        {/* Streaming (stub) */}
        <View style={styles.itemStreaming}>
          <Ionicons name="tv-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.itemStreamingText}>Netflix, Prime Video</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.itemActions}>
        <Pressable
          style={styles.watchButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onWatch();
          }}
        >
          <Ionicons name="play" size={18} color="#FFF" />
        </Pressable>

        <Pressable
          style={[styles.watchedToggle, movie.watched && styles.watchedToggleActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleWatched();
          }}
        >
          <Ionicons
            name={movie.watched ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={18}
            color={movie.watched ? COLORS.success : COLORS.textMuted}
          />
        </Pressable>

        <Pressable
          style={styles.removeButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRemove();
          }}
        >
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

// ============================================================================
// SOLO WATCHLIST SCREEN COMPONENT
// ============================================================================

const SoloWatchlistScreen: React.FC<SoloWatchlistScreenProps> = ({ navigation }) => {
  // Context
  const { soloWatchlist, removeFromSoloWatchlist, soloStats } = useAppMode();

  // State
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [watchedMovies, setWatchedMovies] = useState<Set<number>>(new Set());

  // Filter and sort movies
  const filteredMovies = useMemo(() => {
    let movies = [...soloWatchlist] as MovieWithMeta[];

    // Apply filter
    if (filter === 'perfect') {
      movies = movies.filter((m) => ((m as any).tasteMatchScore || 70) >= 90);
    } else if (filter === 'unwatched') {
      movies = movies.filter((m) => !watchedMovies.has(m.id));
    }

    // Apply sort
    switch (sortBy) {
      case 'match':
        movies.sort((a, b) => ((b as any).tasteMatchScore || 70) - ((a as any).tasteMatchScore || 70));
        break;
      case 'rating':
        movies.sort((a, b) => b.voteAverage - a.voteAverage);
        break;
      case 'year':
        movies.sort((a, b) => {
          const yearA = parseInt(a.releaseDate?.split('-')[0] || '0', 10);
          const yearB = parseInt(b.releaseDate?.split('-')[0] || '0', 10);
          return yearB - yearA;
        });
        break;
      default: // recent
        movies.sort((a, b) => ((b as any).addedAt || 0) - ((a as any).addedAt || 0));
    }

    return movies;
  }, [soloWatchlist, sortBy, filter, watchedMovies]);

  // Handlers
  const handleWatch = (movie: Movie) => {
    // Would open streaming link in production
    Linking.openURL('https://www.justwatch.com/');
  };

  const handleRemove = (movieId: number) => {
    Alert.alert(
      'Remove from Watchlist',
      'Are you sure you want to remove this movie?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromSoloWatchlist(movieId),
        },
      ]
    );
  };

  const toggleWatched = (movieId: number) => {
    setWatchedMovies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(movieId)) {
        newSet.delete(movieId);
      } else {
        newSet.add(movieId);
      }
      return newSet;
    });
  };

  const handleInviteFriends = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to create group room with watchlist movies pre-selected
    navigation.navigate('Home', { mode: 'create', preselectedMovies: soloWatchlist });
  };

  // Stats
  const totalMovies = soloWatchlist.length;
  const watchedCount = watchedMovies.size;
  const perfectMatches = soloWatchlist.filter(
    (m) => ((m as any).tasteMatchScore || 70) >= 90
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <Text style={styles.headerTitle}>My Watchlist</Text>

        <Pressable style={styles.inviteButton} onPress={handleInviteFriends}>
          <Ionicons name="people-outline" size={20} color={COLORS.secondary} />
        </Pressable>
      </Animated.View>

      {/* Stats banner */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalMovies}</Text>
          <Text style={styles.statLabel}>Movies</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>
            {watchedCount}
          </Text>
          <Text style={styles.statLabel}>Watched</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>
            {perfectMatches}
          </Text>
          <Text style={styles.statLabel}>Perfect</Text>
        </View>
      </Animated.View>

      {/* Filters & Sort */}
      <Animated.View entering={FadeInDown.delay(150)} style={styles.controlsRow}>
        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {(['all', 'perfect', 'unwatched'] as FilterOption[]).map((opt) => (
            <Pressable
              key={opt}
              style={[styles.filterPill, filter === opt && styles.filterPillActive]}
              onPress={() => setFilter(opt)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filter === opt && styles.filterPillTextActive,
                ]}
              >
                {opt === 'all' ? 'All' : opt === 'perfect' ? 'Perfect Matches' : 'Unwatched'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Sort dropdown */}
        <Pressable
          style={styles.sortButton}
          onPress={() => {
            const options: SortOption[] = ['recent', 'match', 'rating', 'year'];
            const currentIndex = options.indexOf(sortBy);
            const nextIndex = (currentIndex + 1) % options.length;
            setSortBy(options[nextIndex]);
          }}
        >
          <Ionicons name="swap-vertical" size={16} color={COLORS.textSecondary} />
          <Text style={styles.sortText}>
            {sortBy === 'recent' && 'Recent'}
            {sortBy === 'match' && 'Match %'}
            {sortBy === 'rating' && 'Rating'}
            {sortBy === 'year' && 'Year'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Watchlist */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredMovies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter !== 'all' ? 'No movies match this filter' : 'Your watchlist is empty'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter !== 'all'
                ? 'Try a different filter'
                : 'Start swiping to find movies you love!'}
            </Text>
            <Pressable
              style={styles.startSwipingButton}
              onPress={() => navigation.navigate('SoloSwipeDeck')}
            >
              <Ionicons name="play" size={20} color="#FFF" />
              <Text style={styles.startSwipingText}>Start Swiping</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {filteredMovies.map((movie, index) => (
              <WatchlistItem
                key={movie.id}
                movie={{ ...movie, watched: watchedMovies.has(movie.id) }}
                index={index}
                onWatch={() => handleWatch(movie)}
                onRemove={() => handleRemove(movie.id)}
                onToggleWatched={() => toggleWatched(movie.id)}
              />
            ))}
          </>
        )}

        {/* Invite friends CTA */}
        {filteredMovies.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300)} style={styles.inviteCTA}>
            <LinearGradient
              colors={[COLORS.secondary + '20', COLORS.secondary + '10']}
              style={styles.inviteCTAGradient}
            >
              <Ionicons name="people" size={32} color={COLORS.secondary} />
              <Text style={styles.inviteCTATitle}>
                Can't decide? Invite friends!
              </Text>
              <Text style={styles.inviteCTASubtitle}>
                Create a group room with your watchlist
              </Text>
              <Pressable style={styles.inviteCTAButton} onPress={handleInviteFriends}>
                <Text style={styles.inviteCTAButtonText}>Invite Friends</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}
      </ScrollView>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  inviteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.secondary + '40',
  },

  // Stats banner
  statsBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
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

  // Controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },

  // Item
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemWatched: {
    opacity: 0.6,
  },
  itemPoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundCard,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemYear: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  itemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  itemRatingText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.tertiary,
  },
  itemTasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemTasteBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  itemTasteScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemTasteLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  perfectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFD70020',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  perfectText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
  },
  itemStreaming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemStreamingText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  itemActions: {
    justifyContent: 'center',
    gap: 6,
    marginLeft: 8,
  },
  watchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedToggleActive: {
    backgroundColor: COLORS.success + '20',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  startSwipingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
  },
  startSwipingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Invite CTA
  inviteCTA: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  inviteCTAGradient: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.secondary + '30',
    borderRadius: 20,
  },
  inviteCTATitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    textAlign: 'center',
  },
  inviteCTASubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  inviteCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  inviteCTAButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default SoloWatchlistScreen;
