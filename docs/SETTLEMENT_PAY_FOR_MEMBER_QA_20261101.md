# Pay for another member — 1 November 2026

Confirmed in source: ordinary expense details have no payment entry; settlement cards permit only `transfer.from` to upload; `submit_settlement` always records `auth.uid()` as debtor. Collection payments already support a separate debtor.

Changes: expense details link to the full balance summary. Settlement cards allow another trip member to submit a slip for the named debtor, excluding the recipient. Both online and offline queue payloads carry the original debtor. Settlement loading and slip/history views preserve and display the submitting member. The new RPC validates membership of all parties, attachment ownership, positive finite two-decimal amounts, and prevents replacement of pending slips. It serializes concurrent submissions and preserves confirmed history. Confirmation still uses the existing recipient/authorized reviewer workflow. No debt is transferred to the submitting member and no automatic reimbursement debt is created.

Validation: all 269 tests across 62 files passed; production build passed (existing bundle size advisory). New tests cover proxy eligibility, pending/rejected behavior, original-debtor ledger deduction, API routing and compatibility with legacy offline queue payloads. Added rollback SQL fixture for attribution, retries, pending overwrite protection, attachment ownership and recipient confirmation.

Limits: SQL fixture and migration have NOT been executed against a database. Production has NOT been deployed or changed. No live Khao Yai data was modified; the available browser account only exposes the test trip. The screenshot supplies context but does not prove which specific control the user attempted. Apply the migration and verify the fixture before deploying the new frontend, then verify with separate debtor, submitting member and recipient sessions.

Later verification and the four follow-up fixes are recorded in [PAYMENT_REVIEW_QA_20261101.md](PAYMENT_REVIEW_QA_20261101.md). Its database execution results supersede the initial SQL-testing limit above.
