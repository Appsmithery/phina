---
prd_id: PRD-2026-006
title: "Native Store Builds — Google Play and Apple App Store"
status: In progress
owner: TBD
area: Infrastructure
target_release: "v0.4"
roadmap: "../ROADMAP.md"
plans:
  claude: "../Plans/PRD-2026-006__claude-plan.md"
  android_gap_analysis: "../Plans/Google Play_Targeted Recommendations.md"
  ios_gap_analysis: "../Plans/Targeted iOS Gap Analysis.md"
---

# PRD-2026-006: Native Store Builds — Google Play and Apple App Store

> **Status:** 🛠 In progress
> **Priority:** P2 (Medium) — gated on developer account enrollment
> **Owner:** TBD
> **Target Release:** v0.4 (or when developer accounts are ready)
> See [planning guide](../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.

---

## Problem Statement

Phína is deployed as a PWA on Digital Ocean and can only be discovered by users who know the URL directly. Without App Store and Google Play listings, the app is invisible to users browsing wine apps, loses the native install experience and push reliability, and cannot use platform-specific capabilities (APNs for iOS push, Play billing for subscriptions). The EAS build and submit infrastructure is already configured; the blocking item is developer account enrollment and store-ready assets.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Stores with published listing | 0 | 2 (iOS + Android) | App Store Connect + Play Console status |
| First submission approval | — | Both approved on first review | No rejections |
| Internal testing group established | No | Yes (before App Review) | TestFlight + Play Internal Testing track active |
| Time from accounts active to first submission | — | < 2 weeks | Date tracking |

---

## Solution Overview

Use the existing EAS Build (`production` profile) and EAS Submit infrastructure already configured in `eas.json`. The main work is: (1) enroll developer accounts, (2) generate and back up signing credentials, (3) prepare store assets and listing copy, (4) populate the empty `submit.production` block in `eas.json`, and (5) follow a staged rollout through internal testing → optional beta → store review → production. Minimal code changes are required; the app is already store-ready in architecture.

### User Stories

- **As a potential user**, I want to find Phína in the App Store or Google Play so that I can install it without needing a URL.
- **As a host**, I want to invite members via an App Store link so that they can install with one tap from a familiar storefront.
- **As a developer**, I want a reproducible EAS build + submit workflow so that releasing a new version is a single command.

---

## Functional Requirements

### Core Features

1. **Apple App Store listing — live and approved**
   - App name: "Phína"
   - Bundle ID: `co.appsmithery.phina`
   - Category: Food & Drink
   - Age rating: 17+ (alcohol/tobacco content — set in App Store Connect)
   - Privacy policy URL: `https://phina.appsmithery.co/privacy` (already live)
   - Acceptance criteria: app visible and downloadable on the App Store

2. **Google Play listing — live and approved**
   - Same bundle ID, name, and category
   - Target API level: whatever EAS produces for the current Expo/React Native version (currently Android 14 / API 34)
   - Content rating: determined via Play Console questionnaire (will reflect alcohol content)
   - Acceptance criteria: app visible and downloadable on Google Play

3. **Internal testing before App Review**
   - TestFlight (iOS): internal group with team emails, no Apple review required
   - Google Play Internal Testing track: team emails added before any promotion
   - Acceptance criteria: at least one physical iOS device and one physical Android device run the production build end-to-end before submission

4. **Signed production builds via EAS**
   - iOS: distribution certificate + provisioning profile managed by EAS credentials
   - Android: upload keystore managed by EAS credentials; keystore file downloaded and backed up offline
   - Acceptance criteria: `eas build --platform all --profile production` completes without credential errors

5. **EAS Submit configured for both stores**
   - `eas.json` `submit.production` block populated (see Technical Context)
   - `eas submit --platform all --profile production` routes to the correct App Store Connect app and Google Play track
   - Acceptance criteria: EAS submit command completes and build appears in the store console

### Edge Cases & Error Handling

- **Icon has alpha channel:** Apple rejects 1024×1024 icons with transparency. Verify `phina_favicon.png` has no alpha before the first production build.
- **Google Sign-In in production build:** The iOS OAuth reversed client ID (`EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`) must be registered in Google Cloud Console for the production bundle ID. Failure mode: Google Sign-In silently fails or crashes on device.
- **APNs key missing:** Without an APNs key configured in EAS credentials, push notifications will not work in production iOS builds (Expo Go uses Expo's shared APNs key, but production builds need your own). Run `eas credentials` to set this up.
- **Android keystore lost:** If the upload keystore is lost after the first Play Store publication, Google Play cannot accept future updates to the same app — the only recovery is a new app listing. Back up immediately after first build.
- **App Review rejection:** Most common causes are pre-empted below in Implementation Guidance. If rejected, fix the cited issue and resubmit; review history is preserved.

---

## Technical Context

### Relevant Files & Directories

```
eas.json                                        — EAS build profiles + submit configuration
app.config.ts                                   — Bundle IDs, plugins, associated domains, icon paths, permission strings
phina_favicon.png                               — Source icon (verify 1024×1024, no alpha)
app/(tabs)/profile.tsx                          — Donation card hidden on iOS via Platform.OS check
app/privacy.tsx                                 — Privacy policy (already live at /privacy)
app/terms.tsx                                   — Terms of service (already live at /terms)
public/.well-known/apple-app-site-association   — AASA file for iOS universal links (Team ID placeholder — fill in post-enrollment)
```

### Key Dependencies

- `eas-cli` ≥ 18.0.4 — already specified in `eas.json`
- Apple Developer Program ($99/year) — not yet enrolled (**blocking**)
- Google Play Developer account ($25 one-time) — not yet enrolled (**blocking**)
- Google Play service account JSON key — needed for `eas submit` on Android
- APNs key — needed for production iOS push notifications (generated in Apple Developer portal)

### Database/Schema Changes

None.

### API Changes

None.

### Architecture Notes

- `app.config.ts` is already well-configured for production: correct bundle IDs, associated domains (`applinks:phina.appsmithery.co`), Android intent filters, `ITSAppUsesNonExemptEncryption: false` (skips encryption export compliance question), adaptive icon with `backgroundColor`, and `supportsTablet: false` (no iPad screenshots required).
- `eas.json` already has `"appVersionSource": "remote"` and `"autoIncrement": true` in the production profile — EAS manages version codes and build numbers automatically.
- The `submit.production` block currently reads `"production": {}` — it needs to be populated with credentials (see below). Credential values must **not** be committed to the repository.
- Google Play service account JSON key must be stored outside the repository. Reference it via a path in `eas.json` during local runs, or upload to EAS secrets for CI use.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `eas.json` | EAS build + submit config | ✅ Android submit block populated (`track: "internal"`, `serviceAccountKeyPath`); iOS stub added (credentials pending Apple account) |
| `app.config.ts` | Expo config | ✅ `runtimeVersion: { policy: "appVersion" }` added |

### `eas.json` submit block (fill in after accounts are active)

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "APPLE_ID_EMAIL",
      "ascAppId": "APP_STORE_CONNECT_NUMERIC_APP_ID",
      "appleTeamId": "10_CHAR_TEAM_ID"
    },
    "android": {
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "internal"
    }
  }
}
```

Where:
- `appleId` — the Apple ID email used to enroll in Apple Developer Program
- `ascAppId` — numeric App ID from App Store Connect (found after creating the app record under "My Apps → New App")
- `appleTeamId` — 10-character Team ID from Apple Developer → Account → Membership
- `serviceAccountKeyPath` — local path to the Google Play service account JSON key (add this file to `.gitignore`; **do not commit it**)

### Prerequisite Checklist (all blocking before EAS build)

#### Accounts
- [ ] Enroll Apple Developer Program ($99/yr) at developer.apple.com — allow 24–48h for identity verification
- [ ] Create Google Play Developer account ($25 one-time) at play.google.com/console — typically approved within hours

#### iOS credentials
- [ ] Run `eas credentials --platform ios --profile production` — EAS generates distribution certificate and provisioning profile
- [ ] Create an APNs key in Apple Developer → Certificates, Identifiers & Profiles → Keys (type: Apple Push Notifications service) — upload to EAS when prompted
- [ ] Create the app record in App Store Connect: My Apps → + → New App → iOS, name "Phína", bundle ID `co.appsmithery.phina`
- [ ] Note the numeric `ascAppId` from the URL once the record is created

#### Android credentials
- [ ] Run `eas build --platform android --profile production` (first time) — EAS generates the upload keystore automatically
- [ ] Immediately back up the keystore: `eas credentials --platform android --profile production` → download keystore file → store securely offline
- [ ] Create the app in Google Play Console: All apps → Create app → name "Phína", language English, app type "App", free
- [ ] Create a Google Play service account: Play Console → Setup → API access → link to a Google Cloud project → create service account with "Release Manager" role → download JSON key
- [x] Add `google-play-service-account.json` to `.gitignore`

#### Google Sign-In (production)
- [ ] In Google Cloud Console, add `co.appsmithery.phina` as an authorised bundle ID for the iOS OAuth 2.0 client
- [ ] Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` env var to the reversed client ID for this new client (format: `com.googleusercontent.apps.YOUR_CLIENT_ID`)
- [ ] Ensure the Android OAuth client also lists `co.appsmithery.phina` as an authorised package name with the correct SHA-1 certificate fingerprint (obtainable from EAS after the first build)

