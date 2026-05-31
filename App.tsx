import React, { useState, useEffect, useRef } from 'react';
import { useFonts, Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, BackHandler, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withDelay,
} from 'react-native-reanimated';
import { Svg, Rect, Defs, LinearGradient, Stop, G, Circle, Polygon } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import MobileAds from 'react-native-google-mobile-ads';
import { GameProvider, useGame } from './src/game/gameContext';
import { SettingsProvider, useSettings } from './src/game/settingsContext';
import { Grid } from './src/components/Grid';
import { LeaderboardModal } from './src/components/LeaderboardModal';
import { showRewardedAd } from './src/services/ads';
import { submitScore, prefetchLeaderboard } from './src/services/leaderboard';
import { initAudio, playSound, startMusic, stopMusic, pauseMusic, resumeMusic, setSoundEnabled } from './src/services/audio';
import { BACKGROUND_COLOR, GAME_DURATION_MS } from './src/constants/theme';
import type { PreGameBoost, PowerUpType } from './src/types/game';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const VIGNETTE_SIZE = Math.round(SCREEN_W * 0.23);

const CONTINUE_COUNTDOWN_S = 5;

// ---------- Background decorative shapes ----------

function starPoints(outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const oa = (i * 72 - 90) * (Math.PI / 180);
    const ia = (i * 72 - 54) * (Math.PI / 180);
    pts.push(`${(outer * Math.cos(oa)).toFixed(2)},${(outer * Math.sin(oa)).toFixed(2)}`);
    pts.push(`${(inner * Math.cos(ia)).toFixed(2)},${(inner * Math.sin(ia)).toFixed(2)}`);
  }
  return pts.join(' ');
}

type BgShape = { kind: 'circle' | 'diamond' | 'star'; x: number; y: number; r: number; rot: number; op: number };
const BG_SHAPES: BgShape[] = [
  { kind: 'circle',  x: 0.08, y: 0.07, r: 44, rot: 0,   op: 0.12 },
  { kind: 'star',    x: 0.85, y: 0.05, r: 32, rot: 15,  op: 0.10 },
  { kind: 'diamond', x: 0.93, y: 0.22, r: 28, rot: 8,   op: 0.09 },
  { kind: 'circle',  x: 0.03, y: 0.37, r: 54, rot: 0,   op: 0.08 },
  { kind: 'star',    x: 0.78, y: 0.43, r: 44, rot: -20, op: 0.10 },
  { kind: 'diamond', x: 0.18, y: 0.56, r: 36, rot: 5,   op: 0.08 },
  { kind: 'circle',  x: 0.90, y: 0.63, r: 32, rot: 0,   op: 0.10 },
  { kind: 'star',    x: 0.06, y: 0.73, r: 40, rot: 0,   op: 0.09 },
  { kind: 'diamond', x: 0.65, y: 0.83, r: 34, rot: -12, op: 0.10 },
  { kind: 'circle',  x: 0.36, y: 0.93, r: 28, rot: 0,   op: 0.08 },
  { kind: 'star',    x: 0.52, y: 0.14, r: 24, rot: 22,  op: 0.08 },
  { kind: 'diamond', x: 0.42, y: 0.50, r: 46, rot: 18,  op: 0.06 },
  { kind: 'circle',  x: 0.72, y: 0.90, r: 36, rot: 0,   op: 0.10 },
  { kind: 'star',    x: 0.25, y: 0.23, r: 34, rot: -10, op: 0.08 },
  { kind: 'diamond', x: 0.55, y: 0.70, r: 26, rot: 5,   op: 0.08 },
  { kind: 'circle',  x: 0.60, y: 0.30, r: 20, rot: 0,   op: 0.07 },
  { kind: 'star',    x: 0.15, y: 0.86, r: 28, rot: 5,   op: 0.08 },
  { kind: 'diamond', x: 0.80, y: 0.78, r: 20, rot: -5,  op: 0.08 },
];

