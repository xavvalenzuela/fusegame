# Android Release Workflow — StarFuse

A repeatable checklist for each release, from first build to Play Store production.

---

## Phase 1 — Assets & Branding

### App Icon
- [ ] Run `node scripts/generate-icons.js` to regenerate all mipmap densities
- [ ] Output: `android/app/src/main/res/mipmap-*/ic_launcher*.png` (all densities + adaptive layers)
- [ ] Verify icon appears correctly after a fresh install on device

### Splash Screen
- [ ] Run `node scripts/generate-icons.js` (same script generates splash logos)
- [ ] Output: `android/app/src/main/res/drawable-*/splashscreen_logo.png`
- [ ] Background color set in `android/app/src/main/res/values/colors.xml` → `splashscreen_background`

### Play Store Assets
- [ ] Run `node scripts/generate-store-assets.js`
- [ ] Output: `assets/icon-512.png` (512×512 — Play Store icon)
- [ ] Output: `assets/feature-1/2/3.png` (1024×500 — choose one as feature graphic)
- [ ] Screenshots: take 5–6 on a real device (portrait, full resolution)
  - Home screen with boost buttons
  - Mid-game with tiles + combo counter active
  - Star tile visible on grid
  - Score popup after a chain
  - Game over screen with score
  - Leaderboard global tab

---

## Phase 2 — Services & Config

### Firebase / Firestore
- [ ] Confirm Firestore database exists in Firebase console (project: `starfuse-765a0`)
- [ ] Security rules allow read/write to `leaderboard` collection
- [ ] `src/services/firebase.ts` — real project config in place (not placeholder)

### AdMob
- [ ] App registered in AdMob console under package `com.starfuse.app`
- [ ] Rewarded ad unit created and ID set in `src/services/ads.ts`
- [ ] App ID set in `android/app/src/main/AndroidManifest.xml` and `app.json` plugins
- [ ] Current IDs:
  - App ID: `ca-app-pub-2747379081239953~6742457183`
  - Rewarded unit: `ca-app-pub-2747379081239953/3746804355`

---

## Phase 3 — Legal

### Privacy Policy
- [ ] Hosted at: `https://xavvalenzuela.github.io/fusegame/privacy-policy.html`
- [ ] Contact email: `SabunotApps@gmail.com`
- [ ] Covers: display name, device ID, game scores, AdMob, Firebase
- [ ] Update "Last updated" date for each release with data collection changes

---

## Phase 4 — Build

### Version Bump (each release)
- [ ] Bump `versionCode` (integer, increment by 1) in `android/app/build.gradle`
- [ ] Bump `versionName` (e.g. `"1.0.1"`) in `android/app/build.gradle`
- [ ] Update `version` in `app.json`

### EAS Production Build
```bash
eas build --platform android --profile production --non-interactive
```
- [ ] Build type: `app-bundle` (AAB) — required for Play Store
- [ ] Keystore managed by Expo (EAS) — no local keystore needed
- [ ] Download AAB from the EAS build URL when complete

---

## Phase 5 — Play Store Setup (first release only)

### Create App
1. Play Console → **Create app**
2. App name: `StarFuse`
3. Default language: English (United States)
4. App or game: **Game**
5. Free or paid: **Free**

### Store Listing
- **App name:** StarFuse
- **Short description:** Fuse tiles, chain combos & beat the clock. Fast puzzle action!
- **Full description:** *(see below)*
- **Icon:** `assets/icon-512.png` (512×512 PNG)
- **Feature graphic:** choose from `assets/feature-1/2/3.png` (1024×500)
- **Screenshots:** minimum 2, recommended 6 (see Phase 1)