### App Store Assets Checklist

#### App icon
- [ ] Verify `phina_favicon.png` is exactly **1024×1024 px** with **no alpha channel** (Apple rejects transparent icons)
- If the current file has transparency: export a flat version with the app background colour (`#F2EFE9` or similar) filled behind it

#### iOS screenshots (required for App Store submission)
- [ ] At least 3 screenshots at iPhone 6.9" display: **1320×2868 px** (iPhone 16 Pro Max)
- Suggested screens: Events list, Wine detail (with AI notes), Rating round screen
- Take via Simulator: Device → iPhone 16 Pro Max → Command+S

#### Android screenshots
- [ ] 2–8 screenshots, 9:16 ratio, minimum **1080px on the short side** (e.g. 1080×1920)
- [ ] Feature graphic: **1024×500 px** (shown at the top of the Play Store listing)
- Take via Android Emulator or physical device

#### Store listing copy (prepare before submission)

| Field | Content |
|-------|---------|
| App name | Phína |
| Short description (Google, ≤80 chars) | Host wine club tastings — QR join, AI label scan, live blind ratings. |
| Keywords (Apple, ≤100 chars total) | wine,tasting,club,events,rating,cellar,blind tasting,sommelier |
| Category | Food & Drink |
| Support URL | https://phina.appsmithery.co |
| Privacy policy URL | https://phina.appsmithery.co/privacy |
| Full description | See draft below |

