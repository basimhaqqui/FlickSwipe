/**
 * Firebase Service
 * Handles authentication, Firestore database, and real-time sync
 *
 * Architecture:
 * - Firestore: Rooms, user profiles, matches (persistent data)
 * - Realtime Database: Live swipes, presence, instant sync (ephemeral data)
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  off,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';

import {
  User,
  Room,
  RoomMember,
  RoomStatus,
  Swipe,
  SwipeAction,
  SwipeDirection,
  Match,
  Movie,
  StreamingService,
  Session,
  RewardIntensity,
} from '../types';
import {
  COLLECTIONS,
  ROOM_CODE_LENGTH,
  ROOM_CODE_CHARS,
  GAMIFICATION,
  AVATAR_EMOJIS,
} from '../constants';

// ============================================================================
// FIREBASE CONFIGURATION
// Replace with your Firebase project credentials
// ============================================================================

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  databaseURL: 'https://YOUR_PROJECT.firebaseio.com',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const rtdb = getDatabase(app);

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Sign in anonymously and create/update user profile
 */
export async function signInAnonymousUser(): Promise<User> {
  try {
    const { user: firebaseUser } = await signInAnonymously(auth);

    // Check if user profile exists
    const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, firebaseUser.uid));

    if (userDoc.exists()) {
      return userDoc.data() as User;
    }

    // Create new user profile
    const newUser: User = {
      id: firebaseUser.uid,
      displayName: generateGuestName(),
      avatarEmoji: AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
      createdAt: Date.now(),
      stats: {
        totalSwipes: 0,
        totalMatches: 0,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        badges: [],
        favoriteGenres: [],
      },
    };

    await setDoc(doc(firestore, COLLECTIONS.USERS, firebaseUser.uid), newUser);
    return newUser;
  } catch (error) {
    console.error('Auth error:', error);
    throw error;
  }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, userId));
  return userDoc.exists() ? (userDoc.data() as User) : null;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<User>
): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), updates);
}

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

/**
 * Generate a unique room code
 */
function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a fun guest name
 */
function generateGuestName(): string {
  const adjectives = ['Happy', 'Sleepy', 'Sneaky', 'Silly', 'Brave', 'Clever', 'Swift', 'Witty'];
  const nouns = ['Popcorn', 'Couch', 'Remote', 'Snack', 'Pillow', 'Blanket', 'Movie', 'Screen'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

/**
 * Create a new room
 */
export async function createRoom(
  hostId: string,
  hostName: string,
  hostEmoji: string,
  roomName: string,
  streamingServices: StreamingService[],
  matchThreshold: number = GAMIFICATION.DEFAULT_MATCH_THRESHOLD
): Promise<Room> {
  // Generate unique code (check for collisions)
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await getRoomByCode(code);
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  const roomId = doc(collection(firestore, COLLECTIONS.ROOMS)).id;

  const hostMember: RoomMember = {
    id: hostId,
    displayName: hostName,
    avatarEmoji: hostEmoji,
    isHost: true,
    isReady: false,
    joinedAt: Date.now(),
    currentPoints: 0,
  };

  const room: Room = {
    id: roomId,
    code,
    name: roomName,
    hostId,
    members: [hostMember],
    streamingServices,
    matchThreshold,
    status: 'waiting',
    calibrationComplete: false,
    createdAt: Date.now(),
    currentSessionId: null,
    stats: {
      totalSessions: 0,
      totalMatches: 0,
      streak: 0,
      lastSessionAt: 0,
    },
  };

  await setDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), room);

  // Initialize real-time presence
  await initializeRoomPresence(roomId, hostId);

  return room;
}

/**
 * Get room by ID
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  const roomDoc = await getDoc(doc(firestore, COLLECTIONS.ROOMS, roomId));
  return roomDoc.exists() ? (roomDoc.data() as Room) : null;
}

/**
 * Get room by shareable code
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  const q = query(
    collection(firestore, COLLECTIONS.ROOMS),
    where('code', '==', code.toUpperCase()),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : (snapshot.docs[0].data() as Room);
}

/**
 * Join an existing room
 */
