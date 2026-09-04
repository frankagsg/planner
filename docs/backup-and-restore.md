# Backup & Restore

Backups are `.zip` archives containing the SQLite database (`planner.db`) plus a
small metadata file. They live in `backups/`.

## Automatic backups

- The backend runs a scheduler controlled by `.env`:
  - `BACKUP_INTERVAL_HOURS` (default `24`, `0` disables)
  - `BACKUP_RETENTION` (default `7` — older archives are pruned)
- Automatic archives are labeled `backup-auto-<timestamp>.zip`.

## Manual backups

- **In the app:** Settings → Backups → **Create backup**.
- **CLI on the Pi:**
  ```bash
  bash scripts/backup.sh
  # or
  npm --prefix server run backup
  ```

## Downloading a backup

Settings → Backups → the **download** icon next to any archive, or:

```
GET http://jessie-planner.local:4000/api/backups/<name>/download
```

Copy them off-device periodically (e.g. `scp`) for real safety:

```bash
scp pi@jessie-planner.local:~/wall-planner/backups/*.zip ./
```

## Restoring

Restoring **replaces** the current database. The app automatically takes a
`pre-restore` safety backup first.

- **From an existing archive:** Settings → Backups → **Restore** next to it.
- **Import an archive from elsewhere:** Settings → Backups → **Import archive**
  → choose a `.zip`.
- After restoring, **restart the app** so the new database is fully loaded:
  ```bash
  sudo systemctl restart wall-planner
  ```

Restore and import are **admin-protected** (LAN-only, or `ADMIN_TOKEN`).

## What's in the backup

| File | Contents |
|------|----------|
| `planner.db` | All events, tasks, notes, school data, countdowns, personal config, settings |
| `backup-meta.json` | Timestamp, label, format version |

> Photos in `client/public/photos/` and OAuth tokens in `config/` are **not**
> included in DB backups — copy those separately if you want them preserved.
