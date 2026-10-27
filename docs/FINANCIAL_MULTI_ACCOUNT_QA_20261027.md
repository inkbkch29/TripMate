# Financial multi-account QA — 2026-10-27

## Scope and environment
- Nine generated real authenticated accounts: owner, planner, expense approver, payment confirmer, fund manager, receiver, payer, observer, outsider.
- Two isolated QA trips; no actual money transfers. All receipt/QR images clearly marked TEST ONLY / NO MONEY TRANSFER.
- Actual full app, real auth sessions and backend; responsive viewport 390 × 844 and desktop 1280 × 720. This is browser viewport testing, not a physical iPhone test.

## Verified
- Confirmation-only permission can confirm contributions without gaining fund spending permission. Receiver can confirm only permitted collections. Planner, ordinary member and outsider cannot bypass backend authorization.
- Pending submission is not cash. Confirmed receipts post once; request retries and rounding allocation retries cannot duplicate funds.
- Actual app upload -> pending -> confirmed historical popup; approved receipt can still be opened and zoomed. Cross-account confirmation updates the payer view.
- Member-created unpaid request can be edited by its creator; no unauthorized delete button. Once payment history exists, editing is disabled consistently with backend.
- Exact fund check: contributions 258.58 + rounding 2.00 - spending 60.00 = 200.58. Actual trip spending stays 380.00; contributions are excluded.
- Direct deletion cannot bypass the recoverable deletion RPC. Expense and collection restoration passes, including generated columns and unchanged historical receiving-account snapshot after profile changes.

## Bugs fixed
- Fund receipt trigger incorrectly required fund-manager permission from explicitly authorized payment confirmers.
- Resubmitting a paid ordinary collection could replace its confirmed status/slip.
- Cross-trip attachments could be injected and read through legacy reference policies.
- Referenced receipt bytes could be overwritten/deleted by their uploader.
- Collection mapper omitted creator identity; creator edit action was missing.
- Collection restoration inserted a generated column and recaptured a current receiving account instead of restoring the archived snapshot.

## Verification and cleanup
- 219 frontend tests pass; production build passes (existing MUI chunk-size warning).
- Backend rollback suites: financial_payment_integrity, financial_delete_audit, trip_fund, installment_expenses, installment_import_wizard, fund_collection_integration, collection_request, settings_member_access, settings_permission_scope.
- Removed all nine QA auth users, two trips and five temporary storage images. No temporary auth bootstrap is shipped.
- Ordered hashes of all existing expenses, collections, collection_payments, trip_fund_transactions and trip_settlements match the baseline after cleanup.
- Backend migrations 20261027030000 and 20261027031000 installed with test fixture changes rolled back.
