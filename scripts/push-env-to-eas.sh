#!/usr/bin/env bash
# push-env-to-eas.sh
# Promotes EXPO_PUBLIC_* variables from .env to EAS production environment.
# Run from the project root: bash scripts/push-env-to-eas.sh
#
# Usage:
#   bash scripts/push-env-to-eas.sh           # dry run (prints commands, does not execute)
#   bash scripts/push-env-to-eas.sh --apply   # actually creates/updates the vars in EAS

set -euo pipefail

ENV_FILE=".env"
ENVIRONMENT="production"
DRY_RUN=true

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE not found. Run from project root."
  exit 1
fi

# Variables to promote and their EAS visibility level.
# "plaintext"  → visible in Expo dashboard UI (fine for non-secret public keys)
# "sensitive"  → masked in UI, still readable by builds
# "secret"     → never readable after creation; build-only
declare -A VISIBILITY=(
  [EXPO_PUBLIC_SUPABASE_URL]="plaintext"
  [EXPO_PUBLIC_SUPABASE_ANON_KEY]="plaintext"
  [EXPO_PUBLIC_APP_URL]="plaintext"
  [EXPO_PUBLIC_EAS_PROJECT_ID]="plaintext"
  [EXPO_PUBLIC_VAPID_PUBLIC_KEY]="plaintext"
  [EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID]="plaintext"
  [EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID]="plaintext"
  [EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME]="plaintext"
  [EXPO_PUBLIC_REVENUECAT_IOS_API_KEY]="secret"
  [EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID]="plaintext"
  [EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID]="plaintext"
  [EXPO_PUBLIC_SENTRY_DSN]="plaintext"
  [EXPO_PUBLIC_POSTHOG_KEY]="plaintext"
  [EXPO_PUBLIC_POSTHOG_HOST]="plaintext"
)

echo ""
echo "Environment : $ENVIRONMENT"
echo "Source file : $ENV_FILE"
echo "Mode        : $([ "$DRY_RUN" = true ] && echo 'DRY RUN (pass --apply to execute)' || echo 'APPLY')"
echo ""

# Parse .env file into an associative array
declare -A ENV_VALUES
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  # Skip comments and blank lines
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  # Strip inline comments and surrounding quotes from value
  value="${value%%#*}"           # remove inline comment
  value="${value#\"}" ; value="${value%\"}"   # strip double quotes
  value="${value#\'}" ; value="${value%\'}"   # strip single quotes
  value="${value%"${value##*[![:space:]]}"}"  # rtrim whitespace
  ENV_VALUES["$key"]="$value"
done < "$ENV_FILE"

MISSING=()
SKIPPED=()

for var in "${!VISIBILITY[@]}"; do
  vis="${VISIBILITY[$var]}"
  val="${ENV_VALUES[$var]:-}"

  if [[ -z "$val" ]]; then
    MISSING+=("$var")
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry-run] eas env:create --environment $ENVIRONMENT --name $var --value \"***\" --visibility $vis --non-interactive"
  else
    echo -n "  Setting $var ($vis)... "
    if npx eas env:create \
        --environment "$ENVIRONMENT" \
        --name "$var" \
        --value "$val" \
        --visibility "$vis" \
        --non-interactive 2>/dev/null; then
      echo "✅"
    else
      # Already exists — update instead
      echo -n "(exists, updating) "
      if npx eas env:update \
          --environment "$ENVIRONMENT" \
          --name "$var" \
          --value "$val" \
          --non-interactive 2>/dev/null; then
        echo "✅"
      else
        echo "⚠️  skipped"
        SKIPPED+=("$var")
      fi
    fi
  fi
done

echo ""
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "⚠️  Not found in $ENV_FILE (set manually or add to .env first):"
  for v in "${MISSING[@]}"; do echo "     $v"; done
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo "⚠️  Could not update (set manually in Expo dashboard):"
  for v in "${SKIPPED[@]}"; do echo "     $v"; done
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "ℹ️  Dry run complete. Re-run with --apply to push to EAS."
else
  echo "✅ Done. Verify with: npx eas env:list --environment $ENVIRONMENT"
fi
echo ""
