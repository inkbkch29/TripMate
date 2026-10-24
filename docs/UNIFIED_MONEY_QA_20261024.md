# Unified money workflow — 24 October 2026

## Accounting and UI
- One searchable, date-sorted list for reimbursable expenses and ordinary collections; completed collections stay in the same list. Member/payment detail can be expanded.
- One Add action chooses receipt/advance, per-member collection, or fund contribution. A single cost should be entered once using the appropriate workflow.
- Separate fund tab shows confirmed contributions and target. Contributions are not spending; the received figure is not presented as cash remaining after spending.
- Outstanding summary includes approved expense debts plus exact unpaid collection-payment amounts. Confirmed collection payments are omitted; pending slips remain payable.
- Summary payment actions retain the original collection and recipient; they do not also create an unallocated expense settlement. Expense settlements affect only expense debts.
- Confirmed settlement history survives later submissions for the same payer/recipient. A partial unique index permits one unfinished submission per pair.
- Home and recap cost totals include ordinary collections, exclude fund deposits and rounding money routed to the fund.
- Live refresh now reloads settlements as well as collection payments, and subscribes to settlement changes under existing member RLS. Fund payment notifications open the fund tab.

## Verification
- Release: 23 tests passed; production build passed.
- Original workspace with existing late-join changes: 26 tests passed and build passed.
- Tests cover no-expense collection summaries, paid-array and confirmed-payment deduction, pending slips, exact per-user amounts, separated fund receipts, rounding contributions and expense settlements.
- Browser demo: ordinary collection 149.50 pending appears in summary. Confirming it removes that obligation and reduces outstanding totals from 288.09 to 138.59; only the local mock record was changed.
- Browser demo: created fund collection 200.00, confirmed receiver contribution 100.00; target 200.00/received 100.00 shown separately, cost stays 490.55.
- Mobile 390×844: no horizontal page overflow; summary, mixed list and fund creation verified. Desktop 1440×900 mixed list inspected.
- Production Vercel deployment successful. Authorized trip “ทดสอบ” shows total costs 352.11 = existing expenses 53.11 + ordinary collection 299.00. Summary shows 165.00 = pending collection 149.50 + expense debt 15.50. Existing production payment statuses were not changed.
- Realtime cross-account confirmation was not exercised with two simultaneous accounts; subscription/publication and refresh path were implemented and checked.

## Existing data
No automatic title-based deduplication or data migration between expenses/collections: identical names do not establish that two records represent the same bill. Existing records retain their payment history. No real transfers were executed.
