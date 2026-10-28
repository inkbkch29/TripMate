# Home Screen installation action — 2026-10-28

## Behavior
- One “เพิ่มลงหน้าจอหลัก” action on the main Settings screen. Removed the old prompt-only entry from the submenu.
- Captures `beforeinstallprompt` at module startup, including during authentication. A click invokes the browser's native prompt directly; a consumed prompt is not reused. Dismissal does not claim an installation.
- Browsers without the native API receive a compact manual-instructions bottom sheet. All copy is device-neutral.
- Hides in standalone display mode and when `navigator.standalone` is true (Safari Home Screen). An `appinstalled` event also hides the action.
- On supporting browsers, checks `getInstalledRelatedApps()` against the app's own manifest/id, including when returning to the tab. The initial check suppresses a duplicate-button flash, and failure/timeout does not hide the action indefinitely.
- Added a self-reference in manifest `related_applications`, keeping the existing app id, start URL, scope and icons unchanged.
- Installation analytics only reports a real `appinstalled` event, not prompt acceptance or discovery of an existing installation.

## Verification
- 244 tests in 52 files pass; production build passes (existing MUI chunk warning).
- Android API simulations: native prompt, accepted/dismissed outcomes, repeat-click guard, standalone mode, existing related PWA, unrelated-app filtering, return-to-tab check, API failure/timeout.
- iPhone/Safari API simulations: unavailable native prompt, device-neutral manual help, `navigator.standalone` hiding. UI tests confirm no button when opened as a Home Screen app and no false install analytics.
- Actual in-app browser: main Settings action and manual guide opened at desktop and mobile viewport; no financial or trip records changed.
- Physical Android/iPhone installation was not tested: no attached phone, Android SDK/emulator or Xcode simulator was available. API simulation is not device testing.

## Platform limits
Safari's regular browser tab has no API that reliably enumerates an existing Home Screen web app. The button is hidden when launched from the added icon, but may remain in a regular Safari tab even if an icon exists. No fabricated persistent “installed” flag is set from a cancelled prompt or viewing instructions.

Sources: https://developer.chrome.com/docs/capabilities/get-installed-related-apps and https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
