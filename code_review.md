# FuseGame Code Review

Date: 2026-05-31  
Scope: All source files under `src/`, `App.tsx`, `scripts/generate-sounds.js`

---

## Critical

### 1. ✅ FIXED — Firebase config is all placeholder values (`src/services/firebase.ts`)
Every field is a literal string like `'YOUR_API_KEY'`. Firestore calls silently fail, so no scores are ever written or read globally. The leaderboard appears to work (the UI renders) but data is never persisted between installs or across devices. This needs a real Firebase project before any public release.

### 2. ✅ FIXED — Device ID is a weak random string (`src/services/leaderboard.ts:36`)
```ts
id = Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
```
`Math.random()` is not cryptographically random. On Android, `Date.now()` has millisecond resolution, so two installs within the same millisecond (e.g. emulator factory reset) can produce the same ID. Use `expo-crypto` (`randomUUID`) or `react-native-uuid` instead.

### 3. ✅ FIXED — `submitScore` always creates a new Firestore document (`src/services/leaderboard.ts:105`)
Every game over posts a new document. A single user can spam the global leaderboard with thousands of entries across sessions. There is no deduplication, rate limiting, or "keep only best score per device" logic. The global board will degrade quickly once real users appear.

### 4. ✅ FIXED (by design) — Personal scores are never capped per-device globally
`savePersonalScore` caps at 20 entries locally, but if the user reinstalls the app the local history is lost entirely (AsyncStorage is wiped on uninstall). There is no cloud backup of personal history.

### 5. ✅ FIXED — `getPersonalScores` deserialises raw JSON without validation (`src/services/leaderboard.ts:47`)
```ts
return raw ? JSON.parse(raw) : [];
```
If the stored string is corrupted or from an older schema, `JSON.parse` will either throw (crashing the leaderboard) or return data with missing fields. No try/catch, no shape check.

---

## High

### 6. ✅ FIXED — `ads.ts`: reward is granted before ad is confirmed closed
`onRewarded()` fires on `EARNED_REWARD`, which fires while the ad is still on screen. The `onDismissed` callback fires later. This means the boost is set in state and the "✓ Ready" UI renders while the ad fullscreen is still showing, which looks broken. The reward should be granted on `CLOSED`, after confirming `EARNED_REWARD` was already received.

### 7. ✅ FIXED — `ads.ts`: listeners are not cleaned up on error
If the ad fails to load (`AdEventType.ERROR`), none of the three `unsubscribe` functions are ever called. The listeners leak and `loadingBoost` state in `HomeScreen` never resets, permanently disabling the boost buttons for the session.

### 8. ✅ FIXED — Settings are not persisted (`src/game/settingsContext.tsx`)
`soundEnabled` and `playerName` are plain React state — they reset to defaults every cold start. The player name they set in the pause menu is lost when the app is killed. Use AsyncStorage here.

### 9. ✅ FIXED — `bestScore` lives only in the game reducer (`src/game/gameReducer.ts`)
`bestScore` is initialised to `0` in `createInitialState()` and is never read from or written to AsyncStorage. The all-time best is lost on every app restart. The "BEST" display in the header and "NEW BEST!" banner are correct within a session but meaningless across sessions.

### 10. ✅ FIXED — Score popup layer positioning is hardcoded (`App.tsx:550`)
```ts
popupLayer: { position: 'absolute', top: -50, ... }
```
`-50` is relative to `gridWrapper`, which is laid out by `justifyContent: 'space-between'`. On shorter screens (small Android phones) the popup will clip into the timer bar. It should be measured or driven by the layout.

### 11. ✅ BY DESIGN — `GameScreen` reads `useSettings()` but `SettingsProvider` wraps `GameProvider`, not the other way around (`App.tsx`)
`GameProvider` is nested inside `SettingsProvider`. `GameScreen` is rendered by `GameProvider`'s children. This currently works, but means game logic (inside `GameProvider`) cannot access settings — any future attempt to use settings in game context will silently get the wrong context. The nesting should be documented or intentionally designed.

---

## Medium

