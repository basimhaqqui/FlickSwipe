/**
 * HomeScreen (Solo-First Design)
 *
 * Landing screen with solo mode as the default/quick-entry experience.
 * Features prominent "Start Solo Swipe" alongside group options.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { COLORS, STREAMING_SERVICES } from '../constants';
import { StreamingService } from '../types';
import { useAppMode } from '../context/AppModeContext';
import {
  createRoom,
  joinRoom,
} from '../services/firebase';
import StreakCounter from '../components/StreakCounter';
import PointsDisplay from '../components/PointsDisplay';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// INTERFACES
// ============================================================================

interface HomeScreenProps {
  navigation: any;
}

// ============================================================================
// DAILY GOALS CARD COMPONENT
// ============================================================================

interface DailyGoalsCardProps {
  goals: any[];
  onPress: () => void;
}

const DailyGoalsCard: React.FC<DailyGoalsCardProps> = ({ goals, onPress }) => {
  const completedCount = goals.filter((g) => g.completed).length;
  const totalReward = goals.filter((g) => g.completed).reduce((sum, g) => sum + g.reward, 0);

  return (
    <Pressable style={styles.dailyGoalsCard} onPress={onPress}>
      <LinearGradient
        colors={[COLORS.tertiary + '20', COLORS.tertiary + '05']}
        style={styles.dailyGoalsGradient}
      >
        <View style={styles.dailyGoalsHeader}>
          <Ionicons name="flag" size={20} color={COLORS.tertiary} />
          <Text style={styles.dailyGoalsTitle}>Daily Goals</Text>
          <View style={styles.dailyGoalsBadge}>
            <Text style={styles.dailyGoalsBadgeText}>
              {completedCount}/{goals.length}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.dailyGoalsProgress}>
          <View
            style={[
              styles.dailyGoalsProgressFill,
              { width: `${(completedCount / goals.length) * 100}%` },
            ]}
          />
        </View>

        {totalReward > 0 && (
          <Text style={styles.dailyGoalsReward}>+{totalReward} points earned!</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
};

// ============================================================================
// HOME SCREEN COMPONENT
// ============================================================================

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // Context
  const {
    user,
    isLoading,
    isFirstLaunch,
    setIsFirstLaunch,
    soloStats,
    dailyGoals,
    soloWatchlist,
    selectedServices,
    setSelectedServices,
    setMode,
  } = useAppMode();

  // State
  const [mode, setScreenMode] = useState<'home' | 'create' | 'join'>('home');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [localServices, setLocalServices] = useState<StreamingService[]>(selectedServices);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const logoScale = useSharedValue(1);
  const soloBtnScale = useSharedValue(1);

  // Handle first launch
  useEffect(() => {
    if (isFirstLaunch) {
      // Could show onboarding here
      setIsFirstLaunch(false);
    }
  }, [isFirstLaunch]);

  // Logo pulse animation
  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  // Solo button attention-grabbing pulse
  useEffect(() => {
    soloBtnScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const soloBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: soloBtnScale.value }],
  }));

  // Toggle streaming service
  const toggleService = (serviceId: StreamingService) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((s) => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Start solo mode
  const handleStartSolo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode('solo');
    navigation.navigate('SoloSwipeDeck');
  };

  // Create room handler
  const handleCreateRoom = async () => {
    if (!user) return;
    if (localServices.length === 0) {
      setError('Please select at least one streaming service');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      setSelectedServices(localServices);
      const room = await createRoom(
        user.id,
        user.displayName,
        user.avatarEmoji,
        roomName || `${user.displayName}'s Room`,
        localServices
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('group');
      navigation.navigate('RoomLobby', { roomId: room.id });
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join room handler
  const handleJoinRoom = async () => {
    if (!user) return;
    if (roomCode.length !== 6) {
      setError('Please enter a valid 6-character code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const room = await joinRoom(
        roomCode.toUpperCase(),
        user.id,
        user.displayName,
        user.avatarEmoji
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('group');
      navigation.navigate('RoomLobby', { roomId: room.id });
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // RENDER HOME MODE
  // ========================================================================

  const renderHome = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <Animated.View
        entering={FadeIn.duration(600)}
        style={[styles.logoContainer, logoAnimatedStyle]}
      >
        <LinearGradient
          colors={COLORS.gradientFire}
          style={styles.logoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.logoEmoji}>🎬</Text>
        </LinearGradient>
        <Text style={styles.logoText}>FlickSwipe</Text>
        <Text style={styles.tagline}>Find your next favorite movie</Text>
      </Animated.View>

      {/* User stats (if returning user) */}
      {soloStats.totalSwipes > 0 && (
        <Animated.View entering={FadeInUp.delay(150)} style={styles.statsRow}>
          <StreakCounter streak={soloStats.currentDayStreak} compact />
          <PointsDisplay points={soloStats.totalSwipes * 5} compact />
          {soloWatchlist.length > 0 && (
            <Pressable
              style={styles.watchlistBadge}
              onPress={() => navigation.navigate('SoloWatchlist')}
            >
              <Ionicons name="bookmark" size={16} color={COLORS.secondary} />
              <Text style={styles.watchlistBadgeText}>{soloWatchlist.length}</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* Daily Goals Card */}
      {dailyGoals.length > 0 && (
        <Animated.View entering={FadeInUp.delay(200)}>
          <DailyGoalsCard
            goals={dailyGoals}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleStartSolo();
            }}
          />
        </Animated.View>
      )}

      {/* SOLO MODE - Primary CTA */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.soloSection}>
        <Pressable onPress={handleStartSolo}>
          <Animated.View style={[styles.soloButton, soloBtnAnimatedStyle]}>
            <LinearGradient
              colors={[COLORS.primary, '#FF8E53', COLORS.tertiary]}
              style={styles.soloButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.soloButtonContent}>
                <View style={styles.soloIconContainer}>
                  <Ionicons name="play" size={32} color="#FFF" />
                </View>
                <View style={styles.soloTextContainer}>
                  <Text style={styles.soloTitle}>Start Solo Swipe</Text>
                  <Text style={styles.soloSubtitle}>
                    Build your personal watchlist
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <Text style={styles.soloHint}>
          {soloStats.totalSwipes === 0
            ? '🌟 Try solo to build your taste profile!'
            : `🎯 ${soloStats.totalLikes} movies in your watchlist`}
        </Text>
      </Animated.View>

      {/* Divider */}
      <Animated.View entering={FadeIn.delay(400)} style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or swipe with friends</Text>
        <View style={styles.dividerLine} />
      </Animated.View>

      {/* GROUP MODE - Secondary CTAs */}
      <Animated.View entering={FadeInUp.delay(500)} style={styles.groupSection}>
        <Pressable
          style={[styles.groupButton, styles.createButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setScreenMode('create');
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color={COLORS.secondary} />
          <View style={styles.groupTextContainer}>
            <Text style={styles.groupTitle}>Create Group Room</Text>
            <Text style={styles.groupSubtitle}>Invite 2-10 friends</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.groupButton, styles.joinButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setScreenMode('join');
          }}
        >
          <Ionicons name="enter-outline" size={24} color={COLORS.textSecondary} />
          <View style={styles.groupTextContainer}>
            <Text style={[styles.groupTitle, { color: COLORS.textSecondary }]}>
              Join Room
            </Text>
            <Text style={styles.groupSubtitle}>Enter code</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Quick Features */}
      <Animated.View entering={FadeInUp.delay(600)} style={styles.featuresSection}>
        <View style={styles.featureRow}>
          <View style={styles.feature}>
            <Ionicons name="sparkles" size={20} color={COLORS.primary} />
            <Text style={styles.featureText}>Personalized picks</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flash" size={20} color={COLORS.tertiary} />
            <Text style={styles.featureText}>Instant matches</Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );

  // ========================================================================
  // RENDER CREATE MODE
  // ========================================================================

  const renderCreate = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.formContainer}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Pressable style={styles.backButton} onPress={() => setScreenMode('home')}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>

          <Text style={styles.formTitle}>Create Group Room</Text>
          <Text style={styles.formSubtitle}>
            Swipe together and find movies everyone loves
          </Text>

          {/* Room name input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Room Name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Friday Movie Night"
              placeholderTextColor={COLORS.textMuted}
              value={roomName}
              onChangeText={setRoomName}
              maxLength={30}
            />
          </View>

          {/* Streaming services */}
          <Text style={styles.inputLabel}>Select Streaming Services</Text>
          <View style={styles.servicesGrid}>
            {STREAMING_SERVICES.map((service) => (
              <Pressable
                key={service.id}
                style={[
                  styles.serviceChip,
                  localServices.includes(service.id) && {
                    backgroundColor: service.color + '30',
                    borderColor: service.color,
                  },
                ]}
                onPress={() => toggleService(service.id)}
              >
                <Text
                  style={[
                    styles.serviceChipText,
                    localServices.includes(service.id) && { color: service.color },
                  ]}
                >
                  {service.name}
                </Text>
                {localServices.includes(service.id) && (
                  <Ionicons name="checkmark" size={16} color={service.color} />
                )}
              </Pressable>
            ))}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleCreateRoom}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Creating...' : 'Create Room'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ========================================================================
  // RENDER JOIN MODE
  // ========================================================================

  const renderJoin = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.formContainer}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <Pressable style={styles.backButton} onPress={() => setScreenMode('home')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <Text style={styles.formTitle}>Join a Room</Text>
        <Text style={styles.formSubtitle}>
          Enter the 6-character code from your friend
        </Text>

        {/* Room code input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Room Code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABCD12"
            placeholderTextColor={COLORS.textMuted}
            value={roomCode}
            onChangeText={(text) => setRoomCode(text.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleJoinRoom}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Joining...' : 'Join Room'}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
        style={StyleSheet.absoluteFill}
      />

      {mode === 'home' && renderHome()}
      {mode === 'create' && renderCreate()}
      {mode === 'join' && renderJoin()}
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoGradient: {
    width: 90,
    height: 90,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 44,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  watchlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.secondary + '20',
    borderRadius: 16,
  },
  watchlistBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // Daily Goals Card
  dailyGoalsCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dailyGoalsGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.tertiary + '30',
    borderRadius: 16,
  },
  dailyGoalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dailyGoalsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  dailyGoalsBadge: {
    backgroundColor: COLORS.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dailyGoalsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  dailyGoalsProgress: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyGoalsProgressFill: {
    height: '100%',
    backgroundColor: COLORS.tertiary,
    borderRadius: 3,
  },
  dailyGoalsReward: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 8,
  },

  // Solo Section
  soloSection: {
    marginBottom: 24,
  },
  soloButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  soloButtonGradient: {
    padding: 20,
  },
  soloButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soloIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  soloTextContainer: {
    flex: 1,
  },
  soloTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  soloSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  soloHint: {
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Group Section
  groupSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  groupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  createButton: {
    backgroundColor: COLORS.secondary + '10',
    borderColor: COLORS.secondary + '40',
  },
  joinButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  groupTextContainer: {},
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  groupSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Features
  featuresSection: {},
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Form
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },

  // Input
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },

  // Services
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  serviceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Error
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Submit
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default HomeScreen;
