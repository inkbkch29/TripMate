# Compact Recap with decorative numbered route — 25 October 2026

This design supersedes the real map section and the pending Google Maps Platform work for Recap. No Google billing/key/quota was activated.

## Changes
- Removed RecapRouteMap/useRecapMap from TripRecap; no coordinate resolution, routing request or tile rendering is involved in Recap exports now. The old unrelated map modules remain available but are no longer imported into the Recap entry point.
- Cover uses every enabled real itinerary stop in itinerary/draft order. Numbered pins 1…N and curved dotted segments describe a decorative cover layout, not geographic coordinates. Shared layout drives SVG page cover and canvas export, with title/date below the reserved overlay region.
- Compact 1080×1350 (4:5) is the default. 1080×1920 Story remains selectable. Member profile photos/initials, dynamic overlap, summary, background upload/crop and themes retained. Crop sliders start collapsed to shorten the editor.
- PNG and true JPEG supported. Preview and final file use the same fully rendered Blob, waiting for fonts/cover/profile photos. Extensions and share MIME match selected file type. Empty/missing-coordinate trips export normally.

## Verification
- Release: 86 tests pass, including dynamic layout 0/1/2/4/14/30/100, all numbered pins and avatars in canvas, both dimensions, PNG/JPEG MIME, no old map section.
- Browser: desktop 1440×1000 and mobile 390×844; document width equals viewport width. Selected/unchecked and reordered stops reflected in editor. Empty trip enables export; one stop produces one pin; 30-pin exported image visually inspected, all pins visible above text.
- Actual downloaded files checked with Pillow: PNG 1080×1350, JPEG 1080×1350, Story JPEG 1080×1920. Four-pin and thirty-pin PNGs visually inspected; routes are baked into output.
- Fixture uses the existing trip's four location names with synthetic member initials to inspect layout; no actual trip/finance data changed. Temporary fixture removed before commit.
- Evidence: /tmp/tripmate-route-card-qa/card-4-png.png, card-4-jpg.jpg, story-4.jpg, card-30.png, desktop-editor.png, mobile-editor.png, single-desktop.png.
