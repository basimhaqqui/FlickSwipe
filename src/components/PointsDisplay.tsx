/**
 * PointsDisplay Component
 *
 * Shows user's current points with animated coin effects.
 * Features point earning animations and level progression.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../constants';

// ============================================================================
// INTERFACES
// ============================================================================

interface PointsDisplayProps {
  points: number;
  sessionPoints?: number;
  onPress?: () => void;
  compact?: boolean;
  showEarnAnimation?: boolean;
  earnedAmount?: number;
}

// ============================================================================
// FLOATING POINTS COMPONENT (earn animation)
// ============================================================================

interface FloatingPointsProps {
  amount: number;
  onComplete: () => void;
}

const FloatingPoints: React.FC<FloatingPointsProps> = ({ amount, onComplete }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withSpring(1.2, { damping: 8 });
    translateY.value = withTiming(-60, { duration: 1000 });
    opacity.value = withTiming(0, { duration: 1000 }, () => {
      runOnJS(onComplete)();
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingPoints, animatedStyle]}>
      <Text style={styles.floatingPointsText}>+{amount}</Text>
    </Animated.View>
  );
};

// ============================================================================
// POINTS DISPLAY COMPONENT
// ============================================================================

const PointsDisplay: React.FC<PointsDisplayProps> = ({
  points,
  sessionPoints = 0,
  onPress,
  compact = false,
  showEarnAnimation = false,
  earnedAmount = 0,
}) => {
  // Animation values
  const coinRotate = useSharedValue(0);
  const coinScale = useSharedValue(1);
  const [showFloating, setShowFloating] = React.useState(false);
  const prevPoints = useRef(points);

  // Coin animation on points change
  useEffect(() => {
    if (points > prevPoints.current) {
      // Points increased - animate coin
      coinScale.value = withSequence(
        withSpring(1.3, { damping: 6 }),
        withSpring(1, { damping: 10 })
      );
      coinRotate.value = withSequence(
        withTiming(360, { duration: 400 }),
        withTiming(0, { duration: 0 })
      );

      // Show floating points
      setShowFloating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevPoints.current = points;
  }, [points]);

  useEffect(() => {
    if (showEarnAnimation && earnedAmount > 0) {
      setShowFloating(true);
    }
  }, [showEarnAnimation, earnedAmount]);

  const coinAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateY: `${coinRotate.value}deg` },
      { scale: coinScale.value },
    ],
  }));

  // Format large numbers
  const formatPoints = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (compact) {
    return (
      <Pressable onPress={onPress} style={styles.compactContainer}>
        <Animated.View style={coinAnimatedStyle}>
          <Ionicons name="star" size={18} color={COLORS.tertiary} />
        </Animated.View>
        <Text style={styles.compactNumber}>{formatPoints(points)}</Text>

        {showFloating && (
          <FloatingPoints
            amount={earnedAmount || points - prevPoints.current}
            onComplete={() => setShowFloating(false)}
          />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <LinearGradient
        colors={[`${COLORS.tertiary}20`, 'transparent']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, coinAnimatedStyle]}>
          <Ionicons name="star" size={28} color={COLORS.tertiary} />
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.number}>{formatPoints(points)}</Text>
          <Text style={styles.label}>Total Points</Text>
        </View>

        {sessionPoints > 0 && (
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionText}>+{sessionPoints} this session</Text>
          </View>
        )}
      </View>

      {/* Level indicator */}
      <View style={styles.levelContainer}>
        <Text style={styles.levelText}>Level {Math.floor(points / 500) + 1}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(points % 500) / 5}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {500 - (points % 500)} to next level
        </Text>
      </View>

      {showFloating && (
        <FloatingPoints
          amount={earnedAmount || points - prevPoints.current}
          onComplete={() => setShowFloating(false)}
        />
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
    position: 'relative',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.tertiary}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  number: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.tertiary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sessionBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Level progress
  levelContainer: {
    marginTop: 16,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.tertiary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Floating points
  floatingPoints: {
    position: 'absolute',
    top: '50%',
    right: 20,
  },
  floatingPointsText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.success,
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
    position: 'relative',
  },
  compactNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.tertiary,
  },
});

export default PointsDisplay;
