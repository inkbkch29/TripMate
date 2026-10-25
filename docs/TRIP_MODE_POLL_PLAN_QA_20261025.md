# Trip Mode and Poll-to-Plan QA — 2026-10-25

## Delivered
- Compact Trip Mode header uses the existing Bangkok local date convention. Upcoming, ongoing and completed states share the same components; the current trip day is absent before departure.
- Next scheduled activity, actual itinerary navigation, optional existing check-in/arrival controls, today's route and approximate straight-line travel estimate remain available. Details are collapsed to keep the main screen compact.
- Four inline packing items, progress, full sheet, personal/shared additions and deletion follow existing ownership rules and server APIs. Completed trips retain packing and itinerary history and open the existing Recap component.
- Shared MemberAvatarGroup supports optional member location status; its existing Home display remains unchanged.
- A map preview renders only when valid opted-in member locations exist. A full-screen map uses avatars/initials and popup names/update times. Positions are recent up to 5 minutes, stale between 5 and 30 minutes, unavailable after 30 minutes or when invalid/expired. No fallback city, no historical-coordinate feed, no claim of background or real-time tracking.
- Location sharing remains opt-in. Stopping clears the foreground watch and local position immediately, including after trip dates end. Expiry/completion is enforced in the current-location RPC and direct-table RLS; updates require active consent. The viewer refresh uses existing realtime/fallback infrastructure. Previously shared client data cannot be remotely erased from another device's cache.
- Poll results provide Add to Plan for users with the existing stop-add permission. Tied leaders are displayed equally; other options may be added as backups. Nothing is automatically inserted.
- The compact sheet prefills original name/place, details, price, photos and validated original links; only day/time are initially empty. Extra fields are collapsed. Explicit Maps pins/coordinate queries are parsed on the server; TikTok IDs, camera positions, ambiguous pins and missing data do not become coordinates.
- Source poll/option/token, immutable option snapshot and request ID are stored on the itinerary row. Same-option/same-day uniqueness, a trip row lock and request idempotency protect concurrent submissions. Adding the same option on a different day requires confirmation.
- The parent App stops state is the single source for Plan and Trip Mode. Saved items update it immediately; existing loading/subscriptions use the same mapper after refresh. Deep links focus the correct day/stop. Price/links can be edited manually without replacing the source snapshot. Poll photos/links remain in itinerary details after the original poll is hidden/deleted.

## Verification
- Release suite: 140 tests across 32 files passed; production build passed. Original workspace suite: 143 tests passed (includes three unrelated pre-existing tests not included in this release checkout).
- New tests cover Bangkok midnight/state boundaries, future/past activities, zero/invalid/stale/expired coordinates, no map without positions, real Maps-only coordinate parsing, provenance mapping, packing interactions, 20-member sheets, ongoing check-in, completed Recap/packing, duplicate confirmation and the atomic API contract.
- supabase/tests/trip_mode_poll_plan.sql passed against the installed schema. Uses the authorized two-member ทดสอบ trip; all test polls, dates, members, consents, locations and stops roll back.
- SQL integration checks ordinary-member denial when stop additions are restricted, closed ties, idempotent retry, same-day duplicate, unconfirmed/confirmed another day, unchanged vote counts, stored option snapshot, plan references, backup selection, TikTok coordinate rejection, source deletion retaining itinerary, fresh/stale/expired/revoked positions, direct-table RLS and denied unconsented writes while stopping remains allowed.
- Browser checks: iPhone viewport 390x844 and desktop 1440x1000 using the real components/theme and a simulated API. Checked all three trip states, inline packing/check-in, avatar sheet, full-screen map/marker popup, tied poll results, add-to-plan day/time prefilling, immediate canonical plan update, another-day confirmation and reuse of the same itinerary in Trip Mode.
- Actual App shell in demo mode: Home -> Travel -> Plan navigation worked; ?planStop=s6 selected day 2 and focused the intended record.
- No horizontal overflow at either viewport. Fixed missing isolated avatar/Leaflet styles and full-screen dialog sizing found during browser testing.
- Physical iPhone/background geolocation and a signed-in production browser workflow were not exercised. Browser integration used fixtures; real database authorization and writes were exercised in rollback transactions.

## Migration and preservation
- Applied and recorded 20261025233000_trip_mode_poll_plan.
- Migration hashes checked every existing poll, option, vote and legacy stop field before commit. Existing 8 stops, 3 polls, 7 options and 21 vote rows remained identical.
- No financial calculation, existing poll result or bottom-navigation redesign.
- No new dependency, paid API, geocoding request or automatic itinerary creation.

## Evidence (UI fixtures)
travel-upcoming-mobile.png, travel-active-mobile.png, travel-completed-mobile.png,
travel-map-mobile.png, poll-to-plan-mobile.png, poll-to-plan-desktop.png,
travel-upcoming-desktop.png, travel-active-desktop.png, travel-completed-desktop.png.
