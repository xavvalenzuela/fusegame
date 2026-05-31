import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import {
  fetchTopScores, getPersonalScores, getDeviceId,
  type LeaderboardEntry, type PersonalEntry,
} from '../services/leaderboard';

interface Props {
  onClose: () => void;
}

type Tab = 'global' | 'personal';

export function LeaderboardModal({ onClose }: Props) {
  const [tab, setTab]             = useState<Tab>('global');
  const [global, setGlobal]       = useState<LeaderboardEntry[]>([]);
  const [personal, setPersonal]   = useState<PersonalEntry[]>([]);
  const [deviceId, setDeviceId]   = useState('');
  const [globalLoading, setGlobalLoading] = useState(true);
  const [error, setError]         = useState('');

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    setError('');
    try {
      const result = await fetchTopScores();
      setGlobal(result.entries);
      setDeviceId(result.deviceId);
    } catch (err) {
      console.error('[leaderboard] fetchTopScores failed:', err);
      setError('Could not load scores. Check your connection.');
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  useEffect(() => {
    // Personal scores are AsyncStorage — load them instantly in the background
    Promise.all([getPersonalScores(), getDeviceId()]).then(([scores, id]) => {
      setPersonal(scores);
      setDeviceId(id);
    }).catch(() => {});
    // Global fetches from Firestore
    loadGlobal();
  }, []);

  function renderGlobalRow({ item, index }: { item: LeaderboardEntry; index: number }) {
    const isMe  = item.deviceId === deviceId;
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={[styles.rank, isMe && styles.gold]}>{medal ?? `#${index + 1}`}</Text>
        <Text style={[styles.name, isMe && styles.gold]} numberOfLines={1}>
          {item.name}{isMe ? ' ★' : ''}
        </Text>
        <Text style={[styles.score, isMe && styles.gold]}>{item.score.toLocaleString()}</Text>
      </View>
    );
  }

  function renderPersonalRow({ item, index }: { item: PersonalEntry; index: number }) {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
    const date  = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return (
      <View style={[styles.row, index === 0 && styles.rowHighlight]}>
        <Text style={[styles.rank, index === 0 && styles.gold]}>{medal ?? `#${index + 1}`}</Text>
        <Text style={[styles.name, index === 0 && styles.gold]} numberOfLines={1}>
          {item.name}
          <Text style={styles.dateSub}>  {date}</Text>
        </Text>
        <Text style={[styles.score, index === 0 && styles.gold]}>{item.score.toLocaleString()}</Text>
      </View>
    );
  }

  const loading = tab === 'global' ? globalLoading : false;
  const isEmpty = tab === 'global' ? global.length === 0 : personal.length === 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>🏆 LEADERBOARD</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'global' && styles.tabActive]}
            onPress={() => setTab('global')}
          >
            <Text style={[styles.tabText, tab === 'global' && styles.tabTextActive]}>
              🌐 Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'personal' && styles.tabActive]}
            onPress={() => setTab('personal')}
          >
            <Text style={[styles.tabText, tab === 'personal' && styles.tabTextActive]}>
              👤 This Device
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color="#AA44FF" size="large" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {!loading && error !== '' && tab === 'global' && (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadGlobal}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && (error === '' || tab === 'personal') && isEmpty && (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {tab === 'personal' ? 'No games played yet.' : 'No scores yet. Be the first!'}
            </Text>
          </View>
        )}

        {!loading && (error === '' || tab === 'personal') && !isEmpty && (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerCell}>#</Text>
              <Text style={[styles.headerCell, { flex: 1, textAlign: 'left', paddingLeft: 8 }]}>Player</Text>
              <Text style={[styles.headerCell, { width: 70, textAlign: 'right' }]}>Score</Text>
            </View>
            {tab === 'global' ? (
              <FlatList<LeaderboardEntry>
                data={global}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderGlobalRow}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <FlatList<PersonalEntry>
                data={personal}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderPersonalRow}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}

        {tab === 'global' && !globalLoading && (
          <TouchableOpacity style={styles.refreshBtn} onPress={loadGlobal}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 2, 18, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  card: {
    width: '90%',
    maxHeight: '82%',
    backgroundColor: '#120630',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2D1255',
    padding: 20,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFD700',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
  },
  close: {
    color: '#664488',
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#0D0520',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#2D1255',
  },
  tabText: {
    color: '#664488',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  // List
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E0840',
  },
  headerCell: {
    color: '#664488',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    width: 36,
    textAlign: 'center',
  },
  list: {
    maxHeight: 300,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A0830',
  },
  rowHighlight: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderRadius: 8,
  },
  rank: {
    width: 36,
    color: '#9966CC',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  name: {
    flex: 1,
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  score: {
    width: 70,
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  gold: {
    color: '#FFD700',
  },
  dateSub: {
    color: '#664488',
    fontSize: 11,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  loadingText: {
    color: '#664488',
    fontSize: 13,
  },
  errorText: {
    color: '#CC4444',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyText: {
    color: '#664488',
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: '#6633BB',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  refreshBtn: {
    alignItems: 'center',
    paddingTop: 2,
  },
  refreshText: {
    color: '#664488',
    fontSize: 12,
  },
});
