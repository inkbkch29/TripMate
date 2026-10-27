# Packing List redesign — 2026-10-27

## UI
Personal/shared segmented tabs with outstanding counts; per-tab prepared count and mint progress. Compact personal rows with optional note and role-aware edit/delete menu. Shared rows separate unassigned/assigned/prepared states, claim/release, member avatar and status. Add/edit share a responsive sheet/dialog with type cards, 15-member tested selector, optional note, sticky submit, duplicate-submit guard and short success snackbar. Completion is optimistic with rollback on failure. Existing trip routes and expenses/voting/itinerary logic unchanged.

## Backend
Migration 20261027010000 adds owner_user_id, note, updated_at and revision to the existing checklist table. Original visibility is authoritative; ambiguous legacy private ownership aborts migration. Personal ownership derives from created_by after verifying legacy assignee consistency. No items deleted. Two original items preserved; a transaction compared original content fingerprints before commit.

RPC manage_trip_packing locks memberships then the item, checks membership and ownership, validates revision, assignee membership, title and note. All authenticated writes go through RPC; RLS permits private reads only to owner, never automatically owner/planner. Shared completion requires assignee or planner/owner; claim does not complete, release resets completion. Create uses client UUID for retry idempotency. Shared visibility-to-private conversion invalidates former readers via a generic activity event without title/note; packing events do not send activity pushes.

Metadata audit stores action, actor, assignment, completion and revision without title/note. Departure keeps shared rows, releases assignment and preserves previous metadata in history. Cascade guards keep existing trip deletion functional.

## Verification
- 215 Vitest tests / 48 files passed; production build passed (existing large-chunk advisory).
- Added UI tests for privacy, claim vs completion, optimistic rollback, edit/delete confirmation, note preservation and duplicate creation.
- Rollback SQL fixtures tested SELECT isolation for owner/planner, normal-member denial, create retry, update/conversion, own delete, forbidden edit/delete, claim collision via stale revision, completion/release, direct-write denial, departure access revocation, retained shared rows/audit and parent trip cascade.
- Database migration installed after rollback regressions and content-preservation assertions; fixtures rolled back. Guard functions were updated with the tested cascade checks before release.
- Browser: local fixture at 390×844 and 1280×900, 15 members. Created/edited/deleted fixture row, selected a member and optional note, claimed then completed a shared item (1/3 → 1/3 → 2/3). Another user's private fixture never shown; non-assignee checkbox disabled.
- Screenshots: packing-shared-mobile.png, packing-form-mobile.png, packing-desktop.png in task visualization folder.

## Limits
Browser workflow used local fixtures. Backend multi-user checks used authenticated SQL roles and rolled-back database fixtures, not two simultaneously logged-in physical devices. Row locks plus revision checks guard competing claims; the regression specifically exercises the stale second claim. No live trip packing content was changed by UI tests.
