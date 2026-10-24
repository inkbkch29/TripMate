# Recap photo editor QA — 24 October 2026

Before deployment, exercised the actual TripRecap component in a temporary Vite fixture, without changing real trip records.

- Desktop viewport 1440 × 1000: cover default, image file picker, custom image preview, zoom, horizontal/vertical crop limits, reset, expense toggle, route toggle, place rename/reorder, PNG download.
- Mobile viewport 390 × 844: image picker, crop reset, hide expenses, select one place, download, theme change and zero selected places. Browser emulation, not physical iOS/Android.
- Verified no horizontal page overflow; mobile preview width 270px; bottom save/share controls remain available while scrolling.
- Opened downloaded files visually. PNG output is 1080 × 1920; custom image is cropped without stretching, text is legible, expense value is absent when hidden, single place uses its name instead of a large empty route map.
- Night theme contrast issue discovered in exported stats and fixed; exported again and visually verified.
- Desktop and mobile test fixtures used an existing project illustration as the uploaded image. No new user photo was uploaded to a server.
- New images and layout choices belong to this editing session/export; they do not replace the shared trip cover or alter its plan. Native share-sheet delivery was not sent to an external recipient. Download path tested instead.
- Unit tests: 44 release tests passed; workspace 47 including unrelated late-join tests. Both production builds passed.
- Temporary fixture HTML and JSX removed before committing/releasing.

Proof: /tmp/tripmate-recap-desktop.png, /tmp/tripmate-recap-mobile.png, /tmp/tripmate-recap-export-example.png.