function BackgroundShapes() {
  return (
    <Svg
      width={SCREEN_W}
      height={SCREEN_H}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {BG_SHAPES.map((sh, i) => {
        const cx = sh.x * SCREEN_W;
        const cy = sh.y * SCREEN_H;
        return (
          <G key={i} transform={`translate(${cx}, ${cy}) rotate(${sh.rot})`}>
            {sh.kind === 'circle' && (
              <Circle cx={0} cy={0} r={sh.r}
                fill="none" stroke="#BB88FF" strokeWidth={1.5} opacity={sh.op} />
            )}
            {sh.kind === 'diamond' && (
              <Polygon
                points={`0,${-sh.r} ${sh.r},0 0,${sh.r} ${-sh.r},0`}
                fill="none" stroke="#BB88FF" strokeWidth={1.5} opacity={sh.op} />
            )}
            {sh.kind === 'star' && (
              <Polygon
                points={starPoints(sh.r, sh.r * 0.42)}
                fill="none" stroke="#BB88FF" strokeWidth={1.5} opacity={sh.op} />
            )}
          </G>
        );
      })}
    </Svg>
  );
}

const BOOST_OPTIONS: { boost: PreGameBoost; label: string; sub: string; color: string }[] = [
  { boost: 'extra-time',       label: '⏱ +10s',              sub: 'Extra time',       color: '#AA44FF' },
  { boost: 'time-slow',        label: '🔵 Time Slow',         sub: 'Blue star power',  color: '#3366EE' },
  { boost: 'score-double',     label: '🔴 Score Double',      sub: 'Red star power',   color: '#E04040' },
  { boost: 'multiplier-boost', label: '🟢 Multiplier Boost',  sub: 'Green star power', color: '#29AA55' },
];

