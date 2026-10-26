# Optional poll option pricing — 2026-10-26

## Changes
- Reuses each option's “เพิ่มราคา รูป หรือรีวิว” disclosure. Price defaults to unspecified; fixed/range inputs and person/total segmented controls render only when needed.
- Price fields are independent per option. Hidden draft values are retained while switching modes; saving unspecified clears structured price values.
- One formatter is used in the option list and option detail. Examples: `฿1,500 / คน`, `ประมาณ ฿15,000–฿18,000 / ทั้งหมด`. Unspecified prices have no price line.
- Separate API fields `priceType`, `priceMin`, `priceMax`, `priceUnit` map to nullable database columns. Range prices do not populate the legacy scalar price field.
- Legacy options are not backfilled or given an inferred unit. Editing another field retains their original scalar price until the user explicitly changes pricing.
- Existing permissions, revision checks, image/link processing and immutable voted-option rules remain in the existing RPCs. Voted options also protect new pricing metadata.
- Pricing is informational. No expense, collection or fund transaction is created. Existing poll-to-plan snapshots include the price metadata; range prices are not silently copied as one fixed amount.

## Verification
- Vitest: 205 tests passed in 46 files, covering formatting, optional fields, zero/negative/precision/range validation, independent options, legacy preservation, API payloads and existing poll behaviors.
- Production build passed: `index-C2p6AG8y.js`.
- Additive migration `20261026210000` applied with option and vote fingerprints confirming existing data unchanged. New pricing database assertions ran in rolled-back fixtures.
- Existing collaborative polling and poll-to-plan SQL regressions passed alongside new pricing assertions. Fixtures rolled back; no trip financial entries were created.
- Browser 390×844: form initially has no price amount inputs, first option range 15,000–18,000 total and second unspecified saved correctly. Selected unit has a soft teal state; footer remains accessible.
- Browser 1280×900: fixed 1,500/person plus a TikTok review link saved correctly; second option can remain unspecified. No visible horizontal overflow.
- Browser fixture used real components and mock persistence; it did not publish test polls. Temporary files/tab removed and viewport restored.