#### Full Description
```
StarFuse is a fast-paced tile fusion puzzle game. You have 60 seconds — tap tiles to 
select them, fuse matching pairs, and chain combos to send your score through the roof.

🌟 FUSE & CHAIN
Match tiles of the same type to fuse them. Chain multiple fuses together to build your 
combo multiplier and rack up massive points.

⭐ STAR TILES
Fuse your way to a star tile — the rarest and most powerful fusion. Star tiles trigger 
a time bonus and spawn two new tiles, keeping the grid alive and the action going.

⚡ PRE-GAME BOOSTS
Watch a short ad before the game starts to unlock a boost — extra time, a score 
multiplier, or a head start combo. Your call.

🔄 CONTINUE
When time runs out, you get one chance to continue and keep your score alive. Use it wisely.

🏆 LEADERBOARD
Submit your best score and compete globally. Can you top the board?

Simple to pick up. Hard to put down. How high can you score in 60 seconds?
```

---

## Phase 6 — Dashboard Questions & Compliance

### App Content
- **Target age group:** Everyone / 10+
- **Contains ads:** Yes (rewarded video via AdMob)
- **Ad type:** Rewarded (user-initiated only)

### Data Safety
| Question | Answer |
|---|---|
| Does your app collect or share data? | **Yes** |
| All data encrypted in transit? | **Yes** |
| Users can request deletion? | **Yes** (email SabunotApps@gmail.com) |

**Data types to declare:**

| Type | Collected | Shared | Ephemeral | Required |
|---|---|---|---|---|
| Name (display name) | ✓ | ✓ (public leaderboard) | No | Optional |
| Other user-generated content (score) | ✓ | ✓ (public leaderboard) | No | Optional |
| Device or other IDs (UUID) | ✓ | No | No | Required |
| Advertising ID | ✓ | ✓ (AdMob/Google) | No | Required |

**Deletion request URL:** `https://xavvalenzuela.github.io/fusegame/privacy-policy.html`

### Content Rating Questionnaire
- Violence: None
- Sexual content: None
- Profanity: None
- Controlled substances: None
- → Expected rating: **Everyone (E)**

### Pricing & Distribution
- Price: Free
- Countries: All available
- Contains ads: Yes

---

## Phase 7 — Release

### Closed Testing (first)
1. Play Console → Testing → **Closed testing** → Create new release
2. Upload AAB
3. Add testers (email list or Google Group)
4. Submit for review (~1–3 days)

### Open Testing (optional)
1. Play Console → Testing → **Open testing** → Create new release
2. Promote from closed or upload new AAB
3. Anyone can join via opt-in link

### Production Release
1. Play Console → **Production** → Create new release
2. Promote from open testing or upload new AAB
3. Set rollout percentage (start at 20% recommended)
4. Submit for review (~3–7 days first release)

### Release Notes (every release)
Write in Play Console under "What's new in this release":
```
[version x.x.x]
- Brief bullet points of what changed
- Keep it user-facing (new features, fixes, improvements)
- Max ~500 chars
```

Example for v1.0.0:
```
Initial release of StarFuse!

• 60-second tile fusion puzzle gameplay
• Star tile power-ups and combo chains
• Global leaderboard
• Pre-game boosts via rewarded ads
• Dark purple cosmic theme
```

---

## Phase 8 — Post-Release

- [ ] Monitor Play Console → **Android vitals** for crashes
- [ ] Check Firebase console for Firestore errors
- [ ] Monitor AdMob dashboard for ad impressions / revenue
- [ ] Respond to reviews in Play Console
- [ ] Revoke and rotate any exposed API keys or tokens immediately

---

## Quick Reference — Key IDs & URLs

| Item | Value |
|---|---|
| Package name | `com.starfuse.app` |
| Firebase project | `starfuse-765a0` |
| AdMob App ID | `ca-app-pub-2747379081239953~6742457183` |
| AdMob Rewarded unit | `ca-app-pub-2747379081239953/3746804355` |
| Privacy policy URL | `https://xavvalenzuela.github.io/fusegame/privacy-policy.html` |
| EAS project | `@xavalenzuela/starfuse` |
| GitHub repo | `https://github.com/xavvalenzuela/fusegame` |
| Contact email | `SabunotApps@gmail.com` |
