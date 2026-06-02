import type { GameState, GameAction, PowerUpType, PowerUp } from '../types/game';
import { createInitialTiles, canFuse, makeFusedTile, spawnTile } from './tileUtils';
import { GAME_DURATION_MS, SCORE_PER_FUSE, GRID_COLS, GRID_ROWS } from '../constants/theme';

const GRID_SIZE = GRID_COLS * GRID_ROWS;

const STAR_TIME_BONUS_MS   = 3000;
const PRE_GAME_TIME_BONUS_MS = 10_000;
const CONTINUE_BONUS_MS      = 15_000;

const POWER_UP_DURATION_MS: Record<PowerUpType, number> = {
  'time-slow':        5_000,
  'score-double':     5_000,
  'multiplier-boost': 5_000,
};
const POWER_UP_STACK_MS: Record<PowerUpType, number> = {
  'time-slow':        3_000,
  'score-double':     3_000,
  'multiplier-boost': 3_000,
};
const MULTIPLIER_BOOST_INITIAL = 5;  // +5 to combo on first trigger
const MULTIPLIER_BOOST_STACK   = 3;  // +3 more on each re-trigger
const TIME_SLOW_FACTOR       = 0.50; // timer at 50% speed

// Combo idle timeout: 3000ms at full time, 1500ms at 0s — linear scale
const COMBO_TIMEOUT_MAX_MS = 3000;
const COMBO_TIMEOUT_MIN_MS = 1500;

// Blue tile spawn probability fades from 1/3 → BLUE_CHANCE_MIN between
// BLUE_FADE_START_MS and BLUE_FADE_END_MS of total real elapsed time.
const BLUE_FADE_START_MS = 60_000;
const BLUE_FADE_END_MS   = 120_000;
const BLUE_CHANCE_MIN    = 0.08;

function blueChanceForElapsed(totalElapsedMs: number): number {
  if (totalElapsedMs <= BLUE_FADE_START_MS) return 1 / 3;
  if (totalElapsedMs >= BLUE_FADE_END_MS)   return BLUE_CHANCE_MIN;
  const t = (totalElapsedMs - BLUE_FADE_START_MS) / (BLUE_FADE_END_MS - BLUE_FADE_START_MS);
  return 1 / 3 + t * (BLUE_CHANCE_MIN - 1 / 3);
}

function colorToPowerUp(color: string): PowerUpType {
  if (color === 'blue') return 'time-slow';
  if (color === 'red')  return 'score-double';
  return 'multiplier-boost';
}

function addOrRefreshPowerUp(list: PowerUp[], type: PowerUpType): PowerUp[] {
  const existing = list.find(p => p.type === type);
  if (existing) {
    return list.map(p =>
      p.type === type
        ? {
            ...p,
            remainingMs: p.remainingMs + POWER_UP_STACK_MS[type],
            bonus: type === 'multiplier-boost'
              ? (p.bonus ?? MULTIPLIER_BOOST_INITIAL) + MULTIPLIER_BOOST_STACK
              : p.bonus,
          }
        : p
    );
  }
  return [...list, {
    type,
    remainingMs: POWER_UP_DURATION_MS[type],
    bonus: type === 'multiplier-boost' ? MULTIPLIER_BOOST_INITIAL : undefined,
  }];
}

