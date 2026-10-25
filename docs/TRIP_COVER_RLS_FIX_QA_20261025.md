# Trip cover upload RLS fix — 2026-10-25

## Confirmed cause
The production policies owners upload/update/delete trip covers referenced storage.foldername(name) inside a subquery over public.trips t. PostgreSQL resolved name to t.name (trip title), as confirmed by live pg_policies output. Consequently even the actual trip owner was rejected with new row violates row-level security policy.

## Fix and live verification
- Applied migration 20261025143000_fix_trip_cover_storage_path.sql directly to the linked production database using the installed Supabase CLI. Existing three owner policies now explicitly reference storage.objects.name.
- Bucket, authenticated role and t.owner_id = auth.uid() restriction unchanged. No RLS disabling, public write policies, membership changes or trip-record edits.
- Also corrected the historical policy definitions for fresh environments.
- Live transaction smoke test in trip ทดสอบ: owner INSERT allowed; actual non-owner member INSERT denied; foreign folder denied; anonymous INSERT denied. All temporary metadata rolled back, no binary objects uploaded and no trip images changed.
- The upload test deliberately uses INSERT without RETURNING: SELECT/listing permissions are not granted by these write policies. A preliminary RETURNING test was rejected by that separate SELECT restriction and rolled back; no extra read policy was added.
- Fix is effective on the backend immediately; no frontend release needed for the correction. Users can retry selecting a cover and saving trip settings.
