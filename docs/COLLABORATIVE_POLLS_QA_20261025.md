# Collaborative Trip Polls — 2026-10-25

## Scope
- Plan tab now uses TripPolls. Existing settings and shared vote links open the same new implementation. Other Home, Recap, finance and navigation functions remain unchanged.
- Every current trip member may create draft/open polls. Creator and trip owner (the existing trip administrator role) manage them. Drafts are visible only to these managers.
- Optional member contributions; contributors may edit/remove their own unvoted options. Any option with votes in any round is protected.
- Single/multiple selection, live/after-vote/closed results, fixed electorate captured on first publication. Joining after publication does not grant a ballot; leaving does not shrink the electorate. Managers may close manually.
- One account ballot per poll/round; a parent row lock serializes submissions and auto-close. Unique ballot key prevents duplicate submissions; multi-choice selections remain separate rows under the same ballot.
- Reset archives the old round and chosen winner; delete removes the poll from the list with deleted_at. Neither erases historical vote records.
- Legacy anonymous votes remain included in results and are labeled separately from authenticated progress. New shared links require a trip member account.
- Up to six photos per option, compressed to 1400px/WebP where supported, stored privately in the trip-files bucket. Newly uploaded photos are cleaned up after failed saves. Poll photos are not registered as expiring financial attachments. Signed image links are renewed on load/retry.
- HTTPS TikTok/Maps/website fallback cards, no video embedding or metadata service. HTTPS/host checks reject dangerous schemes, credentials, local/numeric hosts and malformed URLs. External websites control their own subsequent redirects; this client does not fetch or inspect those destinations.

## Verification
- Release test suite: 131 tests passed (30 files), including 24 poll-specific tests (5 UI + 15 URL/legacy-photo utilities + 4 API/image tests).
- Production build passed. Final AvatarGroup UI change retested before release build.
- Database integration: supabase/tests/collaborative_trip_polls.sql passed against the installed schema. Uses only the designated ทดสอบ trip with two members. All test changes, including dates/membership and new polls, are rolled back.
- Verified ordinary member creation, draft privacy, creator/owner management checks, denied foreign option edits, denied disabled contributions, voted option protection, hidden results, single-choice rules, multi-choice replacement, duplicate submissions, closed-vote rejection through the legacy RPC, automatic close, ties, stable eligibility, optimistic revision checks, round history, soft deletion, anonymous denial and direct-table RLS/grants.
- Mobile browser viewport 390×844 and desktop 1440×1000 checked using the real components/theme with an injected in-memory API (20-member fixture). Created a draft, attached two photos, replaced a photo, submitted/updated multi-choice, opened gallery and voter names, added an option, closed a poll with confirmation, and checked read-only results.
- No horizontal overflow: document width 390 on mobile and 1440 on desktop; desktop detail dialog width/scrollWidth both 520.
- Physical iPhone testing and an authenticated browser upload against live storage were not performed. Storage preparation/signing/failure cleanup are covered by API tests; live authorization/ballot behavior is covered by rollback SQL tests.

## Data integrity and migration
- Applied 20261025220000_collaborative_trip_polls.sql and recorded it in remote migration history.
- Migration checks hashes of every legacy field under a brief table lock before commit. Existing 3 polls, 7 options and 21 vote rows remained identical.
- No financial tables or calculations changed.

## Evidence
- polls-mobile.png: multi-choice preview after ballot update.
- polls-desktop.png: desktop voting sheet.
- polls-list-mobile.png: compact list with drafts, closed history and participant avatars.
- Screenshots are UI test fixtures, not production trip content.
