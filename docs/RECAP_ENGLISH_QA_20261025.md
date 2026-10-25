# English Recap Cover QA — 2026-10-25

- Cover only: English system copy, short English months and Gregorian dates, inclusive days/nights (3D2N); Thai settings remain unchanged.
- Title uses an existing English field, established destination name (Kanchanaburi/Khao Yai), existing Latin title, or Our Trip. A Thai-labelled cover-only title input allows any chosen English name without mutating the trip.
- Real route names remain unchanged unless an explicit English name exists. Exact system actions such as เข้าที่พัก become Check-in. The same resolved labels feed summary and numbered pins.
- Counts and amount remain live from the existing itinerary and ledger. White MUI icons and primary layout retained. Hidden-expense behavior retained.
- Preview and export share the same canvas image. Visually verified 1080 × 1920 PNG and title edits; mobile 390 × 844 document has no horizontal overflow.
- 100 automated tests passed, production build passed. Additional canvas PNG/JPEG assertions cover English title/date/stats and actual amount. Date tests include same day, cross-month/year, missing and invalid dates.
- No API calls, paid services, trip DB writes or financial calculation changes.
- Deployment remains pending: automatic approval review rejected pushing the previous combined Recap changes to main. No further push attempted without renewed approval.
