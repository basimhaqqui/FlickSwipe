/**
 * MovieCard Component
 *
 * A beautifully designed movie card with poster, metadata, and action buttons.
 * Features smooth animations, gradient overlays, and haptic feedback.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS, GENRES } from '../constants';
import {
  getPosterUrl,
  getReleaseYear,
  formatRating,
  formatRuntime,
  getMovieRuntime,
} from '../services/tmdb';

// ============================================================================
// INTERFACES
// ============================================================================

interface MovieCardProps {
  movie: Movie;
  onSeenIt?: () => void;
  onFavorite?: () => void;
  showActions?: boolean;
  // Solo mode props
  tasteMatchScore?: number; // 0-100 taste match percentage
  showTasteMatch?: boolean;
  highlights?: string[]; // Reasons for match
}

// ============================================================================
// ANIMATED BUTTON COMPONENT
// ============================================================================

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  isActive?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  color,
  onPress,
  isActive = false,
}) => {
  const scale = useSharedValue(1);
  const [active, setActive] = useState(isActive);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Animate press
    scale.value = withSequence(
      withSpring(0.85, { damping: 10 }),
      withSpring(1.1, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Toggle active state
    setActive(!active);
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.actionButton,
          { backgroundColor: active ? color : 'rgba(255,255,255,0.15)' },
          animatedStyle,
        ]}
      >
        <Ionicons
          name={active ? icon : (icon.replace('-outline', '') as any) || icon}
          size={20}
          color={active ? '#FFF' : color}
        />
        <Text
          style={[
            styles.actionButtonText,
            { color: active ? '#FFF' : color },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

// ============================================================================
// RATING BADGE COMPONENT
// ============================================================================

interface RatingBadgeProps {
  rating: number;
}

const RatingBadge: React.FC<RatingBadgeProps> = ({ rating }) => {
  // Color based on rating
  const getColor = () => {
    if (rating >= 7.5) return COLORS.success;
    if (rating >= 6) return COLORS.warning;
    return COLORS.error;
  };

  return (
    <View style={[styles.ratingBadge, { backgroundColor: getColor() }]}>
      <Ionicons name="star" size={12} color="#FFF" />
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
};

// ============================================================================
// GENRE CHIP COMPONENT
// ============================================================================

interface GenreChipProps {
  genreId: number;
}

const GenreChip: React.FC<GenreChipProps> = ({ genreId }) => {
  const genreName = GENRES[genreId] || 'Unknown';

  return (
    <View style={styles.genreChip}>
      <Text style={styles.genreChipText}>{genreName}</Text>
    </View>
  );
};

// ============================================================================
// TASTE MATCH BADGE COMPONENT
// ============================================================================

interface TasteMatchBadgeProps {
  score: number;
  highlights?: string[];
}

const TasteMatchBadge: React.FC<TasteMatchBadgeProps> = ({ score, highlights }) => {
  // Color based on match score
  const getMatchColor = () => {
    if (score >= 90) return '#FFD700'; // Gold for perfect
    if (score >= 80) return COLORS.like; // Green for great
    if (score >= 70) return COLORS.tertiary; // Yellow for good
    return COLORS.textSecondary; // Gray for average
  };

  const getMatchLabel = () => {
    if (score >= 90) return 'Perfect Match!';
    if (score >= 80) return 'Great Match';
    if (score >= 70) return 'Good Match';
    return 'For You';
  };

  const color = getMatchColor();
  const pulseScale = useSharedValue(1);

  // Pulse animation for high scores
  useEffect(() => {
    if (score >= 85) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [score]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.tasteMatchContainer, animatedStyle]}>
      <LinearGradient
        colors={[`${color}30`, `${color}10`]}
        style={styles.tasteMatchGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={[styles.tasteMatchCircle, { borderColor: color }]}>
          <Text style={[styles.tasteMatchScore, { color }]}>{score}</Text>
          <Text style={[styles.tasteMatchPercent, { color }]}>%</Text>
        </View>
        <View style={styles.tasteMatchInfo}>
          <Text style={[styles.tasteMatchLabel, { color }]}>
            {getMatchLabel()}
          </Text>
          {highlights && highlights.length > 0 && (
            <Text style={styles.tasteMatchHighlight} numberOfLines={1}>
              {highlights[0]}
            </Text>
          )}
        </View>
        {score >= 90 && (
          <View style={styles.tasteMatchStar}>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// ============================================================================
// MOVIE CARD COMPONENT
// ============================================================================

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onSeenIt,
  onFavorite,
  showActions = true,
  tasteMatchScore,
  showTasteMatch = false,
  highlights,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [runtime, setRuntime] = useState<number | null>(movie.runtime || null);

  // Fetch runtime if not available
  useEffect(() => {
    if (!runtime && movie.id) {
      getMovieRuntime(movie.id).then(setRuntime);
    }
  }, [movie.id, runtime]);

  const posterUrl = getPosterUrl(movie.posterPath);
  const releaseYear = getReleaseYear(movie.releaseDate);
  const displayGenres = movie.genreIds.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Poster Image */}
      <Image
        source={{ uri: posterUrl }}
        style={styles.poster}
        resizeMode="cover"
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
      />

      {/* Loading indicator */}
      {imageLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Top gradient for rating badge */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradient}
      />

      {/* Bottom gradient for content */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,1)']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradient}
      />

      {/* Rating badge */}
      <View style={styles.ratingContainer}>
        <RatingBadge rating={movie.voteAverage} />
      </View>

      {/* Taste Match Badge (Solo Mode) */}
      {showTasteMatch && tasteMatchScore !== undefined && (
        <View style={styles.tasteMatchBadgeContainer}>
          <TasteMatchBadge score={tasteMatchScore} highlights={highlights} />
        </View>
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>

        {/* Metadata row */}
        <View style={styles.metadataRow}>
          <Text style={styles.metadataText}>{releaseYear}</Text>
          {runtime && (
            <>
              <Text style={styles.metadataDot}>•</Text>
              <Text style={styles.metadataText}>{formatRuntime(runtime)}</Text>
            </>
          )}
          <Text style={styles.metadataDot}>•</Text>
          <Text style={styles.metadataText}>
            {(movie.voteCount / 1000).toFixed(1)}K votes
          </Text>
        </View>

        {/* Genres */}
        <View style={styles.genresRow}>
          {displayGenres.map((genreId) => (
            <GenreChip key={genreId} genreId={genreId} />
          ))}
        </View>

        {/* Overview */}
        <Text style={styles.overview} numberOfLines={3}>
          {movie.overview || 'No synopsis available.'}
        </Text>

        {/* Swipe hints */}
        <View style={styles.swipeHints}>
          <View style={styles.swipeHintRow}>
            <View style={styles.swipeHint}>
              <Ionicons name="arrow-back" size={14} color={COLORS.pass} />
              <Text style={[styles.swipeHintText, { color: COLORS.pass }]}>
                Pass
              </Text>
            </View>
            <View style={styles.swipeHint}>
              <Text style={[styles.swipeHintText, { color: COLORS.like }]}>
                Like
              </Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.like} />
            </View>
          </View>
          <View style={styles.swipeHintRow}>
            <View style={styles.swipeHint}>
              <Ionicons name="arrow-up" size={14} color={COLORS.trailer} />
              <Text style={[styles.swipeHintText, { color: COLORS.trailer }]}>
                Trailer
              </Text>
            </View>
            <View style={styles.swipeHint}>
              <Ionicons name="arrow-down" size={14} color={COLORS.reviews} />
              <Text style={[styles.swipeHintText, { color: COLORS.reviews }]}>
                Reviews
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        {showActions && (
          <View style={styles.actionsRow}>
            <ActionButton
              icon="checkmark-circle-outline"
              label="Seen It"
              color={COLORS.secondary}
              onPress={onSeenIt || (() => {})}
            />
            <ActionButton
              icon="star-outline"
              label="Favorite"
              color={COLORS.tertiary}
              onPress={onFavorite || (() => {})}
            />
          </View>
        )}
      </View>

      {/* Streaming badges (would show which services have this movie) */}
      {movie.streamingOn && movie.streamingOn.length > 0 && (
        <View style={styles.streamingBadges}>
          {movie.streamingOn.slice(0, 3).map((service) => (
            <View key={service} style={styles.streamingBadge}>
              <Text style={styles.streamingBadgeText}>
                {service.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.backgroundCard,
  },

  // Poster
  poster: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundCard,
  },

  // Gradients
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // Rating
  ratingContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // Taste Match Badge
  tasteMatchBadgeContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 80,
  },
  tasteMatchContainer: {},
  tasteMatchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  tasteMatchCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tasteMatchScore: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  tasteMatchPercent: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 10,
  },
  tasteMatchInfo: {
    flex: 1,
  },
  tasteMatchLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tasteMatchHighlight: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  tasteMatchStar: {
    marginLeft: 4,
  },

  // Content
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Metadata
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metadataText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metadataDot: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginHorizontal: 6,
  },

  // Genres
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },

  // Overview
  overview: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  // Swipe hints
  swipeHints: {
    marginBottom: 12,
    gap: 4,
  },
  swipeHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Streaming badges
  streamingBadges: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 6,
  },
  streamingBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  streamingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default MovieCard;
