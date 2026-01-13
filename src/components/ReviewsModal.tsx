/**
 * ReviewsModal Component
 *
 * Full-screen modal for displaying movie reviews and ratings.
 * Fetches reviews from TMDB API with graceful fallbacks.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Movie, Review } from '../types';
import { COLORS } from '../constants';
import { getMovieReviews, getMovieRatingDetails, formatRating } from '../services/tmdb';

// ============================================================================
// CONSTANTS
// ============================================================================

const DISMISS_THRESHOLD = 150;

// ============================================================================
// INTERFACES
// ============================================================================

interface ReviewsModalProps {
  visible: boolean;
  movie: Movie | null;
  onClose: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
}

// ============================================================================
// REVIEW CARD COMPONENT
// ============================================================================

interface ReviewCardProps {
  review: Review;
  index: number;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, index }) => {
  const [expanded, setExpanded] = useState(false);

  // Avatar URL
  const avatarUrl = review.authorDetails.avatarPath
    ? review.authorDetails.avatarPath.startsWith('/https')
      ? review.authorDetails.avatarPath.substring(1)
      : `https://image.tmdb.org/t/p/w45${review.authorDetails.avatarPath}`
    : null;

  return (
    <Animated.View
      entering={Animated.FadeInUp.delay(index * 100).duration(300)}
      style={styles.reviewCard}
    >
      {/* Author info */}
      <View style={styles.authorRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {review.author.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{review.author}</Text>
          {review.authorDetails.rating && (
            <View style={styles.authorRating}>
              <Ionicons name="star" size={12} color={COLORS.tertiary} />
              <Text style={styles.authorRatingText}>
                {review.authorDetails.rating}/10
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.reviewDate}>
          {new Date(review.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Review content */}
      <Text
        style={styles.reviewContent}
        numberOfLines={expanded ? undefined : 4}
      >
        {review.content}
      </Text>

      {review.content.length > 200 && (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text style={styles.expandButton}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

// ============================================================================
// RATING OVERVIEW COMPONENT
// ============================================================================

interface RatingOverviewProps {
  rating: number;
  voteCount: number;
}

const RatingOverview: React.FC<RatingOverviewProps> = ({ rating, voteCount }) => {
  // Get color based on rating
  const getColor = () => {
    if (rating >= 7.5) return COLORS.success;
    if (rating >= 6) return COLORS.warning;
    return COLORS.error;
  };

  const color = getColor();
  const percentage = (rating / 10) * 100;

  return (
    <View style={styles.ratingOverview}>
      {/* Circular progress */}
      <View style={[styles.ratingCircle, { borderColor: color }]}>
        <Text style={[styles.ratingValue, { color }]}>{rating.toFixed(1)}</Text>
        <Text style={styles.ratingMax}>/10</Text>
      </View>

      <View style={styles.ratingInfo}>
        <Text style={styles.ratingLabel}>TMDB Score</Text>
        <Text style={styles.voteCount}>
          {(voteCount / 1000).toFixed(1)}K votes
        </Text>

        {/* Rating bar */}
        <View style={styles.ratingBar}>
          <View style={[styles.ratingFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// REVIEWS MODAL COMPONENT
// ============================================================================

const ReviewsModal: React.FC<ReviewsModalProps> = ({
  visible,
  movie,
  onClose,
  onSwipeRight,
  onSwipeLeft,
}) => {
  // State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Fetch reviews when modal opens
  useEffect(() => {
    if (visible && movie) {
      setLoading(true);
      setError(null);

      getMovieReviews(movie.id)
        .then(({ reviews: fetchedReviews }) => {
          setReviews(fetchedReviews);
          if (fetchedReviews.length === 0) {
            setError('No reviews available yet');
          }
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load reviews');
          setLoading(false);
        });
    }
  }, [visible, movie]);

  // Reset animation on open
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [visible]);

  // Gesture handler
  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        opacity.value = interpolate(
          event.translationY,
          [0, DISMISS_THRESHOLD],
          [1, 0.5],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0);
        opacity.value = withSpring(1);
      }
    });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!movie) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, containerAnimatedStyle]}>
          {/* Drag handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Reviews & Ratings</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {movie.title}
              </Text>
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* Rating overview */}
          <RatingOverview
            rating={movie.voteAverage}
            voteCount={movie.voteCount}
          />

          {/* Reviews list */}
          <ScrollView
            style={styles.reviewsList}
            contentContainerStyle={styles.reviewsContent}
            showsVerticalScrollIndicator={false}
          >
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading reviews...</Text>
              </View>
            )}

            {error && !loading && reviews.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>{error}</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to watch and review!
                </Text>
              </View>
            )}

            {reviews.map((review, index) => (
              <ReviewCard key={review.id} review={review} index={index} />
            ))}
          </ScrollView>

          {/* Quick actions */}
          <View style={styles.actionsContainer}>
            <Pressable
              style={[styles.actionButton, styles.passButton]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSwipeLeft?.();
                onClose();
              }}
            >
              <Ionicons name="close" size={24} color={COLORS.pass} />
              <Text style={[styles.actionButtonText, { color: COLORS.pass }]}>
                Pass
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.likeButton]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSwipeRight?.();
                onClose();
              }}
            >
              <Ionicons name="heart" size={24} color={COLORS.like} />
              <Text style={[styles.actionButtonText, { color: COLORS.like }]}>
                Like
              </Text>
            </Pressable>
          </View>

          {/* Swipe hint */}
          <View style={styles.swipeHint}>
            <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
            <Text style={styles.swipeHintText}>Swipe down to close</Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  container: {
    flex: 1,
    marginTop: 80,
    backgroundColor: COLORS.backgroundModal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // Drag handle
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rating overview
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  ratingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  ratingMax: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  ratingInfo: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  voteCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  ratingBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Reviews list
  reviewsList: {
    flex: 1,
  },
  reviewsContent: {
    padding: 20,
    gap: 16,
  },

  // Loading & empty states
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Review card
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.textMuted,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  authorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  authorRatingText: {
    fontSize: 12,
    color: COLORS.tertiary,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  reviewContent: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  expandButton: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
  },
  passButton: {
    borderColor: COLORS.pass,
    backgroundColor: COLORS.pass + '15',
  },
  likeButton: {
    borderColor: COLORS.like,
    backgroundColor: COLORS.like + '15',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  swipeHintText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

export default ReviewsModal;
