# ICS Calendar Subscriptions (iCloud, Outlook, and any public calendar)

The Wall Planner can subscribe to **read-only** calendar feeds published as
`.ics` files. This is the robust, no-OAuth way to pull in an iCloud, Outlook,
Google, school, or sports calendar. Events are fetched on a schedule, parsed,
and merged into your calendar with the color you choose.

Add feeds under **Settings → Calendars → Add**. Paste the calendar's secret
`.ics` (or `webcal://`) URL, give it a name and color, and optionally assign it
to a family member. The Planner validates the URL, does an initial sync, and
shows the last sync time (or the last error if a feed is unreachable).

Feeds re-sync automatically on the same interval as Google sync
(**Settings → Google → auto-sync minutes**, default 15). You can also press the
🔄 button next to a subscription to sync it right away.

---

## Apple iCloud

1. On a Mac, open the **Calendar** app.
2. In the sidebar, **right-click the calendar** you want to share and choose
   **Share Calendar…**.
3. Tick **Public Calendar**. A `webcal://…` URL appears.
4. Click the **share icon** and **Copy Link** (or copy the `webcal://` URL).
5. Paste it into the Planner. `webcal://` links are accepted and fetched over
   HTTPS automatically.

> iCloud can also be managed at [icloud.com](https://www.icloud.com) → Calendar
> → the share/wifi icon next to a calendar → **Public Calendar**.

## Microsoft Outlook / Microsoft 365

1. Open **Outlook on the web** (outlook.office.com or outlook.live.com).
2. Go to **Settings → Calendar → Shared calendars**.
3. Under **Publish a calendar**, pick the calendar and the permission level
   **Can view all details**, then **Publish**.
4. Copy the **ICS** link (the one ending in `.ics`, not the HTML link).
5. Paste it into the Planner.

## Google Calendar (public or secret address)

1. In Google Calendar, hover the calendar → **⋮ → Settings and sharing**.
2. Scroll to **Integrate calendar**.
3. Copy the **Secret address in iCal format** (ends in `.ics`).
4. Paste it into the Planner.

> Prefer the full Google integration (**Settings → Google**) if you want
> two-way sync and to pick individual calendars via OAuth. ICS is best for
> calendars you only need to *read*, or accounts you can't OAuth into.

## Any other calendar

Anything that publishes a public `.ics` URL works — school district calendars,
sports league schedules, holiday feeds, trash pickup schedules, etc. Just paste
the `.ics` link.

---

## Notes & troubleshooting

- **Read-only.** ICS events can't be edited or deleted from the Planner; they
  reflect the source feed. Editing happens in the source calendar.
- **Local/private addresses are rejected** (`localhost`, `127.0.0.1`, `.local`,
  etc.) as a safety measure.
- **A broken feed never crashes the app.** If a URL is wrong or the server is
  down, the subscription stores the error (shown in Settings → Calendars) and
  keeps your other calendars working. Fix the URL and press 🔄 to retry.
- **Removing a subscription** also removes its imported events from the
  calendar.
- **Recurring events**: the parser imports each feed's events as the provider
  emits them. Most providers expand recurrences server-side in published ICS
  feeds, so recurring events appear correctly.
