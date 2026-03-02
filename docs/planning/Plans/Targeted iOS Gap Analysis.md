## Phína → Apple App Store: Targeted iOS Gap Analysis

Having reviewed `app.config.ts`, `eas.json`, `package.json`, `GOOGLE_OAUTH_SETUP.md`, `PRD-2026-006`, `profile.tsx`, and the CI workflow, here's the full iOS-specific picture — including several gaps the PRD doesn't catch.

***

### 🔴 Hard Blockers

#### 1. Apple Developer Program not enrolled — and individual vs. org matters for you

The PRD notes this but doesn't flag the D-U-N-S number issue prominently enough: if you want to publish under **"Appsmithery"** as the developer name (not your personal name), you need an **Organization account**, which requires a D-U-N-S number. Applying for a D-U-N-S can take **5–10 business days** through Dun \& Bradstreet. If you're fine with your personal name appearing in the App Store, an Individual account (\$99/yr) is faster (approved in 24–48h after identity verification). Decide this now — it's the single longest lead-time item.[^1]

#### 2. ~~The donation feature (Stripe payment links) will get the app rejected~~ ✅ Done

~~This is the most significant gap not covered in the PRD.~~ The donation card in `profile.tsx` is now completely hidden on `Platform.OS === 'ios'`. It remains visible on Android and web. If/when a native IAP path is built (PRD-2026-007 or similar), this can be revisited.

#### 3. `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` must be set as an EAS secret before the iOS production build

Your `app.config.ts` conditionally includes the `@react-native-google-signin/google-signin` plugin only when `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` is set:[^3]

```ts
...(iosUrlScheme
  ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]]
  : []),
```

If this env var is missing at EAS build time, the native Google Sign-In plugin will **not be compiled in**, and the production iOS build will fall back to browser OAuth. You need to:

1. Create the iOS OAuth client in Google Cloud Console (Application type: **iOS**, Bundle ID: `co.appsmithery.phina`) first
2. Run `eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME --value com.googleusercontent.apps.YOUR_IOS_CLIENT_ID`
3. Confirm the build logs show the plugin being applied

***

### 🟡 Pre-Build Issues to Resolve

#### 4. App icon has no alpha channel verification — Apple is stricter than Google

Your `icon` in `app.config.ts` points to `./phina_favicon.png`. Apple **rejects 1024×1024 icons with any transparency** at upload time in App Store Connect — there is no warning, just a hard rejection. The adaptive icon for Android uses `backgroundColor: "#ffffff"` as a fallback layer, but the iOS icon path uses the raw favicon file which may have a transparent background. Run this before building:[^3]

```bash
python3 -c "from PIL import Image; img = Image.open('phina_favicon.png'); print(img.mode, img.size)"
```

If the mode is `RGBA` and the alpha channel has values < 255, flatten it:

```bash
convert phina_favicon.png -background "#F2EFE9" -flatten -resize 1024x1024 phina_icon_ios.png
```

Then update `app.config.ts` to use separate icon paths for iOS vs. the adaptive icon for Android.

#### 5. APNs key is not yet created — push notifications will be silent in production iOS builds

Your app uses `expo-notifications ~0.32.16` for push notifications (rating rounds). Expo Go uses Expo's shared APNs key. Production EAS iOS builds need **your own APNs key** from the Apple Developer portal. Without it, `expo-notifications` registers successfully but pushes never arrive on device. Steps:[^4]

1. Apple Developer → Certificates, Identifiers \& Profiles → Keys → "+" → select "Apple Push Notifications service (APNs)"
2. Download the `.p8` file — **you can only download it once**
3. Run `eas credentials --platform ios --profile production` and upload the APNs key when prompted
4. Note your Key ID and Team ID

This is different from the distribution certificate/provisioning profile — it's a separate credential that EAS credentials won't auto-generate.

#### 6. ~~`runtimeVersion` not in `app.config.ts`~~ ✅ Done

`runtimeVersion: { policy: "appVersion" }` is now set in `app.config.ts`.

#### 7. ~~`eas.json` submit block needs the iOS fields populated~~ ✅ Partial

An iOS stub (`appleId: ""`, `ascAppId: ""`, `appleTeamId: ""`) is now in `eas.json`. Fill in the values after creating the app record in App Store Connect (post-enrollment).

***

### 🟡 App Store Connect Setup (After Enrollment)

