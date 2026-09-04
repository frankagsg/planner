#!/usr/bin/env bash
# =============================================================================
# Update the Wall Planner in place: pull latest, install deps, migrate, rebuild,
# and restart the services. Takes a safety backup first.
#   bash scripts/update.sh
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
log() { printf '\033[1;35m[update]\033[0m %s\n' "$*"; }

cd "$APP_DIR"

log "Backing up the database first…"
( cd server && node src/lib/backupCli.js ) || log "Backup step skipped."

if [[ -d .git ]]; then
  log "Pulling latest from git…"
  git pull --ff-only || log "git pull skipped (local changes or no remote)."
fi

log "Installing server dependencies…"
( cd server && npm install --omit=dev --no-audit --no-fund )

log "Installing client dependencies + building…"
( cd client && npm install --no-audit --no-fund && npm run build )

log "Running migrations…"
( cd server && node src/db/migrate.js )

log "Restarting services…"
sudo systemctl restart wall-planner.service
sudo systemctl restart wall-planner-kiosk.service 2>/dev/null || true

log "Update complete. Status:"
systemctl --no-pager --lines=0 status wall-planner.service || true
