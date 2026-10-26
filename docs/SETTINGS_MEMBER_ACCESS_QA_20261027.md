# Settings and member management — 2026-10-27

## UI
- Settings retains exactly four entries in one compact card. Reduced legacy Stack margins plus gap, retained profile/payment flows and installed-app/notification actions.
- Trip settings separates information from permissions. Dates use two columns above 420px; cover and album edit under one disclosure. Voting management remains in Plan.
- Fifteen-member fixture uses compact photo/name/role rows, search and role filters. No persistent role dropdowns. Member previews expose photo/name/role only.
- Management opens a bottom sheet. Role radio list and three independent finance switches require a review confirmation. Ownership transfer has a separate typed trip-name confirmation. Owner rows have no removal action.
- Trip/member forms warn before discarding edits. Account/payment fields also guard Settings back navigation and bottom navigation. Sticky sheet headers/footers, 44px targets and safe-area padding remain.
- Existing password-reset link, profile crop, payment account/QR, invitation and trash restore functions remain available.

## Permissions and compatibility
- Existing `trip_members` is reused. No new membership or role system. Nullable finance flags preserve historical treasurer rights; UI presents three primary roles. No membership is automatically reclassified.
- Fund management, expense approval and payment confirmation are checked independently in existing server workflows. The actual recipient retains confirmation rights without an administrative role.
- Member collection and poll switches affect protected server saves. Planner gains plan/poll management without membership or trip deletion powers.
- Separate RLS for adding versus managing stops. Cross-trip membership cannot grant plan, expense or collection access.
- Receipt threshold and expense approval are enforced at the expense write boundary. Financial history protection, accounting math and fund transaction logic remain unchanged.
- Member access and ownership RPCs serialize requests, check the owner server-side, preserve before/after audit data, and deduplicate request keys. Deferred constraints reject an ownerless trip or multiple owner-role rows.
- Audit uses the existing activity timeline, including actor display name and time. Trip setting and direct membership changes are also logged. Existing seven-day trash restoration remains permission checked.
- Active membership/settings changes refresh the trip context through the existing activity subscription.

## Verification
- Vitest: **211 tests in 47 files passed**. Production build passed (`index-CJJU1we-.js`).
- Ten rollback SQL regression files cover funds, installments, collection integration/import/requests, collaborative polling, poll-to-plan, option pricing, independent access/ownership and authenticated cross-trip RLS.
- New server tests: confirm-only and fund-only privileges remain isolated; an explicitly delegated approver can approve; a normal recipient can confirm own receipts; poll/collection switches deny member creation; missing receipts and bypassed approval are rejected; owner self-removal/demotion is rejected; confirmed ownership transfer and retries preserve exactly one owner and one audit entry.
- `20261026220000` installed with historical membership/trip fingerprints unchanged (excluding new optional metadata). `20261027001000` installed only after authenticated cross-trip policy tests passed. All fixtures rolled back; no real member, owner, vote or payment was changed by testing.
- Browser fixture at 390×844 and 1280×900 used real components with fictional members and mock persistence. Search, member review/save, conditional receipt input, unsaved confirmation, settings save/reopen and date columns verified. No visible horizontal overflow; footer did not cover content.
- Integrated Settings opened successfully in the actual app's local demo mode. Temporary fixture files/tabs removed and viewport restored; no production account was used for UI mutations.
