# Mobile release workflow

This document is the source of truth for how Phina ships native iOS and Android
updates through Expo EAS.

## Current cost floor

Verified on March 12, 2026:

- Apple Developer Program: **$99/year**
- Google Play Console registration: **$25 one-time**
- Expo EAS Free: **$0/month**
- Expo EAS Starter: **$19/month + usage**
- Expo EAS Production: **$199/month + usage**

Recommended starting point for Phina:

- use **Expo Starter**
- keep **preview** builds manual
- keep **production** builds manual
- use **EAS Update** for JS-only published app changes
- defer Expo build-cache provider work until after v0.1 submission

Why Starter instead of Free:

- the Free tier only works if native builds stay scarce and intentional
- Starter is the cheapest lane that still gives Phina headroom for OTA updates plus
  occasional release-candidate binaries

## What runs where

- **Development**: local dev client + Metro on the developer machine
- **Preview**: internal iOS / Android builds distributed through Expo EAS
- **Production**: store binaries built through Expo EAS and submitted to Apple /
  Google manually
- **Web/PWA**: deployed to the DigitalOcean droplet
- **Backend**: Supabase Auth, Postgres, Storage, and Edge Functions

The droplet is not part of the native app runtime.

## Android store note

For the first Google Play submission, use
`docs/planning/setup/GOOGLE_PLAY_FIRST_SUBMISSION.md` as the operational
checklist. The Android path assumes:

- personal Play account testing requirements
- billing included in the first Android release
- production access only after the closed-test gate is satisfied
- target API compliance tracked against current Play policy, not older repo notes

## iOS store note

For the first App Store / TestFlight submission, use
`docs/planning/setup/APPLE_APP_STORE_FIRST_SUBMISSION.md` as the operational
checklist. The iOS path assumes:

- billing included in the first iOS release
- Sign in with Apple and Google Sign-In both remain available
- App Review is given seeded reviewer credentials instead of relying on QR join
- privacy, support, and account deletion URLs are all repo-backed static pages

## GitHub Actions workflows

- `checks.yml`
  - PR and `main` validation
  - runs typecheck, lint, tests, and `expo config --type introspect`
- `web-deploy.yml`
  - deploys the web export to the DigitalOcean droplet
  - skips docs-only and backend-only changes
- `native-preview-builds.yml`
  - manual `workflow_dispatch`
  - starts iOS and Android `preview` builds only when an operator explicitly chooses to spend build minutes
  - intended for native-risk QA, Apple Sandbox testing, and release candidates
- `native-release.yml`
  - manual `workflow_dispatch`
  - builds `preview` or `production` iOS / Android binaries
  - optional store submit path
  - intended for release-only or binary-required validation
- `ota-update.yml`
  - manual `workflow_dispatch`
  - publishes JS-only changes to the `preview` or `production` EAS channel
  - must publish with the matching EAS environment (`preview` -> `preview`, `production` -> `production`)

## EAS lanes

The repo uses three EAS build profiles:

- `development`
  - local dev-client work
  - channel: `development`
- `preview`
  - production-like internal builds from `main`
  - channel: `preview`
- `production`
  - store binaries only
  - channel: `production`

Use `preview` when you need a standalone binary that behaves as close to production as possible without store submission. For native billing, that means:

- iOS preview builds are valid for Apple Sandbox purchase testing.
- Android preview builds are useful for native smoke checks, but real Play Billing validation should come from Google Play internal or closed testing.

The app already uses `runtimeVersion: { policy: "appVersion" }`. That means OTA
updates only apply to installed binaries with the same app version/runtime.

That also means reinstalling a preview build does **not** guarantee you are running the embedded JS bundle. If a newer `preview` OTA exists for the same runtime, the app can still load that update after install.

## Build budget rules

- Routine merges to `main` should consume **zero** EAS build minutes.
- Default validation path: local dev build or simulator/emulator first, then `checks.yml`, then `preview` OTA if the change is JS-only.
- Do not use preview builds to verify copy, layout, screen logic, hooks, or server-driven behavior.
- Use iOS as the first paid native gate when a native binary is actually required.
- Build Android only for native smoke checks that cannot be covered locally, or for Play internal / billing validation.
- Do not add Expo build-cache provider during MVP validation; it is a post-launch Android-iteration optimization, not part of the submission path.

## EAS environment hydration

Native EAS builds do not read your local `.env` automatically in a reliable way.
Phina expects the full native `EXPO_PUBLIC_*` matrix to exist in the matching EAS
project environment.

