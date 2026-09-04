# Updating Later

To update the planner on the Pi after changes:

```bash
cd ~/wall-planner
bash scripts/update.sh
```

`scripts/update.sh` will:

1. Take a **safety database backup** first.
2. `git pull --ff-only` (skipped if there's no git remote or local changes).
3. Reinstall server + client dependencies.
4. Rebuild the frontend (`vite build`).
5. Run any new database migrations.
6. Restart `wall-planner.service` and the kiosk.

## Manual update (without the script)

```bash
cd ~/wall-planner
bash scripts/backup.sh
git pull                       # or copy new files over
npm --prefix server install --omit=dev
npm --prefix client install
npm --prefix client run build
npm --prefix server run migrate
sudo systemctl restart wall-planner wall-planner-kiosk
```

## Adding a database migration

1. Create `database/migrations/00N_description.sql` (numbered, ordered).
2. Write idempotent DDL (`CREATE TABLE IF NOT EXISTS …`, etc.).
3. The migration runner applies any unseen files on next start and records them
   in the `_migrations` table — already-applied files are skipped.

## Rolling back

- Restore the pre-update backup from **Settings → Backups** (or the
  `backup-manual-*` / auto archive created before the update), then restart.
- Migrations are forward-only; if you need to undo schema changes, restore a
  backup taken before that migration ran.

## Verifying after an update

```bash
npm --prefix client run build
node scripts/verify.mjs
```

A green run (all checks passed) means the API, database, and served SPA are
healthy.
