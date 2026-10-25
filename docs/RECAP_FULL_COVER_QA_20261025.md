# Full bleed Recap Story — 25 October 2026

## Scope
Only Recap card/editor/export presentation changed. No database, membership, financial calculation, paid provider configuration, API key or billing change. Decorative numbered routes remain local canvas illustration from actual selected itinerary order.

## Layout
- Fixed 1080×1920 PNG/JPEG export. Removed 4:5 option and all cream/white footer/stat cards. Cover cropping covers the entire canvas; preview alone has CSS rounded corners. User-selected plain background uses a full-frame dark gradient.
- Light top shading, cinematic transparent-to-dark lower gradient; white title/date/compact ordered place names. Inclusive trip duration is appended only when absent from the existing date label.
- White two-column statistics with translucent separators; expense visible by default, existing privacy switch can still hide it. Amount comes from unchanged tripLedger.
- “Our Travel Crew · N”, smaller dynamic overlapping profile avatars/initials, all members retained. Colors apply to fallback avatars only.
- Exact closing caption “Trip's over, memories aren't. ♡” plus “Made with TripMate”. Reserved route, title, crew, stats and footer areas do not overlap.
- Fonts, cover and real profile photos load before generating the same Blob used by preview/download/share. PNG/JPEG MIME/extension retained correctly.

## Verification
- Release test suite: 87 pass. Export always 1080×1920 for PNG/JPEG, all numbered route pins and avatars rendered, no roundRect card panels, exact English footer, inclusive day count without duplicate duration. Existing finance/member tests pass unchanged.
- Desktop 1440×1000 and mobile 390×844: document width equals viewport. PNG/JPEG downloaded through editor; Pillow confirms real PNG and JPEG formats and 1080×1920 dimensions. Both bottom corners contain opaque cover/gradient pixels, no cream or white padding.
- Visual checks: 4 stops/11 members with 13,940 THB; long title/30 stops/100 members. All pins/avatars fit; long names truncate within two compact route lines; title shrinks/ellipsizes instead of overflowing. Preview uses the rendered image itself.
- Temporary QA fixture uses sample names/member initials, not database mutations, and is removed before release.
- Evidence: /tmp/tripmate-full-cover-qa/story.png, story.jpg, desktop.png, mobile.png, stress.png.
