# Recap photo-first positioning QA — 2026-10-25

- Reference image proportions applied to 1080 × 1920 canvas: branding and one date line near the top; title, crew, statistics, footer and small credit moved toward the bottom, leaving the central photo clear.
- Removed the duplicate route-summary sentence; optional numbered route and per-pin place labels remain. Removed lower date repetition; date now rendered exactly once.
- Preview/download/share still use the same canvas Blob. Existing expense toggle, cent amounts, avatars, crop and custom cover naming unchanged.
- Focused canvas PNG/JPEG, avatar and expense-stat checks: 14 passed. Assertions verify date appears once at the top and title moved to lower photo.
- Visually inspected actual browser-rendered 1080 × 1920 PNG with eleven synthetic members, two places and real data format; temporary harness excluded from release. No trip data changed.
