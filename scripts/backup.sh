#!/usr/bin/env bash
# =============================================================================
# Create a manual backup archive of the planner database.
# Uses the app's own backup routine so archives match the in-app format.
#   bash scripts/backup.sh
# Backups land in ./backups and old ones are pruned to BACKUP_RETENTION.
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR/server"
node src/lib/backupCli.js
