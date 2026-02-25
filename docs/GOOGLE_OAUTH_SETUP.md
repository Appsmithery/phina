# Google Sign-In Setup Guide

This guide covers all setup required to enable Google Sign-In across Expo Go (development), native iOS/Android production builds, and web.

## Auth flow summary

| Environment | Method | What the user sees |
|---|---|---|
| **Expo Go** | Browser OAuth (fallback) | In-app browser opens for Google auth, closes after completion, app picks up session via `exp://` deep link |
| **iOS / Android production build** | Native Google Sign-In SDK | Native account picker sheet — no browser |
| **Web** | Browser OAuth | Redirect to Google consent screen, back to app |

The code in `lib/oauth-google.ts` auto-detects the runtime and chooses the right path. No config changes are needed when switching between environments.

---

## 1. Google Cloud Console Setup

You need three OAuth 2.0 Client IDs — one per platform. You likely already have the Web client.

### 1.1 Web Client ID (required for all platforms)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your existing **Web application** client, or create one
3. **Authorized JavaScript origins:** `https://phina.appsmithery.co`, `http://localhost:8081`
4. **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Save the **Client ID** — this is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

> Do NOT add `exp://` or `phina://` to Google Console redirect URIs. Google always redirects to Supabase, never directly to your app.

### 1.2 iOS Client ID (required for native iOS builds)

1. Click **Create Credentials → OAuth 2.0 Client ID**
2. Application type: **iOS**
3. Bundle ID: `co.appsmithery.phina`
4. Save the **Client ID** — this is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
5. The **iOS URL scheme** is the reversed client ID: `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID`
   - This is `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` and is set in the `app.config.ts` plugin

### 1.3 Android Client ID (required for native Android builds)

1. Click **Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Android**
3. Package name: `co.appsmithery.phina`
4. SHA-1 certificate fingerprint:
   - For **local debug builds**: run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - For **EAS builds**: run `eas credentials` and view the Android credentials
   - For **Play Store**: use the Play Console signing key fingerprint
5. Save the **Client ID** — this is used in Supabase config (see §3)

### 1.4 OAuth Consent Screen

In [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent), ensure these scopes are added:
- `.../auth/userinfo.email` (added by default)
- `.../auth/userinfo.profile` (added by default)
- `openid` (add manually)

---

## 2. Supabase Dashboard Setup

### 2.1 Enable Google Provider

1. Go to **Authentication → Providers → Google**
2. Enable the provider
3. **Client ID**: paste all client IDs comma-separated, **web first**:
   ```
   WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID
   ```
4. **Client Secret**: paste the Web client's secret
5. Enable **"Skip nonce check"** — required because the free version of `@react-native-google-signin/google-signin` does not support passing a custom nonce
6. Save

### 2.2 Configure Redirect URLs

1. Go to **Authentication → URL Configuration**
2. **Site URL**: `https://phina.appsmithery.co`
3. **Redirect URLs** — add all of these:

   | URL | Used by |
   |---|---|
   | `https://phina.appsmithery.co/**` | Web production |
   | `http://localhost:8081/**` | Web local dev |
   | `phina://**` | Native production / dev builds |
   | `exp://**` | Expo Go development |

---

## 3. Local Supabase Config (if running Supabase locally)

In `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = true
```

Add to `.env`:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="your-web-client-secret"
```

---

## 4. App Environment Variables

Copy `.env.example` to `.env` and fill in these values (see the Google credentials section):

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.your-ios-client-id
```

The `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` must also match the `iosUrlScheme` value in `app.config.ts`.

---

## 5. Testing

### Expo Go (browser fallback)

1. Run `npx expo start`
2. Open in Expo Go
3. Tap **Sign in with Google**
4. In-app browser opens, complete Google auth
5. Browser closes automatically, app navigates to tabs

If auth appears to complete but the app doesn't navigate, check:
- `exp://**` is in Supabase Redirect URLs
- The exact `exp://192.168.x.x:8081` URL shown in logs is also allowed (or use the wildcard)

### Native iOS / Android build

1. Run `npx expo run:ios` or `npx expo run:android`
2. Tap **Sign in with Google**
3. Native Google account picker appears (no browser)
4. Select account, app navigates to tabs

### Web

```bash
npx expo start --web
```

Navigate to `http://localhost:8081`, click **Sign in with Google**, complete the OAuth flow.

---

## 6. Troubleshooting

### "User cancelled" in Expo Go logs but auth appeared to complete

The `openAuthSessionAsync` Promise resolves as `cancel` on Android because the Chrome Custom Tab hands off to Expo Go via an `exp://` deep link rather than returning to the tab. This is expected — the `_layout.tsx` deep-link listener catches the `exp://` URL and sets the session. Check that you see `[oauth-google] Browser dismissed — auth may still complete via deep link` in the logs followed by navigation.

### "redirect_uri_mismatch" from Google

The redirect URI in the OAuth request doesn't match Google Console. The redirect goes to Supabase (`https://<ref>.supabase.co/auth/v1/callback`), not to your app. Ensure that URI is in **Authorized redirect URIs** for the Web client in Google Console.

### "invalid_client" error

Client ID or Client Secret in Supabase doesn't match Google Console. Verify and re-paste.

### Native: "DEVELOPER_ERROR" (Android)

The SHA-1 fingerprint for the running build is not registered in the Android OAuth client in Google Console. Add the correct SHA-1 for your debug or release signing config.

### Native: "RCTModule not found" or similar crash

`@react-native-google-signin/google-signin` is not supported in Expo Go. If you're testing in Expo Go this error should not appear (the module load is wrapped in a `try/catch`). If it appears in a native build, ensure `npx expo prebuild` was run after installing the package.

---

## 7. Implementation Details

### Files

| File | Purpose |
|---|---|
| `lib/oauth-google.ts` | Dual-path sign-in: native SDK (production) or browser (Expo Go/web) |
| `app/_layout.tsx` | Deep-link listener catches `exp://` and `phina://` OAuth callbacks |
| `app/(auth)/callback.tsx` | Web-only OAuth callback route for code exchange |
| `app.config.ts` | `@react-native-google-signin/google-signin` config plugin with `iosUrlScheme` |

### How the dual path works

```
signInWithGoogle()
  ├── isNativeGoogleAvailable()? (native module loaded AND not web)
  │     YES → signInWithGoogleNative()
  │           GoogleSignin.configure() + signIn()
  │           → ID token → supabase.auth.signInWithIdToken()
  │           → session returned directly (no redirect)
  │
  └──   NO  → signInWithGoogleBrowser()  (Expo Go fallback)
              supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
              → openAuthSessionAsync(googleUrl, exp://...)
              → browser closes on redirect
              → createSessionFromUrl(exp://...?access_token=...) OR
                _layout.tsx deep-link listener catches exp:// URL
```

### Security notes

- **Client IDs** in `EXPO_PUBLIC_*` env vars are intentionally public (Google's design).
- **Client Secret** is only in Supabase and never in the app bundle.
- **Skip nonce check** is enabled in Supabase because the free library version does not support custom nonces. The ID token is still cryptographically verified by Google's public keys.
- **Supabase redirect URLs** (`exp://**`, `phina://**`) are only needed for the browser fallback path. Native sign-in never uses redirects.
