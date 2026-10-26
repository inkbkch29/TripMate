# Installment Expenses QA — 2026-10-26

## Release scope
- Extend existing expenses/collections/payment and Trip Fund records with a parent bill, installment schedule, member scope, receipt attestations, vendor-payment records and append-only audit.
- Count the actual parent cost once; keep requested cash, confirmed cash, supplier payments and fund balance separate.
- Support full-trip and future-only joining members, integer-satang calculations, balanced allocation and explicit remainder recipient.
- Show compact parent cards and mobile bottom sheets, individual balances, original payment history and slips.
- Creation and legacy merge are available from เพิ่มรายการ. Legacy merge requires source review, verified installment bill amounts, a note and explicit confirmation.

## Verification
- Frontend: 178 tests in 39 files passed; production build and git diff --check passed.
- Database: installment_expenses.sql and existing trip_fund.sql passed after all three migrations were installed. Fixtures run inside a rollback subtransaction and do not retain financial test records.
- Example: first 14 × 604 = 8,456 against an 8,450 bill; next newcomer 1,127 + 13 × 523 + 524 = 8,450. Parent actual bill stays 16,900, requests total 16,906, confirmed surplus is 6.
- Covered future-only newcomers, agreed whole-baht balances after payment, pending/unknown cash, stale revisions, retry idempotency, role denial, supplier payment duplicate/reversal, audited legacy import, supplemental shortage payment and fund support/reversal.
- Retired historical requests cannot be paid from the fund again. Guest summaries count the parent once without exposing personal payments/slips.
- Existing records were compared by ordered hashes during schema installation; financial values/history were unchanged.
- Browser: actual component with simulated API at 390 × 844 and 1280 × 800. Verified parent detail, 15-member adjustment, canonical allocation preview, member balances and legacy import review gate without horizontal overflow.

## Limits and operational notes
- Existing Khao Yai records remain unmerged. Actual historical cash receipts must be reviewed explicitly; a paid flag alone is not inferred as received cash.
- Surplus enters the fund only after confirmed cash and an authorized allocation. Fund support requires confirmation; original supplier cost is never silently adjusted.
- Recording supplier payment does not perform a bank transfer or create another trip expense/fund withdrawal.
- No physical bank payment was performed. Concurrency protections use transaction locks, revisions and unique keys; simultaneous network load was not exercised.
- Production build retains the existing MUI bundle-size warning.
