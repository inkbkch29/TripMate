# Installments 14 → 15 members: live-auth QA — 2026-10-27

## Environment
- Fifteen generated authenticated accounts, one isolated QA trip.
- Initially 14 trip members. A real fifteenth trip membership was added after first-installment confirmation.
- Actual full app and backend. Desktop 1280 × 720; responsive mobile viewport 390 × 844 (not a physical iPhone).
- No bank transfers; the only attached image was marked TEST ONLY / NO MONEY TRANSFER.

## Scenario and exact results
| Stage | Result |
| --- | --- |
| Parent bill | 1,690,000 satang = 16,900 baht, counted once |
| Installment one | 14 × 604 = 8,456 received against 8,450 actual |
| Available surplus | 600 satang; fund stays zero until authorized allocation |
| Installment two, full-trip newcomer | Newcomer 1,127; 13 original members × 523; chosen original member 524; total 8,450 |
| Partial confirmation | 7,323 received in installment two; newcomer 1,127 pending and still outstanding |
| Final confirmation | All 15 member balances zero; total confirmed receipts 16,906 |
| Supplier payment records | 8,450 + 8,450 = 16,900, no extra trip expense or fund spending |
| Fund | Exactly 6 baht, one rounding transaction; reallocation rejected |

- Issued installment two through the real desktop form, explicitly selecting newcomer full-trip responsibility and the whole-baht remainder recipient.
- Confirmed newcomer through the real payment-history UI; mobile account updated to zero remaining.
- Allocated six-baht surplus through the real fund form after fixing the field mapping bug.
- All 15 independent auth accounts read the same parent. Ordinary member cannot issue/alter installment allocations.
- Ordered full first-installment payment hash remains unchanged after adding member, issuing/confirming installment two, paying supplier and allocating surplus.
- Verified with production loadTripData + installmentMemberSummary + homeExpenseSummary: responsibility 1,690,000, gross receipts 1,690,600, surplus 600 satang; all member remaining values zero; Home spending 16,900 and outstanding zero.

## Fixed
1. Fund rounding confirmation used amount_satang while snapshot supplied available_satang, showing zero and sending no amount. Normalize the available integer satang into the form, validate before submission, retain backend balance/idempotency checks.
2. Home could say settled when the next installment had no active collection yet. Show the unissued bill separately from issued debts, without duplicating payable amounts or changing financial calculations.
3. Installment detail offered another payment submission when all unpaid members already had pending slips. Hide that action until a member actually needs to submit.

## Regression and cleanup
- 223 frontend tests pass, including four new regressions. Production build passes; existing MUI chunk-size warning remains.
- Backend installment_expenses and installment_import_wizard rollback regressions pass, including future-only membership, satang mode, imports, source preservation, supplement and fund reversal behavior.
- Removed 15 QA auth users, one trip and one storage image, plus local bootstrap and credentials.
- Ordered hashes match baseline across ten financial/installment tables after cleanup.
- No backend migration required for this UI fix. No original financial records changed.
