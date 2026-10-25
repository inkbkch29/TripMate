# Home planning and memories dashboard QA — 2026-10-25

## Scope
- Shared HomeDashboard with trip-status/date based upcoming, active and completed content. Existing cover URL and date formatter retained. Countdown moved into the cover; no separate countdown or Recap promotional card.
- Upcoming: sorted next unfinished activity with time/place, permission-aware first-stop action. Completed: recorded visited/total stops, compact memories action to existing TripMode/Recap.
- Reusable MemberAvatarGroup: four actual profile/initial avatars plus +N, full member sheet and larger photo/name preview within the same screen. No bank, contact or authentication details displayed.
- Expense summary uses the existing tripLedger without modifying financial helpers: cost is distinct from outstanding expense transfers plus collection/fund dues. Confirmed settlements reduce outstanding balances; pending slips do not. No budget text without a positive configured budget.
- Poll UI moved from Home/Profile to Plan. Active polls retain existing vote links and owner creation permissions. Completed and closed polls load read-only snapshots through the existing loadStayPoll endpoint, available to ordinary members. Admin results and public vote UI also suppress write actions for completed/closed contexts. No votes closed or deleted in storage; no backend permissions changed.

## Verification
- Release suite: 107 tests across 27 files passed; production build passed; git diff --check passed.
- Added tests for Bangkok dates/countdown, explicit completion, next activity ordering, distinct visited stop counts, spending vs outstanding/confirmed/pending/fund amounts, avatar overflow/profile privacy, empty-plan permissions, upcoming/completed layout and owner-only poll creation/read-only results.
- Browser synthetic harness used actual HomeDashboard, actual Plan function, theme and navigation. Mobile 390 × 844 checked upcoming with itinerary, empty-plan first action, completed with twenty members and confirmed settlements, full member list/profile including last member, Recap navigation and historical results. Document width remained 390 (no horizontal overflow).
- Desktop 1440 × 1000 checked completed with two members and outstanding balance, expense-detail navigation and screenshot. Existing bottom navigation retained.
- All browser data was in-memory fixture data. No existing trip, financial or voting records changed. Temporary fixture removed before commit.
