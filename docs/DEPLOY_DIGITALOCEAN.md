# Deploy Phína to DigitalOcean

This guide gets the Expo web app deployed on a DigitalOcean droplet and served at **phina.appsmithery.co** with HTTPS.

## Prerequisites

- Droplet created; you have SSH access (e.g. `root@your-droplet-ip`).
- Domain **phina.appsmithery.co** has an **A record** pointing to the droplet’s public IP.
- Supabase project is set up; you have `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optionally `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.

---

## 1. Build the web app

Env vars are baked into the bundle at build time. Set them then export:

```bash
# From the project root (use your real values from .env)
export EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
export EXPO_PUBLIC_APP_URL="https://phina.appsmithery.co"

npm run export:web
```

Output goes to **`dist/`**. That folder is what you’ll serve on the droplet.

---

## 2. Droplet setup (one-time)

SSH into the droplet, then:

### 2.1 Install Nginx and Certbot

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
```

### 2.2 Create app directory

```bash
mkdir -p /var/www/phina
chown -R www-data:www-data /var/www/phina
```

### 2.3 Nginx site config

Create `/etc/nginx/sites-available/phina`:

```nginx
server {
    listen 80;
    server_name phina.appsmithery.co;
    root /var/www/phina;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and test:

```bash
ln -sf /etc/nginx/sites-available/phina /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 2.4 Get HTTPS certificate

```bash
certbot --nginx -d phina.appsmithery.co
```

Follow the prompts. Certbot will adjust the Nginx config for HTTPS and set up auto-renewal.

---

## 3. Deploy the built app

From your **local machine** (with `dist/` already built):

```bash
rsync -avz --delete dist/ root@YOUR_DROPLET_IP:/var/www/phina/
```

Replace `YOUR_DROPLET_IP` with the droplet’s public IP (or use the hostname once DNS resolves).

After the first Certbot run, Nginx will be serving HTTPS. Ensure Supabase **Redirect URLs** include `https://phina.appsmithery.co/**`.

---

## 4. Optional: deploy script

From the repo root you can use:

```bash
./scripts/deploy-do.sh
```

See `scripts/deploy-do.sh` for the exact build + rsync steps and required env vars.

---

## 5. Checklist

| Step | Done |
|------|------|
| A record for phina.appsmithery.co → droplet IP | ☐ |
| Build with `EXPO_PUBLIC_*` set → `dist/` | ☐ |
| Nginx installed and site config in place | ☐ |
| `dist/` uploaded to `/var/www/phina/` | ☐ |
| Certbot run for phina.appsmithery.co | ☐ |
| Supabase Auth redirect URLs include `https://phina.appsmithery.co/**` | ☐ |

---

## Troubleshooting

- **502 / no response:** Check `root /var/www/phina` exists and contains `index.html`; run `nginx -t` and `systemctl status nginx`.
- **Mixed content or API errors:** Ensure `EXPO_PUBLIC_APP_URL` was set to `https://phina.appsmithery.co` when you ran `npm run export:web`.
- **Auth redirect fails:** In Supabase → Authentication → URL Configuration, add `https://phina.appsmithery.co/**` to Redirect URLs.
