# FuseGame — Implementation Plan

Inspired by 2Fuse: a fast-paced, arcade-style tile fusion puzzle game with a 60-second timer.

Reference screenshot: `/Users/xaviervalenzuela/Downloads/2fuse.png`

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Expo (managed workflow) | Fastest setup, easy device testing via Expo Go |
| Gestures | react-native-gesture-handler | Tap gesture for tile selection |
| Animations | react-native-reanimated v4 | UI-thread animations. **No Babel plugin needed in v4.** |
| Tile rendering | react-native-svg | Inline SVG for gradients + shapes, no image assets needed |
| State | useReducer + Context | Clean game state machine, no extra dependencies |
| Ads | react-native-google-mobile-ads | Rewarded ads for pre-game boosts + end-game continue |
| Language | TypeScript | Type safety for tile data structures and game logic |

### Installed packages
```
expo ~56.0.8
react-native-gesture-handler ~2.31.1
react-native-reanimated 4.3.1
react-native-svg 15.15.4
react-native-google-mobile-ads  ← rewarded ads (AdMob)
babel-preset-expo               ← must be installed explicitly (not auto-included)
react-dom / react-native-web / @expo/metro-runtime  ← for web testing
playwright                      ← dev dependency for web screenshots
```

> **Notes:**
> - `babel-preset-expo` is not installed by default with `create-expo-app` — add it manually.
> - Reanimated v4 does **not** require `react-native-reanimated/plugin` in `babel.config.js`.
> - Expo Go on App Store only supports up to SDK 52/53. Our project uses SDK 56 — use `expo run:android` with a direct build instead.
> - AdMob SDK must be initialized at app startup: `MobileAds().initialize()` before any ad requests.
> - Swap test AdMob IDs in `src/services/ads.ts` and `app.json` before publishing.

---

## Deploying to Physical Device (Android)

```bash
# 1. Enable Developer Options + Wireless Debugging on phone
# 2. Pair (one-time):
~/Library/Android/sdk/platform-tools/adb pair <IP:PORT> <CODE>
# 3. Connect (port changes each session):
~/Library/Android/sdk/platform-tools/adb connect <IP:PORT>
# 4. Build APK:
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./android/gradlew -p android app:assembleDebug -x lint -x test --build-cache
# 5. Install + port-forward + launch:
adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081   # ← required for Metro to reach device
adb shell am start -n com.xavalenzuela.fusegame/.MainActivity
```

> ADB wireless connection drops when the phone screen locks. Re-run `adb connect` with the new port shown in Wireless Debugging settings.

---

## Core Concepts

### Tile
```ts
{ id, value: 'circle' | 'diamond' | 'star', color: 'red' | 'blue' | 'green', position: { row, col } }
```

### Fusion Rule
Two tiles fuse if they share **same value AND same color**.

### Progression Chain
```
● circle  + ● circle  → ◆ diamond
◆ diamond + ◆ diamond → ★ star
★ star    + ★ star    → Power-Up (color-specific, both tiles cleared, +3s to timer)
```

### Colors
- Red: base `#E04040`, light `#FF6B6B`, dark `#A02020`
- Blue: base `#3366EE`, light `#6699FF`, dark `#1A3CAA`
- Green: base `#29AA55`, light `#55DD88`, dark `#106630`

---

## Input Mechanic — Tap to Fuse

1. **Tap tile A** → selected (colored glow ring + shadow pulse, scales to 1.1×)
2. **Tap tile B** (same color + value) → fuse triggered, combo increments
3. **Tap tile B** (different) → switch selection to B, **combo resets to 0** (mis-tap)
4. **Tap tile A again** → deselect (not a mis-tap)

Two-finger play: left finger selects, right finger fuses.

---

## Power-Up System

Power-ups are **color-specific**, support **multiple concurrent active power-ups**, and can **stack** when re-triggered while active.

| Stars fused | Power-Up | Effect | Initial Duration | Re-trigger adds |
|---|---|---|---|---|
| 🔵 Blue + Blue | **TIME SLOW** | Timer runs at 35% speed, bar turns blue | 10s | +5s |
| 🔴 Red + Red | **SCORE DOUBLE** | All scores ×2 | 8s | +4s |
| 🟢 Green + Green | **MULTIPLIER BOOST** | +4 to combo multiplier | 8s | +4s |

