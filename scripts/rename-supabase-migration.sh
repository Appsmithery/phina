#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: bash scripts/rename-supabase-migration.sh <current-file> <new-slug-or-file>"
  echo "Example: bash scripts/rename-supabase-migration.sh 20260310123000_admin_hosting_bypass.sql allow_admin_hosting_without_credits"
  exit 1
fi

MIGRATIONS_DIR="supabase/migrations"
CURRENT_INPUT="$1"
TARGET_INPUT="$2"

CURRENT_BASENAME="$(basename "$CURRENT_INPUT")"
CURRENT_PATH="$MIGRATIONS_DIR/$CURRENT_BASENAME"

if [[ ! -f "$CURRENT_PATH" ]]; then
  echo "Migration not found: $CURRENT_PATH"
  exit 1
fi

if [[ ! "$CURRENT_BASENAME" =~ ^([0-9]+)_(.+)\.sql$ ]]; then
  echo "Current migration must match <version>_<slug>.sql"
  exit 1
fi

if [[ "$TARGET_INPUT" =~ ^([0-9]{3})_(.+)\.sql$ ]]; then
  TARGET_PREFIX="${BASH_REMATCH[1]}"
  TARGET_SLUG="${BASH_REMATCH[2]}"
elif [[ "$TARGET_INPUT" =~ ^([0-9]{3})_(.+)$ ]]; then
  TARGET_PREFIX="${BASH_REMATCH[1]}"
  TARGET_SLUG="${BASH_REMATCH[2]}"
elif [[ "$TARGET_INPUT" =~ ^[0-9]+_(.+)\.sql$ ]]; then
  echo "Target migration prefix must use the 3-digit convention, for example 036_example.sql"
  exit 1
else
  TARGET_SLUG="$TARGET_INPUT"
  MAX_PREFIX="$(
    find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
      | sed -nE 's/^([0-9]{3})_.+$/\1/p' \
      | sort -n \
      | tail -n 1
  )"

  if [[ -z "$MAX_PREFIX" ]]; then
    TARGET_PREFIX="001"
  else
    TARGET_PREFIX="$(printf '%03d' "$((10#$MAX_PREFIX + 1))")"
  fi
fi

if [[ "$TARGET_PREFIX" =~ ^[0-9]{3}$ ]]; then
  MATCHING_PREFIX_COUNT="$(
    find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name "${TARGET_PREFIX}_*.sql" | wc -l
  )"
  if [[ "$MATCHING_PREFIX_COUNT" -gt 0 ]]; then
    echo "Target prefix already exists: ${TARGET_PREFIX}_*.sql"
    exit 1
  fi
else
  echo "Target migration prefix must use exactly 3 digits"
  exit 1
fi

TARGET_SLUG="${TARGET_SLUG%.sql}"
TARGET_SLUG="${TARGET_SLUG// /_}"
TARGET_SLUG="$(printf '%s' "$TARGET_SLUG" | tr '[:upper:]' '[:lower:]')"

if [[ ! "$TARGET_SLUG" =~ ^[a-z0-9_]+$ ]]; then
  echo "Target slug may contain only lowercase letters, numbers, and underscores"
  exit 1
fi

TARGET_BASENAME="${TARGET_PREFIX}_${TARGET_SLUG}.sql"
TARGET_PATH="$MIGRATIONS_DIR/$TARGET_BASENAME"

if [[ "$CURRENT_BASENAME" == "$TARGET_BASENAME" ]]; then
  echo "Migration already matches target name: $TARGET_BASENAME"
  exit 0
fi

if [[ -e "$TARGET_PATH" ]]; then
  echo "Target migration already exists: $TARGET_PATH"
  exit 1
fi

mv "$CURRENT_PATH" "$TARGET_PATH"
echo "Renamed:"
echo "  $CURRENT_BASENAME"
echo "  -> $TARGET_BASENAME"
