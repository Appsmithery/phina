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

if [[ "$CURRENT_BASENAME" =~ ^([0-9]+)_(.+)\.sql$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
else
  echo "Current migration must match <version>_<slug>.sql"
  exit 1
fi

if [[ "$TARGET_INPUT" =~ ^([0-9]+)_(.+)\.sql$ ]]; then
  TARGET_VERSION="${BASH_REMATCH[1]}"
  TARGET_SLUG="${BASH_REMATCH[2]}"
  if [[ "$TARGET_VERSION" != "$VERSION" ]]; then
    echo "Refusing to change migration version from $VERSION to $TARGET_VERSION. Rename the slug only."
    exit 1
  fi
else
  TARGET_SLUG="$TARGET_INPUT"
fi

TARGET_SLUG="${TARGET_SLUG%.sql}"
TARGET_SLUG="${TARGET_SLUG// /_}"
TARGET_BASENAME="${VERSION}_${TARGET_SLUG}.sql"
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