- All 3 can be active simultaneously — banners shown as a horizontal row
- **Golden edge vignette** fades in when all 3 are simultaneously active, fades out when any expires
- Star fuse also adds **+3 seconds** to the countdown (capped at 60s)
- Active power-up slot has fixed height so grid never shifts when banners appear/disappear

---

## Combo System

- `combo` increments by 1 on every successful match
- **Resets to 0** on: mis-tap, or idle timeout (no match within the window)
- **Idle timeout window**: scales from 3s at full time → 1.5s as clock approaches 0
- Score formula: `base × effectiveMultiplier × (scoreDouble ? 2 : 1)`
- `effectiveMultiplier = combo + (multiplierBoostActive ? 4 : 0)`
- Displayed as `×N` centered above the grid

Base scores: circle = 10pts, diamond = 20pts, star = 50pts

---

## Spawn Rules

| Match type | Replacement tile timing |
|---|---|
| Circle + Circle | 1 tile spawns **immediately** |
| Diamond + Diamond | 1 tile spawns **immediately** |
| Star + Star | 2 tiles spawn **after 2s delay each** (independent timers per match) |

- Grid always refills to 16 tiles
- Rapid star matches stagger their spawns independently (match at t=0 → spawn at t=2s, match at t=0.5s → spawn at t=2.5s)
- Spawn timers pause when game is paused; cleared on game over / restart

---

## Animations

| Animation | Trigger | Behaviour |
|---|---|---|
| Spawn pop | Every new tile mounts | Scale 1.35→1.0, fast spring (damping 22, stiffness 550) |
| Selection glow | Tile selected | Scale→1.1, SVG ring pulses in tile's own color, colored shadow breathes |
| Star ambient glow | Star tile exists | Golden ring + shadow pulses continuously (starPulse shared value) |
| Score popup | Score increases | Gold `+N` text floats up 60px from score area, fades over 900ms |
| Golden vignette | All 3 power-ups active | SVG gradient panels on all 4 screen edges fade in over 700ms |
| Power-up atmosphere | Any power-up active | 0.22 opacity color wash per active power-up (stacks naturally) |
| Timer bar slow | TIME SLOW active | Bar color switches from purple (`#AA44FF`) to blue (`#4488FF`) |

---

## Monetization — Rewarded Ads

Free app, no in-app purchases. Two ad moments:

### Pre-game boost (Home screen)
Four "Watch Ad" cards before starting:
- ⏱ **+10s** — starts the game with 70s instead of 60s
- 🔵 **Time Slow** — power-up pre-charged, activates immediately at game start
- 🔴 **Score Double** — same
- 🟢 **Multiplier Boost** — same

One boost per game. Cleared after `START_GAME` applies it.

### End-game continue (Game Over screen)
- On first game over (before continue is used): 5-second countdown prompt
- **Watch Ad → +15s** resumes the game; one continue per game
- Countdown expires or "No thanks" → regular game over screen

**Implementation:** `src/services/ads.ts` wraps `RewardedAd` from `react-native-google-mobile-ads`. Replace test IDs with real AdMob IDs before publishing.

---

## UI Layout (Game Screen, portrait)

```
┌─────────────────────────────┐
│ BEST 0                      │
│ 00000      COMBO 0    58s ⏸ │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← timer bar
│ [TIME SLOW] [SCORE ×2] ...  │  ← power-up banners (fixed-height row)
│            ×3               │  ← effective multiplier, centered
├─────────────────────────────┤
│  [●]  [◆]  [●]  [◆]        │
│  [◆]  [●]  [●]  [◆]        │
│  [●]  [●]  [◆]  [●]        │
│  [◆]  [●]  [●]  [●]        │
├─────────────────────────────┤
│           FUSEGAME          │
└─────────────────────────────┘
```

Layout uses `justifyContent: 'space-between'` across: topBlock → multiplier → gridWrapper → brandName.

---

## Pause System

- **⏸ button** in header (top-right, next to timer)
- **Android back button** pauses/resumes while game is running
- Pause stops: RAF countdown timer, spawn delay timers
- **Pause menu** (dark overlay):
  - Player name — inline editable with TextInput
  - Sound on/off — toggle (wired to `SettingsContext`)
  - Leaderboards — placeholder ("Coming soon")
  - ▶ RESUME button
  - ✕ Quit to Menu — calls `QUIT_GAME`, preserves best score

---

## File Structure

