export type TileValue = 'circle' | 'diamond' | 'star';
export type TileColor = 'red' | 'blue' | 'green';

export interface TilePosition {
  row: number;
  col: number;
}

export interface Tile {
  id: string;
  value: TileValue;
  color: TileColor;
  position: TilePosition;
}

// Blue star → time-slow | Red star → score-double | Green star → multiplier-boost
export type PowerUpType = 'time-slow' | 'score-double' | 'multiplier-boost';

// Pre-game boost earned by watching a rewarded ad
export type PreGameBoost = PowerUpType | 'extra-time';

export interface PowerUp {
  type: PowerUpType;
  remainingMs: number;
  bonus?: number; // only used by multiplier-boost: accumulated +N to combo
}

export interface GameState {
  tiles: Tile[];
  score: number;
  bestScore: number;
  combo: number;
  comboIdleMs: number;
  timeRemainingMs: number;
  isRunning: boolean;
  isGameOver: boolean;
  activePowerUps: PowerUp[];
  selectedTileId: string | null;
  isPaused: boolean;
  preGameBoost: PreGameBoost | null;
  canContinue: boolean;
  isContinued: boolean;
  sessionDurationMs: number;
  totalElapsedMs: number; // real wall-clock time played this session (ignores time-slow)
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SET_PRE_GAME_BOOST'; boost: PreGameBoost | null }
  | { type: 'CONTINUE_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'QUIT_GAME' }
  | { type: 'SELECT_TILE'; tileId: string }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'GAME_OVER' }
  | { type: 'LOAD_BEST_SCORE'; score: number };
