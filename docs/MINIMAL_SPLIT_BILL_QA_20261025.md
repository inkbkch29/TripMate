# Minimal manual split bill QA — 2026-10-25

## Changes
- Compact Thai-only item editor, two light-blue summary cells, optional receipt photo attachment. No OCR import, scan action, item categories, category selector, or inline member checkbox lists.
- Each item has name, decimal price, delete and one full-width participant trigger. At most four profile/initial avatars plus +N, selected count and ทุกคน when applicable.
- Responsive member picker: selectable avatar chips, selected count, all/clear, retained per-item state and fixed confirmation footer. Scoped compact CSS keeps one main content scroller and existing expense save/cancel footer.
- Parent item-split dialog hides category/method/meal controls, retains expense title/date/payer, existing field values and validation. Other expense modes retain their controls. Entry button says แยกบิลอาหาร instead of promising OCR.
- Existing splitReceipt/receiptProgress/finance and save payload logic unchanged. Cent allocation, per-person final whole-baht rounding and fund difference behavior retained. Extras and balances available in expandable rows.
- Attachment replace/remove updates local draft; persisted receipt path is cleared on removal. No existing trip records modified by QA.

## Checks
- Original workspace: 103 tests passed (26 files), production build passed.
- Component tests cover independent item selections, reopening, all/clear, four avatars +7 for eleven people, correct unallocated summary, append focus, delete, photo attach/replace/preview/remove with manual items preserved.
- Browser harness uses actual ExpenseDialog source with synthetic members and an in-memory onSave. Mobile 390 × 844: eleven-person split, independent two-person second item, append focus, zero horizontal overflow; twenty-member picker has all chips and accessible sticky confirmation. Desktop 1440 × 1000: two-person flow checked.
- Saved synthetic bill: 100/11 + 50/2 -> 34.10, 34.09 and nine shares of 9.09, total exactly 150. Existing roundUp flag retained. Unallocated example: total270, allocated240.
- Temporary fixture excluded from production source.
