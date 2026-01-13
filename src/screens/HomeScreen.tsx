/**
 * HomeScreen
 *
 * Landing screen with options to create or join a room.
 * Features animated logo, quick stats, and call-to-action buttons.
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
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { COLORS, STREAMING_SERVICES } from '../constants';
import { User, Room, StreamingService } from '../types';
import {
  signInAnonymousUser,
  createRoom,
  joinRoom,
  getUserProfile,
  getCurrentUser,
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
// HOME SCREEN COMPONENT
// ============================================================================

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [selectedServices, setSelectedServices] = useState<StreamingService[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const logoScale = useSharedValue(1);
  const logoPulse = useSharedValue(1);

  // Initialize user
  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          setUser(profile);
          setLoading(false);
          return;
        }
      }

      const newUser = await signInAnonymousUser();
      setUser(newUser);
      setLoading(false);
    } catch (err) {
      console.error('Auth error:', err);
      setLoading(false);
    }
  };

  // Logo animation
  useEffect(() => {
    logoPulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value * logoPulse.value }],
  }));

  // Toggle streaming service
  const toggleService = (serviceId: StreamingService) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((s) => s !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Create room handler
  const handleCreateRoom = async () => {
    if (!user) return;
    if (selectedServices.length === 0) {
      setError('Please select at least one streaming service');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const room = await createRoom(
        user.id,
        user.displayName,
        user.avatarEmoji,
        roomName || `${user.displayName}'s Room`,
        selectedServices
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      navigation.navigate('RoomLobby', { roomId: room.id });
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render home mode
  const renderHome = () => (
    <>
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
        <Text style={styles.tagline}>Decide what to watch, together</Text>
      </Animated.View>

      {/* User stats */}
      {user && (
        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsRow}>
          <StreakCounter streak={user.stats.currentStreak} compact />
          <PointsDisplay points={user.stats.totalPoints} compact />
        </Animated.View>
      )}

      {/* Main actions */}
      <Animated.View entering={FadeInDown.delay(400)} style={styles.actionsContainer}>
        <Pressable
          style={[styles.actionButton, styles.createButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMode('create');
          }}
        >
          <LinearGradient
            colors={[COLORS.primary, '#FF8E53']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add-circle" size={28} color="#FFF" />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle}>Create Room</Text>
              <Text style={styles.buttonSubtitle}>Start a new watch party</Text>
            </View>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.joinButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMode('join');
          }}
        >
          <View style={styles.joinButtonInner}>
            <Ionicons name="enter-outline" size={28} color={COLORS.secondary} />
            <View style={styles.buttonTextContainer}>
              <Text style={[styles.buttonTitle, { color: COLORS.secondary }]}>
                Join Room
              </Text>
              <Text style={styles.buttonSubtitle}>Enter a room code</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Features */}
      <Animated.View entering={FadeInUp.delay(600)} style={styles.featuresContainer}>
        <View style={styles.featureRow}>
          <View style={styles.feature}>
            <Ionicons name="people" size={24} color={COLORS.primary} />
            <Text style={styles.featureText}>2-10 players</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flash" size={24} color={COLORS.tertiary} />
            <Text style={styles.featureText}>Instant matches</Text>
          </View>
        </View>
        <View style={styles.featureRow}>
          <View style={styles.feature}>
            <Ionicons name="game-controller" size={24} color={COLORS.secondary} />
            <Text style={styles.featureText}>Earn points</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flame" size={24} color={COLORS.pass} />
            <Text style={styles.featureText}>Build streaks</Text>
          </View>
        </View>
      </Animated.View>
    </>
  );

  // Render create mode
  const renderCreate = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.formContainer}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <Pressable style={styles.backButton} onPress={() => setMode('home')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <Text style={styles.formTitle}>Create a Room</Text>
        <Text style={styles.formSubtitle}>
          Set up your watch party in seconds
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
                selectedServices.includes(service.id) && {
                  backgroundColor: service.color + '30',
                  borderColor: service.color,
                },
              ]}
              onPress={() => toggleService(service.id)}
            >
              <Text
                style={[
                  styles.serviceChipText,
                  selectedServices.includes(service.id) && { color: service.color },
                ]}
              >
                {service.name}
              </Text>
              {selectedServices.includes(service.id) && (
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
    </KeyboardAvoidingView>
  );

  // Render join mode
  const renderJoin = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.formContainer}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <Pressable style={styles.backButton} onPress={() => setMode('home')}>
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
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 48,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },

  // Actions
  actionsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  actionButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButton: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  joinButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  joinButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
  },
  buttonTextContainer: {},
  buttonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Features
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Form
  formContainer: {
    flex: 1,
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
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },

  // Input
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
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
