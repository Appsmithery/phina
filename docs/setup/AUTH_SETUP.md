# Auth setup (Supabase)

The app uses **magic link** for sign-up and **email + password** for sign-in. Sign Up sends a magic link; when the user taps it they land on a **set-password** page to choose a password. Returning users can use the Sign In page (email + password). Supabase must be configured so that the Email provider is enabled and redirect URLs include the set-password page.

---

## 1. Enable Email provider

- Go to **Authentication** → **Providers**.
- Ensure **Email** is enabled.
- **Confirm email:** For magic-link sign-up, the link in the email takes users to the set-password page; no separate confirmation step is required.

---

## 2. Add redirect URLs

The link in the email must redirect to a URL that your app can open. Add every URL where the app runs:

- **Authentication** → **URL Configuration** → **Redirect URLs**.

Add:

- `https://phina.appsmithery.co/**` (PWA / web)
- `https://phina.appsmithery.co/auth/set-password` (magic link redirect target; users land here to set their password)
- If you use a different app origin (e.g. custom domain), add that too, e.g. `https://your-domain.com/**` and `https://your-domain.com/auth/set-password`

Without these, Supabase may block the redirect or use a default that doesn't open your app.

---

## 3. Why you might not get the email (SMTP)

Supabase's **built-in email** is for testing only:

- Only **a few emails per hour** (e.g. 2).
- Often **only to addresses that are team members** of the Supabase project (invited in the dashboard).
- No guarantee of delivery; can be delayed or blocked.

So:

- **Testing:** Add the email address you use (e.g. your Gmail) as a **team member** in Supabase (Project Settings → Team), or use an address you've already used for that project.
- **Production / real users:** Configure **custom SMTP** so Supabase sends through your own provider (Resend, SendGrid, Postmark, AWS SES, etc.):
  - **Project Settings** → **Authentication** → **SMTP Settings**.
  - Fill in your provider's SMTP host, port, user, password, and sender address.

---

## 4. 401 Unauthorized on Sign Up or Sign In

If the browser or app shows **401 (Unauthorized)** on auth requests:

- **Authentication** → **Providers**: ensure **Email** is **enabled** (401 often means the Email provider is off).
- **Project URL and keys:** In **Project Settings** → **API**, confirm you're using the **Project URL** and **anon public** key in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (no trailing slashes, no quotes). Restart the dev server after changing `.env`.
- If the project was **paused**, resume it in the Supabase dashboard.

---

## 5. Check Auth logs

If Sign Up (magic link), Sign In, or set-password fails:

- **Authentication** → **Logs**.
- Look for `signInWithOtp`, `signInWithPassword`, or `updateUser` and any error messages.

---

## 6. Rate limits (OTP / magic link)

Supabase limits how often you can send magic-link emails (e.g. once per 60 seconds per email). You can adjust limits under **Authentication** → **Rate limits**.

## 7. Change password

Signed-in users can change their password from **Profile** (Change password section). This uses Supabase `updateUser`; no redirect URL is required.

---

## Summary

| Step | Where | What to do |
|------|--------|------------|
| Enable Email | Auth → Providers | Turn on Email provider |
| Redirect URLs | Auth → URL Configuration | Add `https://phina.appsmithery.co/**` (and any other app origins) |
| Emails not received | Auth → SMTP / Team | Use team member email for testing, or set up custom SMTP for production |
| 401 on Sign Up / Sign In | Auth → Providers / .env | Enable Email provider; check URL and anon key |
| Set-password redirect | Auth → URL Configuration | Add `https://phina.appsmithery.co/auth/set-password` |
| Debug | Auth → Logs | Confirm signInWithOtp / signInWithPassword and any errors |
