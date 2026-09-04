#!/usr/bin/env bash
# =============================================================================
# Wall Planner — Raspberry Pi 5 installer (Raspberry Pi OS Bookworm, 64-bit)
#
# Idempotent where practical: safe to re-run. It:
#   - checks the OS / architecture
#   - installs system dependencies (Node, Chromium, on-screen keyboard, tools)
#   - installs app dependencies and builds the frontend
#   - creates runtime dirs, sets permissions
#   - installs + enables systemd services (backend + kiosk)
#   - installs the screen sleep/wake timers
#
# Run as the normal 'pi' user (NOT root). It will use sudo where needed.
#   bash scripts/install.sh
# =============================================================================
set -euo pipefail

# ---- resolve paths ----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"
NODE_MAJOR=22  # better-sqlite3 v13 requires Node >= 22

log()  { printf '\033[1;35m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

if [[ "$(id -u)" -eq 0 ]]; then
  err "Please run as the normal user (e.g. 'pi'), not root. It will sudo when needed."
  exit 1
fi

log "App directory: $APP_DIR"
log "Run user:      $RUN_USER"

# ---- 1. OS / arch sanity check ---------------------------------------------
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  log "OS: ${PRETTY_NAME:-unknown}"
fi
ARCH="$(uname -m)"
if [[ "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
  warn "Architecture is '$ARCH' (expected aarch64). Continuing, but this is tuned for Pi OS 64-bit."
fi
if ! grep -qi 'raspberry\|debian' /etc/os-release 2>/dev/null; then
  warn "This doesn't look like Raspberry Pi OS/Debian. Package steps may differ."
fi

# ---- 2. System packages -----------------------------------------------------
log "Updating apt package lists…"
sudo apt-get update -y

log "Installing base packages…"
sudo apt-get install -y \
  ca-certificates curl git build-essential python3 \
  chromium-browser \
  unclutter \
  avahi-daemon \
  wtype squeekboard \
  jq || {
    # chromium-browser is sometimes just 'chromium' on Bookworm
    warn "Some packages failed; retrying with 'chromium' instead of 'chromium-browser'."
    sudo apt-get install -y chromium || true
  }

# Screen control tools: pick what matches the session type.
# Wayland (labwc, the Bookworm default): wlopm. X11: x11-xserver-utils (xset).
log "Installing display-control helpers (Wayland + X11)…"
sudo apt-get install -y wlopm 2>/dev/null || warn "wlopm not available in apt; see docs for manual install."
sudo apt-get install -y x11-xserver-utils 2>/dev/null || true

# ---- 3. Node.js -------------------------------------------------------------
install_node() {
  log "Installing Node.js ${NODE_MAJOR}.x via NodeSource…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
  # Native modules compiled against an older Node ABI will segfault — force rebuild.
  rm -rf "$APP_DIR/server/node_modules"
}
if command -v node >/dev/null 2>&1; then
  CUR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  if [[ "$CUR" -lt "$NODE_MAJOR" ]]; then
    warn "Node $(node -v) is too old; installing ${NODE_MAJOR}.x"
    install_node
  else
    log "Node $(node -v) already installed."
  fi
else
  install_node
fi
log "npm $(npm -v)"

# ---- 4. App dependencies + build -------------------------------------------
log "Installing server dependencies…"
( cd "$APP_DIR/server" && npm install --omit=dev --no-audit --no-fund )

log "Installing client dependencies…"
( cd "$APP_DIR/client" && npm install --no-audit --no-fund )

log "Building the frontend…"
( cd "$APP_DIR/client" && npm run build )

# ---- 5. Env + runtime dirs --------------------------------------------------
if [[ ! -f "$APP_DIR/.env" ]]; then
  log "Creating .env from .env.example (edit it to add credentials)…"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi
mkdir -p "$APP_DIR/database" "$APP_DIR/backups" "$APP_DIR/config" "$APP_DIR/logs" \
         "$APP_DIR/client/public/photos"
chmod 700 "$APP_DIR/config"   # OAuth tokens live here

log "Running database migrations…"
( cd "$APP_DIR/server" && node src/db/migrate.js )

# Seed demo data only if the DB is brand new and not seeded.
if ( cd "$APP_DIR/server" && node -e "import('./src/lib/settings.js').then(({getSetting})=>process.exit(getSetting('general.demoSeeded')?1:0))" ); then
  log "Seeding demo data (first run)…"
  ( cd "$APP_DIR/server" && node src/db/seed.js ) || warn "Seed skipped."
else
  log "Demo data already present or previously cleared; skipping seed."
fi

# ---- 6. systemd services ----------------------------------------------------
log "Installing systemd service files…"
render() {
  sed -e "s#@APP_DIR@#${APP_DIR}#g" \
      -e "s#@RUN_USER@#${RUN_USER}#g" \
      "$1"
}
render "$APP_DIR/config/wall-planner.service"      | sudo tee /etc/systemd/system/wall-planner.service      >/dev/null
render "$APP_DIR/config/wall-planner-sleep.service"| sudo tee /etc/systemd/system/wall-planner-sleep.service>/dev/null
render "$APP_DIR/config/wall-planner-wake.service" | sudo tee /etc/systemd/system/wall-planner-wake.service >/dev/null

# Screen schedule timers read times from .env.
WAKE="$(grep -E '^SCREEN_WAKE=' "$APP_DIR/.env" | cut -d= -f2 || echo 07:00)"
SLEEP="$(grep -E '^SCREEN_SLEEP=' "$APP_DIR/.env" | cut -d= -f2 || echo 23:30)"
sed -e "s#@TIME@#${WAKE}#g" "$APP_DIR/config/wall-planner-wake.timer" \
  | sudo tee /etc/systemd/system/wall-planner-wake.timer >/dev/null
sed -e "s#@TIME@#${SLEEP}#g" "$APP_DIR/config/wall-planner-sleep.timer" \
  | sudo tee /etc/systemd/system/wall-planner-sleep.timer >/dev/null

# ---- 7. sudoers for screen/power actions (scoped, no password) --------------
log "Installing scoped sudoers rule for screen power + reboot/shutdown…"
SUDOERS_FILE=/etc/sudoers.d/wall-planner
sudo tee "$SUDOERS_FILE" >/dev/null <<EOF
# Allow the planner service user to control display power and system power
# WITHOUT a password. Scoped to specific commands only.
${RUN_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl reboot, /usr/bin/systemctl poweroff, /usr/bin/systemctl restart wall-planner.service, /usr/bin/vcgencmd display_power *
EOF
sudo chmod 440 "$SUDOERS_FILE"
sudo visudo -c -f "$SUDOERS_FILE" >/dev/null || { err "sudoers validation failed"; sudo rm -f "$SUDOERS_FILE"; }

# ---- 8. Hostname / avahi ----------------------------------------------------
if command -v hostnamectl >/dev/null 2>&1; then
  CURRENT_HOST="$(hostnamectl --static 2>/dev/null || hostname)"
  if [[ "$CURRENT_HOST" != "jessie-planner" ]]; then
    log "Setting hostname to 'jessie-planner' (reachable at jessie-planner.local)…"
    sudo hostnamectl set-hostname jessie-planner || warn "Could not set hostname."
  fi
fi
sudo systemctl enable --now avahi-daemon 2>/dev/null || true

# ---- 9. Enable + start ------------------------------------------------------
log "Reloading systemd and enabling services…"
sudo systemctl daemon-reload
sudo systemctl enable --now wall-planner.service
# Remove any legacy kiosk system unit from older installs. A system-level unit
# with WantedBy=graphical-session.target never fires (that target is per-user),
# so the kiosk is launched from the desktop session autostart instead.
sudo systemctl disable --now wall-planner-kiosk.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/wall-planner-kiosk.service

log "Installing kiosk desktop-session autostart…"
KIOSK_LOOP="$APP_DIR/scripts/kiosk-loop.sh"
cat > "$KIOSK_LOOP" <<LOOP
#!/bin/bash
# Wait for the backend, then keep Chromium kiosk alive (relaunch on crash).
until curl -sf http://localhost:4000/api/health >/dev/null; do sleep 1; done
while true; do
  "$APP_DIR/scripts/kiosk.sh"
  sleep 3
done
LOOP
chmod +x "$KIOSK_LOOP"
USER_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
mkdir -p "$USER_HOME/.config/labwc" "$USER_HOME/.config/autostart"
# labwc (Wayland, Pi OS default) runs this file as a shell script at session start.
grep -qF "$KIOSK_LOOP" "$USER_HOME/.config/labwc/autostart" 2>/dev/null || \
  echo "$KIOSK_LOOP &" >> "$USER_HOME/.config/labwc/autostart"
# XDG autostart covers X11/LXDE/wayfire sessions.
cat > "$USER_HOME/.config/autostart/wall-planner-kiosk.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Wall Planner Kiosk
Exec=$KIOSK_LOOP
DESK
chown -R "$RUN_USER":"$RUN_USER" "$USER_HOME/.config/labwc" "$USER_HOME/.config/autostart"
sudo systemctl enable --now wall-planner-wake.timer wall-planner-sleep.timer || true

log "-----------------------------------------------------------------------"
log "Install complete."
log "  Local URL:   http://localhost:4000"
log "  On network:  http://jessie-planner.local:4000"
log ""
log "Next steps:"
log "  1. Edit $APP_DIR/.env to add Google + weather credentials."
log "  2. Reboot to launch the kiosk cleanly:  sudo reboot"
log "  3. Check status:  systemctl status wall-planner"
log "-----------------------------------------------------------------------"
