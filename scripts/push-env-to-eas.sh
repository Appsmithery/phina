#!/usr/bin/env bash
# push-env-to-eas.sh
# Promotes EXPO_PUBLIC_* variables from .env to an EAS environment.
# Run from the project root: bash scripts/push-env-to-eas.sh
#
# Usage:
#   bash scripts/push-env-to-eas.sh                          # dry run → production
#   bash scripts/push-env-to-eas.sh --apply                  # apply  → production
#   bash scripts/push-env-to-eas.sh --env development        # dry run → development
#   bash scripts/push-env-to-eas.sh --env development --apply# apply  → development
#
# EAS environments: production | preview | development
# - Local dev (expo start) reads .env directly — no EAS vars needed.
# - EAS vars are only used during eas build runs on EAS infrastructure.

set -euo pipefail

ENV_FILE=".env"
ENVIRONMENT="production"
DRY_RUN=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) DRY_RUN=false ;;
    --env)   ENVIRONMENT="${2:?--env requires a value: production|preview|development}"; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "preview" && "$ENVIRONMENT" != "development" ]]; then
  echo "❌ Invalid environment '$ENVIRONMENT'. Must be: production | preview | development"
  exit 1
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
  [EXPO_PUBLIC_REVENUECAT_IOS_API_KEY]="sensitive"
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
  value="${value%% }"  # rtrim trailing space
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
          --variable-name "$var" \
          --variable-value "$val" \
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