### 12. ✅ FIXED — `selectedRef` in `Grid.tsx` can desync from reducer state
`selectedRef` is updated by `useEffect` (async after render) AND manually in `handleTap` (sync). If the reducer rejects or modifies a `SELECT_TILE` action (e.g. game is paused, `isRunning = false`), `selectedRef` has already been updated imperatively in `handleTap` but the reducer returned the old state. The ref and the reducer state are now out of sync until the next render. There is currently one code path that causes this: tapping a tile when `!state.isRunning` (before game starts or after game over) — the reducer returns early but `selectedRef.current` was already mutated.

### 13. ✅ FIXED — `Tile.tsx`: `useEffect` for star pulse has a stale dependency
```ts
useEffect(() => {
  if (isStar) { starPulse.value = withRepeat(...) }
  return () => { starPulse.value = 0; };
}, [isStar]);
```
The cleanup sets `starPulse.value = 0` unconditionally. When a diamond tile upgrades to a star (its `value` prop changes), the cleanup of the old effect runs and zeroes the pulse, then the new effect starts it again — a visible flash. The cleanup should only reset if the tile is no longer a star: `return () => { if (!isStar) starPulse.value = 0; }`.

### 14. ✅ FIXED — `LeaderboardModal.tsx`: TypeScript error suppressed by mismatched types (line 145)
`FlatList data` is typed as `LeaderboardEntry[]` but `personal` is `PersonalEntry[]` (missing `id` and `deviceId`). TypeScript flags this but the app renders it fine at runtime. The types should be fixed — either a union `LeaderboardEntry | PersonalEntry` or a separate typed FlatList for each tab.

### 15. ✅ FIXED — `gameReducer.ts`: star time bonus is capped at `GAME_DURATION_MS`
```ts
const newTime = Math.min(state.timeRemainingMs + timeBonus, GAME_DURATION_MS);
```
With a 60s game, this means a star fuse at t=58s gives +3s but is capped to 60s (player only gets 2s). If the player is in `continue` mode (15s max), the cap is wrong — it should cap at `GAME_DURATION_MS` only in the first game, and uncapped (or capped higher) on continue. Currently a continued game can never exceed 15s regardless of stars fused.

### 16. ✅ FIXED — `gameReducer.ts`: combo idle timeout uses `GAME_DURATION_MS` as the normaliser even during continue
```ts
const pct = Math.max(0, state.timeRemainingMs / GAME_DURATION_MS);
```
After `CONTINUE_GAME`, `timeRemainingMs` starts at 15,000. `15000 / 60000 = 0.25`. The combo timeout is immediately set to `1500 + 0.25 * 1500 = 1875ms` — close to the minimum — making the continued game very punishing for combos even in the first second. Should use the starting time of the current session as the normaliser, not the original `GAME_DURATION_MS`.

### 17. ✅ ALREADY FIXED — `TILE_SIZE` is computed from screen width at module load time (`src/constants/theme.ts`)
```ts
const { width: SCREEN_WIDTH } = Dimensions.get('window');
```
This is a static snapshot at import time. It does not respond to orientation changes or foldable phone layout changes. For a portrait-only game this is fine, but it should be locked to portrait in the manifest to make the assumption explicit.

### 18. ✅ FIXED — `audio.ts`: `initAudio()` is synchronous but returns `void`, not `Promise<void>`
Callers cannot await it. If sounds haven't finished `prepareAsync` before the first game starts, the first few taps will silently produce no sound. There's no loading gate or ready callback.

### 19. ✅ FIXED — `audio.ts`: pool `_idx` is never reset when a game restarts
Round-robin indices survive across game sessions. This is harmless functionally, but means the pool state is never truly cleaned up. More importantly, if `initAudio()` is ever called a second time (e.g. after a settings change or hot-reload), it will push 3 more Sound instances onto the arrays without clearing the old ones, growing the pool unboundedly.

### 20. ✅ FIXED — `generate-sounds.js`: script is not integrated into the build pipeline
The WAV files in `android/app/src/main/res/raw/` are generated manually by running `node scripts/generate-sounds.js`. If a developer clones the repo and runs the Android build without running this script first, the build succeeds but the app has no sounds. The script should be added to the `prebuild` npm script or to the Gradle `preBuild` task.

---

## Low

