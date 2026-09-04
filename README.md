# Wall Planner 🗓️💛

A warm, touch-first **wall planner kiosk** for a Raspberry Pi 5 on a 1920×1080
landscape touchscreen. Calendar, tasks, school tracker, notes, a couples
section, weather, clock, countdowns, Google Calendar sync, backups, an in-app
touch keyboard, screensaver, and scheduled screen sleep/wake — all running
**locally on the Pi** with no cloud dependency for core features.

Built for **touch from a few feet away**: large targets, no hover, no
right-click, no keyboard shortcuts required.

---

## Architecture

```
wall-planner/
├── client/            React + TypeScript + Vite + Tailwind (touch UI)
│   ├── src/pages/         Home, Calendar, Tasks, School, Notes, Personal, Settings, SetupWizard
│   ├── src/components/    Sidebar, widgets, virtual keyboard, screensaver, error boundary
│   └── dist/              Production build (served by the backend)
├── server/            Node.js + Express REST API
│   ├── src/routes/        events, tasks, notes, school, countdowns, personal,
│   │                      settings, weather, google, backups, system, setup, dashboard
│   ├── src/services/      weather (open-meteo/OWM), google OAuth, backup
│   └── src/db/            better-sqlite3 connection, migrations, seed
├── database/          SQLite DB + SQL migrations
├── config/            systemd unit + timer templates
├── scripts/           install.sh, kiosk.sh, screen.sh, update.sh, backup.sh, verify.mjs
├── docs/              setup + operations guides
├── backups/           generated backup archives
└── .env.example       fully-commented configuration template
```

**Single origin in production:** the Express server serves the built React app
_and_ the `/api` REST endpoints on one port (default `4000`), so Chromium just
opens `http://localhost:4000`.

**Data model** (SQLite, WAL mode): `categories`, `events`, `tasks`, `notes`,
`school_classes`, `school_items`, `countdowns`, `personal_config`,
`personal_events`, `settings`. Migrations live in `database/migrations/` and run
automatically on boot.

---

## Features

- **Home dashboard** — greeting, clock, weather, today's events & tasks, chores,
  meals, grocery count, family avatar row, school progress, pinned notes,
  countdowns, couples card, plus a one-tap **Photo Mode** frame.
- **Family members** — unlimited profiles (name, color, emoji/initial, birthday,
  adult/child), reorderable, fully local. Events, tasks, and chores can belong to
  a person and are **color-coded** across the app, with an *Everyone / per-person*
  filter on Calendar, Tasks, and Chores.
- **Calendar** — FullCalendar with month / week / day / agenda views, categories
  with colors, per-member color-coding + filter, tap a slot to create, tap an
  event to edit/delete/reschedule.
- **Tasks** — name, due, priority, category, member, notes; Today / Upcoming /
  Completed; gentle completion animation.
- **Chores & rewards** — kid-friendly chore chart with points, daily/weekly/
  specific-day recurrence and **auto rollover**, big tap-to-complete targets, and
  a weekly + all-time **points leaderboard**. Encouraging, not stressful.
- **Meals** — weekly 7-day × breakfast/lunch/dinner/snack grid; tap a slot to
  add/edit; one tap to **push a meal's ingredients onto the grocery list**.
- **Lists** — multiple shopping/grocery lists with big checkboxes, on-screen-
  keyboard entry, per-item member tags, and clear-checked. A **Groceries** list
  is seeded by default.
- **Multi-calendar sync (ICS)** — subscribe to any public iCloud / Outlook /
  Google / school `.ics` (or `webcal://`) feed, read-only, color-coded, on the
  same auto-sync schedule as Google — no OAuth required. Robust: URLs are
  validated, failures are stored per-feed and never crash the app. See
  [ICS calendar setup](docs/ics-calendar-setup.md).
- **School** — classes, clinicals, assignments, exams, study, reading; due
  today/tomorrow/this-week/overdue filters; encouraging (not stressful) progress
  summary like “4 remaining · you’ve got this”.
- **Notes** — colored, pinnable, touch-friendly cards.
- **Personal (“Us”)** — next-date countdown, editable message, rotating local
  photos, shared events; can be **fully disabled**.
