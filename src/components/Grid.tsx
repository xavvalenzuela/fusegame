import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tile } from './Tile';
import { useGame } from '../game/gameContext';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, GRID_GAP } from '../constants/theme';
import { canFuse } from '../game/tileUtils';
import { playSound } from '../services/audio';

const GRID_WIDTH  = GRID_COLS * TILE_SIZE + (GRID_COLS - 1) * GRID_GAP;
const GRID_HEIGHT = GRID_ROWS * TILE_SIZE + (GRID_ROWS - 1) * GRID_GAP;

const CELL_SLOTS = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col) => ({ row, col }))
).flat();

export function Grid() {
  const { state, dispatch } = useGame();

  // Track selection in a ref so rapid taps don't read stale React state.
  // Updated synchronously in handleTap to mirror reducer logic exactly.
  const selectedRef = useRef<string | null>(null);
  useEffect(() => { selectedRef.current = state.selectedTileId; }, [state.selectedTileId]);

  function handleTap(tileId: string) {
    if (!state.isRunning) return;
    const selectedTileId = selectedRef.current;
    const { tiles, combo } = state;

    if (!selectedTileId || selectedTileId === tileId) {
      // First tap (select) or re-tap same tile (deselect)
      selectedRef.current = selectedTileId === tileId ? null : tileId;
    } else {
      const from = tiles.find(t => t.id === selectedTileId);
      const to   = tiles.find(t => t.id === tileId);
      if (from && to && canFuse(from, to)) {
        playSound(from.value === 'star' ? 'fuse_star' : from.value === 'diamond' ? 'fuse_diamond' : 'fuse_circle');
        selectedRef.current = null;
      } else {
        if (combo > 0) playSound('cancel');
        selectedRef.current = tileId;
      }
    }

    dispatch({ type: 'SELECT_TILE', tileId });
  }

  return (
    <View style={styles.panel}>
      <View style={[styles.grid, { width: GRID_WIDTH, height: GRID_HEIGHT }]}>
        {/* Empty cell slots rendered as background layer */}
        {CELL_SLOTS.map(({ row, col }) => (
          <View
            key={`slot-${row}-${col}`}
            style={[styles.cellSlot, {
              left:   col * (TILE_SIZE + GRID_GAP),
              top:    row * (TILE_SIZE + GRID_GAP),
              width:  TILE_SIZE,
              height: TILE_SIZE,
            }]}
          />
        ))}
        {state.tiles.map(tile => (
          <Tile
            key={tile.id}
            tile={tile}
            isSelected={state.selectedTileId === tile.id}
            onTap={handleTap}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#080318',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2D1255',
    shadowColor: '#6633BB',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  grid: {
    position: 'relative',
  },
  cellSlot: {
    position: 'absolute',
    backgroundColor: '#120530',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E0840',
  },
});
