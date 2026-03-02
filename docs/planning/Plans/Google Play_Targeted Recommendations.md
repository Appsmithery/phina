## Phína → Google Play: Targeted Recommendations Based on Your Repo

You have a remarkably well-prepared PRD (`PRD-2026-006`) that already covers the canonical checklist. Here's an honest gap analysis of what's actually missing or risky given the current state of the repo:[^1]

***

### ✅ What's Already In Great Shape

- `app.config.ts` is correctly configured: `android.package: "co.appsmithery.phina"`, adaptive icon, `intentFilters` with `autoVerify: true`, and the `autoIncrement: true` + `appVersionSource: "local"` in `eas.json`[^2][^3]
- `eas.json` has a `production` profile, `submit.production` stub, and `eas-cli >= 18.0.4` pinned[^3]
- Expo SDK 54 / RN 0.81.5 → targets Android 14 (API 34), which meets Play's current target API requirement[^4]
- `newArchEnabled: true` is set — good future-proofing[^2]
- Privacy policy (`/privacy`) and Terms (`/terms`) already live as public routes — critical for Play review

***

### 🔴 Hard Blockers (Nothing moves without these)

1. **Google Play Developer account not enrolled** — \$25 one-time fee at [play.google.com/console](https://play.google.com/console). Approval is usually same-day. This is the single gate blocking everything else for Android.[^1]
2. ~~**`submit.production.android` block in `eas.json` is empty `{}`**~~ ✅ **Done** — `eas.json` android submit block populated with `track: "internal"` and `serviceAccountKeyPath: "./google-play-service-account.json"`. iOS stub also added (credentials pending Apple account enrollment).
3. **Google Play service account JSON key doesn't exist yet** — After enrolling, go to Play Console → Setup → API access → link a Google Cloud project → create a service account → grant it **"Release Manager"** role → download the JSON key. ~~Do **not** commit it; add it to `.gitignore` immediately.~~ ✅ `.gitignore` entry already added.

***

### 🟡 Pre-Build Issues to Resolve Before Running EAS

4. **`phina_favicon.png` alpha channel** — Your icon is used as both the launcher icon (`foregroundImage`) and the adaptive icon source. Google Play itself doesn't block alpha on adaptive icons (the `backgroundColor: "#ffffff"` handles the background layer), but **verify the raw PNG dimensions are at least 1024×1024**. Run:

```bash
identify phina_favicon.png   # ImageMagick
# or
file phina_favicon.png
```

If it's not at least 1024×1024, Play Console will reject the hi-res icon upload.[^1]
5. **Android OAuth client SHA-1 fingerprint not yet registered** — Your Google Sign-In (`@react-native-google-signin/google-signin ^16.1.1`) works in development via Expo Go's shared key. For production, you must add the **SHA-1 of the EAS-generated keystore** to the Android OAuth 2.0 client in Google Cloud Console. You can't do this until after the first `eas build --platform android --profile production` run. Workflow:

```bash
eas build --platform android --profile production
# After build completes:
eas credentials --platform android --profile production
# Download keystore → extract SHA-1 → add to Google Cloud Console OAuth client
```

Without this, Google Sign-In will silently fail on the production Android build.[^1]
6. ~~**`runtimeVersion` not set in `app.config.ts`**~~ ✅ **Done** — `runtimeVersion: { policy: "appVersion" }` added to `app.config.ts`.


***

### 🟡 Play Console Setup Steps (After Account Approved)

7. **Create the app record first, before submitting** — Go to Play Console → All apps → Create app → name "Phína", language English, app type "App", free. The `applicationId` in the first uploaded AAB must match `co.appsmithery.phina`. Once published, this ID is permanent.
8. **Data safety form** — Google Play now requires a mandatory **Data Safety section** to be completed before any release can go to review (not just production — even internal testing requires it to be at least in draft). For Phína, you'll need to declare:
    - Email address (collected for auth)
    - Photos/images (camera for label scan)
    - Push token (for notifications)
    - Analytics data (PostHog)[^4]

This form is in Play Console → App content → Data safety. It takes ~30 min and is a common cause of delays people don't anticipate.
9. **Content rating questionnaire** — Required before any promotion beyond Internal Testing. For a wine app, answer "yes" to alcohol content — you'll get a 17+ equivalent rating on Play (PEGI 18 or "Mature" depending on region). This is expected and fine.[^1]
10. **Target audience** — Since alcohol is involved, confirm "18+" in the Target audience section to avoid policy flags.

***

### 🟡 Android-Specific Things the PRD Mentions but Worth Calling Out

11. **Keystore backup is critical and often forgotten** — The EAS-managed keystore lives in Expo's cloud, but you should immediately download it after the first production build:

```bash
eas credentials --platform android --profile production
# Choose: Download keystore
```

Store it in a password manager or encrypted offline backup. Losing it means you can never push updates to the same Play listing.[^1]
12. **Play Console requires a phone number verification** during initial account setup — have your phone handy when enrolling.
13. **Feature graphic is required for Play Store listing** — 1024×500 px, not optional. This is separate from screenshots. Given the Phína brand guidelines are already documented, this should be straightforward to create, but it's easy to forget and will block the listing publication step.[^5]

***

### 🟢 Nice-to-Haves That Will Smooth the Review Process

14. **Add reviewer test credentials to the submission notes** — When submitting for Play review, add a note in the "App access" section explaining: "App requires creating an account via email/password or Google Sign-In. Event joining requires scanning a QR code generated by a host." Optionally provide a test host account with a pre-created event. This prevents "we couldn't test core features" rejections.
15. **Start at the Internal Testing track** (which your `eas.json` correctly targets with `"track": "internal"`) — this lets you validate the production build on real devices before committing to a full review cycle.[^3]

***

### Sequenced Action List for Android Only

| \# | Action | When | Status |
| :-- | :-- | :-- | :-- |
| 1 | Enroll Google Play Developer account (\$25) | Today | ⏳ Pending |
| 2 | Create app record in Play Console | After account approved | ⏳ Pending |
| 3 | Create Google Cloud service account, download JSON key to repo root | After Play Console access | ⏳ Pending |
| 4 | ~~Add `runtimeVersion` to `app.config.ts`~~ | ~~Before build~~ | ✅ Done |
| 5 | Run `eas build --platform android --profile production` | After account + config ready | ⏳ Pending |
| 6 | **Immediately back up the keystore** | Right after first build | ⏳ Pending |
| 7 | Extract SHA-1 → register in Google Cloud Console Android OAuth client | After first build | ⏳ Pending |
| 8 | ~~Populate `eas.json` android submit block~~ | ~~Before submit~~ | ✅ Done |
| 9 | Run `eas submit --platform android --profile production` | After build + submit config | ⏳ Pending |
| 10 | Complete Data Safety + Content Rating + Target Audience in Play Console | Before promoting beyond Internal | ⏳ Pending |
| 11 | Prepare screenshots (1080×1920 min) + feature graphic (1024×500) | Before Play review | ⏳ Pending |
| 12 | Submit for Play review | After Internal Testing passes | ⏳ Pending |

The biggest practical surprise in this process is usually **step 3 (service account setup)** — it involves navigating Play Console → Google Cloud Console IAM and is not as obvious as it sounds. Budget 30–45 minutes for that step.

<div align="center">⁂</div>

[^1]: https://github.com/Appsmithery/phina/blob/main/docs/planning/PRDs/PRD-2026-006__native-store-builds.md

[^2]: https://github.com/Appsmithery/phina/blob/main/app.config.ts

[^3]: https://github.com/Appsmithery/phina/blob/main/eas.json

[^4]: https://github.com/Appsmithery/phina/blob/main/package.json

[^5]: https://github.com/Appsmithery/phina/blob/main/docs/planning/ROADMAP.md