### 21. ✅ FIXED — `App.tsx`: `MobileAds().initialize()` and `prefetchLeaderboard()` and `initAudio()` are module-level side effects
These three calls fire the moment the module is imported — before React mounts, before any context is ready, before the user has seen anything. If any of them throw synchronously, the entire app fails to boot. They should be wrapped in try/catch or deferred to `useEffect` in the root component.

### 22. ✅ BY DESIGN — `App.tsx`: `GameScreen` calls `useSettings()` but also has its own `const { settings }` shadowing nothing — it's just duplicated from the top
`GameScreen` at line ~503 imports `useSettings()` to get `settings.soundEnabled`. But `PauseMenu` at line ~387 also calls `useSettings()`. The audio effects in `GameScreen` are the only caller in that component — this is fine structurally, but if `GameScreen` ever needs more settings fields, they're all accessed through this one hook call, which is correct. No action needed, just note the duplication of hook calls across sibling components.

### 23. ✅ FIXED — `HomeScreen` and `GameOverScreen` each manage their own `showLeaderboard` state and render `LeaderboardModal` independently
`LeaderboardModal` is instantiated in three places: `HomeScreen`, `GameOverScreen`, and `PauseMenu`. Each has its own local `showLeaderboard` boolean. This means three separate copies of the global fetch logic can run concurrently. A shared `LeaderboardModal` at the root level (with a context flag) would be cleaner.

### 24. ✅ FIXED — `gameContext.tsx`: `prevQueueLenRef` is not reset on `QUIT_GAME`
```ts
if (!state.isRunning) prevQueueLenRef.current = 0;
```
`QUIT_GAME` sets `isRunning = false`. The `useEffect` for `pendingSpawns` checks `!state.isRunning` and resets the ref. This is correct. However, `PAUSE_GAME` sets `isRunning = true, isPaused = true` and the spawn timers are cleared but `prevQueueLenRef` is not reset. If a spawn was pending when the user paused, the count is preserved across the pause correctly — but on resume the spawn timer logic re-runs and creates a duplicate timer. Low likelihood, but possible.

### 25. ✅ FIXED — `tileUtils.ts`: `uid()` uses `Math.random()`
```ts
function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
```
7 characters of base-36 gives ~78 billion possibilities, but with 16 tiles on a 4×4 grid and rapid creation during gameplay, collision probability is non-zero (birthday paradox). A collision would cause React key warnings and could break tile lookup by ID. Use a simple incrementing counter instead.

### 26. ✅ FIXED (via #25) — `Tile.tsx`: SVG gradient IDs are tile-specific but not globally unique
```ts
const gradId  = `g${tile.id}`;
const glossId = `gl${tile.id}`;
```
SVG `<defs>` IDs must be unique per SVG document. In React Native, react-native-svg renders all SVGs into the same native canvas context. If two tiles ever have the same `tile.id` (see issue #25), their gradient IDs will collide and one tile will render with the wrong gradient. This is a consequence of issue #25, not a separate bug, but worth noting.

### 27. ✅ FIXED — `leaderboard.ts`: in-memory cache is module-level global state
`_cachedGlobal` and `_cacheTime` survive hot reloads in development. This can cause the leaderboard to show stale data during development iteration. In production it's fine, but a `clearCache()` export would be useful for testing.

### 28. ✅ FIXED — `ads.ts`: ad ID comment says "TODO: replace" but is easy to miss before release
The placeholder `'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'` will cause a blank ad (no fill) in production. This should be an environment variable or a build-time check that throws in release mode if the placeholder is still present.

### 29. ✅ FIXED — `App.tsx`: `VIGNETTE_SIZE = 90` is hardcoded pixels
On high-DPI screens the vignette will be proportionally thinner. Should use a percentage of screen width/height (`SCREEN_W * 0.12`) for consistent appearance.

### 30. ✅ BY DESIGN — `settingsContext.tsx`: `updateSettings` replaces fields shallowly
```ts
function updateSettings(update: Partial<Settings>) {
  setSettings(s => ({ ...s, ...update }));
}
```
This is fine today with only two flat fields. If Settings grows to include nested objects, this will silently overwrite nested data. Not a bug today, but a trap for future additions.
