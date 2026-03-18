# Supabase Production Checklist

This project keeps local Supabase CLI defaults in [supabase/config.toml](D:/APPS/phina/supabase/config.toml), but the hosted production project must be hardened separately in the Supabase dashboard.

Use this checklist before launch and whenever auth email behavior changes.

## Auth URL Configuration

In `Authentication > URL Configuration`:

- Set `Site URL` to `https://phina.appsmithery.co`
- Add `https://phina.appsmithery.co/callback` to allowed redirect URLs
- Keep password reset and email confirmation flows routed through the hosted callback bridge so native builds can reopen the app

## Email Templates

In `Authentication > Email Templates`:

- Use `{{ .ConfirmationURL }}` for confirmation and recovery links, or a wrapper that preserves `token_hash`, `type`, and `redirect_to`
- Do not hardcode `{{ .SiteURL }}` for flows that depend on `redirectTo`
- If you use a wrapper page, make sure it forwards the full confirmation URL without stripping auth params

Recommended verification:

- Create a brand new user with a non-team email
- Tap the confirmation link on iPhone
- Confirm Safari may appear briefly, then the installed app opens
- Confirm the user does not remain on the hosted callback error page

## SMTP

Supabase's default SMTP service is not production-ready. Move production email delivery to a managed SMTP provider.

In `Authentication > SMTP Settings`:

- Enable custom SMTP
- Use a managed provider, not a self-hosted mail server
- Keep a stable sender identity such as `no-reply@yourdomain`
- Disable click tracking and link rewriting for auth emails
- Configure SPF, DKIM, and DMARC for the sending domain

After enabling custom SMTP:

- Review Auth email rate limits and raise them if needed
- Send confirmation and password reset emails to a non-team address
- Confirm links are not rewritten by the mail provider

## Auth Settings

In `Authentication`:

- Keep email confirmations enabled for normal users
- Keep OTP / email link expiry at 1 hour or less
- Keep password reset separate from sign-up confirmation
- Only enable CAPTCHA for signup / signin / reset if launch traffic or abuse justifies the added operational overhead

## Security And Admin

In Supabase project and org settings:

- Run Security Advisor and resolve any RLS or exposed-data warnings
- Confirm RLS is enabled on all client-accessible tables
- Enable MFA for all org owners
- Add at least one additional owner to avoid single-admin lockout
- Enable SSL enforcement

## Availability And Recovery

- Use a paid Supabase plan so the production project does not pause
- Enable PITR if the data is important enough to justify the extra cost
- Subscribe the team to the Supabase status feed

## Regression Checks

Re-run these after any auth, domain, SMTP, or email-template change:

- New user email confirmation returns to the native app
- Password reset returns to the set-password flow
- Existing confirmed user can sign in with email and password
- Duplicate-email sign-up still tells the user to sign in or reset password
