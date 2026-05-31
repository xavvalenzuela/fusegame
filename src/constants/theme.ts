import { Dimensions } from 'react-native';
import type { TileColor } from '../types/game';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const GRID_GAP = 10;
export const GRID_PADDING = 16;

export const TILE_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

export const GAME_DURATION_MS = 60_000;
export const COMBO_RESET_MS = 2_000;

export const TILE_COLORS: Record<TileColor, { base: string; light: string; dark: string; shadow: string; border: string }> = {
  red: {
    base:   '#E04040',
    light:  '#FF6B6B',
    dark:   '#A02020',
    shadow: '#601010',
    border: '#FF9090',
  },
  blue: {
    base:   '#3366EE',
    light:  '#6699FF',
    dark:   '#1A3CAA',
    shadow: '#0A1A60',
    border: '#88AAFF',
  },
  green: {
    base:   '#29AA55',
    light:  '#55DD88',
    dark:   '#106630',
    shadow: '#053318',
    border: '#77EEA0',
  },
};

export const BACKGROUND_COLOR = '#2D1255';

export const SCORE_PER_FUSE: Record<string, number> = {
  circle:  10,
  diamond: 20,
  star:    50,
};