export function createInitialState(): GameState {
  return {
    tiles: [],
    score: 0,
    bestScore: 0,
    combo: 0,
    comboIdleMs: 0,
    timeRemainingMs: GAME_DURATION_MS,
    isRunning: false,
    isGameOver: false,
    activePowerUps: [],
    selectedTileId: null,
    isPaused: false,
    preGameBoost: null,
    canContinue: true,
    isContinued: false,
    sessionDurationMs: GAME_DURATION_MS,
    totalElapsedMs: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'START_GAME': {
      const boost = state.preGameBoost;
      const startTime = boost === 'extra-time'
        ? GAME_DURATION_MS + PRE_GAME_TIME_BONUS_MS
        : GAME_DURATION_MS;
      const startPowerUps: PowerUp[] = boost && boost !== 'extra-time'
        ? [{ type: boost as PowerUpType, remainingMs: POWER_UP_DURATION_MS[boost as PowerUpType] }]
        : [];
      return {
        ...createInitialState(),
        bestScore: state.bestScore,
        tiles: createInitialTiles(),
        isRunning: true,
        timeRemainingMs: startTime,
        sessionDurationMs: startTime,
        activePowerUps: startPowerUps,
        preGameBoost: null,
      };
    }

    case 'SET_PRE_GAME_BOOST':
      return { ...state, preGameBoost: action.boost };

    case 'PAUSE_GAME':
      return { ...state, isPaused: true, selectedTileId: null };

    case 'RESUME_GAME':
      return { ...state, isPaused: false };

    case 'QUIT_GAME':
      return { ...createInitialState(), bestScore: state.bestScore };

    case 'CONTINUE_GAME': {
      if (!state.canContinue || state.isContinued) return state;
      return {
        ...state,
        isGameOver: false,
        isRunning: true,
        isContinued: true,
        canContinue: false,
        timeRemainingMs: CONTINUE_BONUS_MS,
        sessionDurationMs: CONTINUE_BONUS_MS,
        selectedTileId: null,
        // totalElapsedMs carries over — blue fade continues from where it left off
      };
    }

    case 'SELECT_TILE': {
      if (!state.isRunning) return state;
      const { tileId } = action;
      const { selectedTileId, tiles } = state;

      if (selectedTileId === tileId) return { ...state, selectedTileId: null };
      if (!selectedTileId)           return { ...state, selectedTileId: tileId };

      const from = tiles.find(t => t.id === selectedTileId);
      const to   = tiles.find(t => t.id === tileId);

      if (!from || !to || !canFuse(from, to)) {
        return { ...state, selectedTileId: tileId, combo: 0, comboIdleMs: 0 };
      }

      // --- Successful fuse ---
      const newCombo   = state.combo + 1;
      const isStarFuse = from.value === 'star';

      const isDoubleActive = state.activePowerUps.some(p => p.type === 'score-double');
      const boostPowerUp   = state.activePowerUps.find(p => p.type === 'multiplier-boost');
      const effectiveMult  = newCombo + (boostPowerUp ? (boostPowerUp.bonus ?? MULTIPLIER_BOOST_INITIAL) : 0);
      const baseScore      = SCORE_PER_FUSE[from.value] ?? 10;
      const scoreGain      = baseScore * effectiveMult * (isDoubleActive ? 2 : 1);

      let newTiles = tiles.filter(t => t.id !== selectedTileId && t.id !== tileId);
      const fused  = makeFusedTile(from, to);
      if (fused) newTiles = [...newTiles, fused];

      let activePowerUps = [...state.activePowerUps];
      if (isStarFuse) {
        activePowerUps = addOrRefreshPowerUp(activePowerUps, colorToPowerUp(from.color));
      }

      // Blue stars add time; red and green only trigger their power-ups
      const timeBonus = isStarFuse && from.color === 'blue' ? STAR_TIME_BONUS_MS : 0;
      const newTime   = Math.min(state.timeRemainingMs + timeBonus, state.sessionDurationMs);
      const newScore  = state.score + scoreGain;

      // Spawn replacement tiles immediately — star fuses remove 2 with no result tile, so spawn 2
      const blueChance = blueChanceForElapsed(state.totalElapsedMs);
      const spawnCount = isStarFuse && !fused ? 2 : 1;
      for (let i = 0; i < spawnCount; i++) {
        const spawned = spawnTile(newTiles, blueChance);
        if (spawned) newTiles = [...newTiles, spawned];
      }

      return {
        ...state,
        tiles: newTiles,
        score: newScore,
        bestScore: Math.max(state.bestScore, newScore),
        combo: newCombo,
        comboIdleMs: 0,
        selectedTileId: null,
        activePowerUps,
        timeRemainingMs: newTime,
      };
    }

    case 'TICK': {
      if (!state.isRunning) return state;

      const slowActive    = state.activePowerUps.some(p => p.type === 'time-slow');
      const effectiveDelta = action.deltaMs * (slowActive ? TIME_SLOW_FACTOR : 1);
      const newTime       = state.timeRemainingMs - effectiveDelta;

      // Decrement all active power-ups, remove expired
      const activePowerUps = state.activePowerUps
        .map(p => ({ ...p, remainingMs: p.remainingMs - action.deltaMs }))
        .filter(p => p.remainingMs > 0);

      // Combo idle timeout — window shrinks linearly as time runs out within this session
      const pct          = Math.max(0, state.timeRemainingMs / state.sessionDurationMs);
      const comboTimeout = COMBO_TIMEOUT_MIN_MS + pct * (COMBO_TIMEOUT_MAX_MS - COMBO_TIMEOUT_MIN_MS);
      const newComboIdle = state.comboIdleMs + action.deltaMs;
      const comboReset   = state.combo > 0 && newComboIdle >= comboTimeout;

      if (newTime <= 0) {
        return {
          ...state, activePowerUps,
          timeRemainingMs: 0, isRunning: false, isGameOver: true,
          combo: 0, comboIdleMs: 0,
        };
      }

      return {
        ...state,
        timeRemainingMs: newTime,
        activePowerUps,
        combo:          comboReset ? 0 : state.combo,
        comboIdleMs:    comboReset ? 0 : newComboIdle,
        totalElapsedMs: state.totalElapsedMs + action.deltaMs,
      };
    }

    case 'GAME_OVER':
      return { ...state, isRunning: false, isGameOver: true };

    case 'LOAD_BEST_SCORE':
      return { ...state, bestScore: Math.max(state.bestScore, action.score) };

    default:
      return state;
  }
}
