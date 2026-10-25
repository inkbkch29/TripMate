# Compact Recap controls QA — 2026-10-25

- Exactly five 44 px touch targets: custom multicolor MUI palette, mint #328C7B, sky #388DB1, rose #BD776B, sand #877B62. One nonwrapping row, no separate custom button or permanent HEX caption.
- Existing custom wheel/HEX popover and mobile bottom sheet retained. Selecting custom HEX #A86AD9 updates preview and leaves only custom selected after closing; selecting mint leaves only mint selected.
- Title label ตั้งชื่อทริป, original trip name is initial value; accepts mixed Thai/English and blank falls back to original name on cover. No stored trip changes.
- Mobile 390 × 844 measured five buttons in one row, document width 390. Sticky bottom actions retained. Existing shared canvas preview/export retained.
- Targeted color/canvas export tests passed (17 tests); production build passed. No unrelated application or financial modules changed.
