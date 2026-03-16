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
- keep **preview** builds automatic on `main`
- keep **production** builds manual
- use **EAS Update** for JS-only published app changes

Why Starter instead of Free:

- the Free tier is likely too tight once `main` automatically starts both iOS and
  Android preview builds
- Starter is the cheapest lane that still gives Phina headroom for internal build
  automation plus OTA updates

## What runs where

- **Development**: local dev client + Metro on the developer machine
- **Preview**: internal iOS / Android builds distributed through Expo EAS
- **Production**: store binaries built through Expo EAS and submitted to Apple /
  Google manually
- **Web/PWA**: deployed to the DigitalOcean droplet
- **Backend**: Supabase Auth, Postgres, Storage, and Edge Functions

The droplet is not part of the native app runtime.

## GitHub Actions workflows

- `checks.yml`
  - PR and `main` validation
  - runs typecheck, lint, tests, and `expo config --type introspect`
- `web-deploy.yml`
  - deploys the web export to the DigitalOcean droplet
  - skips docs-only and backend-only changes
- `native-preview-builds.yml`
  - starts iOS and Android `preview` builds on `main`
  - skips docs-only, backend-only, and droplet-only changes
- `native-release.yml`
  - manual `workflow_dispatch`
  - builds production iOS / Android binaries
  - optional store submit path
- `ota-update.yml`
  - manual `workflow_dispatch`
  - publishes JS-only changes to the `preview` or `production` EAS channel

## EAS lanes

The repo uses three EAS build profiles:

- `development`
  - local dev-client work
  - channel: `development`
- `preview`
  - internal builds from `main`
  - channel: `preview`
- `production`
  - store binaries only
  - channel: `production`

The app already uses `runtimeVersion: { policy: "appVersion" }`. That means OTA
updates only apply to installed binaries with the same app version/runtime.

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

Use a **new production build** when the change touches native behavior:

- new native modules or Expo plugins
- new permissions or entitlements
- app config changes that require a rebuild
- deep-link / associated-domain changes
- store metadata or signing/credential changes

Example:

- `Help me pick` can ship through `ota-update.yml` if it is only JS/UI/business logic
- if it adds a new native SDK, it needs `native-release.yml`

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
3. Validate with a `preview` OTA update or preview build
4. Run `ota-update.yml` to `production`

Store review is not required if the installed binary already supports the feature.

### Native-affecting feature after launch

1. Merge to `main`
2. Let `checks.yml` pass
3. Validate preview builds
4. Run `native-release.yml` with `build` or `build_and_submit`
5. Complete TestFlight / Play review as needed

## Source links

- Expo pricing: https://expo.dev/pricing
- Expo usage pricing: https://docs.expo.dev/billing/usage-based-pricing/
- Apple Developer Program: https://developer.apple.com/programs/whats-included/
- Apple membership comparison: https://developer.apple.com/support/compare-memberships/
- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622?hl=en
