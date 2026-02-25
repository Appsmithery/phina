# PRD: Password-Based Sign Up & Sign In

> **Status:** Draft
> **Priority:** P1 (High)
> **Owner:** [Name]
> **Target Release:** [Version or Date]

---

## Problem Statement

Returning users who already have an account must request a new magic link every time they open the app or sign out. They wait for an email and can hit rate limits (e.g. 60-second cooldown per email), which creates friction and a poor experience when they just want to get back into the app. New users also have no way to create a persistent account with a password, so every session depends on email delivery.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Time to sign in (returning user) | ~1–2 min (wait for email) | &lt; 10 seconds | Manual timing from tap "Sign In" to app home |
| Magic-link rate limit errors | Possible on rapid re-entry | N/A for password sign-in | Support / logs |
| New user sign-up completion | Magic link only | Email + password, one-time | Funnel: sign-up form submit → session created |

---

## Solution Overview

Add email+password authentication alongside (or replacing) the current magic-link-only flow. The auth screen will offer **Sign Up** (create account with email and password) as the primary action and **Sign In** (email + password) as the secondary action. Once a user has created an account, they can return and sign in immediately without waiting for an email. User profile persistence (members row) remains as today: created/updated when a session exists via existing supabase-context logic.

### User Stories

- **As a** new user, **I want** to create an account with my email and a password, **so that** I can sign in later without waiting for an email.
- **As a** returning user, **I want** to sign in with my email and password, **so that** I can get back into the app quickly without checking my inbox.
- **As a** product owner, **I want** the auth screen to clearly offer "Sign Up" and "Sign In", **so that** users understand the two paths and don’t rely on magic links for every visit.

---

## Functional Requirements

### Core Features

1. **Sign Up (create account)**
   - User can enter email, password, and confirm password.
   - Primary button label: "Sign Up".
   - On submit: validate email format, password length (e.g. min 6), and password === confirm password.
   - Call Supabase `auth.signUp({ email, password })`.
   - On success with session: user is signed in; app redirects to tabs/profile as today; member row is created/updated by existing context.
   - On success without session (e.g. email confirmation required): show "Check your email to confirm your account" and keep user on auth screen.
   - Acceptance criteria: New user can create an account with email+password and, when confirmation is off, land in the app; member row exists after first sign-in.

2. **Sign In (returning user)**
   - User can enter email and password.
   - Secondary action: "Sign In" button (below Sign Up).
   - On submit: validate email and password non-empty; call Supabase `auth.signInWithPassword({ email, password })`.
   - On success: session is set; app redirects to tabs/profile.
   - Acceptance criteria: Returning user with existing password can sign in and reach the app without receiving an email.

3. **Auth screen copy and layout**
   - Subtitle: e.g. "Create an account or sign in" (or keep current style).
   - Replace previous "Send magic link" primary action with "Sign Up".
   - Add "Sign In" as a distinct, secondary button/link below Sign Up.
   - Acceptance criteria: Both actions are visible and map to the correct auth flows.

### Edge Cases & Error Handling

- **Email already registered (Sign Up):** Show clear message (e.g. "An account with this email already exists. Use Sign In instead.").
- **Invalid credentials (Sign In):** Show "Invalid email or password" (or Supabase message) without leaking whether email exists.
- **Password too short / weak:** Validate before calling API; show inline or alert message.
- **Passwords don’t match (Sign Up):** Validate confirm password before submit; show clear error.
- **Existing magic-link-only users:** They have no password set. Out of scope for this PRD: optional follow-up is "Forgot password?" / set password via email.

---

## Technical Context

### Relevant Files & Directories

```
app/(auth)/index.tsx
app/index.tsx
lib/supabase.ts
lib/supabase-context.tsx
__tests__/app/auth-screen.test.tsx
docs/AUTH_SETUP.md
```

### Key Dependencies

- `@supabase/supabase-js` — `auth.signUp`, `auth.signInWithPassword` (existing client).
- Supabase Auth (Email provider) — must support password sign-up/sign-in; Confirm email setting affects whether session is returned on signUp.

### Database/Schema Changes

None. Member row is created/updated in app via existing `members` upsert in `lib/supabase-context.tsx` when session exists.

### API Changes

None. Use existing Supabase client; add calls to `supabase.auth.signUp` and `supabase.auth.signInWithPassword`. No new backend endpoints.

### Architecture Notes

- Session and member lifecycle unchanged: `SupabaseProvider` / `onAuthStateChange` create or load `members` row; root `app/index.tsx` redirects unauthenticated users to `/(auth)` and authenticated users to `/(tabs)` or profile.
- Auth screen is the only place that needs new form state (password, confirm password) and the two submit handlers.

---

## Implementation Handoff

### Critical Files to Modify