- **Weather** — current/feels-like/hi-lo/precip, hourly + multi-day; provider
  configurable (open-meteo needs **no key**); API key comes from `.env`; fails
  gracefully with last-known data.
- **Clock/date** — 12/24h, seconds toggle, date format; uses local system time.
- **Countdowns** — multiple, customizable.
- **Settings** — General / **Family** / Display / Appearance / Calendar /
  **Calendars (ICS)** / Weather / Personal / Google / Backups / System, with
  confirmation before reboot/shutdown.
- **Google Calendar** — real OAuth 2.0, tokens stored on disk `chmod 600` (never
  in the frontend), import/display/sync, multiple calendars.
- **First-run wizard** — 8 guided steps.
- **Backups** — manual + scheduled local archives, keep the most recent N,
  export/download and import/restore.
- **Reliability** — React error boundaries (no white screen if one widget
  fails), backend error handling + logging, graceful API failures. **Offline
  mode** shows cached calendar/tasks/notes/clock/last-weather with a subtle
  “Offline” badge and auto-refreshes on reconnect.
- **Kiosk** — in-app touch keyboard, inactivity screensaver, scheduled screen
  sleep/wake, Chromium fullscreen with crash auto-recovery.

---

## Run locally (dev)

Requires Node ≥ 18 (this repo was verified on Node 24 / npm 11).

```bash
# 1. Install dependencies
npm install --prefix server
npm install --prefix client

# 2. Configure
cp .env.example .env        # edit as needed (works out-of-the-box with open-meteo)

# 3. Migrate + seed demo data
npm --prefix server run migrate
npm --prefix server run seed

# 4a. Dev mode (Vite on :5173 proxying the API on :4000)
npm install                 # root, for the `dev` convenience script
npm run dev

# 4b. …or production-style (build client, serve everything from :4000)
npm --prefix client run build
npm --prefix server start
# open http://localhost:4000
```

Verify the whole stack at any time:

```bash
npm --prefix client run build   # produce client/dist
node scripts/verify.mjs         # starts server, checks endpoints + SPA
```

---

## Deploy to a Raspberry Pi 5

On a fresh Raspberry Pi OS Bookworm (64-bit) with the touchscreen attached and
Wi-Fi connected:

```bash
git clone <your-repo-url> wall-planner   # or copy the folder to the Pi
cd wall-planner
bash scripts/install.sh                  # installs everything, sets up systemd
nano .env                                # add Google + weather credentials
sudo reboot                              # kiosk launches on boot
```

After reboot the planner runs at `http://localhost:4000` on the Pi and, on your
LAN, at `http://jessie-planner.local:4000`.

See [`docs/kiosk-and-systemd.md`](docs/kiosk-and-systemd.md) for exactly what the
installer does and how to operate the device.

---

## Credentials you must supply

| What | Where | Needed for |
|------|-------|-----------|
| Weather API key | `.env` → `WEATHER_API_KEY` (only if `WEATHER_PROVIDER=openweathermap`) | Weather via OpenWeatherMap. **Not needed** with the default open-meteo provider. |
| Google OAuth client | `.env` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Calendar sync |
| Admin token (optional) | `.env` → `ADMIN_TOKEN` | Extra protection for reboot/shutdown/restore when off-LAN |

- [`docs/google-calendar-setup.md`](docs/google-calendar-setup.md) — full Google
  Cloud walkthrough.
- [`docs/weather-setup.md`](docs/weather-setup.md) — providers + keys.

**Security:** no credentials are hardcoded anywhere. OAuth tokens are written to
`config/google-token.json` with `chmod 600` and never bundled into the frontend.
Admin/system endpoints are restricted to the LAN (or an admin token).

---

## Docs

- [Google Calendar setup](docs/google-calendar-setup.md)
- [ICS calendar subscriptions (iCloud / Outlook / any public feed)](docs/ics-calendar-setup.md)
- [Weather setup](docs/weather-setup.md)
- [Kiosk & systemd](docs/kiosk-and-systemd.md)
- [Backup & restore](docs/backup-and-restore.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Updating later](docs/updating.md)

---

## License

MIT
