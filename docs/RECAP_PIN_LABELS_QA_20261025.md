# Names below route pins and matching border colors

- Removed the compact place-name list below the trip date.
- Each numbered pin now has its own centered white place label, soft shadow, up to two lines, Thai grapheme-safe wrapping and truncation for long names. Spacing/font size adapt to the route grid. Full names remain in SVG accessible titles and editable itinerary controls.
- Pin circle borders follow the selected color, using the same theme color as fallback avatars. Shared label layout is used by SVG cover and canvas PNG/JPEG. Row-turn curves bend outside labels.
- Local browser fixture with four trip location names verified labels beneath the corresponding points. Peach PNG and a second selected-color JPEG exported at 1080×1920. Mobile viewport 390×844 has no horizontal overflow. No trip or finance data changed, and no map APIs involved.
- Export tests assert themed border strokes for every pin and absence of the old date-adjacent name block. Existing dynamic layout/member/finance tests retained.
- Evidence: /tmp/tripmate-pin-names-qa/peach.png, sky.jpg (second selected-color JPEG), mobile.png. Temporary fixture removed before commit.
