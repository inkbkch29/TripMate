# TripMate brand replacement — 2026-10-27

Canonical vector: public/brand/tripmate-mark.svg. Based on the supplied scenic heart pin reference, simplified into flat Sky Blue, Mint, White and pastel yellow. No raster tracing dependency, gradients or external image requests.

Generated app icons: white opaque square, 1024/512/192/180/64/32 pixels; padding remains inside Android maskable safe circle. scripts/generate-brand-assets.cjs generates all icons from the canonical vector using sharp (SHARP_MODULE may specify a local installation).

BrandLogo reused in authenticated/guest headers, login/signup/password screens, access waiting screen, error fallback and initial loading. Header disc removed. No existing Settings/About logo or native splash assets found; PWA splash uses manifest icon/background. Transparent mark uses fixed brand fills on light/dark backdrops; icon retains white backing. No theme, financial, route, role, API or database changes.

Verification:
- Inspected generated 180/64/32 PNGs at native sizes.
- Browser verified mobile 390×844 Header and desktop Login with local demo/unauthenticated state.
- 211 tests / 47 files passed; production build passed.
- SVG favicon and PNG fallback, Apple icon, manifest and push notification references updated.
- Asset URL version plus service worker cache namespace updated. Existing unique build ID invalidates old caches on activation.

Limitation: browser checks cannot force iOS launcher icon refresh for an already-installed PWA. iOS may retain its own Home Screen icon until the shortcut is removed and added again. No actual device installation was performed.
