@AGENTS.md

# StarFuse — Project Context

A fast-paced Android tile fusion puzzle game. 60-second timer, tap-to-fuse mechanic, combo chains, power-ups, global leaderboard, rewarded ads.

## Stack
- React Native 0.85.3 / Expo SDK 56 (bare Android workflow)
- TypeScript, useReducer + Context for game state
- react-native-reanimated v4, react-native-gesture-handler, react-native-svg
- Firebase Firestore (leaderboard), react-native-google-mobile-ads (AdMob)
- EAS Build for production AAB

## Key IDs
- Package: `com.starfuse.app`
- Firebase project: `starfuse-765a0`
- AdMob App ID: `ca-app-pub-2747379081239953~6742457183`
- AdMob Rewarded unit: `ca-app-pub-2747379081239953/3746804355`
- EAS project: `@xavalenzuela/starfuse`

## Project Structure
- `App.tsx` — all screens (Home, Game, GameOver, PauseMenu) + shared LeaderboardModal
- `src/game/` — gameReducer.ts, gameContext.tsx, settingsContext.tsx, tileUtils.ts
- `src/services/` — firebase.ts, leaderboard.ts, ads.ts, audio.ts
- `src/components/` — Grid.tsx, Tile.tsx, LeaderboardModal.tsx
- `src/types/game.ts` — all TypeScript interfaces
- `scripts/` — generate-icons.js, generate-sounds.js, generate-store-assets.js
- `docs/` — privacy-policy.html, release-workflow.md (hosted via GitHub Pages)
- `android/` — bare native project, source tracked in git (build artifacts excluded)

## Rules
- Never use `crypto.randomUUID()` — not available in Hermes. Use Math.random()-based UUID v4.
- Tiles spawn immediately on fuse — never use deferred/queued spawn mechanisms.
- All audio via react-native-sound pool. `initAudio()` returns `Promise<void>`.
- Use `setDoc` upsert (not `addDoc`) for leaderboard — one doc per deviceId, best score only.
- `__DEV__` uses AdMob `TestIds.*` — production uses real unit IDs.
- Preload rewarded ad after `MobileAds().initialize()` for instant playback.
- Best score persisted via AsyncStorage key `@starfuse_best_score`.
- Settings persisted via AsyncStorage key `@starfuse_settings`.

## Running on Device
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$PATH:/Users/xaviervalenzuela/Library/Android/sdk/platform-tools"
adb connect <device-ip>:<port>   # port changes each session
adb reverse tcp:8081 tcp:8081
npm run android
```

## Building for Production
```bash
eas build --platform android --profile production --non-interactive
```
