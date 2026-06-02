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

let _uidCounter = 0;
function uid(): string {
  return String(++_uidCounter);
}

// blueChance: 0–1 probability of spawning blue. Default 1/3 (equal weight).
// Reduced late-game to prevent infinite blue star / time-slow loops.
function randomColor(blueChance = 1 / 3): TileColor {
  const r = Math.random();
  if (r < blueChance) return 'blue';
  // remaining probability split evenly between red and green
  return r < blueChance + (1 - blueChance) / 2 ? 'red' : 'green';
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

export function spawnTile(tiles: Tile[], blueChance?: number): Tile | null {
  const occupied = new Set(tiles.map(t => `${t.position.row},${t.position.col}`));
  const empty: TilePosition[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!occupied.has(`${row},${col}`)) empty.push({ row, col });
    }
  }
  if (empty.length === 0) return null;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  return { id: uid(), value: randomSpawnValue(), color: randomColor(blueChance), position: pos };
}

export function makeFusedTile(from: Tile, to: Tile): Tile | null {
  const next = nextValue(from.value);
  if (!next) return null;
  return { id: uid(), value: next, color: from.color, position: to.position };
}
