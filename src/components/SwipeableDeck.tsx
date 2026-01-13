/**
 * SwipeableDeck Component
 *
 * The heart of FlickSwipe - a buttery-smooth, multi-directional swipe deck
 * built with react-native-gesture-handler and react-native-reanimated.
 *
 * Features:
 * - 4-directional gestures: Left (pass), Right (like), Up (trailer), Down (reviews)
 * - Physics-based animations with spring dynamics
 * - Stacked card preview with parallax scaling
 * - Velocity-based fling detection
 * - Haptic feedback on actions
 * - Optimized for 60fps performance
 */

import React, { useCallback, useImperativeHandle, forwardRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Movie, SwipeDirection, SwipeCallbacks } from '../types';
import { ANIMATION, COLORS, LAYOUT } from '../constants';
import MovieCard from './MovieCard';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * LAYOUT.CARD_WIDTH_RATIO;
const CARD_HEIGHT = CARD_WIDTH * LAYOUT.CARD_ASPECT_RATIO;

// Swipe thresholds
const SWIPE_X_THRESHOLD = ANIMATION.SWIPE_THRESHOLD;
const SWIPE_Y_THRESHOLD = ANIMATION.SWIPE_THRESHOLD * 0.8; // Slightly less for vertical
const VELOCITY_THRESHOLD = ANIMATION.SWIPE_VELOCITY_THRESHOLD;

// Exit positions (off-screen)
const EXIT_X = SCREEN_WIDTH * 1.5;
const EXIT_Y = SCREEN_HEIGHT * 0.8;

// Spring configs for different animations
const SPRING_CONFIG = {
  damping: ANIMATION.SPRING_CONFIG.damping,
  stiffness: ANIMATION.SPRING_CONFIG.stiffness,
  mass: ANIMATION.SPRING_CONFIG.mass,
};

const SNAP_SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface SwipeableDeckProps {
  movies: Movie[];
  onSwipeLeft: (movie: Movie) => void;
  onSwipeRight: (movie: Movie) => void;
  onSwipeUp: (movie: Movie) => void;
  onSwipeDown: (movie: Movie) => void;
  onCardChange?: (index: number) => void;
  onSeenIt?: (movie: Movie) => void;
  onFavorite?: (movie: Movie) => void;
  onNeedMoreCards?: () => void;
  renderOverlay?: (direction: SwipeDirection | null, progress: number) => React.ReactNode;
}

export interface SwipeableDeckRef {
  swipeLeft: () => void;
  swipeRight: () => void;
  swipeUp: () => void;
  swipeDown: () => void;
  undo: () => void;
}

// ============================================================================
// SWIPEABLE DECK COMPONENT
// ============================================================================

