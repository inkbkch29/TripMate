# Dynamic Recap participants — 25 October 2026

## Scope

Updated only the participants section in the existing TripRecap component and its existing PNG renderer. Kept the current member data (`id`, `name`, `avatar`), theme, background/crop controls, financial summary and itinerary content.

- New `ParticipantsAvatarGroup` measures its container with ResizeObserver.
- Shared layout geometry lays out every member with an increasing left position and z-index; the last member appears in front. The row has an isolated stacking context.
- Preferred diameter 40 px, white 2 px border, shrinking toward 24 px when crowded. No count limit, wrapping or +N placeholder. Zero and one member handled.
- Only the member count is visible below the group. Button/keyboard interaction opens a scrollable dialog containing every picture and full name.
- Export uses the same formula against the 940 px available width of the 1080 × 1920 poster, independent of browser size. Photos are loaded before canvas export; missing, failed or CORS-blocked photos use initials. An 8-second timeout prevents a stalled profile request from blocking the export indefinitely.
- Recap preview now refreshes when a profile image URL changes as well as when names change.

## Verified

- Browser measurements at actual 390 × 844 and 1440 × 900: 0, 1, 14, 30 and 100 members all render in one row, fit the row, have distinct increasing edges, and do not create horizontal document overflow.
- All 30 members present in the modal; last member reachable by scrolling.
- White border measures 2 px; last member's z-index equals member count.
- Generated and visually inspected 1080 × 1920 exports for 30 profile images and 14 members with the first image missing. Every avatar is included and the missing photo uses an initial.
- Authenticated trip ทดสอบ: actual profile image loads, the second member uses an initial, count is 2, modal lists both, and PNG export contains the actual profile photo and initial. No trip or profile data mutated.
- Existing custom background and export actions remain available.
- Release suite: 63 tests passed. Original workspace: 66 passed including existing late-join tests. Production build and whitespace check passed.

Evidence: `/tmp/tripmate-participants-qa/` contains measured UI screenshots, modal screenshots and the inspected exports. Synthetic-count fixtures were temporary and removed before deployment.

## Limits

Browser viewport emulation, not physical-phone testing. Extremely large counts inevitably expose only narrow slivers at finite screen resolution; every member remains rendered and selectable through the full-member modal. Broken profile URLs use initials in both the web view and export.
