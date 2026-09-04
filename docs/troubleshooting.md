# Troubleshooting

## The screen is blank / white after boot

1. Is the backend up? `systemctl status wall-planner` and `tail logs/backend.log`.
2. Is the API answering? `curl http://localhost:4000/api/health`.
3. Is Chromium running? `systemctl status wall-planner-kiosk`. Restart it:
   `sudo systemctl restart wall-planner-kiosk`.
4. The UI has React **error boundaries**, so a single failing widget won't
   white-screen the whole app — if you *do* see a blank page it's almost always
   the backend or Chromium, not the React app.

## "Weather unavailable"

- Normal if offline — the rest of the planner keeps working.
- Check `WEATHER_PROVIDER`. With `openweathermap` you must set `WEATHER_API_KEY`
  and new keys can take an hour to activate. Switch to `openmeteo` (no key) to
  rule out key issues.
- See [weather-setup.md](weather-setup.md).

## Google Calendar won't connect

- `redirect_uri_mismatch`: the `.env` `GOOGLE_REDIRECT_URI` must exactly match a
  URI registered in Google Cloud. Restart the backend after editing `.env`.
- `access_denied`: add your Google account under **Test users** on the OAuth
  consent screen.
- Reset: Settings → Google → **Disconnect**, or delete
  `config/google-token.json`.
- See [google-calendar-setup.md](google-calendar-setup.md).

## Touch keyboard doesn't appear

- It shows on focus of text inputs/textareas. Fields with `data-vkeyboard="off"`
  (date/time/select) intentionally don't trigger it.
- If a specific field never shows it, confirm it's a text-like `<input>` or
  `<textarea>`.

## Screen won't sleep/wake on schedule

- Find your display stack: `echo $WAYLAND_DISPLAY` (Wayland) vs `echo $DISPLAY`
  (X11).
- Test manually: `scripts/screen.sh off` then `scripts/screen.sh on`. The script
  prints which tool it tried.
- Wayland (Bookworm default) needs `wlopm`: `sudo apt-get install wlopm`.
- The timer services set `XDG_RUNTIME_DIR=/run/user/1000`; if your user id isn't
  1000, edit `wall-planner-sleep.service` / `wall-planner-wake.service` and
  `daemon-reload`.
- Inspect timers: `systemctl list-timers 'wall-planner-*'`.

## Reboot/shutdown buttons do nothing

- They require the scoped sudoers rule from the installer. Verify:
  `sudo cat /etc/sudoers.d/wall-planner`. Re-run `scripts/install.sh` if missing.
- Off-LAN, they also need the `ADMIN_TOKEN`.

## `better-sqlite3` failed to install

- On the Pi the installer pulls `build-essential`, so the native module builds
  fine. If you hit a prebuilt/ABI mismatch on another machine, reinstall:
  `npm --prefix server install better-sqlite3 --build-from-source`.

## `jessie-planner.local` doesn't resolve

- Ensure `avahi-daemon` is running: `sudo systemctl enable --now avahi-daemon`.
- Some networks/clients block mDNS; use the Pi's IP address instead
  (`hostname -I`).

## Port already in use

- Something else is on `4000`. Change `PORT` in `.env` and update `KIOSK_URL`
  accordingly, then restart both services.

## Logs

- Backend: `logs/backend.log` and `journalctl -u wall-planner`.
- Kiosk: `journalctl -u wall-planner-kiosk`.
- Chromium page errors: attach a keyboard and press `Ctrl+Shift+I`, or run the
  app in a normal browser on your laptop pointed at `jessie-planner.local:4000`.
