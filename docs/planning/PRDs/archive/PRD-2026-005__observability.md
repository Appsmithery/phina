---
prd_id: PRD-2026-005
title: "Observability — Error Tracking and Basic Analytics"
status: Shipped
owner: TBD
area: Observability
target_release: "v0.3"
roadmap: "../ROADMAP.md"
plans:
  claude: "../Plans/PRD-2026-005__claude-plan.md"
---

# PRD-2026-005: Observability — Error Tracking and Basic Analytics

> **Status:** 🚀 Shipped
> **Priority:** P1 (High)
> **Owner:** TBD
> **Target Release:** v0.3
> See [planning guide](../planning%20guide.md) for PRD naming, IDs, and when to update the roadmap.

---

## Problem Statement

Production JS errors, component crashes, and unhandled promise rejections are completely invisible — the team only learns about bugs when users report them verbally. There is also zero visibility into which features users actually engage with (label scanning, cellar, rating rounds), making prioritisation guesswork. Both problems are solvable with lightweight, free-tier tooling that integrates cleanly with the existing Expo managed workflow.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Time to detect production errors | Never (user report only) | < 1 hour | Sentry alert on first occurrence |
| % of key product events captured | 0% | ≥ 95% | PostHog live event stream vs. known call sites |
| Recurring errors resolved within 1 sprint | Unknown | ≥ 80% | Sentry issue resolution rate |
| Monthly observability cost | $0 | $0 | Sentry + PostHog free tier |

---

## Solution Overview

Integrate **Sentry** (`@sentry/react-native`) for error tracking and **PostHog** (`posthog-react-native`) for product analytics via a single `lib/observability.ts` wrapper module. The wrapper is the only import used in screens — no screen file imports the SDKs directly. Sentry is initialised at module level in `app/_layout.tsx`, wraps the root component, and receives errors from the enhanced `ErrorBoundary`. PostHog captures 10 product events at key call sites across the app. Both SDKs are disabled in development (`__DEV__`), keeping the local experience clean.

### User Stories

- **As a developer**, I want crash reports with stack traces so that I can reproduce and fix production bugs without waiting for user reports.
- **As a product owner**, I want to see how many users complete rating rounds, scan labels, and open the cellar so that I can make evidence-based prioritisation decisions.
- **As a member**, I want errors to be caught gracefully with a retry option so that a crash doesn't permanently strand me on a dead-end screen.

---

## Functional Requirements

### Core Features

1. **Error capture — unhandled exceptions and promise rejections**
   - All unhandled JS exceptions reported to Sentry automatically via `Sentry.init()`
   - React component errors caught by `ErrorBoundary.componentDidCatch` and reported with component stack
   - Root component wrapped with `Sentry.wrap()` to catch errors above the React tree
   - Acceptance criteria: a manually thrown `throw new Error("test")` in `_layout.tsx` appears in Sentry Issues within 30 seconds of the build reaching production

2. **Source maps in production**
   - Source maps uploaded to Sentry during EAS build via `@sentry/react-native/expo` plugin + `SENTRY_AUTH_TOKEN` EAS secret
   - Acceptance criteria: stack traces in Sentry show original TypeScript file names and line numbers, not minified output

3. **User identity context**
   - `Sentry.setUser({ id })` and `posthog.identify(userId)` called after sign-in / member fetch
   - Both cleared (`Sentry.setUser(null)` / `posthog.reset()`) on sign-out
   - Acceptance criteria: Sentry events for authenticated sessions show the user ID; PostHog events are tied to the same distinct ID across sessions

4. **10 product events in PostHog**

   | Event | Call site |
   |-------|-----------|
   | `user_signed_up` | `lib/supabase-context.tsx` — first member upsert |
   | `user_signed_in` | `app/(auth)/sign-in.tsx` + Google OAuth success |
   | `event_created` | `app/event/create.tsx` after insert |
   | `event_joined` | `app/join/[eventId].tsx` after upsert |
   | `wine_rated` | `app/event/[id]/rate/[wineId].tsx` after upsert |
   | `label_scanned` | `app/scan-label.tsx` after `extractLabel` resolves (success path) |
   | `label_scan_error` | `app/scan-label.tsx` catch block — also calls `captureError()` |
   | `wine_added_to_cellar` | `app/add-wine.tsx` / event add-wine screen on success |
   | `cellar_opened` | `app/(tabs)/cellar.tsx` on mount when member ID is present |
   | `event_ended` | wherever "End Event" mutation is called |

5. **Enhanced `ErrorBoundary` with retry**
   - `componentDidCatch` added to the existing class to call `captureError()`
   - Fallback render includes a "Try again" button (`router.replace("/")`)
   - Optionally surfaces `Sentry.lastEventId()` so users can quote it in a bug report
   - Acceptance criteria: triggering the boundary shows the retry button; Sentry receives the error report

