# Hybrid Trip Fund — 2026-10-26

## Delivered
- Compact Expenses > กองกลาง dashboard with confirmed available cash, income, spending, custodians and unconfirmed contributor count.
- Atomic contribution requests reuse existing collections/payments/slip history. Per-member integer-satang amounts, optional due date, actual receiving account and custodian. No automatic receiver payment.
- Confirmed receipts post cash once. Historical paid flags without posted receipt cash stay pending verification; previous financial records are not reclassified or changed.
- Rounding surplus becomes available only after every payment has a confirmed actual received amount. A separate authorized confirmation posts surplus; no automatic transfer. Original expense and collection references remain.
- Expense sheet supports standalone fund expenses, partial reimbursement of an existing uncollected/unsettled bill, and the exact shortfall of a fully received collection. Unsupported already-settled bill links are rejected rather than changing historical obligations. Linked spending does not duplicate trip cost; remaining personal shares are allocated in integer satang.
- Custodian balances prevent spending another custodian's cash. Explicit actual handover records two internal adjustment entries with no increase in overall cash/income/trip cost.
- Transaction history has all/in/out filters, details, actor, custody, original references, and auditable reversal entries. Posted financial rows cannot be silently edited/deleted. Reversed standalone fund expenses retain their DB source/audit and leave current trip cost.
- Settlement supports proportional confirmed contributions, equal chosen eligibility, and explicit approved carry-forward with a custodian. Proportional policy explicitly chooses ownership of rounding surplus. Deterministic largest-remainder allocation conserves all satang; preview and server use the same policy.
- Refund plans reserve/freeze fund activity, track pending/completed refunds, and only deduct cash when actual payout is confirmed. Returned refunds can be reversed and reissued with full audit. Unresolved historical receipts/unposted surpluses require an authorized reconciliation note before settlement.
- Backend owner/treasurer permissions, immutable ledger RLS, source guards, idempotent request keys, unique receipt/refund/reversal references and a per-trip row lock serialize cash mutations. Permission and balance enforcement do not rely on client state.

## Verification
- Final release regression suite: 169 tests across 37 files passed. Production build and diff whitespace checks passed.
- Production build passed. Mobile browser at 390 × 844 and desktop at 1280 × 800: no horizontal overflow, dashboard, insufficient-cash error, successful debit, history/details/filter, and refund preview verified using actual React components with fixture API callbacks.
- SQL regression on the connected database uses an authorized member pair from ทดสอบ and a temporary trip inside a rollback subtransaction. All fixtures, ledger entries and sample financial records roll back.
- Covers unequal contributions, receiver not auto-paid, request retry, duplicate confirmation, insufficient cash, partial original-bill support, ฿1 shortfall/double-deduction protection, no automatic surplus transfer, ฿1,126.67 bill / ฿1,127 receipts / ฿0.33 allocated surplus, immutable sources, ordinary-member denial, custody handover conservation, exact equal/proportional refunds, refund reversal/reissue, and unresolved-cash settlement guard.
- Concurrency is enforced by a database trip-row lock and unique constraints; the regression verifies idempotent retries sequentially, not two simultaneously executing network sessions.
- No physical money or live bank transfers are performed; these screens record user-confirmed cash movements. Browser fixture tests are not a signed-in production bank/payment test.

## Database rollout
- Applied and recorded 20261026110000_hybrid_trip_fund and 20261026113000_trip_fund_reconciliation_guard using the logged-in Supabase CLI query API.
- The initial install compared ordered hashes of every existing collection, expense and collection-payment row before/after (excluding newly added fields). Original financial histories were identical. Both installs ran the rollback SQL regression before commit.
- Supabase CLI normal authenticated query workflow was used. No credential export is required.

## Proof
/Users/devallnow/.codex/visualizations/2026/10/23/01a16883-d5da-7951-9a51-dc1834796b7b/hybrid-fund-mobile.png