Before the first `preview` or `production` build, and any time those values change:

```bash
bash scripts/push-env-to-eas.sh --env preview --apply
bash scripts/push-env-to-eas.sh --env production --apply
```

Verification is built into the repo:

- `node scripts/verify-eas-env.mjs --environment preview --platform ios`
- `node scripts/verify-eas-env.mjs --environment production --platform all`
- `ota-update.yml` now verifies the selected environment before publishing an OTA

The native preview and native release GitHub workflows now fail fast if the
required EAS environment variables are missing, instead of producing a broken
standalone binary.

## Release decision tree

Use **EAS Update** when the change is JS-only:

- UI updates
- copy changes
- business logic changes
- routing changes
- React hooks/components/screens
- non-native analytics changes
- server-driven behavior or Edge Function changes that do not alter the native binary

Use a **manual native build** when the change touches native behavior:

- new native modules or Expo plugins
- new permissions or entitlements
- app config changes that require a rebuild
- deep-link / associated-domain changes
- notification credential or push capability changes
- StoreKit / Play Billing binary-level validation
- store metadata or signing/credential changes

Example:

- rating-page copy/UI changes -> `ota-update.yml`
- paywall copy/layout changes with no native SDK change -> `ota-update.yml`
- RevenueCat config display fix in JS -> `ota-update.yml`
- if a feature adds a new native SDK or changes `app.config.ts` plugins, it needs a manual native build

## OTA safety rules

- Preview OTA updates must publish with `--channel preview --environment preview`.
- Production OTA updates must publish with `--channel production --environment production`.
- Do not publish preview OTA updates from a shell or CI context that relies on implicit local `.env` loading.
- If a preview app shows behavior that contradicts a fresh preview binary, assume a newer `preview` OTA may be overriding the embedded bundle and inspect the last update published to that channel.

## Required GitHub secrets

Common:

- `EXPO_TOKEN`

Web deploy:

- `DROPLET_HOST`
- `DROPLET_SSH_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- optional web build envs such as `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_POSTHOG_KEY`,
  `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_SENTRY_DSN`

Android submit:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

iOS submit:

- `EXPO_ASC_API_KEY_BASE64`
- `EXPO_ASC_KEY_ID`
- `EXPO_ASC_ISSUER_ID`

Keep the full native `EXPO_PUBLIC_*` env matrix in **EAS project environments** rather
than duplicating it in GitHub Actions.

## Variable platform fees

These are not hosting costs, but they affect revenue planning once billing is live:

- Apple digital-goods commission: typically **30%**, with **15%** cases for qualifying
  subscriptions / Small Business Program scenarios
- Google Play service fees: **15% for subscriptions**, and **15% on the first $1M**
  for enrolled developers before higher-rate tiers apply

Re-check the current store fee pages before final monetization launch because the
exact program terms can change.

## Practical shipping examples

### JS-only feature after launch

1. Merge the feature to `main`
2. Let `checks.yml` pass
3. Validate locally with a dev build or simulator/emulator
4. Publish a `preview` OTA for stakeholder QA on installed preview binaries
5. Run `ota-update.yml` to `production`

Store review is not required if the installed binary already supports the feature.

### Minimum-cost release-candidate matrix

- Every change: local dev build + `checks.yml`
- Release candidate, JS-only: `preview` OTA on an iOS physical device
- Release candidate with native risk: one manual iOS preview build
- Pre-ship Android billing or release validation: one Google Play internal or closed-test install cycle
- Reserve both-platform native builds for final release windows, billing changes, or shared native infrastructure changes
- For v0.1, iOS approval readiness is the primary submission gate; Android store-track validation may trail if needed.

### Native-affecting feature after launch

1. Merge to `main`
2. Let `checks.yml` pass
3. Validate locally first
4. Trigger a manual iOS preview build if the change has native risk or needs Apple Sandbox validation
5. Trigger Android preview only if local coverage is insufficient, or move straight to Play internal testing for billing/release checks
6. Run `native-release.yml` with `preview` or `production` as needed
7. Complete TestFlight / Play review as needed

## Source links

- Expo pricing: https://expo.dev/pricing
- Expo usage pricing: https://docs.expo.dev/billing/usage-based-pricing/
- Apple Developer Program: https://developer.apple.com/programs/whats-included/
- Apple membership comparison: https://developer.apple.com/support/compare-memberships/
- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622?hl=en