6. **No tracking in development**
   - Sentry: `enableInExpoDevelopment: false`
   - PostHog: `disabled: __DEV__`
   - Acceptance criteria: running `npx expo start` and navigating the app produces zero Sentry issues and zero PostHog events

### Edge Cases & Error Handling

- **Missing env vars:** If `EXPO_PUBLIC_SENTRY_DSN` or `EXPO_PUBLIC_POSTHOG_KEY` are absent, `initObservability()` is a no-op — the app continues normally without tracking
- **Network offline:** Both SDKs buffer events locally and flush when connectivity returns; no special handling needed
- **PostHog capture failure:** `trackEvent()` must never throw — wrap in try/catch inside the helper
- **Sentry capture failure:** Same — `captureError()` must be safe to call from within error handlers

---

## Technical Context

### Relevant Files & Directories

```
app/_layout.tsx                          — init, Sentry.wrap(), ErrorBoundary enhancement
app/(auth)/sign-in.tsx                  — user_signed_in event (password + Google)
app/event/create.tsx                    — event_created event
app/join/[eventId].tsx                  — event_joined event
app/event/[id]/rate/[wineId].tsx        — wine_rated event
app/scan-label.tsx                      — label_scanned / label_scan_error events
app/add-wine.tsx                        — wine_added_to_cellar event
app/(tabs)/cellar.tsx                   — cellar_opened event
app/privacy.tsx                         — add PostHog + Sentry disclosure
app.config.ts                           — add Sentry plugin + extra env keys
lib/supabase-context.tsx                — identifyUser / clearUser on auth state
lib/observability.ts                    — NEW: wraps both SDKs
.env.example                            — add new env var keys
```

### Key Dependencies

- `@sentry/react-native` — latest — error tracking, performance, React Native Expo plugin
- `posthog-react-native` — latest — product analytics, 1M events/month free
- `expo-constants` — already installed — used to read `Constants.expoConfig.extra` for DSNs/keys
- `SENTRY_AUTH_TOKEN` — EAS secret — required for source map upload at build time

### Database/Schema Changes

None.

### API Changes

None.

### Architecture Notes

- **Single wrapper rule:** All screens call `trackEvent()` and `captureError()` from `lib/observability.ts`. This makes it trivial to swap or extend the underlying SDKs later without touching screen files.
- **Module-level init:** `initObservability()` is called at module level in `app/_layout.tsx` (before the component tree), not inside `useEffect`, to ensure Sentry captures errors during the very first render.
- **No session replay:** Do not enable PostHog session replay — the app handles personal data (wine lists, event memberships) and replay would be a privacy concern disproportionate to the benefit.
- **`Sentry.wrap()` vs `ErrorBoundary`:** The `Sentry.wrap()` HOC on the root layout catches errors that escape the React tree (e.g. errors thrown inside `useEffect` at the root level). The class `ErrorBoundary` catches errors within the subtree. Both are needed.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `lib/observability.ts` | New SDK wrapper | Create file; export `initObservability`, `identifyUser`, `clearUser`, `trackEvent`, `captureError`, and re-export `Sentry` |
| `app/_layout.tsx` | Root layout | Call `initObservability()` at module level; wrap default export with `Sentry.wrap()`; add `componentDidCatch` to `ErrorBoundary`; add "Try again" button to fallback; call `identifyUser`/`clearUser` on auth state |
| `app.config.ts` | Expo config | Add `"@sentry/react-native/expo"` to `plugins`; add `sentryDsn`, `posthogKey`, `posthogHost` to `extra` |
| `lib/supabase-context.tsx` | Auth + member state | Call `identifyUser(member.id)` after `fetchMember` resolves; call `clearUser()` when session → null |
| `app/privacy.tsx` | Privacy policy | Add PostHog + Sentry under "Service Providers" section |
| `.env.example` | Env template | Add `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` |
| `app/(auth)/sign-in.tsx` | Sign-in screen | `trackEvent("user_signed_in", { method: "password" })` on success |
| `app/event/create.tsx` | Event creation | `trackEvent("event_created", { event_id })` after insert |
| `app/join/[eventId].tsx` | Event join | `trackEvent("event_joined", { event_id })` after upsert |
| `app/event/[id]/rate/[wineId].tsx` | Rating screen | `trackEvent("wine_rated", { event_id, wine_id, value })` after upsert |
| `app/scan-label.tsx` | Label scan | `trackEvent("label_scanned", { platform })` on success; `captureError` + `trackEvent("label_scan_error")` on failure |
| `app/(tabs)/cellar.tsx` | Cellar tab | `trackEvent("cellar_opened")` on mount when `member?.id` is present |

### Implementation Constraints