export async function joinRoom(
  roomCode: string,
  userId: string,
  userName: string,
  userEmoji: string
): Promise<Room> {
  const room = await getRoomByCode(roomCode);

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.status !== 'waiting') {
    throw new Error('Room is already in progress');
  }

  if (room.members.length >= 10) {
    throw new Error('Room is full (max 10 members)');
  }

  // Check if already a member
  const existingMember = room.members.find((m) => m.id === userId);
  if (existingMember) {
    return room;
  }

  const newMember: RoomMember = {
    id: userId,
    displayName: userName,
    avatarEmoji: userEmoji,
    isHost: false,
    isReady: false,
    joinedAt: Date.now(),
    currentPoints: 0,
  };

  await updateDoc(doc(firestore, COLLECTIONS.ROOMS, room.id), {
    members: arrayUnion(newMember),
  });

  // Initialize presence for new member
  await initializeRoomPresence(room.id, userId);

  return { ...room, members: [...room.members, newMember] };
}

/**
 * Leave a room
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;

  const member = room.members.find((m) => m.id === userId);
  if (!member) return;

  // If host leaves, transfer to next member or delete room
  if (member.isHost && room.members.length > 1) {
    const newHost = room.members.find((m) => m.id !== userId);
    if (newHost) {
      await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
        hostId: newHost.id,
        members: room.members
          .filter((m) => m.id !== userId)
          .map((m) => (m.id === newHost.id ? { ...m, isHost: true } : m)),
      });
    }
  } else if (room.members.length === 1) {
    // Last member, delete room
    await deleteDoc(doc(firestore, COLLECTIONS.ROOMS, roomId));
  } else {
    await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
      members: room.members.filter((m) => m.id !== userId),
    });
  }

  // Clean up presence
  await remove(ref(rtdb, `rooms/${roomId}/presence/${userId}`));
}

/**
 * Update room status
 */
export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus
): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), { status });
}

/**
 * Set member ready status
 */
export async function setMemberReady(
  roomId: string,
  userId: string,
  isReady: boolean
): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;

  const updatedMembers = room.members.map((m) =>
    m.id === userId ? { ...m, isReady } : m
  );

  await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
    members: updatedMembers,
  });
}

/**
 * Subscribe to room updates (Firestore)
 */
export function subscribeToRoom(
  roomId: string,
  callback: (room: Room | null) => void
): () => void {
  return onSnapshot(doc(firestore, COLLECTIONS.ROOMS, roomId), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as Room) : null);
  });
}

// ============================================================================
// REAL-TIME PRESENCE (RTDB)
// ============================================================================

/**
 * Initialize presence for a user in a room
 */
async function initializeRoomPresence(
  roomId: string,
  userId: string
): Promise<void> {
  const presenceRef = ref(rtdb, `rooms/${roomId}/presence/${userId}`);
  await set(presenceRef, {
    online: true,
    lastSeen: rtdbServerTimestamp(),
  });
}

/**
 * Subscribe to room presence changes
 */
export function subscribeToPresence(
  roomId: string,
  callback: (presence: Record<string, { online: boolean; lastSeen: number }>) => void
): () => void {
  const presenceRef = ref(rtdb, `rooms/${roomId}/presence`);
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
  return () => off(presenceRef);
}

// ============================================================================
// SWIPES (REAL-TIME DATABASE for instant sync)
// ============================================================================

/**
 * Record a swipe in real-time database
 */
export async function recordSwipe(
  roomId: string,
  userId: string,
  movieId: number,
  action: SwipeAction,
  direction: SwipeDirection
): Promise<Swipe> {
  const swipeRef = push(ref(rtdb, `rooms/${roomId}/swipes`));

  const swipe: Swipe = {
    id: swipeRef.key!,
    roomId,
    userId,
    movieId,
    action,
    direction,
    timestamp: Date.now(),
  };

  await set(swipeRef, swipe);

  // Update user stats
  await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
    'stats.totalSwipes': increment(1),
  });

  // Check for matches if this was a "like"
  if (action === 'like') {
    await checkForMatch(roomId, movieId);
  }

  return swipe;
}

/**
 * Subscribe to new swipes in real-time
 */
export function subscribeToSwipes(
  roomId: string,
  callback: (swipe: Swipe) => void
): () => void {
  const swipesRef = ref(rtdb, `rooms/${roomId}/swipes`);
  const unsubscribe = onChildAdded(swipesRef, (snapshot) => {
    const swipe = snapshot.val() as Swipe;
    callback(swipe);
  });
  return () => off(swipesRef, 'child_added');
}

/**
 * Get all swipes for a movie in a room
 */
export async function getSwipesForMovie(
  roomId: string,
  movieId: number
): Promise<Swipe[]> {
  const snapshot = await get(ref(rtdb, `rooms/${roomId}/swipes`));
  const allSwipes = snapshot.val() || {};

  return Object.values(allSwipes as Record<string, Swipe>).filter(
    (swipe) => swipe.movieId === movieId
  );
}

