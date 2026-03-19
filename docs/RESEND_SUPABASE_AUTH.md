# Resend + Supabase Auth Setup

This project uses Resend only as the SMTP provider for Supabase Auth in the current phase.

Scope for this document:

- Email confirmations
- Password reset emails
- Any other emails sent by Supabase Auth

Out of scope for this phase:

- Direct Resend API usage from Expo client code
- Direct Resend API usage from Supabase Edge Functions
- Any `EXPO_PUBLIC_RESEND_*` app runtime configuration

## Resend

1. Create or use a Resend account on the free tier.
2. Add and verify the sending domain `mail.appsmithery.co`.
3. Publish the DNS records Resend provides for SPF and DKIM.
4. Add DMARC for the sending domain when DNS is ready.
5. Create a dedicated API key for Supabase Auth SMTP.
6. Keep link tracking and open tracking disabled for auth mail.

Recommended sender identity:

- Sender email: `auth@mail.appsmithery.co`
- Sender name: `phína`

## Supabase

In `Authentication > Email > SMTP Settings`:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key created for Supabase Auth
- Sender email: `auth@mail.phina.appsmithery.co`
- Sender name: `Phina`

In `Authentication > URL Configuration`:

- Site URL: `https://phina.appsmithery.co`
- Allowed redirect URL: `https://phina.appsmithery.co/callback`

In `Authentication > Email Templates`:

- Use `{{ .ConfirmationURL }}` for signup confirmation and password recovery flows
- Do not hardcode `{{ .SiteURL }}` for flows that rely on `redirectTo`

## Verification

After setup:

1. Create a new user with a non-team email address.
2. Confirm the email arrives from `auth@mail.phina.appsmithery.co`.
3. Confirm the link is not rewritten by click tracking.
4. Tap the confirmation link on iPhone.
5. Verify Safari may appear briefly, then the native app opens.
6. Verify the hosted callback page does not remain on an auth error.
7. Trigger password reset and verify it lands on the set-password flow.

## Notes

- Keep Resend free tier for pre-launch and low-volume auth traffic only.
- Upgrade only when auth email volume approaches the free-tier quota or when broader transactional email is needed.
- If `RESEND_API_KEY` exists in local secrets, treat it as future server-side-only configuration unless and until app product emails are added.
