# Trip Fund / existing collection integration — 2026-10-26

## Changes
- Extract the existing CollectionDialog into one shared component. Fund top-ups open that same form with per-person contributions, selected members and an optional due date. No receiving-account/QR entry fields are added.
- Reuse profile Settings for the receiver. Link to the existing payment settings when missing; the new form requires a configured name and QR before creating its request.
- Fund requests use the existing trip_fund_action contribution transaction atomically, with a stable request key and collection ID. The database exposes TRIP_FUND_CONTRIBUTION as a generated type of the existing is_fund flag.
- Reuse collection payments, slips and confirm_collection_received. One shared receipt-confirmation sheet reviews actual cash rather than replacing it with the requested amount. A request or pending slip does not increase fund cash; receivers are never automatically paid for a fund contribution.
- Remove the separate fund contribution/account-entry form and separate receipt-confirmation workflow. Dashboard request links open the existing collection screen. Keep the dashboard compact; settlement, handover, reconciliation and reversal remain accessible in history.
- Capture account name, QR storage path and existing profile receiving fields on new contribution requests. Use the snapshot for historical QR display and fund transaction audit. A changed profile never silently swaps an existing request's QR.
- Link new deposit transactions to the existing composite payment key (collection_id, user_id). Reversals retain the same source and account snapshot. No additional receiving-account or payment tables.
- Retain existing confirmed-cash rounding allocation and its duplicate guards. Allocating a surplus never creates another contribution request.

## Verification
- Full frontend suite: 183 tests in 40 files passed. The final compact dashboard also passed its seven focused form/dashboard tests; production build and diff whitespace checks passed.
- SQL: existing trip_fund.sql, installment_expenses.sql and new fund_collection_integration.sql passed in the schema deployment transaction. Fixture rows/profile edits are rolled back internally.
- Ordered hashes of all existing collections (excluding new metadata), collection payments and fund transactions (excluding new metadata) matched before/after installation.
- Regression checks: optional deadline, unequal/satang requests, no automatic receiver payment, pending slip is not cash, repeated creation/confirmation, actual cash above requested amount, permission denial, account/QR snapshot after profile change, historical QR membership access, snapshot immutability, reversal idempotency and preserved payment history.
- Browser: actual shared React components with a simulated API at 390 × 844 and 1280 × 800, fifteen members, 100.33 per person = 1,504.95 requested. Verified form layout, optional deadline, no duplicate bank fields, request links and actual receipt confirmation.

## Limits
- Old requests and transactions are not backfilled with a guessed historical account. Their original source references/history remain intact; legacy requests without a snapshot keep the prior profile-based behavior.
- Browser checks used simulated data; SQL checks exercised real database functions inside rollback fixtures. No real bank transfer or personal slip upload was performed.
- Existing MUI bundle-size warning remains. Production uses the existing deployment pipeline.