/**
 * Get user's swiped movie IDs (for filtering)
 */
export async function getUserSwipedMovieIds(
  roomId: string,
  userId: string
): Promise<Set<number>> {
  const snapshot = await get(ref(rtdb, `rooms/${roomId}/swipes`));
  const allSwipes = snapshot.val() || {};

  const movieIds = new Set<number>();
  Object.values(allSwipes as Record<string, Swipe>).forEach((swipe) => {
    if (swipe.userId === userId) {
      movieIds.add(swipe.movieId);
    }
  });

  return movieIds;
}

// ============================================================================
// MATCH DETECTION & REWARDS
// ============================================================================

/**
 * Check if a movie has reached match threshold
 */
async function checkForMatch(roomId: string, movieId: number): Promise<Match | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const swipes = await getSwipesForMovie(roomId, movieId);
  const likeSwipes = swipes.filter((s) => s.action === 'like');
  const uniqueLikers = [...new Set(likeSwipes.map((s) => s.userId))];

  const consensusPercentage = uniqueLikers.length / room.members.length;

  // Check if threshold reached
  if (consensusPercentage >= room.matchThreshold) {
    // Check if match already exists
    const existingMatch = await getMatchForMovie(roomId, movieId);
    if (existingMatch) return existingMatch;

    // Determine reward intensity
    const intensity = calculateRewardIntensity(consensusPercentage);
    const isJackpot = consensusPercentage >= GAMIFICATION.JACKPOT_THRESHOLD;

    const matchRef = doc(collection(firestore, COLLECTIONS.MATCHES));
    const match: Match = {
      id: matchRef.id,
      roomId,
      movieId,
      movie: {} as Movie, // Will be populated by the client
      matchedBy: uniqueLikers,
      consensusPercentage,
      timestamp: Date.now(),
      isJackpot,
      rewardIntensity: intensity,
    };

    await setDoc(matchRef, match);

    // Update room stats
    await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
      'stats.totalMatches': increment(1),
    });

    // Award points to matchers
    const basePoints = GAMIFICATION.POINTS_MATCH_BASE;
    const bonusPoints = (uniqueLikers.length - 1) * GAMIFICATION.POINTS_MATCH_MULTIPLIER;
    const jackpotBonus = isJackpot ? GAMIFICATION.POINTS_JACKPOT_BONUS : 0;
    const totalPoints = basePoints + bonusPoints + jackpotBonus;

    for (const likerId of uniqueLikers) {
      await updateDoc(doc(firestore, COLLECTIONS.USERS, likerId), {
        'stats.totalMatches': increment(1),
        'stats.totalPoints': increment(totalPoints),
      });
    }

    // Broadcast match via RTDB for instant notification
    await set(ref(rtdb, `rooms/${roomId}/matches/${match.id}`), {
      ...match,
      notifiedAt: rtdbServerTimestamp(),
    });

    return match;
  }

  return null;
}

/**
 * Calculate reward intensity based on consensus
 */
function calculateRewardIntensity(consensus: number): RewardIntensity {
  const thresholds = GAMIFICATION.REWARD_THRESHOLDS;

  if (consensus >= thresholds.legendary) return 'legendary';
  if (consensus >= thresholds.epic) return 'epic';
  if (consensus >= thresholds.great) return 'great';
  return 'normal';
}

/**
 * Get existing match for a movie
 */
