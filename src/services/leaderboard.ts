import {
  collection, addDoc, getDocs,
  query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

const COLLECTION        = 'leaderboard';
const DEVICE_ID_KEY     = '@fusegame_device_id';
const PERSONAL_KEY      = '@fusegame_personal_scores';
const TOP_N             = 20;
const CACHE_TTL_MS      = 60_000; // 1 minute

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  deviceId: string;
  timestamp: number;
}

export interface PersonalEntry {
  score: number;
  name: string;
  timestamp: number;
}

// ── Device ID ──────────────────────────────────────────────────────────────

let _deviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  _deviceId = id;
  return id;
}

// ── Personal scores (AsyncStorage) ────────────────────────────────────────

export async function getPersonalScores(): Promise<PersonalEntry[]> {
  const raw = await AsyncStorage.getItem(PERSONAL_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function savePersonalScore(name: string, score: number): Promise<void> {
  const existing = await getPersonalScores();
  const updated  = [...existing, { score, name, timestamp: Date.now() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  await AsyncStorage.setItem(PERSONAL_KEY, JSON.stringify(updated));
}

// ── Global scores (Firestore) ──────────────────────────────────────────────

let _cachedGlobal: LeaderboardEntry[] | null = null;
let _cacheTime = 0;

export async function fetchTopScores(): Promise<{ entries: LeaderboardEntry[]; deviceId: string }> {
  const deviceId = await getDeviceId();
  const now      = Date.now();

  if (_cachedGlobal && now - _cacheTime < CACHE_TTL_MS) {
    return { entries: _cachedGlobal, deviceId };
  }

  const q    = query(collection(db, COLLECTION), orderBy('score', 'desc'), limit(TOP_N));
  const snap = await getDocs(q);
  const entries: LeaderboardEntry[] = snap.docs.map(doc => ({
    id:       doc.id,
    name:     doc.data().name,
    score:    doc.data().score,
    deviceId: doc.data().deviceId,
    timestamp: doc.data().timestamp?.toMillis?.() ?? 0,
  }));

  _cachedGlobal = entries;
  _cacheTime    = now;
  return { entries, deviceId };
}

// Warm the cache in the background — call this when a game starts
export function prefetchLeaderboard(): void {
  fetchTopScores().catch(() => {});
}

// ── Submit score ───────────────────────────────────────────────────────────

export async function submitScore(name: string, score: number): Promise<void> {
  if (score <= 0) return;
  const deviceId = await getDeviceId();
  const trimmed  = name.trim() || 'Player';

  // Always save locally (instant)
  await savePersonalScore(trimmed, score);

  // Invalidate global cache so next open reflects the new entry
  _cachedGlobal = null;

  // Post to Firestore
  await addDoc(collection(db, COLLECTION), {
    name: trimmed,
    score,
    deviceId,
    timestamp: serverTimestamp(),
  });
}
