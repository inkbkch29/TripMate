# Three-step legacy expense import — 2026-10-26

## UX
1. Select existing bills first: compact selectable rows show their existing bill basis, paid/pending status and a live selected total. No parent name, amount or member checkbox form precedes selection.
2. Configure the parent name/actual total and installment schedule. Members appear as compact avatar groups and counts; a nested bottom sheet handles independent member selections and optional custom amounts. Existing source references are expandable and can be moved between installments. A source must belong to exactly one installment.
3. Review actual parent cost, installment sum, confirmed cash, unconfirmed/outstanding requests, original requested amount and cost-reference difference. Show historical fund allocations, unallocated confirmed surplus, individual installment responsibilities and old member payments on expansion. Changed source reference amounts are disclosed. Explicit review note and approval precede submission.

The footer stays outside the scrolling content with iOS safe-area padding. Primary actions are Next or Confirm, one per step; Back preserves edits when source selection is unchanged. Old source rows remain linked to the parent and the existing ledger counts the actual parent once.

## Data behavior
- Reuse installment_expense_action import, existing collections, payments/slips, audit and fund ledger. No additional payment/account system or automatic fund adjustment.
- Optional allocation metadata stores per-installment equal/custom responsibilities using integer satang. The backend validates member IDs, exact totals and source sums; old plans with no metadata retain their previous behavior.
- Every new import supplies a reviewed source signature. A concurrent change to the source amount, receiver, payment status, receipt amount or slip path rejects confirmation and requires a fresh review.
- Approved custom responsibilities never rewrite historical requested amounts or received cash. The existing explicit shortfall, receipt attestation and fund-reversal workflows remain available.
- Unknown legacy paid flags are shown separately and are not inferred as actual cash.
- Gaps are computed per installment, so an unallocated surplus in one installment cannot hide a shortage in another.
- Subsequent approved whole-baht collection allocations remain authoritative for settlement summaries, avoiding phantom satang debts after full payment.

## Verification
- Full release frontend suite: 190 tests in 42 files. Production build and whitespace checks passed.
- New unit coverage: 14/15-member import, 16,900 actual bill vs 16,894 old bill basis, separate 6-baht confirmed surplus and 1-baht request shortage, unknown cash, mismatched source/part/custom sums, explicit approval, no phantom post-issue rounding debt, source-first UI, independent member sheets, Back persistence and fund-load failure gate.
- Database deployment transaction ran existing trip_fund.sql, installment_expenses.sql, fund_collection_integration.sql and new installment_import_wizard.sql. Fixtures rolled back internally. Ordered hashes of all real collection/payment/fund transaction rows matched before and after installation.
- Database cases include custom allocations, unknown historical receipts, stale review rejection, invalid custom total rejection, retry idempotency, retained original amounts/payments and audited approved responsibility settings.
- Browser: actual React wizard with simulated API at 390 × 844 and 1280 × 800; selected bills, 14/15-member sheets, equal/custom modes, a 0.01-baht mismatch blocking completion, review screen and final submission verified. No horizontal overflow observed. Screenshots contain simulated data.

## Limits
- Real Khao Yai records remain unmerged; a manager must review and approve them in the app.
- Fixed custom responsibilities require explicit review before adding a later member across those custom installments; the backend refuses silent redistribution. Existing equal/full-trip/future-only behavior remains unchanged for old plans.
- Browser checks use simulated data; database functions are exercised with rollback fixtures. No bank transfer or actual historical payment edit was performed.
- The existing large MUI bundle warning remains.
