#!/usr/bin/env bash
set -euo pipefail
# Nightly-style backup for TVED PostgreSQL + uploads
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Load .env if present
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DB_NAME="${DB_NAME:-tvet_portal}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "Backing up $DB_NAME → $BACKUP_DIR/tved_${STAMP}.sql.gz"
PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/tved_${STAMP}.sql.gz"

if [[ -d "$ROOT/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads_${STAMP}.tar.gz" -C "$ROOT" uploads
  echo "Uploads archived → $BACKUP_DIR/uploads_${STAMP}.tar.gz"
fi

# Keep 30 days
find "$BACKUP_DIR" -type f -mtime +30 -delete 2>/dev/null || true
echo "Backup complete. Restore example:"
echo "  gunzip -c $BACKUP_DIR/tved_${STAMP}.sql.gz | psql -h $DB_HOST -U $DB_USER $DB_NAME"
