# Offline expense receipts — 1 November 2026

Adds “บันทึกรับเงินนอกระบบ” to ordinary expense settlement cards for the recipient and members with explicit confirmation permission. Pending slips must be reviewed first. The dialog prefills the balance, accepts a partial amount, requires a note and preserves a request ID across failed retries. Confirmed history shows the receipt method, note, recorder and timestamp. Actual user debts are not cleared automatically.

The protected RPC validates both members, permission, positive satang precision, a note and a request UUID. Trip and pair advisory locks serialize submissions; the request UUID makes retries idempotent. It recalculates net ordinary-expense debt/credit server-side, excluding collection-linked bills and installment parents, allocating partial fund payments with the existing largest-remainder helper, and deducting confirmed settlements. It rejects overpayment and affected members' pending slips. It inserts a new confirmed record; immutable receipt audit fields cannot be rewritten. Ordinary receipts do not credit the trip fund.

Validation: dialog and actual Money/SettlementCard component tests cover partial receipts, audit history, permission visibility, pending slips, validation, failed retry and same-tick duplicate clicks. API test covers the stable request ID and error propagation. A disposable isolated PostgreSQL database passed 16 offline checks and the previous 32 collection/proxy workflow checks. No live financial record is modified during verification.

Production rollout requires migration `20261101190000_offline_expense_settlements.sql` before deploying the UI. As with the previous QA harness, Auth JWT and storage metadata are local shims; these are financial integration tests, not a claim of real multi-account Supabase browser E2E coverage.

Final release validation: all 272 Vitest cases across 62 files passed; production build passed. Existing unrelated packing controlled-input and bundle-size advisories remain.
