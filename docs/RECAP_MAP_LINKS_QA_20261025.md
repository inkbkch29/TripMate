# Recap Google Maps links — 25 October 2026

## Correction
Recap now tries existing `googleMapsUrl` before asking for coordinates. Explicit saved coordinates still take priority. The selected pin `!3dlatitude!4dlongitude`, coordinate search queries, and coordinate place paths are supported. Camera centers (`@`, `center`, `ll`), directions, multiple pins and text/Place-ID-only links are never mistaken for a selected pin.

Short links are expanded server-side by `resolve-recap-places`. The function keeps Supabase JWT gateway verification enabled, additionally calls auth.getUser(), checks trip membership, and reads only the requested trip's stored stop URLs through the user's RLS-scoped client. No service role, arbitrary URL input, secret or database write is involved. HTTPS Google Maps hosts only, no credentials/custom ports, six redirects maximum, 18-second per-link timeout, four concurrent workers, 25-stop batches, bounded cache. HTML/map centers are not scraped.

## Verified
- Original workspace: 82 passing tests (includes three unrelated existing late-join tests). Release: 79 passing. Added parser and hook tests cover selected pin versus viewport, explicit zero coordinates, URL safety, partial resolution, stale link rejection and server-resolved coordinates reaching the map renderer.
- Authenticated browser fixture reads actual กาญจนบุรี itinerary through RLS. Four existing Google Maps short links were checked without changing trip/finance data.
- Erawan waterfall and Kirin Tara short links expand to URLs containing exact selected-pin coordinates. Lake Heaven and the restaurant links expand to Google text/feature IDs without coordinates. The UI reports only those two unresolved stops and offers their original Maps links. A full selected-place URL or explicit coordinate is still needed for those two; no approximate/geocoded location is substituted.
- Function deployed with gateway JWT verification enabled; authenticated browser requests succeeded.
- A local read-only fixture tested the two resolved actual stops separately: actual road route 4.7 km, rendered on desktop and 390×844 mobile without horizontal overflow. Evidence: /tmp/tripmate-map-links-qa/resolved-desktop.png and resolved-mobile.png. Temporary fixture was removed before commit.

## Important limitation
Google Maps URLs are not a universal geocoding API. A Maps link can open correctly while exposing only a place name or identifier. Automatic exact resolution for every such link is not claimed. See official URL semantics: https://developers.google.com/maps/documentation/urls/get-started