const SwipeableDeck = forwardRef<SwipeableDeckRef, SwipeableDeckProps>(
  (
    {
      movies,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onCardChange,
      onSeenIt,
      onFavorite,
      onNeedMoreCards,
      renderOverlay,
    },
    ref
  ) => {
    // ========================================================================
    // STATE & REFS
    // ========================================================================

    // Current card index
    const currentIndex = useSharedValue(0);

    // Translation values for the top card
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // Track active swipe direction for overlays
    const activeDirection = useSharedValue<SwipeDirection | null>(null);
    const swipeProgress = useSharedValue(0);

    // History for undo functionality
    const [swipeHistory, setSwipeHistory] = React.useState<
      { movie: Movie; direction: SwipeDirection }[]
    >([]);

    // ========================================================================
    // HAPTIC FEEDBACK
    // ========================================================================

    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy') => {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    }, []);

    // ========================================================================
    // SWIPE HANDLERS
    // ========================================================================

    const handleSwipeComplete = useCallback(
      (direction: SwipeDirection) => {
        const idx = currentIndex.value;
        if (idx >= movies.length) return;

        const movie = movies[idx];

        // Add to history for undo
        setSwipeHistory((prev) => [...prev.slice(-10), { movie, direction }]);

        // Trigger appropriate callback
        switch (direction) {
          case 'left':
            onSwipeLeft(movie);
            break;
          case 'right':
            onSwipeRight(movie);
            break;
          case 'up':
            onSwipeUp(movie);
            break;
          case 'down':
            onSwipeDown(movie);
            break;
        }

        // Move to next card
        currentIndex.value = idx + 1;
        onCardChange?.(idx + 1);

        // Request more cards if running low
        if (idx >= movies.length - 5) {
          onNeedMoreCards?.();
        }
      },
      [movies, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onCardChange, onNeedMoreCards]
    );

    const resetPosition = useCallback(() => {
      'worklet';
      translateX.value = withSpring(0, SNAP_SPRING_CONFIG);
      translateY.value = withSpring(0, SNAP_SPRING_CONFIG);
      activeDirection.value = null;
      swipeProgress.value = withTiming(0, { duration: 150 });
    }, []);

    const animateSwipeOut = useCallback(
      (direction: SwipeDirection) => {
        'worklet';
        const exitX =
          direction === 'left' ? -EXIT_X : direction === 'right' ? EXIT_X : 0;
        const exitY =
          direction === 'up' ? -EXIT_Y : direction === 'down' ? EXIT_Y : 0;

        translateX.value = withSpring(exitX, SPRING_CONFIG, (finished) => {
          if (finished) {
            // Reset for next card
            translateX.value = 0;
            translateY.value = 0;
            activeDirection.value = null;
            swipeProgress.value = 0;
            runOnJS(handleSwipeComplete)(direction);
          }
        });

        translateY.value = withSpring(exitY, SPRING_CONFIG);
      },
      [handleSwipeComplete]
    );

    // ========================================================================
    // GESTURE HANDLER
    // ========================================================================

    const panGesture = Gesture.Pan()
      .onStart(() => {
        // Haptic feedback on touch
        runOnJS(triggerHaptic)('light');
      })
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;

        // Determine dominant direction
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);

        if (absX > absY) {
          // Horizontal swipe
          activeDirection.value = event.translationX > 0 ? 'right' : 'left';
          swipeProgress.value = Math.min(absX / SWIPE_X_THRESHOLD, 1);
        } else {
          // Vertical swipe
          activeDirection.value = event.translationY < 0 ? 'up' : 'down';
          swipeProgress.value = Math.min(absY / SWIPE_Y_THRESHOLD, 1);
        }
      })
      .onEnd((event) => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const velocityX = Math.abs(event.velocityX);
        const velocityY = Math.abs(event.velocityY);

        // Check for velocity-based fling
        const isHorizontalFling = velocityX > VELOCITY_THRESHOLD && absX > 50;
        const isVerticalFling = velocityY > VELOCITY_THRESHOLD && absY > 50;

        // Determine if horizontal or vertical dominates
        const isHorizontalDominant = absX > absY || isHorizontalFling;
        const isVerticalDominant = absY > absX || isVerticalFling;

        if (isHorizontalDominant) {
          // Horizontal swipe
          const shouldComplete =
            absX > SWIPE_X_THRESHOLD || isHorizontalFling;

          if (shouldComplete) {
            const direction: SwipeDirection =
              translateX.value > 0 ? 'right' : 'left';
            runOnJS(triggerHaptic)('medium');
            animateSwipeOut(direction);
          } else {
            resetPosition();
          }
        } else if (isVerticalDominant) {
          // Vertical swipe
          const shouldComplete =
            absY > SWIPE_Y_THRESHOLD || isVerticalFling;

          if (shouldComplete) {
            const direction: SwipeDirection =
              translateY.value < 0 ? 'up' : 'down';
            runOnJS(triggerHaptic)('medium');
            animateSwipeOut(direction);
          } else {
            resetPosition();
          }
        } else {
          resetPosition();
        }
      });

    // ========================================================================
    // IMPERATIVE METHODS
    // ========================================================================

    useImperativeHandle(ref, () => ({
      swipeLeft: () => {
        triggerHaptic('medium');
        animateSwipeOut('left');
      },
      swipeRight: () => {
        triggerHaptic('medium');
        animateSwipeOut('right');
      },
      swipeUp: () => {
        triggerHaptic('medium');
        animateSwipeOut('up');
      },
      swipeDown: () => {
        triggerHaptic('medium');
        animateSwipeOut('down');
      },
      undo: () => {
        if (swipeHistory.length === 0) return;
        const last = swipeHistory[swipeHistory.length - 1];
        setSwipeHistory((prev) => prev.slice(0, -1));
        currentIndex.value = Math.max(0, currentIndex.value - 1);
        triggerHaptic('light');
        onCardChange?.(currentIndex.value);
      },
    }));

    // ========================================================================
    // RENDER CARDS
    // ========================================================================

    const renderCards = () => {
      const cards = [];

      // Render visible stack (top 3 cards)
      for (let i = 0; i < ANIMATION.STACK_VISIBLE_CARDS; i++) {
        const movieIndex = currentIndex.value + i;
        if (movieIndex >= movies.length) break;

        const movie = movies[movieIndex];
        const isTopCard = i === 0;

        cards.push(
          <SwipeCard
            key={movie.id}
            movie={movie}
            isTopCard={isTopCard}
            stackIndex={i}
            translateX={isTopCard ? translateX : undefined}
            translateY={isTopCard ? translateY : undefined}
            activeDirection={isTopCard ? activeDirection : undefined}
            swipeProgress={isTopCard ? swipeProgress : undefined}
            panGesture={isTopCard ? panGesture : undefined}
            onSeenIt={onSeenIt}
            onFavorite={onFavorite}
          />
        );
      }

      // Render in reverse order so top card is on top
      return cards.reverse();
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    if (movies.length === 0) {
      return (
        <View style={styles.container}>
          <View style={styles.emptyState}>
            {/* Empty state handled by parent */}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {renderCards()}

        {/* Swipe direction overlays */}
        {renderOverlay && (
          <SwipeOverlay
            activeDirection={activeDirection}
            swipeProgress={swipeProgress}
            renderOverlay={renderOverlay}
          />
        )}
      </View>
    );
  }
);

