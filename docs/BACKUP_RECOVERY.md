# TripMate backup and recovery

## Policy

- Enable Supabase daily database backups and point-in-time recovery when the production plan supports it.
- Keep a monthly encrypted export outside Supabase for at least 90 days.
- Trip files are registered in `trip_file_retention`; the default retention date is 90 days after the trip ends.
- Detailed location history remains limited to 24 hours and must not be included in long-term backups intended for product reporting.
- Test a restore into a separate Supabase project every quarter. Never test by overwriting production.

## Quarterly restore test

1. Record the production migration version and backup timestamp.
2. Create an isolated restore project with no production Auth redirect URLs or push secrets.
3. Restore the selected database backup and Storage snapshot.
4. Run every migration newer than the backup.
5. Verify counts for trips, members, stops, expenses, collections, and storage objects.
6. Sign in with a dedicated test account and verify one trip end-to-end.
7. Record the recovery time, missing records, and corrective actions.
8. Delete the isolated restore project after the report is approved.

## User-level recovery

- Owners can download CSV and JSON from **Trip settings → History and backup**.
- Deleted stops, expenses, and collections can be restored from Trash for seven days.
- JSON exports omit temporary signed URLs; they contain stable storage paths only.

## Incident rule

Stop writes before starting a production restore. Preserve the incident timestamp, deployment commit, database backup identifier, and audit log. Restore to an isolated project first, validate it, then schedule the production cutover.
