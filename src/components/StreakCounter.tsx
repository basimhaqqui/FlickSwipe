/**
 * StreakCounter Component
 *
 * Displays the current group streak with animated fire effects.
 * Encourages users to maintain their streak with visual feedback.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../constants';

// ============================================================================
// INTERFACES
// ============================================================================

interface StreakCounterProps {
  streak: number;
  lastSessionAt?: number;
  onPress?: () => void;
  compact?: boolean;
}

// ============================================================================
// STREAK COUNTER COMPONENT
// ============================================================================

const StreakCounter: React.FC<StreakCounterProps> = ({
  streak,
  lastSessionAt,
  onPress,
  compact = false,
}) => {
  // Animation values
  const flameScale = useSharedValue(1);
  const flameOpacity = useSharedValue(1);
  const numberScale = useSharedValue(1);

  // Determine if streak is at risk (no session in 20+ hours)
  const hoursAgo = lastSessionAt
    ? (Date.now() - lastSessionAt) / (1000 * 60 * 60)
    : 0;
  const isAtRisk = hoursAgo > 20 && streak > 0;

  // Flame animation
  useEffect(() => {
    if (streak > 0) {
      // Pulse animation for active streak
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      flameOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        true
      );
    }
  }, [streak]);

  // Number pop animation when streak changes
  useEffect(() => {
    numberScale.value = withSequence(
      withSpring(1.3, { damping: 8 }),
      withSpring(1, { damping: 10 })
    );
  }, [streak]);

  const flameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
    opacity: flameOpacity.value,
  }));

  const numberAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
  }));

  // Get color based on streak level
  const getStreakColor = () => {
    if (streak === 0) return COLORS.textMuted;
    if (streak < 3) return '#FF9500';
    if (streak < 7) return '#FF6B6B';
    if (streak < 14) return '#FF4757';
    return '#FFD700';
  };

  const color = getStreakColor();

  if (compact) {
    return (
      <Pressable onPress={onPress} style={styles.compactContainer}>
        <Animated.View style={flameAnimatedStyle}>
          <Ionicons
            name={streak > 0 ? 'flame' : 'flame-outline'}
            size={20}
            color={color}
          />
        </Animated.View>
        <Animated.Text
          style={[styles.compactNumber, { color }, numberAnimatedStyle]}
        >
          {streak}
        </Animated.Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient
        colors={
          streak > 0
            ? [`${color}20`, `${color}10`, 'transparent']
            : ['transparent', 'transparent']
        }
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, flameAnimatedStyle]}>
          <Ionicons
            name={streak > 0 ? 'flame' : 'flame-outline'}
            size={32}
            color={color}
          />
        </Animated.View>

        <View style={styles.textContainer}>
          <Animated.Text
            style={[styles.number, { color }, numberAnimatedStyle]}
          >
            {streak}
          </Animated.Text>
          <Text style={styles.label}>
            {streak === 1 ? 'Day Streak' : 'Day Streak'}
          </Text>
        </View>
      </View>

      {isAtRisk && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={12} color="#FFF" />
          <Text style={styles.warningText}>Expiring soon!</Text>
        </View>
      )}

      {streak >= 7 && (
        <View style={[styles.milestone, { borderColor: color }]}>
          <Text style={[styles.milestoneText, { color }]}>
            {streak >= 30 ? 'LEGEND' : streak >= 14 ? 'ON FIRE' : 'BLAZING'}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  number: {
    fontSize: 36,
    fontWeight: '900',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  warningBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  milestone: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 12,
  },
  milestoneText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  compactNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
});

export default StreakCounter;