async function getMatchForMovie(
  roomId: string,
  movieId: number
): Promise<Match | null> {
  const q = query(
    collection(firestore, COLLECTIONS.MATCHES),
    where('roomId', '==', roomId),
    where('movieId', '==', movieId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : (snapshot.docs[0].data() as Match);
}

/**
 * Subscribe to new matches in real-time
 */
export function subscribeToMatches(
  roomId: string,
  callback: (match: Match) => void
): () => void {
  const matchesRef = ref(rtdb, `rooms/${roomId}/matches`);
  const unsubscribe = onChildAdded(matchesRef, (snapshot) => {
    const match = snapshot.val() as Match;
    callback(match);
  });
  return () => off(matchesRef, 'child_added');
}

/**
 * Get all matches for a room
 */
export async function getRoomMatches(roomId: string): Promise<Match[]> {
  const q = query(
    collection(firestore, COLLECTIONS.MATCHES),
    where('roomId', '==', roomId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Match);
}

// ============================================================================
// SEEN IT / FAVORITES
// ============================================================================

/**
 * Mark a movie as "seen" for a user in a room
 */
export async function markMovieAsSeen(
  roomId: string,
  userId: string,
  movieId: number
): Promise<void> {
  const seenRef = ref(rtdb, `rooms/${roomId}/seen/${movieId}/${userId}`);
  await set(seenRef, {
    timestamp: rtdbServerTimestamp(),
  });
}

/**
 * Add movie to favorites
 */
export async function addToFavorites(
  userId: string,
  movieId: number,
  movie: Movie
): Promise<void> {
  const favRef = doc(firestore, COLLECTIONS.USERS, userId, 'favorites', String(movieId));
  await setDoc(favRef, {
    movieId,
    movie,
    addedAt: Date.now(),
  });

  // Award points
  await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
    'stats.totalPoints': increment(GAMIFICATION.POINTS_PER_SWIPE),
  });
}

/**
 * Get user's favorites
 */
export async function getUserFavorites(
  userId: string
): Promise<{ movieId: number; movie: Movie; addedAt: number }[]> {
  const q = query(
    collection(firestore, COLLECTIONS.USERS, userId, 'favorites'),
    orderBy('addedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as any);
}

// ============================================================================
// SESSIONS & STREAKS
// ============================================================================

/**
 * Start a new swiping session
 */
export async function startSession(roomId: string): Promise<Session> {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Room not found');

  const sessionRef = doc(collection(firestore, COLLECTIONS.SESSIONS));
  const session: Session = {
    id: sessionRef.id,
    roomId,
    startedAt: Date.now(),
    endedAt: null,
    moviesShown: [],
    matches: [],
    participants: room.members.map((m) => m.id),
    pointsAwarded: {},
  };

  await setDoc(sessionRef, session);
  await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
    currentSessionId: session.id,
    status: 'swiping',
  });

  return session;
}

/**
 * End a session and update streaks
 */
export async function endSession(sessionId: string): Promise<void> {
  const sessionDoc = await getDoc(doc(firestore, COLLECTIONS.SESSIONS, sessionId));
  if (!sessionDoc.exists()) return;

  const session = sessionDoc.data() as Session;
  const matches = await getRoomMatches(session.roomId);
  const sessionMatches = matches.filter(
    (m) => m.timestamp >= session.startedAt && (!session.endedAt || m.timestamp <= session.endedAt)
  );

  await updateDoc(doc(firestore, COLLECTIONS.SESSIONS, sessionId), {
    endedAt: Date.now(),
    matches: sessionMatches,
  });

  // Update room streak
  const room = await getRoom(session.roomId);
  if (room) {
    const hasMatches = sessionMatches.length > 0;
    const newStreak = hasMatches ? room.stats.streak + 1 : 0;

    await updateDoc(doc(firestore, COLLECTIONS.ROOMS, session.roomId), {
      currentSessionId: null,
      status: 'waiting',
      'stats.totalSessions': increment(1),
      'stats.streak': newStreak,
      'stats.lastSessionAt': Date.now(),
    });

    // Award streak bonus
    if (hasMatches && newStreak > 0 && newStreak % 7 === 0) {
      for (const participantId of session.participants) {
        await updateDoc(doc(firestore, COLLECTIONS.USERS, participantId), {
          'stats.totalPoints': increment(GAMIFICATION.POINTS_STREAK_BONUS),
        });
      }
    }
  }
}

// ============================================================================
// POWER-UPS
// ============================================================================

/**
 * Award a random power-up (after dry spells)
 */
export async function awardRandomPowerUp(
  roomId: string,
  userId: string
): Promise<void> {
  const powerUpTypes = ['undo', 'superlike', 'wildcard', 'peek', 'reroll'];
  const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

  const powerUpRef = push(ref(rtdb, `rooms/${roomId}/powerups/${userId}`));
  await set(powerUpRef, {
    type: randomType,
    awardedAt: rtdbServerTimestamp(),
    used: false,
  });
}

/**
 * Use a power-up
 */
export async function usePowerUp(
  roomId: string,
  userId: string,
  powerUpId: string
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/powerups/${userId}/${powerUpId}`), {
    used: true,
    usedAt: rtdbServerTimestamp(),
  });
}

// ============================================================================
// CALIBRATION
// ============================================================================

/**
 * Save user's calibration preferences
 */
export async function saveCalibration(
  userId: string,
  likedGenres: number[],
  dislikedGenres: number[]
): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
    'stats.favoriteGenres': likedGenres,
    calibrationComplete: true,
  });
}

/**
 * Mark room calibration complete
 */
export async function markRoomCalibrationComplete(roomId: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.ROOMS, roomId), {
    calibrationComplete: true,
    status: 'swiping',
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { auth, firestore, rtdb };
