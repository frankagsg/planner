# Google Calendar Setup

The planner syncs Google Calendar using **OAuth 2.0**. You create an OAuth
client in Google Cloud, put the ID/secret in `.env`, then connect from
**Settings → Google** in the app. No credentials are hardcoded, and the access
token is stored on the Pi at `config/google-token.json` with `chmod 600`.

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown → **New Project**. Name it e.g. `Wall Planner`.
3. Select the new project.

## 2. Enable the Google Calendar API

1. Navigation menu → **APIs & Services → Library**.
2. Search **Google Calendar API** → **Enable**.

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** (works for a personal Google account) → **Create**.
3. Fill in app name (`Wall Planner`), your support email, and a developer
   contact email. Save and continue.
4. **Scopes** → Add:
   - `.../auth/calendar.readonly`
   - `.../auth/calendar.events`
5. **Test users** → add the Google account(s) whose calendar you'll sync.
   (While the app is in "Testing" status only these accounts can connect — that
   is fine for a personal kiosk.)

## 4. Create OAuth credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Wall Planner Web`.
4. **Authorized redirect URIs** — add the exact URLs the app will use. Add both:
   - `http://localhost:4000/api/google/callback`
   - `http://jessie-planner.local:4000/api/google/callback`
   > These must match `GOOGLE_REDIRECT_URI` in `.env` **exactly** (scheme, host,
   > port, path). If you connect while viewing the app on the Pi itself, use the
   > `localhost` one; if you connect from another device pointing at the Pi's
   > hostname, use the `jessie-planner.local` one and set that as
   > `GOOGLE_REDIRECT_URI`.
5. **Create**. Copy the **Client ID** and **Client secret**.

## 5. Put the values in `.env`

```dotenv
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_TOKEN_PATH=./config/google-token.json
```

Restart the backend so it picks up the new values:

```bash
sudo systemctl restart wall-planner.service   # on the Pi
# or Ctrl-C + `npm --prefix server start` in dev
```

## 6. Connect in the app

1. Open **Settings → Google**.
2. Click **Connect Google Calendar** — you're redirected to Google's consent
   screen.
3. Approve access. Google redirects back to the app; the token is saved and an
   initial sync runs.
4. Under **Calendars to show**, tick the calendars you want displayed. Use
   **Sync now** anytime; the backend also auto-syncs every ~15 minutes
   (`google.autoSyncMinutes`).

---

## How sync works

- Selected calendars are pulled for a window of −7 to +60 days.
- Recurring events are expanded server-side (`singleEvents: true`).
- Google events are stored locally with `source='google'` so they still show
  when offline. Local events you create stay `source='local'`.
- Deleting/cancelling upstream removes the local copy on the next sync.

## Editing / creating on Google

The requested scopes include `calendar.events`, so the backend **can** create
and delete remote events (`server/src/services/google.js` →
`createRemoteEvent` / `deleteRemoteEvent`). By default the UI creates events in
the **local** calendar; point creation at a Google calendar by wiring those
service calls into your workflow if you want writes to flow upstream.

## Troubleshooting

- **redirect_uri_mismatch** — the URI in `.env` doesn't exactly match one you
  registered. Fix and restart.
- **access_denied / app not verified** — add your account under **Test users**,
  or publish the consent screen.
- **No refresh token** — the app requests `access_type=offline` +
  `prompt=consent`, so you get one on first grant. If it's missing, disconnect
  and reconnect.
- Token lives at `config/google-token.json` (`chmod 600`). Delete it (or use
  **Disconnect**) to fully reset.