| File | Purpose | Key Changes |
|------|---------|-------------|
| `app/(auth)/index.tsx` | Auth screen UI and auth calls | Add password + confirm password fields; Sign Up (signUp) and Sign In (signInWithPassword); remove OTP/cooldown; update copy to "Sign Up" / "Sign In". |
| `__tests__/app/auth-screen.test.tsx` | Auth screen tests | Mock signUp and signInWithPassword; assert "Sign Up" and "Sign In" present and form behavior. |
| `docs/AUTH_SETUP.md` | Auth setup docs | Note email+password flow; mention Confirm email setting for post-sign-up behavior. |

### Root Cause Analysis

**Current behavior:** Single path: user enters email and taps "Send magic link"; must wait for email and tap link every time; rate limits apply.  
**Expected behavior:** User can Sign Up once with password and Sign In on return with email+password; no email wait for returning users.  
**Root cause:** Auth screen only implemented magic-link (OTP) flow; no password creation or sign-in path.

### Implementation Constraints

- DO NOT remove session/member handling in `lib/supabase-context.tsx` or redirect logic in `app/index.tsx`.
- MUST preserve existing behavior when a valid session exists (redirect to tabs/profile, member fetch/upsert).
- MUST use secure text entry for password and confirm password fields.

### Verification Commands

```bash
# Lint
npm run lint

# Tests
npm test -- __tests__/app/auth-screen.test.tsx

# Manual verification
# 1. Open app unauthenticated → auth screen shows "Sign Up" and "Sign In".
# 2. Sign Up with new email + password (+ confirm) → account created, redirected into app.
# 3. Sign out → back to auth screen. Sign In with same email + password → redirected into app without email.
# 4. Sign In with wrong password → error message shown.
# 5. Sign Up with already-registered email → message to use Sign In instead.
```

### Decisions Made

- [x] **Primary action:** Sign Up (create account with password) — so new users have a clear first step and can set a password once.
- [x] **Secondary action:** Sign In (email+password) — so returning users don’t wait for email.
- [x] **No magic link on this screen for initial scope:** Password-only for this PRD; "Forgot password?" or magic-link fallback can be a follow-up.
- [x] **Profile persistence:** No code change; existing member fetch/upsert on session suffices.

### Related Plan File

Plan file: `password_auth_and_sign_in_up_ui` (Claude Code plan: Password auth and Sign In/Up UI)

---

## Implementation Guidance

### Suggested Approach

1. Update `app/(auth)/index.tsx`: add state for password and confirm password; add secure inputs; implement Sign Up handler (validation + signUp); implement Sign In handler (signInWithPassword); replace single button with Sign Up (primary) and Sign In (secondary); remove magic-link and cooldown logic; adjust subtitle/copy.
2. Update `__tests__/app/auth-screen.test.tsx`: mock `signUp` and `signInWithPassword`; update assertions for "Sign Up" and "Sign In" and any new fields.
3. Update `docs/AUTH_SETUP.md`: add section or bullets on email+password flow and Confirm email setting.

### Testing Requirements

- [ ] Unit tests: auth screen renders Sign Up / Sign In and password fields; mocks for signUp and signInWithPassword.
- [ ] Manual QA: full Sign Up then Sign In flow; error cases (wrong password, duplicate email, validation errors).

### Out of Scope

- "Forgot password?" / password reset email flow.
- Magic link as fallback on the same screen.
- Changing Supabase dashboard defaults (document only); no automated config changes.

---

## Design & UX

- Same auth screen layout as today (logo, subtitle, inputs, buttons); add two password fields and two actions.
- **Sign Up** button: primary style (e.g. filled, primary color), same as current CTA.
- **Sign In** button: secondary (e.g. outline or text) below Sign Up.
- Password and confirm password: secure entry (masked); placeholder/labels clear (e.g. "Password", "Confirm password").

**Key Interactions:**
- User fills email + password + confirm → taps "Sign Up" → account created (and signed in if no confirmation) → redirect to app.
- User fills email + password → taps "Sign In" → signed in → redirect to app.
- Validation errors (mismatch, short password, empty fields) → inline or alert before API call.

---

## Rollout Plan

| Phase | Description | Audience | Success Gate |
|-------|-------------|----------|--------------|
| 1 | Ship behind existing auth route | All unauthenticated users | No regressions; Sign Up and Sign In work |
| 2 | Monitor support/logs for auth errors | — | No spike in auth failures |
| 3 | Optional: deprecate magic-link-only flow or add "Forgot password?" | — | — |

### Feature Flags

- No feature flag for initial implementation; auth screen change is the default for unauthenticated users.

---

## Open Questions

- [ ] Should "Confirm email" be off in Supabase for this app so users are signed in immediately after Sign Up?
- [ ] Copy for existing magic-link-only users who have no password (e.g. link to "Set password" / "Forgot password?" in a later PR)?

---

## References

- [Supabase Auth: Passwords](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Auth: signUp / signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- Related plan: Password auth and Sign In/Up UI (Claude Code)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| [YYYY-MM-DD] | [Name] | Initial draft from PRD template and password auth plan |