// ============================================================================
// SWIPE CARD COMPONENT
// ============================================================================

interface SwipeCardProps {
  movie: Movie;
  isTopCard: boolean;
  stackIndex: number;
  translateX?: SharedValue<number>;
  translateY?: SharedValue<number>;
  activeDirection?: SharedValue<SwipeDirection | null>;
  swipeProgress?: SharedValue<number>;
  panGesture?: ReturnType<typeof Gesture.Pan>;
  onSeenIt?: (movie: Movie) => void;
  onFavorite?: (movie: Movie) => void;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  movie,
  isTopCard,
  stackIndex,
  translateX,
  translateY,
  activeDirection,
  swipeProgress,
  panGesture,
  onSeenIt,
  onFavorite,
}) => {
  // Animated styles for the card
  const animatedStyle = useAnimatedStyle(() => {
    if (!isTopCard || !translateX || !translateY) {
      // Background cards: static position with scale/offset
      const scale = 1 - stackIndex * ANIMATION.CARD_SCALE_RATIO;
      const offsetY = stackIndex * ANIMATION.STACK_OFFSET_Y;

      return {
        transform: [
          { scale },
          { translateY: offsetY },
        ],
        zIndex: ANIMATION.STACK_VISIBLE_CARDS - stackIndex,
      };
    }

    // Top card: follows gesture with rotation
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-ANIMATION.MAX_ROTATION, 0, ANIMATION.MAX_ROTATION],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ],
      zIndex: ANIMATION.STACK_VISIBLE_CARDS,
    };
  });

  // Overlay opacity styles
  const likeOverlayStyle = useAnimatedStyle(() => {
    if (!swipeProgress || !activeDirection) return { opacity: 0 };

    const opacity =
      activeDirection.value === 'right'
        ? interpolate(swipeProgress.value, [0, 0.5, 1], [0, 0.3, 0.8])
        : 0;

    return { opacity };
  });

  const passOverlayStyle = useAnimatedStyle(() => {
    if (!swipeProgress || !activeDirection) return { opacity: 0 };

    const opacity =
      activeDirection.value === 'left'
        ? interpolate(swipeProgress.value, [0, 0.5, 1], [0, 0.3, 0.8])
        : 0;

    return { opacity };
  });

  const trailerOverlayStyle = useAnimatedStyle(() => {
    if (!swipeProgress || !activeDirection) return { opacity: 0 };

    const opacity =
      activeDirection.value === 'up'
        ? interpolate(swipeProgress.value, [0, 0.5, 1], [0, 0.3, 0.8])
        : 0;

    return { opacity };
  });

  const reviewsOverlayStyle = useAnimatedStyle(() => {
    if (!swipeProgress || !activeDirection) return { opacity: 0 };

    const opacity =
      activeDirection.value === 'down'
        ? interpolate(swipeProgress.value, [0, 0.5, 1], [0, 0.3, 0.8])
        : 0;

    return { opacity };
  });

  const cardContent = (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <MovieCard
        movie={movie}
        onSeenIt={() => onSeenIt?.(movie)}
        onFavorite={() => onFavorite?.(movie)}
      />

      {/* Direction overlays */}
      {isTopCard && (
        <>
          {/* LIKE overlay (right) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              styles.likeOverlay,
              likeOverlayStyle,
            ]}
          >
            <View style={styles.overlayBadge}>
              <Animated.Text style={styles.overlayText}>LIKE</Animated.Text>
            </View>
          </Animated.View>

          {/* PASS overlay (left) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              styles.passOverlay,
              passOverlayStyle,
            ]}
          >
            <View style={[styles.overlayBadge, styles.passOverlayBadge]}>
              <Animated.Text style={styles.overlayText}>NOPE</Animated.Text>
            </View>
          </Animated.View>

          {/* TRAILER overlay (up) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              styles.trailerOverlay,
              trailerOverlayStyle,
            ]}
          >
            <View style={[styles.overlayBadge, styles.trailerOverlayBadge]}>
              <Animated.Text style={styles.overlayText}>TRAILER</Animated.Text>
            </View>
          </Animated.View>

          {/* REVIEWS overlay (down) */}
          <Animated.View
            style={[
              styles.directionOverlay,
              styles.reviewsOverlay,
              reviewsOverlayStyle,
            ]}
          >
            <View style={[styles.overlayBadge, styles.reviewsOverlayBadge]}>
              <Animated.Text style={styles.overlayText}>REVIEWS</Animated.Text>
            </View>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );

  // Only top card is draggable
  if (isTopCard && panGesture) {
    return <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>;
  }

  return cardContent;
};

// ============================================================================
// SWIPE OVERLAY COMPONENT
// ============================================================================

interface SwipeOverlayProps {
  activeDirection: SharedValue<SwipeDirection | null>;
  swipeProgress: SharedValue<number>;
  renderOverlay: (direction: SwipeDirection | null, progress: number) => React.ReactNode;
}

const SwipeOverlay: React.FC<SwipeOverlayProps> = ({
  activeDirection,
  swipeProgress,
  renderOverlay,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: swipeProgress.value > 0.2 ? 1 : 0,
    };
  });

  return (
    <Animated.View style={[styles.overlayContainer, animatedStyle]}>
      {/* Custom overlay content */}
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Direction overlays
  directionOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeOverlay: {
    backgroundColor: COLORS.like + '40',
    borderWidth: 4,
    borderColor: COLORS.like,
  },
  passOverlay: {
    backgroundColor: COLORS.pass + '40',
    borderWidth: 4,
    borderColor: COLORS.pass,
  },
  trailerOverlay: {
    backgroundColor: COLORS.trailer + '40',
    borderWidth: 4,
    borderColor: COLORS.trailer,
  },
  reviewsOverlay: {
    backgroundColor: COLORS.reviews + '40',
    borderWidth: 4,
    borderColor: COLORS.reviews,
  },

  // Overlay badges
  overlayBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.like,
    borderRadius: 8,
    transform: [{ rotate: '-20deg' }],
  },
  passOverlayBadge: {
    backgroundColor: COLORS.pass,
    transform: [{ rotate: '20deg' }],
  },
  trailerOverlayBadge: {
    backgroundColor: COLORS.trailer,
    transform: [{ rotate: '0deg' }],
  },
  reviewsOverlayBadge: {
    backgroundColor: COLORS.reviews,
    transform: [{ rotate: '0deg' }],
  },
  overlayText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});

export default SwipeableDeck;
