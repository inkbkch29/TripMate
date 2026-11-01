# Collection and proxy payment review — 1 November 2026

## Changes

1. Settlement review locks the row, permits only a current trip recipient or member with explicit confirmation rights, accepts transitions only from pending, and makes repeated confirmations harmless. Confirmed records cannot be downgraded or changed by direct updates, including debtor, submitter, recipient, amount, slip and confirmation metadata.
2. Collection reviewers can return a pending slip with a required reason. The RPC checks the exact slip being reviewed and locks the payment row, so a stale rejection cannot reject a newer upload or a confirmed payment. Return to unpaid preserves the previous slip and submitter. Resubmission clears rejection metadata; confirmation still determines payment and fund cash. Rejection reasons are visible to reviewers and payers. Network failures keep the dialog retryable.
3. Collection card edit visibility uses `canEdit`, independently of confirmation/deletion rights. Request-only records with payment/slip history remain locked, matching the server's history protection. Creator edits of unpaid requests work.
4. Overdue and due-soon collection helper filters exclude completed records, whether completion is recorded in the legacy paid array or payment statuses. The current unified list uses all/mine/pending/unpaid/complete; it does not currently expose these date filters.

Includes the earlier proxy settlement fix: the authenticated submitter is stored separately from the original debtor, including offline queue payloads and slip history. Expense details link to the balance summary.

## Verification executed

- Full Vitest suite: 277 tests across 63 files passed. After adding two retry cases and the visible rejection caption, the relevant four files passed all 20 cases, covering 279 current unique suite cases in aggregate. No React/MUI select warning remains.
- Production build passed after the final UI change. Existing >500 kB bundle advisory remains.
- `git diff --check` passed.
- `money-workflow.test.jsx` renders the actual exported Money/CollectionCard/SettlementCard components: creator edit and history locking; receiver rejection with a network failure and retry; proxy correction and attribution; confirmation clearing the due; proxy settlement upload and pending/reviewer controls; failed own/proxy uploads and retries retaining the debt.
- CollectionDialog test creates a request with exact satang amounts and retries with a stable ID. API tests verify original-debtor routing, legacy offline payload compatibility and expected-slip rejection/error propagation.
- Actual PostgreSQL 17 in a temporary container, with no network or published ports. `scripts/prepare-finance-test-db.py` builds a focused schema from the repository's real table/function definitions, including the actual fund posting and history triggers. Both new 20261101 migrations applied successfully.
- `supabase/tests/payment_review_workflow.sql`: 31 checks passed and rolled back. Covers creating/editing a request, unauthorized edits, own payment, proxy pending protection, unauthorized review, rejection reason and slip preservation, corrected proxy resubmission, stale rejection, confirmation retries, paid history, request receipts excluded from fund cash, actual fund deposit posted once, settlement rejection/resubmission, immutable confirmed metadata, later settlement history, foreign submitter attachment ownership, non-members, anonymous execution restrictions and delegated confirmation permission.
- Local browser demo at `http://127.0.0.1:5181/?demo=1`: returned an existing synthetic pending slip with a reason; the card showed the reason and review count fell from 2 to 1 while the debt and paid count remained unchanged. Screenshot: `/Users/devallnow/.codex/visualizations/2026/11/01/01a197b4-98be-76f2-bb5e-3e06a3226be9/payment-review-proof.png`.

## Limits and rollout

The local PostgreSQL harness is a focused financial integration environment, not a full Supabase installation. JWT identity and storage metadata use local shims; actual Auth sessions, Storage uploads/signing, realtime delivery, multi-browser concurrency and the complete migration chain were not exercised. SQL roles simulate three members plus an outsider; this is not a claim of a live multi-account end-to-end pass.

No production deployment, migration or real-trip financial mutation occurred. Apply `20261101160000_settlement_pay_for_member.sql` followed by `20261101170000_payment_review_integrity.sql` before deploying this frontend: snapshot reads now request the new rejection columns. Then validate with separate payer, proxy payer and recipient accounts in the named test trip before real-trip use. The earlier `SETTLEMENT_PAY_FOR_MEMBER_QA_20261101.md` reflected the first implementation stage; its statement that no SQL was executed is superseded by this report.

## Production release preparation

Deployment is prepared from latest `origin/main` at `9fda942`, preserving production changes absent from the original local checkout. Production already used `canEdit` and disabled history-locked edits; that behavior is preserved. The isolated release excludes unrelated local late-join, refresh-coordinator, packing, fund, poll and styling edits. Its full suite passed 268 tests in 61 files and its production build passed.

Live preflight found a legacy two-argument `submit_collection_payment` overload alongside the guarded three-argument API with a default argument. The final migration removes the obsolete overload: two-argument calls resolve to the guarded API's default and all authorization/history checks apply. Tested over the actual legacy definition in isolated PostgreSQL; 32 workflow checks passed, including legacy own-payment submission and prevention of paid-history overwrite.

Both migrations were then applied to production in one transaction with migration history entries, lock/statement timeouts and canonical financial-record fingerprints checked inside the transaction. Existing collection, payment, settlement and fund records retained their amounts, statuses and history; the intended historical settlement submitter backfill is excluded from the fingerprint comparison. Database migration versions `20261101160000` and `20261101170000` are recorded.
