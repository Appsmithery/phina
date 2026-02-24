# Making your account admin

The app does not create admin users in-app. The first admin must be set in the database. After that, admins can promote or demote other members from the **Admin** tab in the app.

## Option A — Supabase Dashboard

1. Open your project in [Supabase Dashboard](https://app.supabase.com).
2. Go to **Table Editor** → **members**.
3. Find your row (match by **email** or **id**; `id` is the same as your `auth.users` id).
4. Set **is_admin** to `true`.
5. Save.

## Option B — SQL

In **SQL Editor** (or `psql` connected to your project), run:

```sql
UPDATE members SET is_admin = true WHERE email = 'your@email.com';
```

Replace `your@email.com` with the email of the account that should be admin. Alternatively, if you know your auth user id:

```sql
UPDATE members SET is_admin = true WHERE id = '<your-auth-user-uuid>';
```

You can find your user id in **Authentication** → **Users** in the dashboard (copy the UUID).

## Option C — One-off migration

The repo includes an optional migration `supabase/migrations/005_bootstrap_admin_by_email.sql`. Replace `YOUR_EMAIL` in that file with the email that should be admin, then run your migrations (or run the SQL manually in SQL Editor). The migration is idempotent (safe to run again). You can remove or leave it in place after the first run.

After setting `is_admin = true`, reload the app; the **Admin** tab will appear in the tab bar (for that account only).
