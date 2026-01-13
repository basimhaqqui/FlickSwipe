/**
 * OnboardingScreen
 *
 * First-time user onboarding flow guiding users to solo mode.
 * Multi-step carousel with animations and haptic feedback.
 *
 * Features:
 * - Welcome introduction
 * - Swipe mechanics tutorial
 * - Solo mode benefits
 * - Quick genre preferences
 * - Get started CTA
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  FlatList,
  ViewToken,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInUp,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, GENRE_PREFERENCES } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARDING_COMPLETE_KEY = '@flickswipe_onboarding_complete';

// ============================================================================
// INTERFACES
// ============================================================================

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  features?: string[];
}

// ============================================================================
// ONBOARDING SLIDES DATA
// ============================================================================

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to FlickSwipe',
    subtitle: 'Swipe your way to the perfect movie night',
    icon: 'film',
    iconColor: COLORS.primary,
  },
  {
    id: 'swipes',
    title: 'Simple Swipe Controls',
    subtitle: 'Four directions, endless possibilities',
    icon: 'hand-left',
    iconColor: COLORS.tertiary,
    features: [
      '👉 Right = Love it!',
      '👈 Left = Pass',
      '👆 Up = Watch trailer',
      '👇 Down = See reviews',
    ],
  },
  {
    id: 'solo',
    title: 'Start Solo, Match Later',
    subtitle: 'Build your personal watchlist instantly',
    icon: 'person',
    iconColor: COLORS.like,
    features: [
      '✨ Every like is an instant match',
      '🎯 See your taste match %',
      '🏆 Earn streaks & badges',
      '📺 Quick Pick suggestions',
    ],
  },
  {
    id: 'group',
    title: 'Then Swipe Together',
    subtitle: 'Find movies everyone will love',
    icon: 'people',
    iconColor: COLORS.secondary,
    features: [
      '🔗 Share room codes with friends',
      '🎰 Jackpot when everyone matches',
      '🏆 Group watchlist ready to go',
    ],
  },
];

// ============================================================================
// GENRE SELECTION
// ============================================================================

const POPULAR_GENRES = [
  { id: 28, name: 'Action', emoji: '💥' },
  { id: 35, name: 'Comedy', emoji: '😂' },
  { id: 18, name: 'Drama', emoji: '🎭' },
  { id: 27, name: 'Horror', emoji: '👻' },
  { id: 878, name: 'Sci-Fi', emoji: '🚀' },
  { id: 10749, name: 'Romance', emoji: '💕' },
  { id: 53, name: 'Thriller', emoji: '😱' },
  { id: 16, name: 'Animation', emoji: '🎨' },
  { id: 14, name: 'Fantasy', emoji: '🧙' },
  { id: 99, name: 'Documentary', emoji: '📹' },
];

// ============================================================================
// SLIDE COMPONENT
// ============================================================================

interface SlideProps {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.SharedValue<number>;
}

const Slide: React.FC<SlideProps> = ({ slide, index, scrollX }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={styles.slideContainer}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: slide.iconColor + '20' }]}>
          <Ionicons name={slide.icon} size={64} color={slide.iconColor} />
        </View>

        {/* Title */}
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>

        {/* Features */}
        {slide.features && (
          <View style={styles.featuresContainer}>
            {slide.features.map((feature, idx) => (
              <Animated.View
                key={idx}
                entering={FadeInUp.delay(200 + idx * 100)}
                style={styles.featureItem}
              >
                <Text style={styles.featureText}>{feature}</Text>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

// ============================================================================
// GENRE SELECTION COMPONENT
// ============================================================================

interface GenreSelectionProps {
  selectedGenres: number[];
  onToggleGenre: (genreId: number) => void;
}

const GenreSelection: React.FC<GenreSelectionProps> = ({
  selectedGenres,
  onToggleGenre,
}) => {
  return (
    <View style={styles.slideContainer}>
      <View style={styles.slideContent}>
        <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '20' }]}>
          <Ionicons name="heart" size={64} color={COLORS.primary} />
        </View>

        <Text style={styles.slideTitle}>What do you love?</Text>
        <Text style={styles.slideSubtitle}>Pick a few genres to personalize your feed</Text>

        <View style={styles.genresGrid}>
          {POPULAR_GENRES.map((genre, idx) => {
            const isSelected = selectedGenres.includes(genre.id);
            return (
              <Animated.View
                key={genre.id}
                entering={ZoomIn.delay(100 + idx * 50)}
              >
                <Pressable
                  style={[
                    styles.genreChip,
                    isSelected && styles.genreChipSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleGenre(genre.id);
                  }}
                >
                  <Text style={styles.genreEmoji}>{genre.emoji}</Text>
                  <Text
                    style={[
                      styles.genreName,
                      isSelected && styles.genreNameSelected,
                    ]}
                  >
                    {genre.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.like} />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.genreHint}>
          {selectedGenres.length === 0
            ? 'Select at least 2 genres'
            : `${selectedGenres.length} selected`}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// PAGINATION COMPONENT
// ============================================================================

interface PaginationProps {
  data: OnboardingSlide[];
  scrollX: Animated.SharedValue<number>;
  currentIndex: number;
  hasGenreSlide: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  data,
  scrollX,
  currentIndex,
  hasGenreSlide,
}) => {
  const totalDots = data.length + (hasGenreSlide ? 1 : 0);

  return (
    <View style={styles.paginationContainer}>
      {Array.from({ length: totalDots }).map((_, index) => {
        const isActive = index === currentIndex;
        return (
          <Animated.View
            key={index}
            style={[
              styles.paginationDot,
              isActive && styles.paginationDotActive,
            ]}
          />
        );
      })}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const totalSlides = SLIDES.length + 1; // +1 for genre selection
  const isLastSlide = currentIndex === totalSlides - 1;
  const isGenreSlide = currentIndex === SLIDES.length;

  // Handle genre toggle
  const handleToggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId]
    );
  };

  // Handle next
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isLastSlide) {
      handleComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  // Handle skip
  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  // Handle complete
  const handleComplete = async () => {
    try {
      // Save onboarding complete flag
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

      // Save selected genres
      if (selectedGenres.length > 0) {
        await AsyncStorage.setItem(
          '@flickswipe_preferred_genres',
          JSON.stringify(selectedGenres)
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (error) {
      console.error('Error saving onboarding state:', error);
      onComplete();
    }
  };

  // Handle viewable items changed
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Render item
  const renderItem = ({ item, index }: { item: OnboardingSlide | 'genres'; index: number }) => {
    if (item === 'genres') {
      return (
        <GenreSelection
          selectedGenres={selectedGenres}
          onToggleGenre={handleToggleGenre}
        />
      );
    }

    return <Slide slide={item} index={index} scrollX={scrollX} />;
  };

  // Build data array
  const data: (OnboardingSlide | 'genres')[] = [...SLIDES, 'genres'];

  // Can proceed check
  const canProceed = !isGenreSlide || selectedGenres.length >= 2;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundDark]}
        style={StyleSheet.absoluteFill}
      />

      {/* Skip button */}
      {!isLastSlide && (
        <Animated.View entering={FadeIn.delay(500)} style={styles.skipButton}>
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          typeof item === 'string' ? item : item.id
        }
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={(event) => {
          scrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Bottom section */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.bottomSection}>
        {/* Pagination */}
        <Pagination
          data={SLIDES}
          scrollX={scrollX}
          currentIndex={currentIndex}
          hasGenreSlide
        />

        {/* Next/Get Started button */}
        <Pressable
          style={[
            styles.nextButton,
            !canProceed && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <LinearGradient
            colors={
              canProceed
                ? [COLORS.primary, COLORS.primaryDark]
                : ['#444', '#333']
            }
            style={styles.nextButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? "Let's Go!" : 'Next'}
            </Text>
            <Ionicons
              name={isLastSlide ? 'rocket' : 'arrow-forward'}
              size={20}
              color="#FFF"
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Skip button
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // Slide
  slideContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 160,
  },
  slideContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Features
  featuresContainer: {
    marginTop: 32,
    alignItems: 'flex-start',
    width: '100%',
  },
  featureItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
  },
  featureText: {
    fontSize: 16,
    color: '#FFF',
  },

  // Genres
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 24,
    gap: 10,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  genreChipSelected: {
    borderColor: COLORS.like,
    backgroundColor: COLORS.like + '20',
  },
  genreEmoji: {
    fontSize: 18,
  },
  genreName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  genreNameSelected: {
    color: '#FFF',
  },
  genreHint: {
    marginTop: 20,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },

  // Bottom section
  bottomSection: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Next button
  nextButton: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default OnboardingScreen;

export { ONBOARDING_COMPLETE_KEY };
