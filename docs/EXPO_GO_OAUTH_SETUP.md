# Expo Go OAuth Setup (Development)

## Quick Fix for "User cancelled" Issue

When testing Google OAuth in Expo Go, you'll see "User cancelled" in the logs because the OAuth redirect URL isn't configured in Supabase yet.

### Steps to Fix:

1. **Run the app and attempt Google sign-in**
   - You'll see logs like:
     ```
     [oauth-google] Using redirect URL: exp://192.168.1.100:8081
     [oauth-google] ⚠️  Make sure this URL is added to Supabase Dashboard
     ```

2. **Copy the redirect URL from the logs**
   - It will be something like `exp://192.168.x.x:8081`

3. **Add to Supabase Dashboard**
   - Go to: [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to: **Authentication → URL Configuration**
   - Under **Redirect URLs**, add:
     - The specific URL from the logs (e.g., `exp://192.168.1.100:8081`)
     - **OR** add the wildcard: `exp://**` (recommended for development)
   - Click **Save**

4. **Try signing in again**
   - The OAuth flow should now complete successfully
   - You should see: `[oauth-google] ✅ Success! Callback URL received`

### Why This Happens

- **Expo Go** uses the `exp://` URL scheme during development
- **Standalone builds** use the custom `phina://` scheme
- Supabase needs to know which URLs are allowed for OAuth redirects
- The `exp://**` wildcard allows any Expo Go redirect during development

### For Production

When you build a standalone app (not Expo Go), the redirect URL will automatically use `phina://` which should already be configured in Supabase as `phina://**`.

### Troubleshooting

If you still see "User cancelled" after adding the redirect URL:

1. **Double-check the URL matches exactly** - including the IP address and port
2. **Try the wildcard** `exp://**` instead of a specific URL
3. **Restart the Expo dev server** after changing Supabase settings
4. **Check the console logs** for any error messages from Supabase
5. **Verify Google OAuth is enabled** in Supabase Dashboard → Authentication → Providers
