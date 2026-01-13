/**
 * WatchlistScreen
 *
 * Displays all group matches as a ranked watchlist.
 * Features direct streaming links and match stats.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Match, Room } from '../types';
import { COLORS, STREAMING_SERVICES } from '../constants';
import { getRoomMatches, subscribeToRoom } from '../services/firebase';
import { getPosterUrl, getReleaseYear, formatRating } from '../services/tmdb';

// ============================================================================
// INTERFACES
// ============================================================================

interface WatchlistScreenProps {
  route: { params: { roomId: string } };
  navigation: any;
}

// ============================================================================
// MATCH CARD COMPONENT
// ============================================================================

interface MatchCardProps {
  match: Match;
  rank: number;
  index: number;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, rank, index }) => {
  const movie = match.movie;
  const posterUrl = getPosterUrl(movie.posterPath, 'w185');
  const consensusPercent = Math.round(match.consensusPercentage * 100);

  // Get medal emoji for top 3
  const getMedal = () => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const medal = getMedal();

  // Fake streaming link (would be real in production)
  const openStreaming = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // In production, use JustWatch deep links
    Linking.openURL('https://www.justwatch.com/');
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).springify()}
      style={[styles.matchCard, rank <= 3 && styles.matchCardHighlight]}
    >
      {/* Rank indicator */}
      <View
        style={[
          styles.rankBadge,
          rank === 1 && { backgroundColor: '#FFD700' },
          rank === 2 && { backgroundColor: '#C0C0C0' },
          rank === 3 && { backgroundColor: '#CD7F32' },
        ]}
      >
        {medal ? (
          <Text style={styles.rankMedal}>{medal}</Text>
        ) : (
          <Text style={styles.rankNumber}>#{rank}</Text>
        )}
      </View>

      {/* Poster */}
      <Image source={{ uri: posterUrl }} style={styles.matchPoster} />

      {/* Info */}
      <View style={styles.matchInfo}>
        <Text style={styles.matchTitle} numberOfLines={2}>
          {movie.title}
        </Text>

        <View style={styles.matchMeta}>
          <Text style={styles.matchYear}>{getReleaseYear(movie.releaseDate)}</Text>
          <View style={styles.matchRating}>
            <Ionicons name="star" size={12} color={COLORS.tertiary} />
            <Text style={styles.matchRatingText}>
              {movie.voteAverage.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Consensus */}
        <View style={styles.consensusRow}>
          <View style={styles.consensusBar}>
            <View
              style={[
                styles.consensusFill,
                { width: `${consensusPercent}%` },
              ]}
            />
          </View>
          <Text style={styles.consensusText}>{consensusPercent}%</Text>
        </View>

        {/* Matched by */}
        <Text style={styles.matchedBy}>
          {match.matchedBy.length} member{match.matchedBy.length !== 1 ? 's' : ''} matched
        </Text>
      </View>

      {/* Watch button */}
      <Pressable style={styles.watchButton} onPress={openStreaming}>
        <Ionicons name="play" size={20} color="#FFF" />
      </Pressable>
    </Animated.View>
  );
};

// ============================================================================
// WATCHLIST SCREEN COMPONENT
// ============================================================================

const WatchlistScreen: React.FC<WatchlistScreenProps> = ({ route, navigation }) => {
  const { roomId } = route.params;

  // State
  const [room, setRoom] = useState<Room | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to room
  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomId, setRoom);
    return unsubscribe;
  }, [roomId]);

  // Load matches
  useEffect(() => {
    loadMatches();
  }, [roomId]);

  const loadMatches = async () => {
    try {
      const fetchedMatches = await getRoomMatches(roomId);
      // Sort by consensus (highest first)
      const sorted = fetchedMatches.sort(
        (a, b) => b.consensusPercentage - a.consensusPercentage
      );
      setMatches(sorted);
      setLoading(false);
    } catch (error) {
      console.error('Error loading matches:', error);
      setLoading(false);
    }
  };

  // Stats
  const totalMatches = matches.length;
  const avgConsensus =
    totalMatches > 0
      ? matches.reduce((sum, m) => sum + m.consensusPercentage, 0) / totalMatches
      : 0;
  const jackpots = matches.filter((m) => m.isJackpot).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Watchlist</Text>

        <View style={styles.headerRight}>
          <Ionicons name="list" size={24} color={COLORS.textMuted} />
        </View>
      </Animated.View>

      {/* Stats summary */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalMatches}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{Math.round(avgConsensus * 100)}%</Text>
          <Text style={styles.statLabel}>Avg Consensus</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.tertiary }]}>
            {jackpots}
          </Text>
          <Text style={styles.statLabel}>Jackpots</Text>
        </View>
      </Animated.View>

      {/* Matches list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading matches...</Text>
          </View>
        )}

        {!loading && matches.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No matches yet!</Text>
            <Text style={styles.emptySubtitle}>
              Keep swiping to find movies everyone loves
            </Text>
            <Pressable
              style={styles.continueButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.continueButtonText}>Keep Swiping</Text>
            </Pressable>
          </View>
        )}

        {matches.map((match, index) => (
          <MatchCard
            key={match.id}
            match={match}
            rank={index + 1}
            index={index}
          />
        ))}

        {matches.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(matches.length * 100 + 100)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              Keep swiping to find more matches!
            </Text>
            <Pressable
              style={styles.continueButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.continueButtonText}>Continue Swiping</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },

  // Match card
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  matchCardHighlight: {
    borderColor: COLORS.tertiary + '30',
    backgroundColor: COLORS.tertiary + '08',
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankMedal: {
    fontSize: 18,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  matchPoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundCard,
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  matchYear: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  matchRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  matchRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.tertiary,
  },
  consensusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  consensusBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  consensusFill: {
    height: '100%',
    backgroundColor: COLORS.like,
    borderRadius: 2,
  },
  consensusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.like,
    width: 35,
  },
  matchedBy: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  watchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
});

export default WatchlistScreen;
