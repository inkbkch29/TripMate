# Recap customization QA — 2026-10-25

- Conditional expense stats: OFF removes the wallet, amount, label and divider; remaining place stat centered. ON uses the existing ledger amount.
- Shared canvas export drives preview, PNG and JPEG at 1080 × 1920; white icons rendered from MUI SVG components.
- Twelve presets and custom hue/saturation wheel, brightness slider and HEX input. Invalid HEX cannot be applied. Color remembered per trip in browser localStorage; real profile images remain unmodified.
- Explicit browser viewports: 390 × 844 mobile bottom sheet and 1440 × 1000 desktop popover. No horizontal document overflow.
- Synthetic fixture checked with 2, 11 and 20 members, PNG and JPEG, expense toggle, color changes, reload persistence, image upload and crop zoom. No trip records changed.
- Automated release checks: 94 tests passed in 23 files; production build passed; git diff --check passed.
- Export images visually inspected: both statistics, centered single statistic, custom color and 20-member overlap. All content stays within story safe areas.
- No API keys, paid services or expense-calculation changes.
