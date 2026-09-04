#!/usr/bin/env bash
# =============================================================================
# Turn the display on/off in a way that works across Pi OS display stacks.
#   Usage: screen.sh on | off
# Detection order: Wayland (wlopm) -> X11 (xset) -> HDMI (vcgencmd).
# Pi OS Bookworm defaults to Wayland/labwc, so wlopm is tried first.
# =============================================================================
set -uo pipefail
ACTION="${1:-}"

if [[ "$ACTION" != "on" && "$ACTION" != "off" ]]; then
  echo "Usage: $0 on|off" >&2
  exit 2
fi

# Ensure Wayland tools can find the compositor socket when run from a timer.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"

tried=0

# 1) Wayland via wlopm (labwc/wlroots)
if command -v wlopm >/dev/null 2>&1; then
  tried=1
  if [[ "$ACTION" == "on" ]]; then wlopm --on '*' && exit 0; else wlopm --off '*' && exit 0; fi
fi

# 2) Sway (if used) via swaymsg
if command -v swaymsg >/dev/null 2>&1; then
  tried=1
  swaymsg "output * power ${ACTION}" && exit 0
fi

# 3) X11 via xset DPMS
if command -v xset >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  tried=1
  if [[ "$ACTION" == "on" ]]; then xset dpms force on && exit 0; else xset dpms force off && exit 0; fi
fi

# 4) HDMI hardware fallback
if command -v vcgencmd >/dev/null 2>&1; then
  tried=1
  if [[ "$ACTION" == "on" ]]; then sudo vcgencmd display_power 1 && exit 0; else sudo vcgencmd display_power 0 && exit 0; fi
fi

if [[ "$tried" -eq 0 ]]; then
  echo "[screen] No supported display-control tool found (wlopm/xset/vcgencmd)." >&2
fi
exit 1
