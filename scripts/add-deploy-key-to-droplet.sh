#!/usr/bin/env bash
# One-time: add the GitHub Actions deploy public key to the droplet.
# Run from a machine that can already SSH to the droplet (e.g. your laptop).
#
# Usage: ./scripts/add-deploy-key-to-droplet.sh [user@host]
# Example: ./scripts/add-deploy-key-to-droplet.sh root@159.89.184.205

set -e
DROPLET="${1:-root@159.89.184.205}"

# From workflow run #22326042016 "Show deploy public key" step
DEPLOY_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDgjUleK5Tpq8d97IdujCRmOGR9lIBaam4ThxLql5EM3 github-actions-deploy-devtools"

echo "Adding deploy key to $DROPLET ..."
ssh "$DROPLET" "grep -qF '$DEPLOY_PUBLIC_KEY' ~/.ssh/authorized_keys 2>/dev/null || echo '$DEPLOY_PUBLIC_KEY' >> ~/.ssh/authorized_keys"
echo "Done. Key is in ~/.ssh/authorized_keys (or was already present). Re-run the deploy workflow."