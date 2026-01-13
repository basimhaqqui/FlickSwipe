/**
 * SoloMatchReveal Component
 *
 * Displays instant dopamine hits when users right-swipe in solo mode.
 * Variable rewards based on taste match percentage + streak bonuses.
 *
 * Features:
 * - Instant "Added to Watchlist" confirmation
 * - "Perfect Taste Match!" celebration for 90%+ matches
 * - Streak celebrations (3, 5, 10 likes in a row)
 * - Random bonus reveals
 * - Quick, non-blocking animations
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS } from '../constants';
import ConfettiExplosion from './ConfettiExplosion';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Celebration thresholds
const CELEBRATION_THRESHOLDS = {
  perfectMatch: 90,      // Taste match % for "Perfect Match!"
  greatMatch: 80,        // Taste match % for "Great Match!"
  streakSmall: 3,        // Likes in a row
  streakMedium: 5,
  streakLarge: 10,
};

// Celebration types with configs
type CelebrationType =
  | 'added'
  | 'great_match'
  | 'perfect_match'
  | 'streak_small'
  | 'streak_medium'
  | 'streak_large'
  | 'bonus';

interface CelebrationConfig {
  title: string;
  subtitle: string;
  emoji: string;
  colors: string[];
  confetti: boolean;
  confettiCount: number;
  duration: number;
  hapticPattern: 'light' | 'medium' | 'heavy' | 'success';
}

const CELEBRATION_CONFIGS: Record<CelebrationType, CelebrationConfig> = {
  added: {
    title: 'Added!',
    subtitle: 'Saved to your watchlist',
    emoji: '✓',
    colors: [COLORS.like, COLORS.secondary],
    confetti: false,
    confettiCount: 0,
    duration: 1500,
    hapticPattern: 'light',
  },
  great_match: {
    title: 'Great Match!',
    subtitle: '{{score}}% taste match',
    emoji: '🎯',
    colors: [COLORS.tertiary, COLORS.primary],
    confetti: true,
    confettiCount: 30,
    duration: 2000,
    hapticPattern: 'medium',
  },
  perfect_match: {
    title: 'Perfect Match!',
    subtitle: '{{score}}% — Made for you!',
    emoji: '⭐',
    colors: ['#FFD700', '#FF6B6B', '#6C5CE7'],
    confetti: true,
    confettiCount: 80,
    duration: 2500,
    hapticPattern: 'success',
  },
  streak_small: {
    title: '🔥 3 in a row!',
    subtitle: 'Keep the streak going!',
    emoji: '🔥',
    colors: [COLORS.primary, COLORS.tertiary],
    confetti: true,
    confettiCount: 40,
    duration: 2000,
    hapticPattern: 'medium',
  },
  streak_medium: {
    title: '🔥🔥 5 Streak!',
    subtitle: "You're on fire!",
    emoji: '🔥',
    colors: ['#FF6B6B', '#FF8E53', '#FFD700'],
    confetti: true,
    confettiCount: 60,
    duration: 2500,
    hapticPattern: 'heavy',
  },
  streak_large: {
    title: '🔥🔥🔥 10 STREAK!',
    subtitle: 'UNSTOPPABLE!',
    emoji: '👑',
    colors: ['#FFD700', '#FF6B6B', '#6C5CE7', '#00D68F'],
    confetti: true,
    confettiCount: 120,
    duration: 3000,
    hapticPattern: 'success',
  },
  bonus: {
    title: 'BONUS!',
    subtitle: '+50 points',
    emoji: '🎁',
    colors: [COLORS.tertiary, '#6C5CE7'],
    confetti: true,
    confettiCount: 50,
    duration: 2000,
    hapticPattern: 'success',
  },
};

// ============================================================================
// INTERFACES
// ============================================================================

interface SoloMatchRevealProps {
  visible: boolean;
  movie: Movie | null;
  tasteMatchScore: number;
  currentStreak: number;
  onComplete: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineCelebrationType(
  tasteMatchScore: number,
  currentStreak: number
): CelebrationType {
  // Check streaks first (highest priority for dopamine)
  if (currentStreak === CELEBRATION_THRESHOLDS.streakLarge) {
    return 'streak_large';
  }
  if (currentStreak === CELEBRATION_THRESHOLDS.streakMedium) {
    return 'streak_medium';
  }
  if (currentStreak === CELEBRATION_THRESHOLDS.streakSmall) {
    return 'streak_small';
  }

  // Random bonus (5% chance)
  if (Math.random() < 0.05) {
    return 'bonus';
  }

  // Taste match based
  if (tasteMatchScore >= CELEBRATION_THRESHOLDS.perfectMatch) {
    return 'perfect_match';
  }
  if (tasteMatchScore >= CELEBRATION_THRESHOLDS.greatMatch) {
    return 'great_match';
  }

  return 'added';
}

// ============================================================================
// SOLO MATCH REVEAL COMPONENT
// ============================================================================

const SoloMatchReveal: React.FC<SoloMatchRevealProps> = ({
  visible,
  movie,
  tasteMatchScore,
  currentStreak,
  onComplete,
}) => {
  // State
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('added');
  const [showConfetti, setShowConfetti] = useState(false);
  const [config, setConfig] = useState(CELEBRATION_CONFIGS.added);

  // Animation values
  const containerScale = useSharedValue(0);
  const containerOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.5);
  const checkScale = useSharedValue(0);

  // ========================================================================
  // DETERMINE CELEBRATION TYPE
  // ========================================================================

  useEffect(() => {
    if (visible && movie) {
      const type = determineCelebrationType(tasteMatchScore, currentStreak);
      setCelebrationType(type);
      setConfig(CELEBRATION_CONFIGS[type]);
      startCelebration(type);
    }
  }, [visible, movie, tasteMatchScore, currentStreak]);

  // ========================================================================
  // CELEBRATION ANIMATION
  // ========================================================================

  const startCelebration = useCallback(
    (type: CelebrationType) => {
      const cfg = CELEBRATION_CONFIGS[type];

      // Haptic feedback
      switch (cfg.hapticPattern) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }

      // Animate in
      containerOpacity.value = withTiming(1, { duration: 150 });
      containerScale.value = withSequence(
        withSpring(1.1, { damping: 8 }),
        withSpring(1, { damping: 12 })
      );

      titleScale.value = withDelay(
        100,
        withSequence(
          withSpring(1.2, { damping: 6 }),
          withSpring(1, { damping: 10 })
        )
      );

      checkScale.value = withDelay(
        200,
        withSpring(1, { damping: 10 })
      );

      // Glow effect
      if (type !== 'added') {
        glowOpacity.value = withSequence(
          withTiming(0.6, { duration: 300 }),
          withTiming(0.3, { duration: 500 })
        );
      }

      // Show confetti
      if (cfg.confetti) {
        setTimeout(() => setShowConfetti(true), 200);
      }

      // Auto dismiss
      setTimeout(() => {
        dismissCelebration();
      }, cfg.duration);
    },
    []
  );

  const dismissCelebration = useCallback(() => {
    containerOpacity.value = withTiming(0, { duration: 200 });
    containerScale.value = withTiming(0.8, { duration: 200 });

    setTimeout(() => {
      setShowConfetti(false);
      containerScale.value = 0;
      titleScale.value = 0.5;
      checkScale.value = 0;
      glowOpacity.value = 0;
      onComplete();
    }, 200);
  }, [onComplete]);

  // ========================================================================
  // ANIMATED STYLES
  // ========================================================================

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!visible || !movie) return null;

  const subtitle = config.subtitle.replace('{{score}}', String(tasteMatchScore));

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Confetti */}
      {showConfetti && (
        <ConfettiExplosion
          count={config.confettiCount}
          duration={config.duration}
          colors={config.colors}
        />
      )}

      {/* Main celebration card */}
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Glow background */}
        <Animated.View style={[styles.glowContainer, glowStyle]}>
          <LinearGradient
            colors={config.colors.map((c) => c + '60')}
            style={styles.glow}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Content */}
        <LinearGradient
          colors={['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.98)']}
          style={styles.card}
        >
          {/* Emoji/Check */}
          <Animated.View style={[styles.emojiContainer, checkStyle]}>
            {celebrationType === 'added' ? (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={32} color="#FFF" />
              </View>
            ) : (
              <Text style={styles.emoji}>{config.emoji}</Text>
            )}
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              celebrationType !== 'added' && styles.titleLarge,
              titleStyle,
            ]}
          >
            {config.title}
          </Animated.Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Movie title */}
          <Text style={styles.movieTitle} numberOfLines={1}>
            {movie.title}
          </Text>

          {/* Taste match badge */}
          {celebrationType !== 'added' && (
            <View style={[styles.matchBadge, { borderColor: config.colors[0] }]}>
              <Text style={[styles.matchScore, { color: config.colors[0] }]}>
                {tasteMatchScore}%
              </Text>
              <Text style={styles.matchLabel}>taste match</Text>
            </View>
          )}

          {/* Streak indicator */}
          {currentStreak >= 2 && (
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={16} color={COLORS.primary} />
              <Text style={styles.streakText}>{currentStreak} in a row</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Tap to dismiss */}
      <Pressable style={styles.dismissArea} onPress={dismissCelebration} />
    </View>
  );
};

