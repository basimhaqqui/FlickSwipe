/**
 * ConfettiExplosion Component
 *
 * Creates a spectacular confetti explosion effect for match celebrations.
 * Uses react-native-reanimated for smooth, performant particle animations.
 *
 * Features:
 * - Configurable particle count and colors
 * - Physics-based gravity and spin
 * - Multiple explosion sources
 * - Variable particle sizes and shapes
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Particle shapes
const SHAPES = ['square', 'rectangle', 'circle'] as const;
type Shape = (typeof SHAPES)[number];

// Default colors
const DEFAULT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#6C5CE7', // Purple
  '#00D68F', // Green
  '#FF8E53', // Orange
  '#A29BFE', // Lavender
  '#FD79A8', // Pink
];

// ============================================================================
// INTERFACES
// ============================================================================

interface ConfettiExplosionProps {
  count?: number;
  duration?: number;
  colors?: string[];
  onComplete?: () => void;
}

interface ParticleConfig {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  shape: Shape;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  delay: number;
}

// ============================================================================
// PARTICLE COMPONENT
// ============================================================================

interface ParticleProps {
  config: ParticleConfig;
  duration: number;
}

const Particle: React.FC<ParticleProps> = ({ config, duration }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withTiming(1, {
        duration: duration,
        easing: Easing.out(Easing.quad),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // Parabolic trajectory with gravity
    const time = progress.value;
    const gravity = 800; // Pixels per second squared

    // Position with physics
    const x = config.x + config.velocityX * time * (duration / 1000);
    const y =
      config.y +
      config.velocityY * time * (duration / 1000) +
      0.5 * gravity * Math.pow(time * (duration / 1000), 2);

    // Rotation
    const rotate = config.rotation + config.rotationSpeed * time * 360 * 3;

    // Fade out near end
    const opacity = interpolate(time, [0, 0.7, 1], [1, 1, 0]);

    // Scale down slightly
    const scale = interpolate(time, [0, 0.3, 1], [0.8, 1, 0.6]);

    return {
      position: 'absolute',
      left: x,
      top: y,
      opacity,
      transform: [
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  // Render different shapes
  const renderShape = () => {
    const baseStyle = {
      width: config.size,
      height:
        config.shape === 'rectangle' ? config.size * 2 : config.size,
      backgroundColor: config.color,
    };

    if (config.shape === 'circle') {
      return (
        <View
          style={[
            baseStyle,
            { borderRadius: config.size / 2 },
          ]}
        />
      );
    }

    if (config.shape === 'rectangle') {
      return <View style={[baseStyle, { borderRadius: 2 }]} />;
    }

    // Square
    return <View style={[baseStyle, { borderRadius: 2 }]} />;
  };

  return <Animated.View style={animatedStyle}>{renderShape()}</Animated.View>;
};

// ============================================================================
// CONFETTI EXPLOSION COMPONENT
// ============================================================================

const ConfettiExplosion: React.FC<ConfettiExplosionProps> = ({
  count = 100,
  duration = 3000,
  colors = DEFAULT_COLORS,
  onComplete,
}) => {
  // Generate particle configurations
  const particles = useMemo(() => {
    const configs: ParticleConfig[] = [];

    // Create multiple explosion sources for variety
    const sources = [
      { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT * 0.4 },        // Center
      { x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.3 },      // Left
      { x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.3 },      // Right
      { x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.6 },      // Bottom left
      { x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.6 },      // Bottom right
    ];

    for (let i = 0; i < count; i++) {
      // Pick a random source
      const source = sources[Math.floor(Math.random() * sources.length)];

      // Random angle for explosion (mostly upward and outward)
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 400;

      configs.push({
        id: i,
        x: source.x + (Math.random() - 0.5) * 50,
        y: source.y + (Math.random() - 0.5) * 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 10,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 300, // Bias upward
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2,
        delay: Math.random() * 200, // Stagger start
      });
    }

    return configs;
  }, [count, colors]);

  // Trigger onComplete callback
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, duration + 300);
      return () => clearTimeout(timer);
    }
  }, [duration, onComplete]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((config) => (
        <Particle key={config.id} config={config} duration={duration} />
      ))}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

export default ConfettiExplosion;
