# Multiple expense receipts — 2026-10-27

## Changes
- General expenses and manual food splitting accept multiple files in one selection, append later selections, preview each file and remove individual attachments.
- Maximum 10 attachments per expense; existing 15 MB per-file limit. General expenses support JPG/PNG/WebP/PDF; food splitting keeps its image-only input. No OCR added.
- One shared gallery in editing and saved expense details; numbered popup with previous/next, original-file access and renewed signed URLs.
- Existing single receipts remain readable/editable. `receipt_path` stays the primary legacy reference; `receipt_attachments` stores only path/name/type metadata. Existing receipt breakdown/calculation is unchanged.
- All uploads complete before the existing atomic expense save runs once. Failed batches clean new uploads; existing historical files are not deleted while editing. Offline queue supports multiple Files and older single-File payloads.
- Backend validates limits, metadata, duplicate paths and trip boundaries; referenced secondary receipts are protected by existing storage restrictions, including recoverable trash. RPC revision and financial guards retained.

## Browser verification (real backend, isolated QA trip)
Actual app at 390×844 and 1280×720, synthetic TEST ONLY receipt images and two temporary accounts. Browser viewport coverage, not physical-device testing.

Mobile general expense:
1. Selected images 1/2/3 in one picker.
2. Removed image 2 and appended image 4.
3. Saved once: 3 images, one expense, ฿240, shares ฿120/฿120.
4. Reloaded; all 3 thumbnails loaded and popup opened saved image.
5. Edited the saved expense and removed image 1. Saved/reloaded: images 3/4 remained; expense still ฿240.

Desktop food expense:
1. Manual food item ฿150 split between two members.
2. Selected images 1/2/3, removed 2, appended 4, saved.
3. Reloaded and opened saved photos; previous/next showed all pages.
4. Edited saved attachments, removed 3, appended 2. Reloaded: images 1/4/2 retained; cost still ฿150 and shares ฿75/฿75.

Final backend check: exactly 2 expenses, cost ฿390; one linked food collection (not an additional expense), fund ฿0. No horizontal overflow in verified viewports.

## Automated verification
- 230 tests / 49 files pass. Added tests cover legacy mapping, append/delete/preview, unchanged manual item data, save-once amount/share preservation, invalid files/limits and partial upload cleanup.
- Production build passes; existing MUI >500 kB warning remains.
- Backend rollback regression covers multiple-file save/edit, exact expense totals, stale revision, cross-trip rejection, secondary-file locking and older-client field omission.
- Migration applied with an in-transaction hash check that existing expense fields (excluding the additive attachment field) remained unchanged.
- QA expense/collection fixtures, 7 storage images, temporary trip and both QA accounts removed. Local auth bootstrap removed before release.