**Full description draft (use for both stores, adapt as needed):**

> Phína digitises wine club tasting events so hosts and members can focus on the wine, not the paperwork.
>
> Host a tasting: create an event, show the QR code, and members join instantly on their phones — no sign-in sheet, no manual list.
>
> Add wines with a photo: point the camera at the bottle label and let AI extract the producer, varietal, vintage, region, and tasting notes. Review and confirm — done in seconds.
>
> Run blind rating rounds: the host starts a round, members receive a notification and rate each wine (👍 / 😐 / 👎) without seeing anyone else's vote. When the host ends the event, anonymous aggregates are revealed to everyone.
>
> Build your cellar: log wines outside events, rate them anytime, and build a personal collection over time.
>
> Browse history: search past events by producer, varietal, vintage, or theme.

### Implementation Constraints

- DO NOT commit the Google Play service account JSON key, any Apple certificates, or any EAS secrets to the repository
- DO NOT change the bundle identifier `co.appsmithery.phina` after any version of the app has been published to either store — this would require a new app record and lose all reviews and ratings
- DO NOT use `--clear-cache` in EAS builds unless specifically debugging a build failure — it rebuilds the native layer unnecessarily
- MUST back up the Android keystore before promoting any build to production — losing it means the app can never be updated in the Play Store

