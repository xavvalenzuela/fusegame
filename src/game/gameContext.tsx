import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import type { GameState, GameAction } from '../types/game';
import { gameReducer, createInitialState } from './gameReducer';

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

const SPAWN_DELAY_MS = 2000;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const lastTickRef       = useRef<number | null>(null);
  const rafRef            = useRef<number>(0);
  const spawnTimersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevQueueLenRef   = useRef(0);

  // RAF-based countdown — stops when paused or not running
  useEffect(() => {
    if (!state.isRunning || state.isPaused) {
      cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTickRef.current !== null) {
        dispatch({ type: 'TICK', deltaMs: now - lastTickRef.current });
      }
      lastTickRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [state.isRunning, state.isPaused]);

  // Each new queue entry gets its own independent 2s timer
  useEffect(() => {
    if (state.isPaused) return;

    const currentLen = state.pendingSpawns.length;
    const prevLen    = prevQueueLenRef.current;

    if (currentLen > prevLen) {
      for (let i = 0; i < currentLen - prevLen; i++) {
        const timer = setTimeout(() => {
          dispatch({ type: 'SPAWN_PENDING' });
          spawnTimersRef.current = spawnTimersRef.current.filter(t => t !== timer);
        }, SPAWN_DELAY_MS);
        spawnTimersRef.current.push(timer);
      }
    }

    prevQueueLenRef.current = currentLen;
  }, [state.pendingSpawns.length, state.isPaused]);

  // Clear timers when game stops or pauses
  useEffect(() => {
    if (!state.isRunning || state.isPaused) {
      spawnTimersRef.current.forEach(clearTimeout);
      spawnTimersRef.current = [];
      // Don't reset prevQueueLenRef on pause so resume picks up correctly
      if (!state.isRunning) prevQueueLenRef.current = 0;
    }
  }, [state.isRunning, state.isPaused]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
