# Google OAuth Setup Guide

This guide covers the manual setup steps required to enable Google Sign-In via Supabase Auth.

## Prerequisites

- Google Cloud Console access
- Supabase Dashboard access for your project
- App deployed or running locally

## 1. Google Cloud Console Setup

### 1.1 Create OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**

### 1.2 Configure Web Application Client

Create a **Web application** client with the following settings:

**Authorized JavaScript origins:**
- Production: `https://phina.appsmithery.co`
- Local dev (web): `http://localhost:8081` (or your dev port)
- Expo tunnel (if testing): `https://*.exp.direct`

**Authorized redirect URIs:**
- Production Supabase: `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Local Supabase: `http://127.0.0.1:54321/auth/v1/callback`

### 1.3 Configure OAuth Consent Screen

1. Navigate to **APIs & Services → OAuth consent screen**
2. Add the following scopes (required by Supabase):
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`

### 1.4 Save Credentials

After creating the client, save:
- **Client ID** (e.g., `123456789-abc.apps.googleusercontent.com`)
- **Client Secret** (e.g., `GOCSPX-...`)

---

## 2. Supabase Dashboard Setup

### 2.1 Enable Google Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Providers**
4. Find **Google** and click to configure
5. Enable the provider
6. Paste the **Client ID** and **Client Secret** from Google Cloud Console
7. Save

### 2.2 Configure Redirect URLs

1. Navigate to **Authentication → URL Configuration**
2. Set **Site URL** to your production URL: `https://phina.appsmithery.co`
3. Add **Redirect URLs**:
   - Web production: `https://phina.appsmithery.co/**`
   - Web local dev: `http://localhost:8081/**` (or your dev port)
   - Expo tunnel (if testing): `https://*.exp.direct/**`
   - Native standalone builds: `phina://**`
   - **Expo Go development (IMPORTANT)**: `exp://**`
     - When testing in Expo Go, the redirect URL will be something like `exp://192.168.x.x:8081`
     - You can see the exact URL in the console logs when you attempt to sign in
     - Add `exp://**` as a wildcard to allow all Expo Go redirects during development

---

## 3. Local Supabase Setup (Optional)

If you're running Supabase locally via CLI, add to `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "<your-web-client-id>"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

Create a `.env` file (or add to existing) with:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="<your-client-secret>"
```

---

## 4. Testing

### 4.1 Web (Local)

```bash
npm start
# or
npx expo start --web
```

Navigate to `http://localhost:8081` (or your dev port), click "Sign in with Google", and complete the OAuth flow.

### 4.2 Native (iOS/Android)

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

Tap "Sign in with Google" on the auth screen. The app will open an in-app browser for Google sign-in, then redirect back to the app.

### 4.3 Web (Tunnel for Mobile Testing)

```bash
npx expo start --tunnel
```

This creates an HTTPS URL (e.g., `https://abc123.exp.direct:8081`) that you can access from mobile devices. Make sure this URL pattern (`https://*.exp.direct/**`) is in your Supabase Redirect URLs and Google Authorized JavaScript origins.

---

## 5. Troubleshooting

### "redirect_uri_mismatch" Error

**Cause:** The redirect URI in the OAuth request doesn't match any authorized redirect URIs in Google Cloud Console.

**Fix:**
1. Check the error message for the actual redirect URI being used
2. Add that exact URI to **Authorized redirect URIs** in Google Cloud Console
3. For Supabase, the redirect URI is typically `https://<project-ref>.supabase.co/auth/v1/callback`

### "invalid_client" Error

**Cause:** Client ID or Client Secret is incorrect.

**Fix:**
1. Verify the Client ID and Client Secret in Supabase Dashboard match those in Google Cloud Console
2. Regenerate the Client Secret in Google Cloud Console if needed and update Supabase

### Native App: "OAuth cancelled" or No Redirect

**Cause:** The app scheme (`phina://`) is not properly configured or the redirect URL doesn't match.

**Fix:**
1. Verify `scheme: "phina"` is in `app.config.ts`
2. Verify `phina://**` is in Supabase Redirect URLs
3. Rebuild the app: `npx expo prebuild` then `npx expo run:ios` or `npx expo run:android`

### Web: Stuck on Callback Screen

**Cause:** The callback route (`app/(auth)/callback.tsx`) is not handling the code exchange properly.

**Fix:**
1. Check browser console for errors
2. Verify the URL contains `code=` or `access_token=` parameters
3. Ensure `exchangeCodeForSession` is being called for PKCE flow

---

## 6. Implementation Summary

The following files were created/modified to implement Google Sign-In:

### Created Files
- `lib/oauth-google.ts` - OAuth helper functions (getOAuthRedirectUrl, createSessionFromUrl, signInWithGoogle)
- `app/(auth)/callback.tsx` - Web OAuth callback route for code exchange
- `docs/GOOGLE_OAUTH_SETUP.md` - This setup guide

### Modified Files
- `app.config.ts` - Added `expo-web-browser` to plugins
- `app/_layout.tsx` - Added deep link handler for native OAuth callback
- `app/(auth)/index.tsx` - Added "Sign in with Google" button
- `app/(auth)/sign-in.tsx` - Added "Sign in with Google" button
- `package.json` - Added `expo-web-browser` and `expo-auth-session` dependencies

### Dependencies Installed
- `expo-web-browser` - Opens in-app browser for OAuth
- `expo-auth-session` - Provides `makeRedirectUri()` for platform-specific redirect URLs

---

## 7. User Flow

### Web
1. User clicks "Sign in with Google"
2. App redirects to Google OAuth consent screen
3. User approves
4. Google redirects to `https://phina.appsmithery.co/callback?code=...`
5. Callback route exchanges code for session
6. User is redirected to `/(tabs)`

### Native (iOS/Android)
1. User taps "Sign in with Google"
2. App opens in-app browser with Google OAuth URL
3. User approves
4. Google redirects to `phina://?access_token=...&refresh_token=...`
5. App intercepts the deep link
6. `createSessionFromUrl` sets the session
7. User is navigated to `/(tabs)`

---

## 8. Security Notes

- **Client Secret:** Keep the Client Secret secure. Never commit it to version control (use environment variables).
- **Redirect URLs:** Only add trusted redirect URLs to prevent OAuth hijacking.
- **Nonce:** The implementation uses nonces for additional security (CSRF protection).
- **PKCE:** The web flow uses PKCE (Proof Key for Code Exchange) for enhanced security.

---

## 9. Next Steps

- **Apple Sign-In:** The same OAuth pattern can be reused for Apple Sign-In by adding the Apple provider in Supabase and creating a similar flow.
- **Testing:** Test the full flow on all platforms (web, iOS, Android) before deploying to production.
- **Analytics:** Consider adding analytics events for OAuth sign-in success/failure.