### Verification Commands

```bash
# Confirm EAS CLI version meets minimum
eas --version
# Expected: >= 18.0.4

# Validate app.config.ts before building
npx expo config --type introspect

# Build production for both platforms (triggers EAS credential prompts on first run)
eas build --platform all --profile production

# Submit to both stores (internal testing track)
eas submit --platform all --profile production

# Alternative: build + auto-submit in one command
eas build --platform all --profile production --auto-submit
```

### Decisions Made

- [x] **Submission target:** Internal Testing (TestFlight + Google Play Internal) before App Review — staged rollout reduces rejection risk
- [x] **Android keystore management:** EAS-managed (not local) — reduces credential complexity; back up immediately after first build
- [x] **iOS credential management:** EAS-managed — EAS generates and refreshes distribution certificates automatically
- [x] **Age rating:** 17+ (alcohol content) on both stores — accurate and expected for a wine app
- [x] **`runtimeVersion`:** `{ policy: "appVersion" }` — safe default for future OTA support
- [x] **Version source:** `"appVersionSource": "remote"` already set — EAS manages version/build numbers automatically

---

## Implementation Guidance

### Suggested Approach

**Phase 0 — Accounts and credentials (1–7 days, blocking)**
1. Enroll Apple Developer Program; wait for identity verification
2. Create Google Play Developer account
3. Run `eas credentials` for iOS after Apple account is active
4. Create app records in App Store Connect and Google Play Console
5. Generate Google Play service account JSON key
6. Back up Android keystore after first production build

**Phase 1 — Internal testing (1–3 days)**
7. Run `eas build --platform all --profile production`
8. Run `eas submit --platform all --profile production`
9. Add team to TestFlight internal group (App Store Connect → TestFlight → Internal Testing → add emails)
10. Add team to Google Play Internal Testing (Play Console → Testing → Internal Testing → add emails)
11. Install on physical devices; test full flow: sign in, join event, scan label, rate, view cellar
12. Verify: deep links work, push notifications arrive, Google Sign-In works

**Phase 2 — Closed beta (optional, 1 week)**
13. iOS: add external testers to TestFlight (up to 10,000; requires brief Apple review ~24h)
14. Android: promote to Closed Testing (Alpha) track

**Phase 3 — Store review**
15. Complete App Store Connect listing: screenshots, description, keywords, age rating, pricing (Free)
16. Complete Google Play listing: same assets
17. Submit for App Review (iOS) and Google Play review (24–72h each)

**Phase 4 — Production release**
18. iOS: approve the build in App Store Connect → "Release this version"
19. Android: roll out to Production (start at 10% phased rollout, expand to 100%)

### Testing Requirements

- [ ] Full app flow on a physical iOS device running the production EAS build (not Expo Go)
- [ ] Full app flow on a physical Android device running the production EAS build
- [ ] Google Sign-In tested with the production OAuth client ID (not the development one)
- [ ] Push notification received on physical iOS device (APNs, not Expo shared key)
- [ ] Deep link `https://phina.appsmithery.co/join/[eventId]` opens the native app on both platforms
- [ ] Camera permission denial handled gracefully (no crash)
- [ ] App works fully offline for viewed content (no crash on network loss)

### Common App Review Rejection Causes (pre-empt these)

