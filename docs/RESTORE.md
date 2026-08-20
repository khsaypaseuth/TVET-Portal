# Restore procedure

1. Stop the API server.
2. Recreate or choose target database:
   ```bash
   createdb -U postgres tvet_portal_restore
   ```
3. Restore SQL dump:
   ```bash
   gunzip -c server/backups/tved_YYYYMMDD_HHMMSS.sql.gz | psql -U postgres tvet_portal_restore
   ```
4. Restore uploads (if present):
   ```bash
   tar -xzf server/backups/uploads_YYYYMMDD_HHMMSS.tar.gz -C server/
   ```
5. Point `server/.env` `DB_NAME` at the restored database and start the API.

Test restore at least once before go-live.
