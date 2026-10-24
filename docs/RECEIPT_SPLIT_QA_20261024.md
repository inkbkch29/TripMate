# Receipt expense splitting — 24 Oct 2026

## Changes
- Expenses are the default finance tab.
- New split option: itemized food / receipt OCR (Thai + English Tesseract, runs locally).
- Review editable line totals; select consumers per line; shared dishes split only among selected people.
- Service, added tax and discounts follow food share proportions. Final cents use largest remainders.
- Optional receipt total must match before saving; explicit review checkbox required.
- Expense detail retains food lines, consumers, extras and per-person totals.
- Summaries and balances now honor stored custom shares instead of redividing equally.
- New security-invoker RPC saves expense and participant shares in one transaction, enforces membership and exact sum, retains revision protection and existing RLS.
- Focused migration applied to production; no unrelated migrations applied.

## Verified
- Isolated release: 18 unit tests pass; Vite production build passes.
- Original workspace including existing late-join work: 21 unit tests pass; build passes.
- Actual browser OCR of generated PNG: Rice 100, Tea 50, Service 15, VAT 11.55, Discount 5, Total 171.55 extracted correctly.
- Rice assigned to A, tea shared A/B: A 142.96, B 28.59; save and details work in demo.
- Mobile viewport 390 × 844: no horizontal overflow; item editor and details usable. Desktop detail checked at 1440 × 900.
- Production deployment 7214afa confirmed successful via GitHub Vercel status; live bundle matches build.
- Production trip “ทดสอบ”: created QA itemized expense 33.11, A 27.61 / B 5.50; reload retained lines and shares; edit saved successfully.
- Production summary includes previous equal expense: A responsible 37.61, B 15.50, total 53.11, transfer due 15.50. No transfer executed.

## Limits
- OCR is an editable suggestion, not guaranteed recognition. Only one generated English receipt image tested end to end; real Thai receipt layouts and poor photos still require user review.
- JPG, PNG and WebP supported for OCR, max 15 MB. PDF remains available as a normal attachment, not OCR input.
- First OCR use downloads worker/language models and needs network; receipt images are processed locally, then normal attachment storage occurs on save.
- Test expense remains clearly labelled QA in authorized test trip.