// ============================================================================
// MINI TOAST COMPONENT (for subtle notifications)
// ============================================================================

interface MiniToastProps {
  visible: boolean;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  onHide: () => void;
}

export const MiniToast: React.FC<MiniToastProps> = ({
  visible,
  message,
  icon = 'checkmark-circle',
  color = COLORS.like,
  onHide,
}) => {
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const timer = setTimeout(onHide, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(15)}
      exiting={FadeOut.duration(200)}
      style={styles.miniToast}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.miniToastText}>{message}</Text>
    </Animated.View>
  );
};

// ============================================================================
// STREAK POPUP COMPONENT
// ============================================================================

interface StreakPopupProps {
  streak: number;
  visible: boolean;
  onHide: () => void;
}

export const StreakPopup: React.FC<StreakPopupProps> = ({
  streak,
  visible,
  onHide,
}) => {
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const timer = setTimeout(onHide, 2000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible || streak < 2) return null;

  return (
    <Animated.View
      entering={ZoomIn.springify()}
      exiting={FadeOut.duration(200)}
      style={styles.streakPopup}
    >
      <LinearGradient
        colors={[COLORS.primary + '90', COLORS.tertiary + '90']}
        style={styles.streakPopupGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="flame" size={24} color="#FFF" />
        <Text style={styles.streakPopupText}>{streak} STREAK!</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  glow: {
    flex: 1,
    borderRadius: 150,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 250,
  },
  emojiContainer: {
    marginBottom: 12,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.like,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  titleLarge: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
    maxWidth: 200,
    textAlign: 'center',
  },
  matchBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '900',
  },
  matchLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Mini toast
  miniToast: {
    position: 'absolute',
    top: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,30,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  miniToastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },

  // Streak popup
  streakPopup: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25,
    borderRadius: 24,
    overflow: 'hidden',
  },
  streakPopupGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  streakPopupText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
});

export default SoloMatchReveal;