#### 8. Create the App Record before building

Go to App Store Connect → My Apps → "+" → New App → select iOS, set:

- Name: "Phína" (the accent is fine and distinctive — good for searchability)
- Bundle ID: `co.appsmithery.phina` (must match `app.config.ts` exactly)
- SKU: something like `phina-001` (internal identifier, never shown to users)
- Primary Language: English (U.S.)


#### 9. Age Rating — the questionnaire has a specific alcohol question

In App Store Connect → App Information → Age Rating → "Set Age Rating" — you'll answer a questionnaire. You must select **"Frequent/Intense"** for the "Alcohol, Tobacco, or Drug Use or References" category. This yields a **17+** rating, which is expected and correct for Phína. Don't try to select a lower tier — if reviewers see wine content and find the rating is 12+, they'll reject it and require you to resubmit with the correct rating.

#### 10. Privacy Nutrition Labels (App Privacy in App Store Connect)

Apple's App Privacy section is the iOS equivalent of Google's Data Safety form. For Phína, you'll need to declare data collected from users:


| Data Type | Category | Use | Linked to Identity? |
| :-- | :-- | :-- | :-- |
| Email Address | Contact Info | App Functionality, Analytics | Yes |
| Name | Contact Info | App Functionality | Yes |
| Photos/Video | Media | App Functionality (label scan) | No |
| Crash Data | Diagnostics | Analytics (Sentry) | No |
| Usage Data | Analytics | Analytics (PostHog) | No |

The fact that your Supabase anon key is embedded in the app bundle (intentionally, as your README notes — RLS enforces security) doesn't require a separate declaration, but the data collected through the app does. Leave ~45 minutes for this section.[^6]

#### 11. ~~`NSCameraUsageDescription` — verify the string is user-facing and meaningful~~ ✅ Done

Both strings are now explicitly set in `app.config.ts` `ios.infoPlist`:
- `NSCameraUsageDescription` — "Phína uses your camera to scan wine bottle labels and extract wine details automatically."
- `NSPhotoLibraryUsageDescription` — "Phína lets you select a photo from your library to update a wine's label image." (`expo-image-picker` is actively used in `app/wine/[wineId]/edit.tsx`)

***

### 🟡 TestFlight-Specific Steps (Internal Testing Before Review)

#### 12. CI workflow doesn't include an EAS build job