function HomeScreen({ onShowLeaderboard }: { onShowLeaderboard: () => void }) {
  const { state, dispatch } = useGame();
  const [loadingBoost, setLoadingBoost] = useState<PreGameBoost | null>(null);

  function watchAdForBoost(boost: PreGameBoost) {
    if (loadingBoost) return;
    setLoadingBoost(boost);
    showRewardedAd(
      () => {
        dispatch({ type: 'SET_PRE_GAME_BOOST', boost });
        setLoadingBoost(null);
      },
      () => setLoadingBoost(null),
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>STARFUSE</Text>
      <Text style={styles.subtitle}>Match shapes & colors to fuse</Text>

      {/* Pre-game boost selection */}
      <View style={styles.boostSection}>
        <Text style={styles.boostTitle}>EARN A BOOST</Text>
        <View style={styles.boostGrid}>
          {BOOST_OPTIONS.map(({ boost, label, sub, color }) => {
            const isSelected = state.preGameBoost === boost;
            const isLoading  = loadingBoost === boost;
            return (
              <TouchableOpacity
                key={boost}
                style={[styles.boostCard, isSelected && { borderColor: color, borderWidth: 2 }]}
                onPress={() => watchAdForBoost(boost)}
                disabled={!!loadingBoost}
              >
                <Text style={[styles.boostLabel, { color }]}>{label}</Text>
                <Text style={styles.boostSub}>{sub}</Text>
                <Text style={styles.boostAdBtn}>
                  {isLoading ? 'Loading...' : isSelected ? '✓ Ready' : 'Watch Ad'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {state.preGameBoost && (
          <TouchableOpacity onPress={() => dispatch({ type: 'SET_PRE_GAME_BOOST', boost: null })}>
            <Text style={styles.clearBoost}>✕ Remove boost</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => dispatch({ type: 'START_GAME' })}
      >
        <Text style={styles.startBtnText}>
          {state.preGameBoost ? 'START WITH BOOST' : 'START'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.leaderboardBtn}
        onPress={onShowLeaderboard}
      >
        <Text style={styles.leaderboardBtnText}>🏆 Leaderboard</Text>
      </TouchableOpacity>

      {state.bestScore > 0 && (
        <Text style={styles.bestScore}>BEST {state.bestScore}</Text>
      )}
    </View>
  );
}

function GameOverScreen({ onShowLeaderboard }: { onShowLeaderboard: () => void }) {
  const { state, dispatch } = useGame();
  const { settings } = useSettings();
  const [countdown, setCountdown] = useState(CONTINUE_COUNTDOWN_S);
  const [showContinue, setShowContinue] = useState(state.canContinue && !state.isContinued);
  const [loadingAd, setLoadingAd] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // Submit score once when game over screen first mounts
  useEffect(() => {
    if (!submittedRef.current && state.score > 0) {
      submittedRef.current = true;
      submitScore(settings.playerName, state.score).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!showContinue) return;
    intervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          setShowContinue(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [showContinue]);

  function handleWatchAdContinue() {
    if (loadingAd) return;
    setLoadingAd(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    showRewardedAd(
      () => {
        dispatch({ type: 'CONTINUE_GAME' });
        setLoadingAd(false);
      },
      () => {
        setLoadingAd(false);
        setShowContinue(false);
      },
    );
  }

  const isNewBest = state.score > 0 && state.score >= state.bestScore;

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>TIME'S UP</Text>
      <Text style={styles.scoreLabel}>SCORE</Text>
      <Text style={styles.scoreValue}>{state.score}</Text>
      {isNewBest && <Text style={styles.newBest}>NEW BEST!</Text>}

      {showContinue ? (
        <View style={styles.continueBox}>
          <Text style={styles.continueTitle}>CONTINUE?</Text>
          <Text style={styles.continueTimer}>{countdown}s</Text>
          <TouchableOpacity
            style={[styles.continueBtn, loadingAd && styles.btnDisabled]}
            onPress={handleWatchAdContinue}
            disabled={loadingAd}
          >
            <Text style={styles.continueBtnText}>
              {loadingAd ? 'Loading ad...' : '▶ Watch Ad  +15s'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowContinue(false)}>
            <Text style={styles.noThanks}>No thanks</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => dispatch({ type: 'START_GAME' })}
          >
            <Text style={styles.startBtnText}>PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.leaderboardBtn}
            onPress={onShowLeaderboard}
          >
            <Text style={styles.leaderboardBtnText}>🏆 Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dispatch({ type: 'QUIT_GAME' })}>
            <Text style={styles.backToMenuText}>← Back to Menu</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}


// ---------- Score popup ----------

function FloatingScore({ value, onDone }: { value: number; onDone: () => void }) {
  const ty      = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1,  { duration: 80 }),
      withDelay(320, withTiming(0, { duration: 500 })),
    );
    ty.value = withTiming(-60, { duration: 900 });
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, []);

  const s = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.Text style={[styles.floatingScoreText, s]}>+{value}</Animated.Text>
  );
}

function ScorePopupLayer() {
  const { state } = useGame();
  const [popups, setPopups] = useState<{ id: number; value: number }[]>([]);
  const prevScoreRef = useRef(state.score);
  const nextId = useRef(0);

  useEffect(() => {
    const delta = state.score - prevScoreRef.current;
    if (delta > 0) {
      const id = nextId.current++;
      setPopups(p => [...p, { id, value: delta }]);
    }
    prevScoreRef.current = state.score;
  }, [state.score]);

  return (
    <View style={styles.popupLayer} pointerEvents="none">
      {popups.map(p => (
        <FloatingScore
          key={p.id}
          value={p.value}
          onDone={() => setPopups(prev => prev.filter(x => x.id !== p.id))}
        />
      ))}
    </View>
  );
}

// ---------- Golden vignette ----------

function GoldenVignette({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 700 });
  }, [visible]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.vignetteLayer, animStyle]} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="vTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity={0.65} />
            <Stop offset="100%" stopColor="#FFD700" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="vBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity={0} />
            <Stop offset="100%" stopColor="#FFD700" stopOpacity={0.65} />
          </LinearGradient>
          <LinearGradient id="vLeft" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity={0.65} />
            <Stop offset="100%" stopColor="#FFD700" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="vRight" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity={0} />
            <Stop offset="100%" stopColor="#FFD700" stopOpacity={0.65} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={SCREEN_W} height={VIGNETTE_SIZE} fill="url(#vTop)" />
        <Rect x={0} y={SCREEN_H - VIGNETTE_SIZE} width={SCREEN_W} height={VIGNETTE_SIZE} fill="url(#vBottom)" />
        <Rect x={0} y={0} width={VIGNETTE_SIZE} height={SCREEN_H} fill="url(#vLeft)" />
        <Rect x={SCREEN_W - VIGNETTE_SIZE} y={0} width={VIGNETTE_SIZE} height={SCREEN_H} fill="url(#vRight)" />
      </Svg>
    </Animated.View>
  );
}

