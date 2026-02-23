#!/usr/bin/env bash
# Deploy Phína web build to a DigitalOcean droplet.
# Usage: ./scripts/deploy-do.sh [user@]host
# Or:    DROPLET_HOST=root@1.2.3.4 ./scripts/deploy-do.sh
#
# Requires: .env with EXPO_PUBLIC_* set, or export them before running.
# On Windows: run in Git Bash or WSL.

set -e
cd "$(dirname "$0")/.."

DROPLET_HOST="${1:-$DROPLET_HOST}"
if [[ -z "$DROPLET_HOST" ]]; then
  echo "Usage: $0 [user@]host"
  echo "   or: DROPLET_HOST=root@1.2.3.4 $0"
  exit 1
fi

if [[ -f .env ]]; then
  echo "Loading .env..."
  set -a
  # shellcheck source=../.env
  source .env
  set +a
fi
export EXPO_PUBLIC_APP_URL="${EXPO_PUBLIC_APP_URL:-https://phina.appsmithery.co}"

for v in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY; do
  if [[ -z "${!v}" ]]; then
    echo "Missing $v (set in .env or environment)"
    exit 1
  fi
done

echo "Building web bundle (EXPO_PUBLIC_APP_URL=$EXPO_PUBLIC_APP_URL)..."
npm run export:web

echo "Uploading dist/ to $DROPLET_HOST:/var/www/phina/ ..."
if command -v rsync &>/dev/null; then
  rsync -avz --delete dist/ "$DROPLET_HOST:/var/www/phina/"
else
  echo "rsync not found, using scp (clear then copy)..."
  ssh "$DROPLET_HOST" "rm -rf /var/www/phina/*"
  scp -r dist/* "$DROPLET_HOST:/var/www/phina/"
fi

echo "Done. Open https://phina.appsmithery.co to verify."