- **Age rating not set to 17+:** Set in App Store Connect → App Information → Age Rating → add "Frequent/Intense" for Alcohol, Tobacco
- **Privacy policy not accessible without login:** `app/privacy.tsx` is a public route — confirm it renders without auth
- **Broken features in review build:** Ensure the App Review team can create an account and join a test event; consider adding reviewer credentials to app metadata notes
- **Missing camera permission description:** `NSCameraUsageDescription` is already set in `app.config.ts` via the `expo-camera` plugin — verify the string is meaningful
- **Icon with alpha channel:** Pre-empted by the asset checklist above

### Out of Scope

- App Store Optimization (ASO) — keyword research, A/B testing of store listing
- In-app purchases via StoreKit / Google Play Billing (subscription payments will use a separate payment provider per PRD-2026-007 when written)
- iPad-specific layout (supportsTablet is false)
- macOS / tvOS / watchOS builds

---

## Design & UX

No new in-app UI. Store listing assets (screenshots, feature graphic, icon) to be created by the owner of this PRD.

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 0 | Accounts + credentials | Internal | Developer accounts active; credentials generated and backed up |
| 1 | Internal testing | Team (≤100 testers) | Full flow works on physical device; no critical bugs |
| 2 | Closed beta (optional) | Extended testers | No new crash reports for 1 week |
| 3 | App Review | Apple + Google reviewers | Both stores approve on first submission |
| 4 | Production | All users | App live and downloadable in both stores |

### Feature Flags

None — this is a distribution milestone, not a feature flag scenario.

---

## Open Questions

- [ ] Are Apple Developer Program and Google Play Developer accounts enrolled? (Blocking gate)
- [ ] Individual vs. Organization Apple account? Organisation requires D-U-N-S number (5–10 day lead time through Dun & Bradstreet) — decide before enrolling.
- [ ] Is `phina_favicon.png` 1024×1024 with no alpha? (Needs manual verification via ImageMagick or similar before first build)
- [ ] Has the iOS Google OAuth client been created for the production bundle ID in Google Cloud Console?
- [ ] Has the Android OAuth 2.0 client been updated with the EAS keystore SHA-1? (Can only be done after first production build)
- [ ] Should the personal cellar / subscription feature be completed before first App Store submission? (Recommended: yes — adding subscription billing post-launch requires updated App Privacy declarations and may trigger re-review)
- [ ] AASA file `PLACEHOLDER_TEAM_ID` — fill in 10-character Team ID from Apple Developer → Account → Membership once enrolled, then configure nginx `Content-Type: application/json` and verify at Apple CDN.

---

## References

- [Android Gap Analysis — Google Play Targeted Recommendations](../Plans/Google%20Play_Targeted%20Recommendations.md)
- [iOS Gap Analysis — Targeted iOS Gap Analysis](../Plans/Targeted%20iOS%20Gap%20Analysis.md)
- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit docs](https://docs.expo.dev/submit/introduction/)
- [EAS Credentials docs](https://docs.expo.dev/app-signing/managed-credentials/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [ROADMAP.md](../ROADMAP.md)
- [System Architecture](../../architecture/system-architecture.md)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-01 | Claude | Initial draft — prerequisite checklist, EAS submit config, staged rollout, store asset requirements |
| 2026-03-01 | Claude | Code prep (Android): `runtimeVersion: { policy: "appVersion" }` added to `app.config.ts`; `google-play-service-account.json` added to `.gitignore`; `eas.json` android submit block populated (`track: "internal"`); iOS submit stub added (credentials pending Apple account) |
| 2026-03-01 | Claude | Code prep (iOS): `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` added to `ios.infoPlist` in `app.config.ts`; donation card hidden on `Platform.OS === 'ios'` in `profile.tsx` to avoid App Store Guideline 3.1.1 rejection; `public/.well-known/apple-app-site-association` AASA file created (Team ID placeholder — fill in post-enrollment); cellar/subscription completion noted as pre-submission gate |
