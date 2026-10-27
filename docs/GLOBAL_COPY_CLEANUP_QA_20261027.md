# Global UX copy cleanup — 2026-10-27

## Scope
Shortened interface headings, actions, empty states and repeated subtitles across Home, Plan, Travel, packing, polls, expenses/installments/fund, members, notifications, settings, album access and Recap. Removed decorative English overlines and redundant headings. Financial approval, pending-slip, privacy, permissions, validation and destructive-action context remain.

Recap overview now has one Recap heading, larger cover, all-member avatars with count, compact dynamic place/cost chips and an “แต่งรูป” action. Export dimensions are only in the editor. The generated story artwork/layout and renderer were not modified. Embedded Recap suppresses its own heading when the parent dialog supplies it.

## Verification
- 226 tests across 48 files passed, including existing financial, permissions, packing, notification and Recap preview/download/share tests.
- Recap integration test additionally checks the single heading, actual place count and absence of overview export/decorative copy.
- Production build passed; existing >500 kB MUI chunk warning remains.
- Existing 100 literal accessibility attributes in changed components preserved.
- Browser checked Recap at 390×844 and 1280×720: no horizontal overflow, dynamic 11-member/7-place synthetic fixtures, photo/title/date retained; editor opens after selecting actual places.
- Downloaded real PNG: 1080×1920. Existing integration verifies preview/download/share use the same rendered blob.
- Demo Home, Plan, Settings and Expenses inspected; financial status and outstanding/approval wording retained. No production trip records were modified during QA.
- No database, API or financial calculation changes.
