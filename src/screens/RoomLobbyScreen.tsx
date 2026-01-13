/**
 * RoomLobbyScreen
 *
 * Waiting room where members gather before starting a swipe session.
 * Features room code sharing, member list, and ready status.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  Share,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { Room, RoomMember } from '../types';
import { COLORS, STREAMING_SERVICES } from '../constants';
import {
  subscribeToRoom,
  setMemberReady,
  leaveRoom,
  startSession,
  getCurrentUser,
} from '../services/firebase';
import StreakCounter from '../components/StreakCounter';

// ============================================================================
// INTERFACES
// ============================================================================

interface RoomLobbyScreenProps {
  route: { params: { roomId: string } };
  navigation: any;
}

// ============================================================================
// MEMBER CARD COMPONENT
// ============================================================================

interface MemberCardProps {
  member: RoomMember;
  isCurrentUser: boolean;
  index: number;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, isCurrentUser, index }) => (
  <Animated.View
    entering={FadeInUp.delay(index * 100).springify()}
    style={[styles.memberCard, isCurrentUser && styles.memberCardCurrent]}
  >
    <View style={styles.memberAvatar}>
      <Text style={styles.memberEmoji}>{member.avatarEmoji}</Text>
    </View>

    <View style={styles.memberInfo}>
      <View style={styles.memberNameRow}>
        <Text style={styles.memberName}>{member.displayName}</Text>
        {member.isHost && (
          <View style={styles.hostBadge}>
            <Ionicons name="star" size={10} color={COLORS.tertiary} />
            <Text style={styles.hostBadgeText}>Host</Text>
          </View>
        )}
        {isCurrentUser && (
          <Text style={styles.youBadge}>(You)</Text>
        )}
      </View>
      <Text style={styles.memberStatus}>
        {member.isReady ? 'Ready to swipe!' : 'Waiting...'}
      </Text>
    </View>

    <View
      style={[
        styles.readyIndicator,
        member.isReady && styles.readyIndicatorActive,
      ]}
    >
      <Ionicons
        name={member.isReady ? 'checkmark' : 'hourglass-outline'}
        size={16}
        color={member.isReady ? '#FFF' : COLORS.textMuted}
      />
    </View>
  </Animated.View>
);

// ============================================================================
// ROOM LOBBY SCREEN COMPONENT
// ============================================================================

const RoomLobbyScreen: React.FC<RoomLobbyScreenProps> = ({ route, navigation }) => {
  const { roomId } = route.params;

  // State
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [starting, setStarting] = useState(false);

  // Get current user
  const currentUser = getCurrentUser();
  const userId = currentUser?.uid || '';

  // Subscribe to room updates
  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);

      // Navigate to swipe deck if room status changes to swiping
      if (updatedRoom?.status === 'swiping') {
        navigation.replace('SwipeDeck', { roomId });
      }
    });

    return unsubscribe;
  }, [roomId, navigation]);

  // Copy room code
  const copyCode = async () => {
    if (!room) return;
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share room
  const shareRoom = async () => {
    if (!room) return;
    try {
      await Share.share({
        message: `Join my FlickSwipe room! Code: ${room.code}\n\nLet's decide what to watch together! 🎬`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Toggle ready status
  const toggleReady = async () => {
    const newReady = !isReady;
    setIsReady(newReady);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setMemberReady(roomId, userId, newReady);
  };

  // Start session (host only)
  const handleStart = async () => {
    if (!room) return;

    setStarting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await startSession(roomId);
      // Navigation happens via room subscription
    } catch (error) {
      console.error('Start error:', error);
      setStarting(false);
    }
  };

  // Leave room
  const handleLeave = async () => {
    await leaveRoom(roomId, userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  // Check if can start
  const currentMember = room?.members.find((m) => m.id === userId);
  const isHost = currentMember?.isHost || false;
  const allReady = room?.members.every((m) => m.isReady) || false;
  const canStart = isHost && room && room.members.length >= 2;

  // Get service names
  const serviceNames = room?.streamingServices.map((id) => {
    const service = STREAMING_SERVICES.find((s) => s.id === id);
    return service?.name || id;
  });

  if (!room) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[COLORS.background, COLORS.backgroundLight]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading room...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleLeave}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Room Lobby</Text>

        <StreakCounter streak={room.stats.streak} compact />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Room info */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.roomInfo}>
          <Text style={styles.roomName}>{room.name}</Text>

          {/* Room code */}
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Room Code</Text>
            <Pressable style={styles.codeBox} onPress={copyCode}>
              <Text style={styles.codeText}>{room.code}</Text>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={20}
                color={copied ? COLORS.success : COLORS.textSecondary}
              />
            </Pressable>
            {copied && (
              <Text style={styles.copiedText}>Copied to clipboard!</Text>
            )}
          </View>

          {/* Share button */}
          <Pressable style={styles.shareButton} onPress={shareRoom}>
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.shareButtonText}>Invite Friends</Text>
          </Pressable>
        </Animated.View>

        {/* Streaming services */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.servicesContainer}>
          <Text style={styles.sectionLabel}>Streaming on</Text>
          <View style={styles.servicesRow}>
            {serviceNames?.map((name, index) => (
              <View key={index} style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>{name}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Members */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.membersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>
              Players ({room.members.length}/10)
            </Text>
            {allReady && room.members.length >= 2 && (
              <View style={styles.allReadyBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.allReadyText}>All Ready!</Text>
              </View>
            )}
          </View>

          {room.members.map((member, index) => (
            <MemberCard
              key={member.id}
              member={member}
              isCurrentUser={member.id === userId}
              index={index}
            />
          ))}

          {room.members.length < 2 && (
            <View style={styles.waitingMessage}>
              <Ionicons name="hourglass" size={24} color={COLORS.textMuted} />
              <Text style={styles.waitingText}>
                Waiting for more players...
              </Text>
              <Text style={styles.waitingSubtext}>
                Need at least 2 players to start
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom actions */}
      <Animated.View entering={FadeInUp.delay(400)} style={styles.bottomActions}>
        {/* Ready button */}
        <Pressable
          style={[
            styles.readyButton,
            isReady && styles.readyButtonActive,
          ]}
          onPress={toggleReady}
        >
          <Ionicons
            name={isReady ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={24}
            color={isReady ? '#FFF' : COLORS.success}
          />
          <Text
            style={[
              styles.readyButtonText,
              isReady && styles.readyButtonTextActive,
            ]}
          >
            {isReady ? "I'm Ready!" : 'Ready?'}
          </Text>
        </Pressable>

        {/* Start button (host only) */}
        {isHost && (
          <Pressable
            style={[
              styles.startButton,
              (!canStart || starting) && styles.startButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={!canStart || starting}
          >
            <LinearGradient
              colors={
                canStart && !starting
                  ? [COLORS.primary, '#FF8E53']
                  : ['#555', '#444']
              }
              style={styles.startButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="play" size={24} color="#FFF" />
              <Text style={styles.startButtonText}>
                {starting ? 'Starting...' : 'Start Swiping'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        {!isHost && (
          <View style={styles.waitingForHost}>
            <Ionicons name="hourglass" size={20} color={COLORS.textMuted} />
            <Text style={styles.waitingForHostText}>
              Waiting for host to start...
            </Text>
          </View>
        )}
      </Animated.View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  // Content
  content: {
    padding: 20,
    paddingBottom: 150,
  },

  // Room info
  roomInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  roomName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 8,
  },
  copiedText: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Services
  servicesContainer: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  serviceBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Members
  membersContainer: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  allReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  allReadyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  memberCardCurrent: {
    borderColor: COLORS.primary + '50',
    backgroundColor: COLORS.primary + '10',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberEmoji: {
    fontSize: 24,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.tertiary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.tertiary,
  },
  youBadge: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  memberStatus: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  readyIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyIndicatorActive: {
    backgroundColor: COLORS.success,
  },

  // Waiting message
  waitingMessage: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  waitingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  waitingSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: COLORS.background + 'F0',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  readyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.success,
    backgroundColor: 'transparent',
  },
  readyButtonActive: {
    backgroundColor: COLORS.success,
  },
  readyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  readyButtonTextActive: {
    color: '#FFF',
  },
  startButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  waitingForHost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  waitingForHostText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});

export default RoomLobbyScreen;
