# Recap road map — 25 October 2026

## Implementation
- Itinerary `trip_stops.latitude/longitude`, day and sort_order remain the source. No database schema changes or invented/geocoded coordinates.
- FOSSGIS OSRM car Route API returns full GeoJSON road geometry in original waypoint order. Chunks contain up to 25 points and share one endpoint; disconnected chunks fail instead of drawing a connector. Road snapping is limited to 1 km.
- On-demand queued routing starts at least 1.05 seconds apart in each browser, debounced 450 ms, with bounded in-memory promise caches. Renaming/theme/export changes reuse geometry and map images.
- OpenFreeMap vector tiles rendered with MapLibre in an offscreen non-interactive canvas, pastel OpenMapTiles style. Full route geometry and real stop pins determine bounds. Map is removed after capture; the page shows a static image.
- A/B/.../AA labels retain repeated visits. Co-located start/end markers remain visible; start green/end peach. Provider attribution is baked into map PNG and linked in UI, with OpenStreetMap correction link.
- Export waits for fonts, profile photos, cover and map. Missing/error/loading map blocks download/share until ready or explicitly excluded. 1080×1920 Story and 1080×1350 Post contain the same fitted, uncropped map.
- WebGL2 and network access to the approved providers are required. Provider errors have retry; no straight-line route fallback.

## Verification
- Release unit/component tests: 72 passing. Coordinate null/zero/range validation; numeric day ordering; repeat start/end; chunk overlap; full detour bounds; labels after Z; request deduplication; failed route cache eviction/retry; unready-map export rejection; both PNG dimensions and all 30 avatars.
- Production Vite build passes on Node 20.20.2. MapLibre is dynamically imported only for valid map generation (about 301 KB gzip plus worker); existing initial bundle stays separate.
- Browser at 390×844 and 1440×1000: no horizontal page overflow. Real authenticated test-trip Recap uses loaded itinerary data and correctly lists its missing coordinate.
- Browser fixture uses public Bangkok Victory Monument → Pak Chong → Victory Monument coordinates, not user trip substitutes. Actual OSRM route: 334.8 km; real OpenFreeMap tiles and distinct A/C at the repeated start. Downloaded and visually inspected both PNG sizes. Confirmed single point, empty itinerary, missing coordinate, and NoRoute states. Explicitly excluding map enables cover-only export when coordinates are missing.
- Read-only database inspection: existing stops for กาญจนบุรี and ทดสอบ have NULL coordinates. No actual trip or finance data was changed. These trips will show the missing-coordinate notice until their planner adds coordinates.
- Temporary QA fixtures and temporary local service-worker cache bypass were removed/restored before release.

## Evidence (local)
`/tmp/tripmate-map-qa/`: story.png, post.png, desktop-editor.png, mobile-editor.png, mobile-page.png, single-mobile.png, missing-coordinate.png, real-trip-mobile.png, real-trip-desktop.png.

## Provider references
- https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://routing.openstreetmap.de/about.html
- https://project-osrm.org/docs/v5.24.0/api/
