# Carrying unpaid installments, 14 → 15 members — 2026-10-27

## Test setup
- Two isolated passes, each with fifteen independent real QA auth sessions and one QA trip. Fourteen members in installment one; fifteenth joined afterward.
- Actual full app on desktop 1280 × 720 and responsive mobile 390 × 844 (not a physical iPhone).
- No actual transfers. Five storage images across both passes marked TEST ONLY / NO MONEY TRANSFER.

## Exact scenario
1. Parent bill 16,900; two actual supplier installments of 8,450.
2. First collection: 14 × 604. Initially 10 confirmed, one slip pending, three unpaid. Cash 6,040; fund zero.
3. Attempting to issue installment two with the pending slip is rejected atomically. No duplicate collection or payment-row changes.
4. Confirmed pending slip through real UI: 11 × 604 = 6,644 received; three still unpaid.
5. Issued installment two through real UI with full-trip newcomer and whole-baht ceiling: 11 × 523 + 4 × 1,127 = 10,261. Remaining actual bill 16,900 − 6,644 = 10,256; includes 1,806 of prior unreceived bill plus the next 8,450 installment.
6. Exactly three old unpaid requests are marked superseded. Their original amount/status remains archived in place; all eleven already-paid rows are byte-for-byte unchanged.
7. Old confirmation rejected; an old member uploading their own valid file also cannot submit against the superseded request. No double collection.
8. Confirmed original fourteen participants in installment two, newcomer pending. Actual fund remains zero; payable newcomer amount remains exactly 1,127.
9. Confirmed final newcomer through real UI. Total received 6,644 + 10,261 = 16,905; supplier records 16,900; all fifteen balances zero.
10. Allocated five-baht confirmed surplus through real fund form. Exactly one rounding transaction, no old six-baht surplus, repeat allocation rejected.

## Findings fixed
- Member detail apportioned current received cash across only the members who had paid. During rounded collection it showed fourteen paid members as overpaid by fractions, and newcomer bill share 1,126.45 instead of actual payable 1,127.
- Display now separates each issued request's agreed bill share from its rounding portion. Confirmed cash is required; pending/unknown cash is never credited. Paid rounded requests show zero remaining; unpaid rounded requests include the remaining rounding charge.
- This changes member-summary presentation only. Canonical issue previews, backend cash allocation, ledger transactions and original payment records are unchanged.
- Added compact carried-bill breakdown to preview and installment detail, explaining why a new request can exceed that installment's supplier bill.

## Verification
- 226 frontend tests pass; production build passes with existing MUI chunk-size warning.
- New backend rollback regression installment_carry_forward.sql checks pending rejection, unchanged paid history, three retired dues, issuance retry, sum of actual bill bases, old-request payment rejection, no premature fund credit and idempotent five-baht allocation.
- Production loadTripData + installmentMemberSummary + homeExpenseSummary confirm responsibility 1,690,000, actual receipts 1,690,500 and surplus 500 satang, all member balances zero, Home cost 16,900 and no outstanding dues.
- Mobile participant expansion shows old 604 request as rolled forward and new 1,127 payment as settled.
- Removed all thirty QA users, two trips, five images and local auth bootstrap files. Ordered hashes of ten original financial/installment tables match the pre-test baseline.

- Verified mobile viewport width and screenshot at exactly 390 × 844, including real final receipt confirmation and fund allocation. Document scrollWidth equals 390; desktop remains 1280 × 720.
- Expanded member history now distinguishes pending slips from unpaid requests.
