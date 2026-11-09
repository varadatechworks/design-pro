#!/usr/bin/env bash
# varadatechworks/design-pro - guarded database operator script (2026-11-09)
# Default MODE=plan is read-only. Does NOT invent or replace project migrations.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION_SOURCE="$ROOT/apps/api/db.mjs"
ENGINE="sqlite"
MODE="${1:-plan}"
if [[ "$MODE" == "plan" ]]; then
  echo "Repository: varadatechworks/design-pro"
  echo "Engine family: $ENGINE"
  echo "Migration source: apps/api/db.mjs"
  find "$MIGRATION_SOURCE" -type f \( -name '*.sql' -o -name 'db.mjs' \) | sort -V
  echo "READ-ONLY: Verify pending migrations against the true deployment database."
  echo "Record release SHA, backup reference, restore test and a migration approval."
  exit 0
fi
if [[ "$MODE" == "export-schema" ]]; then
  case "$ENGINE" in
    postgres)
      : "${DATABASE_URL:?Verified PostgreSQL URL required from secure environment}"
      command -v pg_dump >/dev/null || { echo "Install pg_dump" >&2; exit 2; }
      pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > "${SCHEMA_OUTPUT:-schema-only.sql}"
      echo "Schema-only export complete. Review before sharing (may include sensitive DDL)."
      ;;
    d1)
      : "${D1_DATABASE:?Set verified Wrangler D1 binding or database name}"
      npx wrangler d1 execute "$D1_DATABASE" --remote --command "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','view','index');"
      ;;
    sqlite)
      : "${DATABASE_FILE:?Set an existing local SQLite file; do not use ephemeral production storage}"
      command -v sqlite3 >/dev/null || { echo "Install sqlite3" >&2; exit 2; }
      sqlite3 "$DATABASE_FILE" ".schema" > "${SCHEMA_OUTPUT:-schema-only.sql}"
      ;;
  esac
  exit 0
fi
if [[ "$MODE" != "apply" ]]; then
  echo "Usage: $0 plan|export-schema|apply" >&2
  exit 2
fi
[[ "${CONFIRM_DB_MIGRATION:-}" == "BACKUP_VERIFIED" ]] || { echo "Refusing apply: confirm backup + successful restore test." >&2; exit 3; }
: "${BACKUP_REFERENCE:?Record verified backup/snapshot in change ticket}"
: "${RELEASE_SHA:?Record expected application commit}"
: "${MIGRATION_APPLY_CMD:?Set reviewed, repository-native migration command}"
if [[ "$ENGINE" == "sqlite" && "${NODE_ENV:-development}" == "production" ]]; then
  echo "Refusing production use of local SQLite UAT migration wrapper." >&2
  exit 4
fi
echo "Applying reviewed migrations to VERIFIED environment for release $RELEASE_SHA."
echo "Backup reference: $BACKUP_REFERENCE"
(cd "$ROOT" && bash -lc "$MIGRATION_APPLY_CMD")
echo "Apply command completed. Check migration history, runtime health and smoke tests."
echo "Do not assume rollback is safe; use pre-approved forward-fix/restore plan."
