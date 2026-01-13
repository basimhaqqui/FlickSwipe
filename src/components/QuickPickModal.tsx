/**
 * QuickPickModal Component
 *
 * "Quick Pick Tonight" modal that shows after 15-30 swipes.
 * Displays top 3-5 personalized recommendations for immediate watching.
 *
 * Features:
 * - Auto-suggests based on session likes
 * - Shows streaming availability
 * - Direct "Watch Now" links
 * - Save for later option
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
  FadeInUp,
  SlideInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS, STREAMING_SERVICES } from '../constants';
import { getPosterUrl, getReleaseYear } from '../services/tmdb';
import ConfettiExplosion from './ConfettiExplosion';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// INTERFACES
// ============================================================================

interface QuickPickModalProps {
  visible: boolean;
  movies: Movie[];
  tasteScores: Map<number, number>;
  onClose: () => void;
  onWatchNow: (movie: Movie) => void;
  onSaveForLater: (movie: Movie) => void;
  onKeepSwiping: () => void;
}

interface MovieWithScore extends Movie {
  tasteScore: number;
}

// ============================================================================
// PICK CARD COMPONENT
// ============================================================================

interface PickCardProps {
  movie: MovieWithScore;
  rank: number;
  onWatchNow: () => void;
  onSave: () => void;
  index: number;
}

const PickCard: React.FC<PickCardProps> = ({
  movie,
  rank,
  onWatchNow,
  onSave,
  index,
}) => {
  const posterUrl = getPosterUrl(movie.posterPath, 'w185');
  const releaseYear = getReleaseYear(movie.releaseDate);

  // Get rank styling
  const getRankStyle = () => {
    if (rank === 1) return { bg: '#FFD700', label: '🥇 Top Pick' };
    if (rank === 2) return { bg: '#C0C0C0', label: '🥈 Runner Up' };
    if (rank === 3) return { bg: '#CD7F32', label: '🥉 Great Choice' };
    return { bg: COLORS.textMuted, label: `#${rank}` };
  };

  const rankStyle = getRankStyle();

  return (
    <Animated.View
      entering={FadeInUp.delay(300 + index * 150).springify()}
      style={[styles.pickCard, rank === 1 && styles.pickCardTop]}
    >
      {rank === 1 && (
        <LinearGradient
          colors={['#FFD70020', 'transparent']}
          style={styles.topPickGlow}
        />
      )}

      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
        <Text style={styles.rankText}>{rankStyle.label}</Text>
      </View>

      {/* Content row */}
      <View style={styles.pickContent}>
        {/* Poster */}
        <Image source={{ uri: posterUrl }} style={styles.pickPoster} />

        {/* Info */}
        <View style={styles.pickInfo}>
          <Text style={styles.pickTitle} numberOfLines={2}>
            {movie.title}
          </Text>

          <View style={styles.pickMeta}>
            <Text style={styles.pickYear}>{releaseYear}</Text>
            <View style={styles.pickRating}>
              <Ionicons name="star" size={12} color={COLORS.tertiary} />
              <Text style={styles.pickRatingText}>
                {movie.voteAverage.toFixed(1)}
              </Text>
            </View>
          </View>

          {/* Taste match */}
          <View style={styles.pickTasteMatch}>
            <Text style={styles.pickTasteScore}>{movie.tasteScore}%</Text>
            <Text style={styles.pickTasteLabel}>match</Text>
          </View>

          {/* Streaming (stub) */}
          <View style={styles.pickStreaming}>
            <Ionicons name="play-circle" size={14} color={COLORS.textMuted} />
            <Text style={styles.pickStreamingText}>Available on Netflix</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.pickActions}>
          <Pressable
            style={styles.watchNowButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onWatchNow();
            }}
          >
            <Ionicons name="play" size={20} color="#FFF" />
          </Pressable>

          <Pressable
            style={styles.saveButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSave();
            }}
          >
            <Ionicons name="bookmark-outline" size={18} color={COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================================================
// QUICK PICK MODAL COMPONENT
// ============================================================================

const QuickPickModal: React.FC<QuickPickModalProps> = ({
  visible,
  movies,
  tasteScores,
  onClose,
  onWatchNow,
  onSaveForLater,
  onKeepSwiping,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);

  // Process and sort movies by taste score
  const sortedMovies: MovieWithScore[] = movies
    .map((movie) => ({
      ...movie,
      tasteScore: tasteScores.get(movie.id) || 70,
    }))
    .sort((a, b) => b.tasteScore - a.tasteScore)
    .slice(0, 5);

  // Trigger celebration on open
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowConfetti(true), 500);
    } else {
      setShowConfetti(false);
    }
  }, [visible]);

  if (!visible || sortedMovies.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Confetti */}
        {showConfetti && (
          <ConfettiExplosion
            count={60}
            duration={2500}
            colors={[COLORS.tertiary, COLORS.primary, '#FFD700']}
          />
        )}

        {/* Content */}
        <Animated.View
          entering={SlideInUp.springify().damping(15)}
          style={styles.container}
        >
          <LinearGradient
            colors={[COLORS.backgroundModal, COLORS.background]}
            style={styles.gradient}
          >
            {/* Header */}
            <Animated.View entering={ZoomIn.delay(200)} style={styles.header}>
              <Text style={styles.headerEmoji}>🎬</Text>
              <Text style={styles.headerTitle}>Quick Pick Tonight!</Text>
              <Text style={styles.headerSubtitle}>
                Based on your {movies.length} likes, here's what to watch
              </Text>
            </Animated.View>

            {/* Picks list */}
            <ScrollView
              style={styles.picksList}
              contentContainerStyle={styles.picksContent}
              showsVerticalScrollIndicator={false}
            >
              {sortedMovies.map((movie, index) => (
                <PickCard
                  key={movie.id}
                  movie={movie}
                  rank={index + 1}
                  index={index}
                  onWatchNow={() => {
                    onWatchNow(movie);
                    onClose();
                  }}
                  onSave={() => onSaveForLater(movie)}
                />
              ))}
            </ScrollView>

            {/* Footer actions */}
            <View style={styles.footer}>
              <Pressable
                style={styles.keepSwipingButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onKeepSwiping();
                  onClose();
                }}
              >
                <Ionicons name="refresh" size={20} color={COLORS.primary} />
                <Text style={styles.keepSwipingText}>Keep Swiping</Text>
              </Pressable>

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Decide Later</Text>
              </Pressable>
            </View>

            {/* Close X */}
            <Pressable style={styles.closeXButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Picks list
  picksList: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  picksContent: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Pick card
  pickCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickCardTop: {
    borderColor: '#FFD70040',
    borderWidth: 2,
  },
  topPickGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  rankBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  pickContent: {
    flexDirection: 'row',
    marginTop: 8,
  },
  pickPoster: {
    width: 70,
    height: 105,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundCard,
  },
  pickInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  pickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  pickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pickYear: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  pickRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pickRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.tertiary,
  },
  pickTasteMatch: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  pickTasteScore: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.like,
  },
  pickTasteLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  pickStreaming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickStreamingText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  pickActions: {
    justifyContent: 'center',
    gap: 8,
    marginLeft: 8,
  },
  watchNowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  keepSwipingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  keepSwipingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  closeXButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default QuickPickModal;
