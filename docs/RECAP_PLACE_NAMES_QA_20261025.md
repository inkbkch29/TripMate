# Recap: Place Names Only — 2026-10-25

- Labels read exclusively from the itinerary place field. Activity titles, English title aliases, system-action translations and generic fallbacks are not used.
- A shared selector filters empty/placeholder names, URLs and coordinate-only values, then sorts by trip day and scheduled time. Source itinerary data is not mutated.
- SVG and canvas routes both use this selector defensively. Pins are renumbered after filtering. Existing white two-line captions, shadow, numbered markers and dotted path are preserved.
- Place selection still supports include/exclude. Captions are read-only and manual reorder controls were removed to keep names sourced from the itinerary and order chronological. Names remain editable in Plan.
- Cover layout, trip title, dates, avatar styling and expense total are unchanged. Downloads use the preview blob; sharing creates its File from the same blob.

## Verification
- 31 targeted tests passed, covering filtering, day/time sorting, sequential numbering, no activity fallbacks, coordinates/URLs, legitimate numeric venue names, two-line captions, SVG/canvas parity, PNG/JPG rendering and preview/download/share file parity.
- Production build passed.
- Browser tested the supplied example and invalid URL/coordinate entries: exactly 1 ครัวน้ำปลาพริก, 2 บ้านอิงภู, 3 Khao Yai ATV.
- Actual PNG and JPG downloads were generated from the customization screen and verified at 1080x1920. Mobile viewport 390x844 was checked.
- Native social posting was not performed. The native share API payload is verified by a component test.
- No backend migration or trip data change.

Artifacts: recap-place-names.png, recap-place-names.jpg and recap-place-names-mobile.png in the task visualization directory. Images use fixture data and an existing sample cover asset.
