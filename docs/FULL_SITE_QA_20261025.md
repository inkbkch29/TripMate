# TripMate continued QA — 25 October 2026

## Environment and scope

- Used the authenticated account and authorized trip **ทดสอบ**. New fixtures: `QA 25 ต.ค. desktop ตรวจครบวงจร` and `QA 25 ต.ค. mobile ตรวจครบวงจร`.
- Actual DOM viewport measurements verified at **390 × 844** and **1440 × 900** in a single selected browser tab. Browser viewport overrides apply to the selected tab; earlier multi-tab size labels were rechecked and superseded by this measured pass.
- Mobile means browser emulation, not physical iOS/Android testing.
- No real money transfer, new account, password change, email reset send, permanent deletion, member permission change or location permission grant performed.

## Page coverage

| Area | Checked |
| --- | --- |
| Main navigation | Home, itinerary, travel/ended-trip Recap, money, settings; both measured sizes, no document overflow or broken images observed |
| Settings | Account, members, receive-money, trip/app; both measured sizes; empty-name validation, member no-results/clear, QR show/hide |
| Itinerary | Empty add validation, date controls, calendar download (.ics); existing places left unchanged |
| Travel | Demo check-in/uncheck, map zoom, expense shortcut; ended real trip Recap |
| Recap | Custom image selection, crop controls, show-route selection, place editor, PNG export; no trip cover update |
| Money | Receipt OCR, item consumers, extras, review validation, copy summary, save, pending slip, approve, fund, outstanding summary, approved-slip zoom, reload, recoverable delete/restore |
| Trip tools | Trip manager filters/empty state, create dialog empty validation, trip settings, history and JSON backup export |
| Invitations | Existing link and join-request list; no new link/access created |
| Voting | Existing poll/results, option detail, empty new-poll validation; no votes or results changed |
| Guest | All four pages at both measured sizes; no slip/review/edit or bank-QR controls exposed |
| Public authentication | Login/signup/reset form views at both measured sizes; empty and malformed-email validation; no real submission |

## Receipt-to-fund results

Synthetic English receipt: Rice 100, Tea 50, service 15, VAT 11.55, discount 5, total **171.55**. Rice belongs to one diner; tea belongs to both.

| Per bill | Expected | Desktop | Mobile |
| --- | ---: | ---: | ---: |
| Actual cost | 171.55 | 171.55 | 171.55 |
| Exact shares | 142.96 / 28.59 | matched | matched |
| Rounded charges | 143 / 29 | matched | matched |
| Total charged | 172 | 172 | 172 |
| Rounding to fund | 0.45 | 0.45 | 0.45 |
| Confirmed people | 2/2 | 2/2 | 2/2 |
| Remaining debt for bill | 0 | 0 | 0 |

The desktop payer's submission was simulated through the existing authenticated RPC; the receiver approved in the UI. The mobile payer selected and uploaded the file through the real UI; that bill's other receiver was simulated through the existing confirmation RPC. All files were synthetic test images; these actions record test settlements, not bank transfers.

Trip confirmed fund moved **0.90 → 1.80**, exactly two new contributions of 0.45. Combined trip cost moved **695.21 → 1,038.31**, exactly two actual bills of 171.55, without counting linked collection charges twice. Existing unrelated outstanding debt remains **165.00** (149.50 collection + 15.50 expense). The existing pending slip was not approved.

Database aggregate cross-check confirms both new bills cost 171.55, charge 172, fund 0.45, paid 2/2. Deleted and restored only the new desktop fixture; food data, payment statuses and a loadable approved-slip image survived. The new confirmation dialog's cancel and confirm paths were exercised.

## Thai OCR and corrections

A generated Thai receipt was scanned in the UI. Numeric amounts, tax and total were recognized; several Thai words were misspelled and service/discount lines were initially treated as food. The new category actions moved those lines into service and discount, then the corrected bill reconciled to 171.55. Selecting all five demo diners yielded 35 each, total 175 and fund 3.45. This demonstrates editable recovery, not perfect Thai OCR. Low-quality photographs and other real receipt layouts still require review.

## Fixes

1. Payment dialog and home pending amount now use the selected/unpaid participant's actual share rather than the first participant's amount.
2. Payment upload locks recipient, file and close/cancel controls while sending.
3. Finance deletion uses an in-page confirmation with recovery instructions; linked expense/collection local state is removed together after success.
4. Receipt parser skips tax identifiers before tax amounts, recognizes a standalone Thai `รวม` total, and supports moving misclassified OCR lines into service/tax/discount without double counting.
5. Guest home labels its expense-only total clearly; trip selector and packing controls have accessible names; login asks to enter an existing password.

## Automated verification and limitations

- Release suite: **52 tests passed**, including selected-diner amount changes, deletion safeguards, tax-header parsing and OCR correction amount preservation.
- Original workspace: **55 passed**, including its existing unrelated late-join tests.
- Production build and whitespace checks passed.
- Signed-link renewal/error handling and PDF support remain covered by the existing PaymentSlipButton tests. A live PDF upload, expired-link wait, offline conflict, real GPS and OS permission flows were not exercised in this pass. Neither was accepting a new member request (none pending).
- Not an assertion that every possible data permutation or hardware/browser combination has been tested.

Evidence retained under `/tmp/tripmate-qa-20261025/` (fund and approved-slip screenshots, generated Thai receipt). New QA bills remain in the authorized test trip for review.
