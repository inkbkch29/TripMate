# Packing List — real multi-account QA, 2026-10-27

## Environment and isolation
Six newly created disposable email-authenticated accounts, each with a distinct GoTrue JWT session: owner, planner, creator, assignee, observer, outsider. Five joined one isolated QA trip; outsider did not. No existing user's credentials were changed and no emails were sent. Browser harness rendered the production CompactPackingList and packing mapper against the production Supabase project with isolated authenticated clients; it did not mock database responses. Browser checks used 390×844 and 1280×900 responsive viewports, not physical phones.

## Permission matrix — actual REST/RPC calls
| Case | Result |
| --- | --- |
| Own personal create/read/edit/toggle/delete | Allowed |
| Others' private SELECT or any RPC operation, including owner/planner | Hidden / denied |
| Shared read by trip members | Allowed |
| Outsider read | No rows |
| Shared creator edit/delete | Allowed |
| Creator toggle when someone else responsible, or no assignee | Denied |
| Assignee claim/toggle/release | Allowed; claim does not count as prepared |
| Assignee edit/delete item created by someone else | Denied |
| Normal observer edit/delete/toggle/release others' item | Denied |
| Owner/planner shared edit/toggle/release/delete | Allowed |
| Two simultaneous HTTP claim requests | Exactly one wins; the other rejected |
| Retried create UUID | One row |
| Direct REST PATCH | Denied for all accounts |
| Shared-to-personal conversion | Only creator retains read access; other browser lists invalidate |

## Bugs found and fixed
1. **Stale open edit form:** another account could claim/complete while the creator edited; database correctly rejected stale revision but UI had no recovery action. The draft now stays intact, saving is disabled, and “ใช้ข้อมูลล่าสุด” explicitly reloads the current row. Removed/inaccessible rows cannot be saved. The same review rule applies to pending deletion. Operation failures reload the packing list to recover current state.
2. **Shared deletion did not sync:** filtered Postgres DELETE subscriptions lack trip_id with default replica identity, so another account retained the deleted row. Migration 20261027020000 emits a generic `packing` activity only for shared deletion (and preserves shared→personal invalidation). No title, note or entity ID is broadcast. Private deletion emits no shared activity. Returning to the app also refreshes packing through a focused read.

## Verification
- Before/after real-session browser reproduction of both bugs.
- Mobile: private isolation, observer disabled controls, claim, completion, creator edit, concurrent open-form conflict and recovery.
- Desktop: owner/planner private isolation, planner shared edit/delete, assignee-only release menu, shared deletion propagation, outsider empty lists.
- Two open sessions confirmed completion 2/6→3/6, conversion 6→5 shared rows, then corrected delete propagation resulted in the same 3/3 rows on both sessions without manual reload. Release changed prepared count 3/3→2/3.
- 219 tests / 48 files passed. Production build passed with existing chunk-size advisory.
- Rollback SQL regressions for packing permissions and shared-delete invalidation passed before migration commit. Private delete did not emit an event; shared delete emitted one generic event; parent trip deletion still passed.
- Production build scanned against exact QA access/refresh tokens; no test tokens in build.
- Cleanup committed: temporary trip/users/profiles/items removed; the 2 original packing items remain. Local credential/fixture files removed before commit.

## Evidence
Screenshots in task visualization folder: `packing-observer-real-mobile.png`, `packing-conflict-real-mobile.png`, `packing-planner-private-real-desktop.png`, `packing-owner-private-real-desktop.png`. They contain only QA display names.