function PauseMenu({ onShowLeaderboard }: { onShowLeaderboard: () => void }) {
  const { state, dispatch } = useGame();
  const { settings, updateSettings } = useSettings();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(settings.playerName);
  const [confirmQuit, setConfirmQuit] = useState(false);

  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed) updateSettings({ playerName: trimmed });
    setEditingName(false);
  }

  return (
    <View style={styles.pauseOverlay}>
      <View style={styles.pauseCard}>
        <Text style={styles.pauseTitle}>PAUSED</Text>

        {/* Player name */}
        <View style={styles.pauseRow}>
          <Text style={styles.pauseRowLabel}>Player</Text>
          {editingName ? (
            <View style={styles.nameInputRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={16}
                returnKeyType="done"
                onSubmitEditing={saveName}
                selectionColor="#AA44FF"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setNameInput(settings.playerName); setEditingName(true); }}>
              <Text style={styles.pauseRowValue}>{settings.playerName} ✎</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sound toggle */}
        <TouchableOpacity
          style={styles.pauseRow}
          onPress={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
        >
          <Text style={styles.pauseRowLabel}>Sound</Text>
          <Text style={styles.pauseRowValue}>
            {settings.soundEnabled ? '🔊 On' : '🔇 Off'}
          </Text>
        </TouchableOpacity>

        {/* Leaderboards */}
        <TouchableOpacity style={styles.pauseRow} onPress={onShowLeaderboard}>
          <Text style={styles.pauseRowLabel}>Leaderboards</Text>
          <Text style={styles.pauseRowValue}>🏆 View</Text>
        </TouchableOpacity>

        {/* Resume */}
        <TouchableOpacity
          style={styles.resumeBtn}
          onPress={() => dispatch({ type: 'RESUME_GAME' })}
        >
          <Text style={styles.resumeBtnText}>▶  RESUME</Text>
        </TouchableOpacity>

        {/* Quit */}
        {confirmQuit ? (
          <View style={styles.confirmQuitRow}>
            <Text style={styles.confirmQuitLabel}>Are you sure?</Text>
            <View style={styles.confirmQuitBtns}>
              <TouchableOpacity
                style={styles.confirmQuitYes}
                onPress={() => dispatch({ type: 'QUIT_GAME' })}
              >
                <Text style={styles.confirmQuitYesText}>Quit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmQuit(false)}>
                <Text style={styles.confirmQuitNo}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setConfirmQuit(true)}>
            <Text style={styles.quitText}>✕ Quit to Menu</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function GameScreen() {
  const { state, dispatch } = useGame();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const onShowLeaderboard  = () => setShowLeaderboard(true);
  const onCloseLeaderboard = () => setShowLeaderboard(false);

  // Android back button → pause / unpause
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!state.isRunning) return false;
      if (state.isPaused) {
        dispatch({ type: 'RESUME_GAME' });
      } else {
        dispatch({ type: 'PAUSE_GAME' });
      }
      return true;
    });
    return () => sub.remove();
  }, [state.isRunning, state.isPaused]);

  // ── Audio ───────────────────────────────────────────────────────────────
  const { settings } = useSettings();

  // Sync sound-enabled setting into audio module
  useEffect(() => { setSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  // Music: start on game begin, stop on game end/quit
  useEffect(() => {
    if (state.isRunning && !state.isPaused) startMusic();
    else if (!state.isRunning) stopMusic();
  }, [state.isRunning]);

  useEffect(() => {
    if (state.isPaused) pauseMusic();
    else if (state.isRunning) resumeMusic();
  }, [state.isPaused]);

  // Game over sound
  useEffect(() => {
    if (state.isGameOver) { stopMusic(); playSound('game_over'); }
  }, [state.isGameOver]);

  // All-three-active bonus fanfare
  const prevAllThreeRef = useRef(false);
  useEffect(() => {
    const active = state.activePowerUps.length === 3;
    if (active && !prevAllThreeRef.current) playSound('bonus');
    prevAllThreeRef.current = active;
  }, [state.activePowerUps.length]);

  // Timer tick in final 10 seconds
  const prevSecondsRef = useRef(999);
  // ── End audio ────────────────────────────────────────────────────────────

  const seconds          = Math.ceil(state.timeRemainingMs / 1000);

  // Tick sound for last 10 seconds
  useEffect(() => {
    if (state.isRunning && seconds < prevSecondsRef.current && seconds <= 10 && seconds > 0) {
      playSound('timer_tick');
    }
    prevSecondsRef.current = seconds;
  }, [seconds, state.isRunning]);

  const timerPct         = Math.min(state.timeRemainingMs / GAME_DURATION_MS, 1);
  const allThreeActive   = state.activePowerUps.length === 3;
  const slowActive       = state.activePowerUps.some(p => p.type === 'time-slow');
  const boostPowerUp     = state.activePowerUps.find(p => p.type === 'multiplier-boost');
  const effectiveMult    = Math.max(1, state.combo + (boostPowerUp ? (boostPowerUp.bonus ?? 5) : 0));

  if (!state.isRunning && !state.isGameOver) return (
    <>
      <HomeScreen onShowLeaderboard={onShowLeaderboard} />
      {showLeaderboard && <LeaderboardModal onClose={onCloseLeaderboard} />}
    </>
  );
  if (state.isGameOver) return (
    <>
      <GameOverScreen onShowLeaderboard={onShowLeaderboard} />
      {showLeaderboard && <LeaderboardModal onClose={onCloseLeaderboard} />}
    </>
  );

  return (
    <View style={styles.gameContainer}>
      {/* Per-power-up atmosphere tints */}
      {state.activePowerUps.map(p => (
        <View
          key={p.type}
          style={[StyleSheet.absoluteFill, styles.atmosphere, { backgroundColor: POWER_UP_ATMOSPHERE[p.type] }]}
          pointerEvents="none"
        />
      ))}

      <View style={styles.topBlock}>
        <View style={styles.header}>
          <View>
            <Text style={styles.bestLabel}>BEST {state.bestScore}</Text>
            <Text style={styles.scoreText}>{String(state.score).padStart(5, '0')}</Text>
          </View>
          <Text style={styles.comboText}>COMBO {state.combo}</Text>
          <View style={styles.timerRow}>
            <Text style={styles.timerText}>{seconds}s</Text>
            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={() => dispatch({ type: 'PAUSE_GAME' })}
            >
              <Text style={styles.pauseBtnText}>⏸</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.timerBarBg}>
          <View style={[
            styles.timerBarFill,
            { width: `${timerPct * 100}%` as any },
            slowActive && styles.timerBarSlow,
          ]} />
        </View>
        {/* Fixed-height slot — always reserves space so grid never shifts */}
        <View style={styles.powerUpSlot}>
          {allThreeActive ? (
            <View style={[styles.powerUpBanner, styles.powerUpBannerBonus]}>
              <Text style={styles.powerUpText}>✨ BONUS</Text>
            </View>
          ) : (
            state.activePowerUps.map(p => (
              <View key={p.type} style={[styles.powerUpBanner, POWER_UP_STYLES[p.type]]}>
                <Text style={styles.powerUpText}>{POWER_UP_LABELS[p.type]}</Text>
              </View>
            ))
          )}
        </View>

        {/* Fixed-height slot — always reserves space so grid never shifts */}
        <View style={styles.multiplierSlot}>
          <Text style={styles.multiplierAboveGrid}>
            {effectiveMult > 1 ? `×${effectiveMult}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.gridWrapper}>
        <Grid />
        {/* Score popups float upward from just above the grid */}
        <ScorePopupLayer />
      </View>

      <Text style={styles.brandName}>STARFUSE</Text>

      {/* Golden vignette rendered last so elevation doesn't get covered by grid panel */}
      <GoldenVignette visible={allThreeActive} />

      {/* Pause menu overlay */}
      {state.isPaused && <PauseMenu onShowLeaderboard={onShowLeaderboard} />}
      {showLeaderboard && <LeaderboardModal onClose={onCloseLeaderboard} />}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ 'Orbitron-Bold': Orbitron_700Bold, 'Orbitron-Black': Orbitron_900Black });

  useEffect(() => {
    MobileAds().initialize().catch(() => {});
    prefetchLeaderboard();
    initAudio().catch(() => {});
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <BackgroundShapes />
        <SettingsProvider>
          <GameProvider>
            <GameScreen />
          </GameProvider>
        </SettingsProvider>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Orbitron-Black',
    color: 'white',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Orbitron-Bold',
    color: '#9966CC',
    letterSpacing: 1,
  },
  // Pre-game boost
  boostSection: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    gap: 10,
  },
  boostTitle: {
    color: '#9966CC',
    fontSize: 10,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 2,
  },
  boostGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  boostCard: {
    width: '45%',
    backgroundColor: '#1A0B2E',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#2D1255',
  },
  boostLabel: {
    fontSize: 11,
    fontFamily: 'Orbitron-Bold',
  },
  boostSub: {
    fontSize: 9,
    fontFamily: 'Orbitron-Bold',
    color: '#6644AA',
  },
  boostAdBtn: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: 'Orbitron-Bold',
    color: '#AA44FF',
  },
  clearBoost: {
    color: '#664499',
    fontSize: 12,
    marginTop: 2,
  },
  // Start button
  startBtn: {
    marginTop: 8,
    backgroundColor: '#6633BB',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 32,
  },
  startBtnText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 3,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  bestScore: {
    color: '#9966CC',
    fontSize: 12,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 2,
  },
  // Game over
  scoreLabel: {
    color: '#9966CC',
    fontSize: 12,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 3,
  },
  scoreValue: {
    color: 'white',
    fontSize: 56,
    fontFamily: 'Orbitron-Black',
  },
  newBest: {
    color: '#FFD700',
    fontSize: 14,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 2,
  },
  continueBox: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2D1255',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    backgroundColor: '#1A0B2E',
  },
  continueTitle: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 3,
    textAlign: 'center',
  },
  continueTimer: {
    color: '#AA44FF',
    fontSize: 36,
    fontFamily: 'Orbitron-Black',
  },
  continueBtn: {
    backgroundColor: '#6633BB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  continueBtnText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 1,
  },
  noThanks: {
    color: '#664499',
    fontSize: 13,
  },
  // Game screen
  gameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 28,
    paddingBottom: 24,
  },
  topBlock: {
    width: '100%',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  bestLabel: {
    color: '#9966CC',
    fontSize: 10,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  scoreText: {
    color: 'white',
    fontSize: 26,
    fontFamily: 'Orbitron-Black',
  },
  comboText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  timerText: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'Orbitron-Black',
    minWidth: 40,
    textAlign: 'right',
  },
  timerBarBg: {
    width: '90%',
    height: 6,
    backgroundColor: '#2D1255',
    borderRadius: 3,
    marginBottom: 0,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    backgroundColor: '#AA44FF',
    borderRadius: 3,
  },
  timerBarSlow: {
    backgroundColor: '#4488FF',
  },
  powerUpSlot: {
    height: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  powerUpBanner: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  powerUpBannerBonus: {
    backgroundColor: '#6622AA',
    paddingHorizontal: 32,
  },
  atmosphere: {
    opacity: 0.22,  // per-power-up opacity; stacks naturally when multiple are active
    zIndex: 0,
  },
  vignetteLayer: {
    zIndex: 20,
    elevation: 20,
  },
  powerUpText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1.5,
  },
  gridWrapper: {
    alignItems: 'center',
  },
  brandName: {
    color: '#4A1A88',
    fontSize: 16,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 4,
  },
  // Score popups
  popupLayer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  floatingScoreText: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#FFD700',
    fontSize: 30,
    fontFamily: 'Orbitron-Black',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  // Multiplier above grid
  multiplierSlot: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiplierAboveGrid: {
    color: '#AA44FF',
    fontSize: 28,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 2,
  },
  leaderboardBtn: {
    borderWidth: 1,
    borderColor: '#2D1255',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 28,
  },
  leaderboardBtnText: {
    color: '#FFD700',
    fontSize: 13,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  // Back to menu on game over screen
  backToMenuText: {
    color: '#664499',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  // Pause button in header
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pauseBtn: {
    padding: 4,
  },
  pauseBtnText: {
    fontSize: 18,
    color: '#9966CC',
  },
  // Pause overlay
  pauseOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 2, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pauseCard: {
    width: '82%',
    backgroundColor: '#120630',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2D1255',
    padding: 28,
    gap: 18,
    alignItems: 'stretch',
  },
  pauseTitle: {
    color: 'white',
    fontSize: 22,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
  },
  pauseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E0840',
  },
  pauseRowDisabled: {
    opacity: 0.4,
  },
  pauseRowLabel: {
    color: '#9966CC',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  pauseRowValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  pauseRowValueDim: {
    color: '#664488',
    fontSize: 13,
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#AA44FF',
    minWidth: 100,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  saveBtn: {
    backgroundColor: '#6633BB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  resumeBtn: {
    backgroundColor: '#6633BB',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 4,
  },
  resumeBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  quitText: {
    color: '#664488',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
  },
  confirmQuitRow: {
    alignItems: 'center',
    gap: 10,
    marginTop: -4,
  },
  confirmQuitLabel: {
    color: '#FF6666',
    fontSize: 13,
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  confirmQuitBtns: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  confirmQuitYes: {
    backgroundColor: '#AA2222',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
  },
  confirmQuitYesText: {
    color: 'white',
    fontSize: 13,
    fontFamily: 'Orbitron-Black',
    letterSpacing: 1,
  },
  confirmQuitNo: {
    color: '#664488',
    fontSize: 13,
    fontFamily: 'Orbitron-Bold',
  },
});

const POWER_UP_LABELS: Record<string, string> = {
  'time-slow':        '⏱ TIME SLOW',
  'score-double':     '✕2 SCORE DOUBLE',
  'multiplier-boost': '⬆ MULTIPLIER BOOST',
};

const POWER_UP_STYLES: Record<string, object> = {
  'time-slow':        { backgroundColor: '#1A3A88' },
  'score-double':     { backgroundColor: '#881A1A' },
  'multiplier-boost': { backgroundColor: '#1A6633' },
};

const POWER_UP_ATMOSPHERE: Record<PowerUpType, string> = {
  'time-slow':        '#4488FF',
  'score-double':     '#FF3333',
  'multiplier-boost': '#33DD66',
};
