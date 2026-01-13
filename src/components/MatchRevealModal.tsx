/**
 * MatchRevealModal Component
 *
 * THE DOPAMINE ENGINE - Variable reward system for maximum addiction.
 *
 * Features:
 * - Dramatic build-up with anticipation
 * - Variable intensity based on consensus percentage
 * - Escalating confetti explosions
 * - Slow-mo poster zoom reveal
 * - Cinematic sound cues (haptics substitute in code)
 * - Stats comparison ("You beat 85% of groups!")
 * - Random bonuses and power-ups
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeInUp,
  ZoomIn,
  SlideInUp,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Match, Movie, RewardIntensity, RoomMember } from '../types';
import { COLORS, GAMIFICATION } from '../constants';
import { getPosterUrl } from '../services/tmdb';
import ConfettiExplosion from './ConfettiExplosion';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Intensity configurations for variable rewards
const INTENSITY_CONFIG: Record<
  RewardIntensity,
  {
    title: string;
    emoji: string;
    confettiCount: number;
    confettiDuration: number;
    posterScale: number;
    glowIntensity: number;
    gradientColors: string[];
    hapticPattern: number[];
    bonusChance: number;
  }
> = {
  normal: {
    title: "It's a Match!",
    emoji: '🎬',
    confettiCount: 50,
    confettiDuration: 2000,
    posterScale: 1.1,
    glowIntensity: 0.5,
    gradientColors: [COLORS.primary, COLORS.secondary],
    hapticPattern: [0, 100, 100, 100],
    bonusChance: 0.1,
  },
  great: {
    title: 'Great Match!',
    emoji: '🔥',
    confettiCount: 100,
    confettiDuration: 2500,
    posterScale: 1.15,
    glowIntensity: 0.7,
    gradientColors: [COLORS.tertiary, COLORS.primary],
    hapticPattern: [0, 80, 80, 80, 80, 80],
    bonusChance: 0.25,
  },
  epic: {
    title: 'EPIC MATCH!',
    emoji: '⚡',
    confettiCount: 150,
    confettiDuration: 3000,
    posterScale: 1.2,
    glowIntensity: 0.85,
    gradientColors: ['#FFD700', '#FF6B6B', '#6C5CE7'],
    hapticPattern: [0, 60, 60, 60, 60, 60, 60, 60],
    bonusChance: 0.5,
  },
  legendary: {
    title: '🏆 JACKPOT! 🏆',
    emoji: '👑',
    confettiCount: 250,
    confettiDuration: 4000,
    posterScale: 1.3,
    glowIntensity: 1,
    gradientColors: ['#FFD700', '#FF6B6B', '#6C5CE7', '#00D68F'],
    hapticPattern: [0, 50, 50, 50, 50, 50, 50, 50, 200, 100, 200],
    bonusChance: 1.0,
  },
};

// ============================================================================
// INTERFACES
// ============================================================================

interface MatchRevealModalProps {
  visible: boolean;
  match: Match | null;
  members: RoomMember[];
  onClose: () => void;
  onWatchNow?: () => void;
  onAddToWatchlist?: () => void;
}

// ============================================================================
// MATCH REVEAL MODAL COMPONENT
// ============================================================================

const MatchRevealModal: React.FC<MatchRevealModalProps> = ({
  visible,
  match,
  members,
  onClose,
  onWatchNow,
  onAddToWatchlist,
}) => {
  // State
  const [phase, setPhase] = useState<'buildup' | 'reveal' | 'stats'>('buildup');
  const [showConfetti, setShowConfetti] = useState(false);
  const [bonusReward, setBonusReward] = useState<string | null>(null);
  const [statsLine, setStatsLine] = useState<string>('');

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const posterScale = useSharedValue(0.5);
  const posterRotate = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.5);
  const contentOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Get config based on intensity
  const config = match
    ? INTENSITY_CONFIG[match.rewardIntensity]
    : INTENSITY_CONFIG.normal;

  // ========================================================================
  // HAPTIC PATTERNS
  // ========================================================================

  const playHapticPattern = useCallback((pattern: number[]) => {
    let timeout = 0;
    pattern.forEach((duration, index) => {
      if (index % 2 === 0) {
        // Even indices are delays
        timeout += duration;
      } else {
        // Odd indices are haptic triggers
        setTimeout(() => {
          Haptics.impactAsync(
            duration > 150
              ? Haptics.ImpactFeedbackStyle.Heavy
              : duration > 80
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
        }, timeout);
        timeout += duration;
      }
    });
  }, []);

  // ========================================================================
  // ANIMATION SEQUENCE
  // ========================================================================

  const startRevealSequence = useCallback(() => {
    if (!match) return;

    // Reset state
    setPhase('buildup');
    setShowConfetti(false);
    setBonusReward(null);

    // Phase 1: Buildup (suspense)
    backdropOpacity.value = withTiming(1, { duration: 300 });

    // Poster entrance with anticipation
    posterScale.value = withSequence(
      withTiming(0.8, { duration: 200 }),
      withDelay(300, withSpring(config.posterScale, { damping: 8, stiffness: 100 }))
    );

    // Slow rotation for drama
    posterRotate.value = withSequence(
      withTiming(-3, { duration: 500 }),
      withSpring(0, { damping: 10 })
    );

    // Glow pulse
    setTimeout(() => {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(config.glowIntensity, { duration: 500 }),
          withTiming(config.glowIntensity * 0.5, { duration: 500 })
        ),
        -1,
        true
      );
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    }, 400);

    // Phase 2: Title reveal
    setTimeout(() => {
      setPhase('reveal');
      playHapticPattern(config.hapticPattern);

      titleOpacity.value = withSpring(1);
      titleScale.value = withSequence(
        withSpring(1.3, { damping: 5 }),
        withSpring(1, { damping: 12 })
      );

      // Trigger confetti
      setShowConfetti(true);
    }, 800);

    // Phase 3: Stats and actions
    setTimeout(() => {
      setPhase('stats');
      contentOpacity.value = withTiming(1, { duration: 400 });

      // Generate stats line
      const randomPercentile = 60 + Math.floor(Math.random() * 35);
      setStatsLine(`You beat ${randomPercentile}% of groups!`);

      // Check for bonus reward
      if (Math.random() < config.bonusChance) {
        const bonuses = ['Undo Power-Up!', 'Double Points!', 'Super Like Unlocked!'];
        setBonusReward(bonuses[Math.floor(Math.random() * bonuses.length)]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 1800);
  }, [match, config, playHapticPattern]);

  // Start sequence when modal opens
  useEffect(() => {
    if (visible && match) {
      startRevealSequence();
    } else {
      // Reset animations
      backdropOpacity.value = 0;
      posterScale.value = 0.5;
      posterRotate.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 1;
      titleOpacity.value = 0;
      titleScale.value = 0.5;
      contentOpacity.value = 0;
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
    }
  }, [visible, match]);

  // ========================================================================
  // ANIMATED STYLES
  // ========================================================================

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const posterStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: posterScale.value },
      { rotate: `${posterRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!match) return null;

  const movie = match.movie;
  const posterUrl = getPosterUrl(movie.posterPath);
  const matchedMembers = members.filter((m) => match.matchedBy.includes(m.id));
  const consensusPercent = Math.round(match.consensusPercentage * 100);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop with gradient */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(10,10,15,0.98)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Confetti explosion */}
      {showConfetti && (
        <ConfettiExplosion
          count={config.confettiCount}
          duration={config.confettiDuration}
          colors={config.gradientColors}
        />
      )}

      {/* Main content */}
      <View style={styles.container}>
        {/* Glow effect behind poster */}
        <Animated.View style={[styles.glowContainer, glowStyle]}>
          <LinearGradient
            colors={config.gradientColors.map((c) => c + '60')}
            style={styles.glow}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Movie poster */}
        <Animated.View style={[styles.posterContainer, posterStyle]}>
          <Image source={{ uri: posterUrl }} style={styles.poster} />

          {/* Poster border glow */}
          <View style={[styles.posterBorder, { borderColor: config.gradientColors[0] }]} />
        </Animated.View>

        {/* Match title */}
        <Animated.View style={[styles.titleContainer, titleStyle]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
          <Text
            style={[
              styles.title,
              match.rewardIntensity === 'legendary' && styles.legendaryTitle,
            ]}
          >
            {config.title}
          </Text>
        </Animated.View>

        {/* Movie title */}
        <Animated.Text
          entering={FadeInUp.delay(1000).duration(400)}
          style={styles.movieTitle}
        >
          {movie.title}
        </Animated.Text>

        {/* Consensus indicator */}
        <Animated.View
          entering={ZoomIn.delay(1200).duration(300)}
          style={styles.consensusContainer}
        >
          <Text style={styles.consensusValue}>{consensusPercent}%</Text>
          <Text style={styles.consensusLabel}>Group Consensus</Text>
        </Animated.View>

        {/* Matched members */}
        <Animated.View style={[styles.membersContainer, contentStyle]}>
          <Text style={styles.membersLabel}>Matched with:</Text>
          <View style={styles.membersList}>
            {matchedMembers.map((member, index) => (
              <Animated.View
                key={member.id}
                entering={FadeIn.delay(1400 + index * 100)}
                style={styles.memberBadge}
              >
                <Text style={styles.memberEmoji}>{member.avatarEmoji}</Text>
                <Text style={styles.memberName}>{member.displayName}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Stats line */}
        {statsLine && (
          <Animated.View
            entering={SlideInUp.delay(1600).duration(400)}
            style={styles.statsContainer}
          >
            <Ionicons name="trophy" size={20} color={COLORS.tertiary} />
            <Text style={styles.statsText}>{statsLine}</Text>
          </Animated.View>
        )}

        {/* Bonus reward */}
        {bonusReward && (
          <Animated.View
            entering={ZoomIn.delay(2000).springify()}
            style={styles.bonusContainer}
          >
            <LinearGradient
              colors={COLORS.gradientGold}
              style={styles.bonusGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="gift" size={24} color="#FFF" />
              <Text style={styles.bonusText}>BONUS: {bonusReward}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View style={[styles.actionsContainer, contentStyle]}>
          <Pressable
            style={[styles.actionButton, styles.watchButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onWatchNow?.();
            }}
          >
            <Ionicons name="play" size={22} color="#FFF" />
            <Text style={styles.actionButtonText}>Watch Now</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.watchlistButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAddToWatchlist?.();
            }}
          >
            <Ionicons name="bookmark-outline" size={22} color={COLORS.primary} />
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
              Save for Later
            </Text>
          </Pressable>
        </Animated.View>

        {/* Continue button */}
        <Animated.View style={[styles.continueContainer, contentStyle]}>
          <Pressable style={styles.continueButton} onPress={onClose}>
            <Text style={styles.continueText}>Keep Swiping</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Glow effect
  glowContainer: {
    position: 'absolute',
    width: 300,
    height: 450,
    borderRadius: 24,
    overflow: 'hidden',
  },
  glow: {
    flex: 1,
    borderRadius: 24,
  },

  // Poster
  posterContainer: {
    width: 220,
    height: 330,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 3,
  },

  // Title
  titleContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  legendaryTitle: {
    fontSize: 28,
    color: COLORS.tertiary,
  },

  // Movie title
  movieTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Consensus
  consensusContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  consensusValue: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.like,
  },
  consensusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Members
  membersContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  membersLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  memberEmoji: {
    fontSize: 18,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.tertiary + '20',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.tertiary + '40',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.tertiary,
  },

  // Bonus
  bonusContainer: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bonusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bonusText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    textTransform: 'uppercase',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  watchButton: {
    backgroundColor: COLORS.primary,
  },
  watchlistButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Continue
  continueContainer: {
    position: 'absolute',
    bottom: 50,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

export default MatchRevealModal;
