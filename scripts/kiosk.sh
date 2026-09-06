#!/usr/bin/env bash
# =============================================================================
# Launch Chromium in fullscreen kiosk mode pointing at the local planner.
# Auto-recovers because the systemd unit restarts this script on exit.
# Tuned for Raspberry Pi OS Bookworm (Wayland/labwc) with an X11 fallback.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read the kiosk URL from .env (fallback to localhost).
URL="$(grep -E '^KIOSK_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2-)"
URL="${URL:-http://localhost:4000}"

# Find the Chromium binary (name varies across releases).
CHROME_BIN=""
for c in chromium-browser chromium chromium-browser-l10n; do
  if command -v "$c" >/dev/null 2>&1; then CHROME_BIN="$(command -v "$c")"; break; fi
done
if [[ -z "$CHROME_BIN" ]]; then
  echo "[kiosk] Chromium not found. Install it (see scripts/install.sh)." >&2
  exit 1
fi

# Hide the mouse cursor after inactivity (harmless if unclutter missing).
command -v unclutter >/dev/null 2>&1 && (unclutter -idle 0.5 -root &) 2>/dev/null || true

# A dedicated, disposable profile keeps the kiosk clean across reboots.
PROFILE_DIR="$APP_DIR/.chromium-kiosk"
mkdir -p "$PROFILE_DIR"

# Clear a stale singleton lock left by an unclean shutdown, so Chromium doesn't
# refuse to start with "profile appears to be in use".
rm -f "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonSocket" 2>/dev/null || true

# Clear previous "exited abnormally" flags so no restore bubble appears.
PREFS="$PROFILE_DIR/Default/Preferences"
if [[ -f "$PREFS" ]]; then
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' "$PREFS" 2>/dev/null || true
fi

exec "$CHROME_BIN" \
  --kiosk \
  --app="$URL" \
  --user-data-dir="$PROFILE_DIR" \
  --password-store=basic \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --hide-scrollbars \
  --ozone-platform=wayland \
  --start-fullscreen
