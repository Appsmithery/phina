# Auth setup (Supabase)

Magic link sign-in only works after configuring Supabase. If you tap "Send magic link" and never get an email, check the following in the [Supabase Dashboard](https://supabase.com/dashboard) → your project.

---

## 1. Enable Email provider

- Go to **Authentication** → **Providers**.
- Ensure **Email** is enabled.
- For magic links you can leave **Confirm email** on or off (magic link counts as confirmation).

---

## 2. Add redirect URLs

The link in the email must redirect to a URL that your app can open. Add every URL where the app runs:

- **Authentication** → **URL Configuration** → **Redirect URLs**.

Add:

- `https://phina.appsmithery.co/**` (PWA / web)
- If you use a different app origin (e.g. custom domain), add that too, e.g. `https://your-domain.com/**`

Without these, Supabase may block the redirect or use a default that doesn’t open your app.

---

## 3. Why you might not get the email (SMTP)

Supabase’s **built-in email** is for testing only:

- Only **a few emails per hour** (e.g. 2).
- Often **only to addresses that are team members** of the Supabase project (invited in the dashboard).
- No guarantee of delivery; can be delayed or blocked.

So:

- **Testing:** Add the email address you use (e.g. your Gmail) as a **team member** in Supabase (Project Settings → Team), or use an address you’ve already used for that project.
- **Production / real users:** Configure **custom SMTP** so Supabase sends through your own provider (Resend, SendGrid, Postmark, AWS SES, etc.):
  - **Project Settings** → **Authentication** → **SMTP Settings**.
  - Fill in your provider’s SMTP host, port, user, password, and sender address.

---

## 4. 401 Unauthorized on “Send magic link”

If the browser shows **401 (Unauthorized)** on `auth/v1/otp`:

- **Authentication** → **Providers**: ensure **Email** is **enabled** (401 often means the Email provider is off).
- **Project URL and keys:** In **Project Settings** → **API**, confirm you’re using the **Project URL** and **anon public** key in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (no trailing slashes, no quotes). Restart the dev server after changing `.env`.
- If the project was **paused**, resume it in the Supabase dashboard.

---

## 5. Check Auth logs

If the button succeeds in the app but you still get no email:

- **Authentication** → **Logs**.
- Look for the `signInWithOtp` (or similar) event and any error or “email sent” message. That will show whether Supabase tried to send and if SMTP failed.

---

## Summary

| Step | Where | What to do |
|------|--------|------------|
| Enable Email | Auth → Providers | Turn on Email provider |
| Redirect URLs | Auth → URL Configuration | Add `https://phina.appsmithery.co/**` (and any other app origins) |
| Emails not received | Auth → SMTP / Team | Use team member email for testing, or set up custom SMTP for production |
| 401 on magic link | Auth → Providers / .env | Enable Email provider; check URL and anon key |
| Debug | Auth → Logs | Confirm the magic link request and any send errors |
