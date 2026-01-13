/**
 * TrailerModal Component
 *
 * Full-screen modal for playing movie trailers via YouTube embed.
 * Uses react-native-webview for reliable YouTube playback in Expo.
 *
 * Features:
 * - Smooth slide-up animation
 * - YouTube autoplay with controls
 * - Loading states and error handling
 * - Swipe down to dismiss
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { Movie } from '../types';
import { COLORS } from '../constants';
import { getMovieTrailerKey, getYouTubeEmbedUrl } from '../services/tmdb';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 150;
const VIDEO_ASPECT_RATIO = 16 / 9;
const VIDEO_HEIGHT = SCREEN_WIDTH / VIDEO_ASPECT_RATIO;

// ============================================================================
// INTERFACES
// ============================================================================

interface TrailerModalProps {
  visible: boolean;
  movie: Movie | null;
  onClose: () => void;
  onSwipeRight?: () => void; // Like the movie
  onSwipeLeft?: () => void;  // Pass on the movie
}

// ============================================================================
// TRAILER MODAL COMPONENT
// ============================================================================

const TrailerModal: React.FC<TrailerModalProps> = ({
  visible,
  movie,
  onClose,
  onSwipeRight,
  onSwipeLeft,
}) => {
  // State
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);

  // Animation values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Fetch trailer when movie changes
  useEffect(() => {
    if (visible && movie) {
      setLoading(true);
      setError(null);
      setTrailerKey(null);

      // Check if we already have the trailer key
      if (movie.trailerKey) {
        setTrailerKey(movie.trailerKey);
        setLoading(false);
      } else {
        // Fetch trailer key
        getMovieTrailerKey(movie.id)
          .then((key) => {
            if (key) {
              setTrailerKey(key);
            } else {
              setError('No trailer available for this movie');
            }
            setLoading(false);
          })
          .catch(() => {
            setError('Failed to load trailer');
            setLoading(false);
          });
      }
    }
  }, [visible, movie]);

  // Reset animation on open
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [visible]);

  // ========================================================================
  // GESTURE HANDLERS
  // ========================================================================

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow downward drag
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
        // Dismiss
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        // Snap back
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        opacity.value = withSpring(1);
      }
    });

  // ========================================================================
  // ANIMATED STYLES
  // ========================================================================

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, DISMISS_THRESHOLD],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!movie) return null;

  const embedUrl = trailerKey ? getYouTubeEmbedUrl(trailerKey) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" />

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

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
              <Text style={styles.headerTitle} numberOfLines={1}>
                {movie.title}
              </Text>
              <Text style={styles.headerSubtitle}>Official Trailer</Text>
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* Video container */}
          <View style={styles.videoContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading trailer...</Text>
              </View>
            )}

            {error && !loading && (
              <View style={styles.errorContainer}>
                <Ionicons name="videocam-off" size={48} color={COLORS.textMuted} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={onClose}>
                  <Text style={styles.retryButtonText}>Close</Text>
                </Pressable>
              </View>
            )}

            {embedUrl && !loading && !error && (
              <WebView
                source={{ uri: embedUrl }}
                style={styles.webView}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                onError={() => setError('Failed to load video')}
                renderLoading={() => (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                )}
                startInLoadingState
              />
            )}

            {webViewLoading && embedUrl && (
              <View style={styles.webViewLoadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            )}
          </View>

          {/* Quick action buttons */}
          <View style={styles.actionsContainer}>
            <Pressable
              style={[styles.actionButton, styles.passButton]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSwipeLeft?.();
                onClose();
              }}
            >
              <Ionicons name="close" size={28} color={COLORS.pass} />
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
              <Ionicons name="heart" size={28} color={COLORS.like} />
              <Text style={[styles.actionButtonText, { color: COLORS.like }]}>
                Like
              </Text>
            </Pressable>
          </View>

          {/* Movie info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>About this movie</Text>
            <Text style={styles.infoText} numberOfLines={4}>
              {movie.overview || 'No description available.'}
            </Text>
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
    backgroundColor: 'rgba(0,0,0,0.8)',
  },

  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: COLORS.backgroundModal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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

  // Video
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  webViewLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  // Loading & Error states
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
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

  // Info
  infoContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  swipeHintText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

export default TrailerModal;
