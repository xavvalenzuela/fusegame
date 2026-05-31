import type { Tile, TileColor, TileValue, TilePosition } from '../types/game';
import { GRID_COLS, GRID_ROWS } from '../constants/theme';

const COLORS: TileColor[] = ['red', 'blue', 'green'];

export function nextValue(value: TileValue): TileValue | null {
  if (value === 'circle') return 'diamond';
  if (value === 'diamond') return 'star';
  return null; // star + star → power-up, no result tile
}

export function canFuse(a: Tile, b: Tile): boolean {
  return a.id !== b.id && a.color === b.color && a.value === b.value;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function randomColor(): TileColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function randomSpawnValue(): TileValue {
  return Math.random() < 0.5 ? 'circle' : 'diamond';
}

export function createInitialTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      tiles.push({
        id: uid(),
        value: randomSpawnValue(),
        color: randomColor(),
        position: { row, col },
      });
    }
  }
  return tiles;
}

export function spawnTile(tiles: Tile[]): Tile | null {
  const occupied = new Set(tiles.map(t => `${t.position.row},${t.position.col}`));
  const empty: TilePosition[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!occupied.has(`${row},${col}`)) empty.push({ row, col });
    }
  }
  if (empty.length === 0) return null;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  return { id: uid(), value: randomSpawnValue(), color: randomColor(), position: pos };
}

export function makeFusedTile(from: Tile, to: Tile): Tile | null {
  const next = nextValue(from.value);
  if (!next) return null;
  return { id: uid(), value: next, color: from.color, position: to.position };
}