Your `ci.yml` runs typecheck/lint/test and deploys the PWA to DigitalOcean, but there's no `eas build` job. This is fine for now (you'd trigger EAS builds manually), but when you're ready to automate, you'll need to add `EXPO_TOKEN` to GitHub Actions secrets (it's already listed as a comment in `.env.example`) and a separate workflow:[^7][^6]

```yaml
- name: EAS Build iOS Production
  run: eas build --platform ios --profile production --non-interactive
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```


#### 13. TestFlight internal testing requires no Apple review — do this first

Add your team to TestFlight: App Store Connect → Your App → TestFlight → Internal Testing → "+" → add Apple IDs. Internal testers must have an Apple Developer account associated with your team. Up to 100 internal testers, no review required, builds appear within minutes of upload. Before submitting for App Review, validate the full flow on physical iPhone — especially:

- Push notifications arriving from APNs (not Expo's shared key)
- Deep link `https://phina.appsmithery.co/join/[eventId]` opening the native app (not Safari)
- Google Sign-In showing the native account picker sheet (not an in-app browser)
- Camera permission prompt is meaningful and doesn't crash on deny

***

### 🟡 App Review Gotchas Specific to iOS (Beyond What the PRD Covers)

#### 14. Demo account / demo event required in App Review notes

Phína's core loop (join event → scan label → rate) requires scanning a QR code at a physical venue. Apple reviewers cannot attend your wine club. You **must** either:

- Provide a pre-created test event with a known `eventId` and include the direct join URL in the "Notes for App Review" section
- Or add a "Demo mode" bypass in the join screen that populates a test event without QR scanning

Without this, reviewers will hit a dead end at the "scan QR code at the venue" step and reject for "unable to review core functionality."

#### 15. Magic link auth needs a fallback reviewers can use

App Review notes should include email/password credentials for a test account. Magic links go to email, which reviewers won't have access to. Since you have email + password auth (`sign-in.tsx`), provide those credentials explicitly.[^8]

#### 16. Associated Domains (`applinks:phina.appsmithery.co`) requires AASA file verification — ✅ Partial

`public/.well-known/apple-app-site-association` has been created and will be deployed via the existing rsync CI pipeline to `/var/www/phina/.well-known/apple-app-site-association`. **Remaining steps after Apple Developer enrollment:**

1. Replace `PLACEHOLDER_TEAM_ID` with the 10-character Team ID from Apple Developer → Account → Membership
2. Configure nginx to serve the file with `Content-Type: application/json` (it has no extension so nginx defaults to `application/octet-stream` — Apple's CDN will reject that). Add to the nginx site config:
   ```nginx
   location = /.well-known/apple-app-site-association {
     default_type application/json;
   }
   ```
3. Deploy and verify at `https://app-site-association.cdn-apple.com/a/v1/phina.appsmithery.co`

If this file is missing or misconfigured, universal links silently fall back to opening in Safari — QR code joins won't open the native app.

***

### Sequenced iOS Action List

| \# | Action | When | Status |
| :-- | :-- | :-- | :-- |
| 1 | Decide: Individual vs. Organization Apple account. Apply for D-U-N-S if Org. | Today | ⏳ Pending |
| 2 | Enroll Apple Developer Program (\$99/yr) | After D-U-N-S (if Org) or immediately (if Individual) | ⏳ Pending |
| 3 | ~~Disable donation UI on `Platform.OS === 'ios'`~~ | ~~Before build~~ | ✅ Done |
| 4 | ~~Add `runtimeVersion`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` to `app.config.ts`~~ | ~~Before build~~ | ✅ Done |
| 5 | Create iOS OAuth client in Google Cloud Console → set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` as EAS secret | After Developer account active | ⏳ Pending |
| 6 | Create APNs key in Apple Developer portal → upload to EAS credentials | After Developer account active | ⏳ Pending |
| 7 | Create app record in App Store Connect → fill `ascAppId` + `appleTeamId` in `eas.json` stub | After Developer account active | ⏳ Pending (stub added) |
| 8 | Verify `phina_favicon.png` is 1024×1024, no alpha — fix and use as iOS-only icon if needed | Before first build | ⏳ Pending |
| 9 | ~~Create AASA file structure~~ / Fill in Team ID + configure nginx `Content-Type` + verify at Apple CDN | After Developer account active | ✅ Partial (file created, Team ID placeholder) |
| 10 | Complete personal cellar / subscription feature before submitting (see note below) | Before App Review | ⏳ Pending |
| 11 | Run `eas build --platform ios --profile production` | After steps 1–9 | ⏳ Pending |
| 12 | Add team to TestFlight Internal Testing → install on physical iPhone | After build | ⏳ Pending |
| 13 | Complete App Privacy (nutrition labels) + Age Rating (17+) in App Store Connect | Before App Review | ⏳ Pending |
| 14 | Prepare screenshots (iPhone 6.9" / 1320×2868 px, min 3) | Before App Review | ⏳ Pending |
| 15 | Add reviewer test credentials + direct join URL to App Review notes | Before submitting | ⏳ Pending |
| 16 | Submit for App Review | After TestFlight validated | ⏳ Pending |

> **Note on step 10 — Personal cellar / subscription feature:** Submit to the App Store only after the cellar and subscription features are complete. Adding subscription billing (IAP or otherwise) after an initial submission requires updating the App Privacy declarations and may trigger re-review. It's cleaner to ship with those features in place or explicitly removed for v1.

The biggest iOS-specific surprise is the **AASA file** (step 9, nginx config) and the ~~donation rejection risk~~ (now resolved).

<div align="center">⁂</div>

[^1]: https://github.com/Appsmithery/phina/tree/main/app/(tabs)

[^2]: https://github.com/Appsmithery/phina/blob/main/app/(tabs)/profile.tsx

[^3]: https://github.com/Appsmithery/phina/tree/main/app

[^4]: https://github.com/Appsmithery/phina/tree/main/.github/workflows

[^5]: https://github.com/Appsmithery/phina/blob/main/.env.example

[^6]: https://github.com/Appsmithery/phina/blob/main/.env.example

[^7]: https://github.com/Appsmithery/phina/blob/main/.github/workflows/ci.yml

[^8]: https://github.com/Appsmithery/phina/tree/main/app/(auth)

