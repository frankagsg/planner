# Kiosk & systemd

How the planner runs unattended on the Pi, and how to operate it.

## What `scripts/install.sh` sets up

1. **System packages** — Node 20 (NodeSource), Chromium, `unclutter` (hides the
   cursor), `avahi-daemon` (`.local` hostname), display-control tools
   (`wlopm` for Wayland, `x11-xserver-utils` for X11), `wtype`/`squeekboard`
   (OS on-screen keyboard, optional), and build tools.
2. **App** — installs server + client deps, builds the frontend.
3. **Runtime dirs** — `database/`, `backups/`, `config/` (`chmod 700`), `logs/`.
4. **Migrations + first-run seed.**
5. **systemd units** (templates in `config/`, paths substituted at install):
   - `wall-planner.service` — the Express backend. `Restart=always`.
   - `wall-planner-kiosk.service` — launches Chromium via `scripts/kiosk.sh`
     once the backend health check passes. `Restart=always`.
   - `wall-planner-wake.service` + `.timer` — screen ON at `SCREEN_WAKE`.
   - `wall-planner-sleep.service` + `.timer` — screen OFF at `SCREEN_SLEEP`.
6. **Scoped sudoers** (`/etc/sudoers.d/wall-planner`) — passwordless for exactly
   `systemctl reboot|poweroff|restart wall-planner.service` and
   `vcgencmd display_power *`. Nothing else.
7. **Hostname** — sets `jessie-planner` so the UI is reachable at
   `http://jessie-planner.local:4000` on the LAN.

## Everyday commands

```bash
# Status / logs
systemctl status wall-planner
journalctl -u wall-planner -f
tail -f logs/backend.log

# Restart just the app (also available in Settings → System)
sudo systemctl restart wall-planner

# Restart the kiosk browser
sudo systemctl restart wall-planner-kiosk

# Screen on/off now
scripts/screen.sh off
scripts/screen.sh on
```

## The kiosk browser (`scripts/kiosk.sh`)

Runs Chromium with `--kiosk --app=<KIOSK_URL>`, a disposable profile, no
infobars, no crash-restore bubble, cursor hidden, and `--ozone-platform-hint=auto`
so it works under both Wayland and X11. Because the systemd unit is
`Restart=always`, if Chromium crashes it relaunches automatically.

> **Wayland vs X11:** Raspberry Pi OS Bookworm defaults to **Wayland/labwc**. The
> kiosk unit exports `WAYLAND_DISPLAY=wayland-0` and `XDG_RUNTIME_DIR=/run/user/1000`.
> If your Pi user id isn't `1000`, edit those in
> `/etc/systemd/system/wall-planner-kiosk.service` and the sleep/wake units, then
> `sudo systemctl daemon-reload`.

## On-screen keyboard

Two layers, and the **in-app keyboard is the reliable default**:

1. **In-app touch keyboard** (implemented, always available): appears when a text
   field gains focus, docks to the bottom, and the layout reserves space so the
   focused field is never permanently covered (it also scrolls into view). No OS
   configuration needed — this is what makes the kiosk usable out of the box.
2. **OS keyboard (optional):** `squeekboard` (Wayland) is installed by the script
   if available. To use it instead, disable the in-app keyboard on a field with
   `data-vkeyboard="off"`, and enable squeekboard in the desktop settings. For a
   kiosk we recommend sticking with the in-app keyboard.

## Screen sleep / wake

- Scheduled by the two systemd **timers**, which call `scripts/screen.sh`.
- `screen.sh` auto-detects the display stack: **wlopm** (Wayland) →
  **swaymsg** → **xset** (X11) → **vcgencmd** (HDMI hardware) and uses the first
  that works.
- Change the times in `.env` (`SCREEN_WAKE`, `SCREEN_SLEEP`) or in
  **Settings → Display**, then re-run the relevant part of the installer or edit
  the timer `OnCalendar=` lines and `daemon-reload`.
- There's also a **Sleep Screen** button in **Settings → System** and an
  inactivity **screensaver** (large clock/date/weather, optional rotating
  photos) that dismisses on touch.

## Remote admin

- **SSH:** `ssh pi@jessie-planner.local` (enable SSH via `raspi-config` or an
  empty `ssh` file in `/boot`).
- **Local URL:** `http://jessie-planner.local:4000` from any device on the LAN.
- Admin/system endpoints (`/api/system/*`, restore) are limited to private-LAN
  IPs, and can additionally require `ADMIN_TOKEN`. **Do not port-forward this to
  the public internet.** If you need remote access, use a VPN/Tailscale.

## On-device verification checklist

These need real Pi hardware and can't be tested off-device:

- [ ] Kiosk launches fullscreen on boot and recovers after `pkill chromium`.
- [ ] Touch input + in-app keyboard work on the physical panel.
- [ ] `scripts/screen.sh off` / `on` actually powers the panel (confirms which
      backend your Pi uses).
- [ ] Wake/sleep timers fire at the configured times.
- [ ] `jessie-planner.local` resolves from another device.
- [ ] Reboot/shutdown buttons work (scoped sudoers active).
