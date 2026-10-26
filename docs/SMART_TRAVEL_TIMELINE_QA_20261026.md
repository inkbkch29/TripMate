# Smart Travel Timeline — 2026-10-26

## Changes
- Replace manual completion pins/status filters with compact chronological Timeline cards. Show time, activity title, place and a direct Google Maps link; preserve the existing edit, calendar, reorder and poll/provenance functions and their permissions.
- Highlight exactly one scheduled interval using the activity start and next scheduled start, with the label ตามแผนตอนนี้. No check-in, arrival confirmation, manual progress or completed-place counts.
- Use the same Bangkok-time interval rules in Plan, Home and Trip Mode. Refresh at minute boundaries and when the app regains focus/visibility. Handle overnight stays, equal start times deterministically and trips before/after their travel window. Activities without valid times are not automatically highlighted.
- Reordering retains the existing chronological time slots and persists the reordered places/times through the original backend. Time editing still uses the existing form.
- Keep optional member location sharing separate from the scheduled activity; it does not determine the timeline highlight or imply actual arrival.
- Remove new check-in submission paths from the travel UI. Old completion/check-in records and previously queued actions are retained for compatibility/history; no database records are deleted or rewritten by this redesign.
- Completed Home/Trip Mode show actual named itinerary places as Timeline candidates, rather than reporting check-in progress as visited places.

## Recap
- Require a place-selection sheet before generating a Recap. Start with no assumed visits; users explicitly select actual places or create an image without places.
- Candidate names come exclusively from valid Timeline place fields, sorted chronologically. No activity-title fallback, URL or coordinate labels.
- Maintain a local Recap draft. Selecting/deselecting places never updates the trip itinerary, historical completion flags, expenses or fund.
- Use the selected list for the decorative route, place statistic and shared PNG/JPG rendering. Preserve the existing cover/custom photo/crop/color/member/expense controls.

## Verification
- Release frontend suite: 196 tests in 44 files passed; production build and whitespace checks passed.
- Tests cover interval boundaries, overnight/Bangkok dates, equal-time ties, missing times, old done flags, unchanged source itinerary, chronological slot swaps, minute/focus refresh, direct Maps links and absent navigation data.
- Recap test verifies no render before selection, filtered place names, unchanged input itinerary, and reuse of the same rendered Blob for preview/download/share after selection changes.
- Browser: actual components with app CSS and simulated local itinerary at 390 × 844 and 1280 × 800. Verified current highlight, edited start time, reordered slots, place-only selection, retained original Timeline rows after Recap edits and PNG/JPG previews containing only selected route labels.
- Navigation targets were inspected; no real travel-location data was transmitted to Google during fixture checks. No production itinerary/financial mutations were used for testing.

## Notes
- The highlight describes the schedule, never a verified current location or proof that a place was visited.
- No backend migration is needed. Existing financial logic, location consent and notification preferences remain unchanged; ordinary itinerary-time reminders remain, with no new check-in reminders.
- The existing MUI bundle-size warning remains.