```
fusegame/
├── App.tsx                       # All screens + FloatingScore + GoldenVignette + PauseMenu
├── babel.config.js               # babel-preset-expo only
├── android/                      # Bare workflow (generated by expo run:android)
├── src/
│   ├── components/
│   │   ├── Tile.tsx              # Tap gesture, spawn/selection/star animations, SVG render
│   │   └── Grid.tsx              # 4×4 board, dispatches SELECT_TILE
│   ├── game/
│   │   ├── gameReducer.ts        # All state transitions
│   │   ├── gameContext.tsx       # RAF timer + independent spawn timers, pauses correctly
│   │   ├── settingsContext.tsx   # playerName, soundEnabled (persists across games)
│   │   └── tileUtils.ts          # canFuse, makeFusedTile, spawnTile, createInitialTiles
│   ├── services/
│   │   └── ads.ts                # showRewardedAd() — wraps AdMob RewardedAd
│   ├── constants/
│   │   └── theme.ts              # TILE_SIZE, colors, GAME_DURATION_MS
│   └── types/
│       └── game.ts               # All TypeScript types
├── assets/
│   ├── tiles/                    # SVG tile assets (design reference, not loaded at runtime)
│   └── icons/                    # Power-up icon SVGs (design reference)
└── plan.md
```

---

## Game State Shape

```ts
{
  tiles: Tile[]
  score: number
  bestScore: number
  combo: number              // resets on mis-tap or idle timeout
  comboIdleMs: number        // ms since last match; triggers reset when threshold exceeded
  timeRemainingMs: number
  isRunning: boolean
  isGameOver: boolean
  isPaused: boolean
  activePowerUps: PowerUp[]  // all active (can stack up to 3)
  selectedTileId: string | null
  pendingSpawns: number[]    // queue of delayed star-match spawns
  preGameBoost: PreGameBoost | null  // ad-earned boost applied on START_GAME
  canContinue: boolean       // end-game continue available (once per game)
  isContinued: boolean       // already used the continue this game
}
```

---

## Phases

### Phase 1 — Foundation ✅
- [x] Expo + TypeScript, all packages installed
- [x] TypeScript types, theme constants, folder structure

### Phase 2 — Core Mechanic ✅
- [x] Tap-to-select, fusion logic, grid always full
- [x] Independent 2s spawn delay per star match
- [x] RAF-based 60s countdown

### Phase 3 — Scoring & Combo ✅
- [x] `base × effectiveMultiplier` formula
- [x] Combo resets on mis-tap and idle timeout (3s→1.5s window)
- [x] +3s timer bonus on star fuse
- [x] Score popup: gold `+N` floats up from score area on each match
- [x] Multiplier badge `×N` centered above grid

### Phase 4 — Power-Ups ✅
- [x] Color-specific, concurrent (all 3 can stack)
- [x] TIME SLOW: 35% timer speed, 10s + 5s stack
- [x] SCORE DOUBLE: ×2 scoring, 8s + 4s stack
- [x] MULTIPLIER BOOST: +4 combo bonus, 8s + 4s stack
- [x] Golden edge vignette when all 3 active simultaneously
- [x] Per-power-up atmosphere color tints (stack additively)
- [x] Power-up banners in fixed-height slot (grid never shifts)

### Phase 5 — Animations ✅
- [x] Spawn pop (1.35→1.0 bouncy spring)
- [x] Selection glow (tile's own color ring + colored shadow)
- [x] Star tile ambient golden glow (always pulsing)

### Phase 6 — Monetization ✅
- [x] react-native-google-mobile-ads installed + initialized
- [x] Pre-game boost (4 options, watch ad to earn)
- [x] End-game continue (+15s, one per game)
- [x] Test ad IDs wired up (swap for real IDs before publishing)

### Phase 7 — Pause & Settings ✅
- [x] Pause button + Android back button handler
- [x] Pause menu: player name, sound toggle, leaderboards placeholder, quit
- [x] SettingsContext for player name + sound (separate from game state)
- [x] Back to Menu button on game over screen

### Phase 8 — Polish (TODO)
- [ ] Best score persistence (AsyncStorage)
- [ ] Leaderboards implementation
- [ ] Sound effects (wired to soundEnabled in SettingsContext)
- [ ] Animated timer bar smooth width transition
- [ ] Background crystal texture
- [ ] App icon + splash screen
- [ ] Google Play release build + signing config
