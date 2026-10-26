# Notification Center — 2026-10-26

- Extracted the center into React + MUI NotificationCenter and pure notification presentation helpers.
- Compact header actions, all/unread tabs, multi-category filter bottom sheet, separate preferences bottom sheet.
- Structured type mapping (including stop/trip_stops) separates plan, expense, collection, location; unknown types stay visible under All.
- Compact clickable rows, concise copy, relative Thai timestamps, read state indicators.
- Existing persistence APIs retained. Read/preference state changes only after successful backend calls; errors preserve details and allow retry. Missing or cross-trip destinations retain notification details rather than opening the wrong trip content.
- No migrations, history deletion, expense calculation changes or preference key changes.

## Verification
- Full release suite: 161 tests passed across 35 files.
- Production build passed.
- Local fixture browser test at 390 × 844 and 1280 × 800: list layout, multi-category filtering, settings switch, mark all/read count, and fallback details verified.
- Backend APIs reviewed; browser fixture uses mock callbacks, not a live authenticated account.
- Screenshot: /Users/devallnow/.codex/visualizations/2026/10/23/01a16883-d5da-7951-9a51-dc1834796b7b/notification-center-mobile.png
