# Compact expense entry — 2026-10-26

## Scope
- Three action rows: general expense, manual food split, member collection.
- Installment creation is under the general expense form's advanced options, retaining title, total, members and receiver in the existing installment flow. No ordinary expense is saved before switching.
- Legacy grouping is available in the expanded details of existing eligible collection cards. Fund top-up remains in the Fund tab.
- Optional dish quantity multiplies unit price using integer satang; historical receipt `amount` remains the line total and is not multiplied on load.
- New standalone collections opt into `collection_only`. Existing collections retain their accounting meaning. Request-only collections contribute to outstanding dues but never spending totals, fund deposits, rounding surplus, or installment-import sources.
- New requests save members and per-member amounts atomically, use existing receiving-account snapshots and slip/confirmation flows, and never auto-confirm the receiver. Paid/slip history cannot be repriced; identical retries are safe.

## Verification
- Vitest: 200 tests passed in 45 files.
- Production build passed (`index-oikNiwQg.js`).
- Database regression scripts for fund, installments, fund collection integration, import wizard, and new collection requests all passed in rollback fixtures.
- Additive migration `20261026200000` applied with before/after hashes proving historical collections (excluding the new false metadata flag) and payment rows unchanged.
- Browser UI fixture used real React/MUI components and 15 fictional members, without financial backend writes.
- Mobile 390×844: all 3 menu actions fit; collection receiver, amount, member sheet, deselection and submit worked.
- Desktop 1280×900: compact centered-width bottom sheet; food item 3×33.33 =99.99; 2 consumers allocated the whole item. Existing per-person whole-baht rounding remains in effect.
- Menu and food editor had no visible horizontal overflow. Fixed clipped unit-price label on mobile by keeping it floated.
- Temporary UI fixtures removed, browser tab closed, viewport restored.

## Historical behavior
Existing bills were not merged, renamed, deleted or reclassified. Old collection edits continue through their original form. A new request-only collection is intentionally not a bill; actual spending is recorded through general expenses or food splitting.
