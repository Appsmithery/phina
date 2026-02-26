# Google Sign-In in Expo Go

Expo Go uses a **browser-based OAuth fallback** because native Google Sign-In requires native modules unavailable in Expo Go. In production/dev native builds, the native Google Sign-In SDK is used instead (no browser).

## How it works in Expo Go

1. User taps **Sign in with Google**
2. App detects native SDK is not available, falls back to browser OAuth
3. In-app browser opens Google consent screen
4. User approves → Google redirects to Supabase → Supabase redirects to `exp://192.168.x.x:8081`
5. Browser closes; the app's deep-link listener in `app/_layout.tsx` catches the `exp://` URL
6. Session is set, user is navigated to the app

## Required Supabase configuration

Add these to **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**:

| URL | Purpose |
|---|---|
| `exp://**` | Wildcard for all Expo Go development URLs |

You can also add the specific IP-based URL shown in the console logs (e.g. `exp://192.168.1.97:8081`), but the wildcard is easier.

> Note: `exp://` and `phina://` are **not** added to Google Cloud Console. Google redirects to Supabase's callback URL, not to your app. Only Supabase needs to know about your app's scheme.

## Logs to look for

When sign-in works correctly:

```
[oauth-google] Native SDK not available — using browser fallback (Expo Go)
[oauth-google] Generated redirect URI: exp://192.168.1.97:8081
[oauth-google] Opening OAuth URL in browser
[oauth-google] Browser dismissed — auth may still complete via deep link
```

Then (from `_layout.tsx` picking up the deep link):

```
// app navigates to /(tabs) — no explicit log, but you'll see the tabs screen appear
```

If you see `✅ Success! Callback URL received`, `openAuthSessionAsync` caught the redirect directly (better, but not always possible on Android).

## Troubleshooting

**"User cancelled" and nothing happens after auth**

- `exp://**` is not in Supabase Redirect URLs → Supabase redirects elsewhere (e.g. your web URL), deep link never fires
- Fix: add `exp://**` to Supabase Redirect URLs

**Auth completes in the browser but app stays on auth screen**

- The deep-link listener in `_layout.tsx` may not be seeing the `exp://` URL
- Restart the Expo dev server and try again
- Check logs for any errors from `createSessionFromUrl`

**In-app browser never closes**

- The OAuth completed but the Supabase redirect URL isn't one your app knows about
- Ensure the `redirectTo` URL in `signInWithOAuth` matches a Supabase allowed redirect URL

## For production (native builds)

When you build a native iOS app (`npx expo run:ios` or EAS Build), the app automatically switches to the native Google Sign-In SDK. No browser appears — just a native account picker. The `exp://` redirect URLs are not needed in production builds (they use `phina://`). See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) for full setup.
