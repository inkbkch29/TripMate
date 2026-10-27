# Legacy rounding cash review — 2026-10-27

## Diagnosis (read-only production inspection)
Khao Yai accommodation deposit: 14 paid statuses, ฿8,456 called against ฿8,450 real bill. Thirteen legacy payments have no received_amount. Only one has a recorded ฿604 receipt; no fund transaction has been posted. The backend correctly exposes no allocatable cash yet, while the former green collection caption incorrectly made the planned ฿6 look received/allocated.

## Fix
- Removed the misleading green per-collection “ส่วนเกินจากยอดรับ…” caption; status now explicitly distinguishes unverified legacy cash, awaiting full receipt and allocation approval.
- Fund dashboard lists “รอตรวจยอดรับเดิม”, the missing receipt count, planned surplus and an action opening the existing collection with member details expanded.
- Already-paid members with unknown cash expose “ยืนยันยอดรับเดิม” only to the existing receiver/payment-confirmation permissions.
- Reuses the existing actual-receipt confirmation dialog/API. The dialog states that this verifies an already-paid record and does not call for another payment.
- Real fund balance still comes from confirmed fund transactions. Verifying receipt amounts does not itself post rounding; the existing explicit allocation confirmation remains required.
- No API/database/calculation changes; no production balances, historical receipts or fund transactions were altered.

## Verification
- 233 frontend tests across 50 files passed; production build passed (existing MUI chunk warning).
- Added tests cover 13 legacy paid-but-unknown receipts, separate zero fund/฿6 planned surplus, review navigation, no automatic cash mutation, known cash versus allocated cash and retired receipts.
- Backend rollback suite: 14×฿604, first receipt known and 13 unknown; fund remains zero until explicit verification/allocation. After verifying all receipts, exactly 600 satang becomes available. Existing dues/status/slip fields remain unchanged. Explicit allocation posts exactly once and identical request retry cannot duplicate it. All fixtures rolled back.
- Browser checked the shared fund UI and existing confirmation sheet with synthetic data at 390×844: no horizontal overflow, clear zero balance/planned ฿6/missing 13 count. The desktop view was also opened. Temporary harness removed before release.