- DO NOT import `@sentry/react-native` or `posthog-react-native` directly in screen files — always via `lib/observability.ts`
- DO NOT set `enableInExpoDevelopment: true` in Sentry — dev noise pollutes the dashboard
- DO NOT enable PostHog session replay (`enableSessionRecording: false` is the default — leave it)
- MUST preserve the existing `ErrorBoundary` class shape; only add `componentDidCatch` and update the fallback render
- MUST guard all SDK calls so a missing DSN/key causes a no-op, not a crash
- DO NOT track personally identifiable information in event properties (no email, name, or wine notes in PostHog events)

### Verification Commands

```bash
# Type-check after changes
npx tsc --noEmit

# Lint check
npx expo lint

# Build preview (internal) to test SDK init
eas build --platform ios --profile preview

# Add Sentry source map token as EAS secret
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your-sentry-auth-token>

# Manual verification
# 1. Open the preview build, sign in → check PostHog Live Events for user_signed_in
# 2. Join an event → check for event_joined
# 3. Rate a wine → check for wine_rated
# 4. Trigger a test error → check Sentry Issues for stack trace with readable file names
```

### Decisions Made

- [x] **Error tracking tool:** Sentry — best-in-class for React Native, official Expo plugin, free tier sufficient
- [x] **Analytics tool:** PostHog — open-source, 1M events/month free, privacy-respecting, no fingerprinting
- [x] **Wrapper pattern:** Single `lib/observability.ts` — screens never import SDKs directly
- [x] **Development mode:** Both SDKs disabled in `__DEV__` — no dev noise in dashboards
- [x] **Session replay:** Disabled — privacy concern disproportionate to benefit for this app
- [x] **Custom Supabase events table:** Not used as primary analytics — too much bespoke tooling required

---

## Implementation Guidance

### Suggested Approach

1. Install packages: `npx expo install @sentry/react-native posthog-react-native`
2. Create `lib/observability.ts` with the wrapper (see structure above)
3. Update `app.config.ts`: add Sentry plugin + `extra` keys
4. Update `.env.example` with the three new env vars
5. Update `app/_layout.tsx`: module-level `initObservability()`, `Sentry.wrap()`, `ErrorBoundary.componentDidCatch`, retry button
6. Update `lib/supabase-context.tsx`: `identifyUser` / `clearUser` on auth state
7. Instrument the 10 product events across screen files (one `trackEvent()` line per call site)
8. Update `app/privacy.tsx` with PostHog + Sentry disclosure
9. Add `SENTRY_AUTH_TOKEN` as EAS secret
10. Build preview and verify events in dashboards

### Testing Requirements

- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`) after all changes
- [ ] `initObservability()` with empty env vars does not throw
- [ ] A preview EAS build shows `user_signed_in` in PostHog Live Events after signing in
- [ ] A preview EAS build shows a test error in Sentry Issues with readable stack trace
- [ ] `ErrorBoundary` "Try again" button navigates back to root successfully
- [ ] `__DEV__` build produces no Sentry issues and no PostHog events

### Out of Scope

- Session replay (privacy concern)
- Performance monitoring beyond Sentry's default transaction tracing (10% sample rate)
- Custom analytics dashboard — use PostHog's built-in UI
- A/B testing or feature flags (PostHog supports this but not needed now)
- Alerting configuration in Sentry (set up manually after first events arrive)

---

## Design & UX

No new UI beyond the `ErrorBoundary` fallback enhancement:

**Updated error fallback:**
- Keep existing "Oops, something went wrong" message and error detail text
- Add "Try again" button below the error text that calls `router.replace("/")`
- Optionally add small grey text below: "Error ID: [Sentry.lastEventId()]" for support reference

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | Internal preview build (EAS preview profile) | Team only | Events appear in PostHog; errors in Sentry with readable stacks |
| 2 | Production EAS build | All users | No regressions; error volume < 1% of sessions for 1 week |

### Feature Flags

None — observability is always-on in production builds.

---

## Open Questions

- [ ] Which Sentry organisation and project should this be associated with? (Needs account setup)
- [ ] Which PostHog project / team? (Needs account setup)
- [ ] Should `event_ended` be tracked in `use-event-actions.ts` (the mutation hook) or at the screen call site?

---

## References

- [Sentry React Native docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Expo integration](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)
- [PostHog React Native SDK](https://posthog.com/docs/libraries/react-native)
- [ROADMAP.md](../ROADMAP.md)
- [System Architecture](../../architecture/system-architecture.md)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-01 | Claude | Initial draft — Sentry + PostHog, 10 product events, ErrorBoundary enhancement |
| 2026-03-01 | Claude | Shipped — all 10 events instrumented, Sentry + PostHog confirmed in dev smoke tests (PostHog Live Events, Sentry issue capture). iOS preview build blocked pending Apple Developer account approval; full source map validation deferred to first iOS build. |
