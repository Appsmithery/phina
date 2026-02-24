# Deploy Edge Functions Manually (Supabase Dashboard)

If `supabase functions deploy` fails on your machine (e.g. Windows/Scoop "Shim: Could not create process"), you can deploy and fix Edge Functions from the **Supabase Dashboard** instead.

---

## 1. Fix "Label extraction failed" (extract-wine-label)

The app shows: *"Label extraction failed. Check that the Edge Function is deployed and PERPLEXITY_API_KEY is set."*

### Option A: Function already exists – add the secret

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Edge Functions** in the left sidebar.
3. Click **extract-wine-label** (if it exists).
4. Go to **Settings** (or **Secrets**) for the function and add:
   - **Name:** `PERPLEXITY_API_KEY`
   - **Value:** your Perplexity API key (from [Perplexity API](https://www.perplexity.ai/settings/api)).
5. Save. Redeploy the function if the dashboard asks you to.

### Option B: Function missing – create and deploy

1. In the dashboard go to **Edge Functions** → **Deploy a new function**.
2. Choose **Deploy via Editor** (or **Create from template** and then replace the code).
3. Set the function name to **extract-wine-label**.
4. Paste the full contents of [supabase/functions/extract-wine-label/index.ts](../supabase/functions/extract-wine-label/index.ts) into the editor.
5. Add secret **PERPLEXITY_API_KEY** (see Option A).
6. Click **Deploy function**.

### If you see "Label extraction failed" with "Invalid JWT" (401)

The app sends the user's session JWT when calling the function. If the Supabase project uses **JWT Signing Keys** (new auth), the Edge Function gateway can sometimes return 401 even for valid tokens. Two approaches:

- **Ensure the app and function use the same project:** In the app's `.env`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` must point at the same Supabase project that hosts the function. If they differ, the gateway will reject the JWT.
- **Deploy with JWT verification skipped at the gateway:** Deploy the function with "Verify JWT" disabled (e.g. CLI: `supabase functions deploy extract-wine-label --no-verify-jwt`). The function code in this repo **verifies the JWT inside the function** using the project's JWKS, so the endpoint stays protected. If you deploy via the dashboard, check the function or project settings for a "Verify JWT" / "Skip JWT verification" option; when it is off, the function must validate the JWT itself (already implemented in `extract-wine-label/index.ts`).

---

## 2. Deploy the Notifications function (send-rating-round-push) manually

### Step 1: Open Edge Functions in the Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. In the left sidebar click **Edge Functions**.

### Step 2: Create the function

1. Click **Deploy a new function** (or **Create function**).
2. Select **Deploy via Editor** (or equivalent: create in the browser).
3. Set the function name to exactly: **send-rating-round-push**.

### Step 3: Paste the code

1. Open in your repo: `supabase/functions/send-rating-round-push/index.ts`.
2. Copy the **entire** file contents (all 206 lines).
3. In the dashboard editor, delete any template code and paste the copied code.
4. Save (e.g. **Save** or **Deploy** – the UI may deploy on save).

### Step 4: Set the secret (Web Push)

The function needs the VAPID private key for Web Push (optional for Expo-only).

1. In the Edge Function view, open **Settings** or **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**).
2. Add a secret:
   - **Name:** `VAPID_PRIVATE_KEY`
   - **Value:** the **full JWK JSON string** of your VAPID private key.

To generate a valid key:

```bash
npx @pushforge/builder vapid
```

Use the **private** key output (the whole JSON object, e.g. `{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}`) as the secret value. Use the **public** key in your app env as `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.

3. Save the secret. If the function was already deployed, you may need to **Redeploy** so it picks up the new secret.

### Step 5: Confirm the URL

After deployment, the function URL will be:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-rating-round-push
```

Your app already calls this via `supabase.functions.invoke("send-rating-round-push", { body: { event_id, wine_id } })`, so no code change is needed.

---

## 3. If the CLI works later

From the project root:

```bash
# Deploy a single function
supabase functions deploy send-rating-round-push

# Set a secret (then redeploy if the function was already deployed)
supabase secrets set VAPID_PRIVATE_KEY='{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}'
```

On Windows, if you keep seeing "Shim: Could not create process", try:

- Running the same command from **PowerShell** or **Windows Terminal** (not Cursor’s integrated terminal), or
- Using the full path to the executable, or
- Reinstalling the Supabase CLI (e.g. `scoop uninstall supabase` then `scoop install supabase`).

---

## Summary

| Function                  | Purpose              | Required secret(s)        |
|---------------------------|----------------------|---------------------------|
| **extract-wine-label**    | Wine label OCR/AI    | `PERPLEXITY_API_KEY`      |
| **send-rating-round-push**| Rating round push    | `VAPID_PRIVATE_KEY` (JWK) |

Both can be deployed and configured entirely from the Supabase Dashboard when the CLI is not usable.
