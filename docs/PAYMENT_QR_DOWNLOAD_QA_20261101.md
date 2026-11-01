# Payment QR save fix — 1 November 2026

Confirmed cause: both payment QR buttons called `saveQrImage`, which was neither defined nor imported. Build tools did not catch this runtime ReferenceError. QR uploads also went through the generic lossy WebP compressor.

Replaced both buttons with a shared, tested component. It renews the exact stored QR path (including historical account snapshots), fetches and decodes the image, and prepares an actual PNG File at original dimensions with white background, no crop and no resampling. Save uses a correctly named PNG blob download, with delayed URL cleanup. Files are prepared before clicking, so native sharing executes from a direct user gesture. Supported devices expose “บันทึกลงรูปภาพ / แชร์”; user cancellation is harmless and failures have visible retry actions. Existing WebP/JPEG uploads are converted when saved; new QR uploads retain original bytes instead of going through lossy compression. Financial records and QR contents are not rewritten.

Validation:
- User screenshot decoded successfully with a local QR reader; payload was not printed or sent elsewhere.
- Actual Chrome click on a local synthetic test page saved `/Users/devallnow/Downloads/TripMate-payment-QR.png`. Source was browser-encoded WebP; downloaded file had a real PNG signature, retained 512×512 dimensions and decoded to the exact original synthetic payload using jsQR. The download-event waiter timed out, but the filesystem file and decoded content independently verified success.
- New tests render the actual payment dialog and assert functioning save and native share controls; cover signed URL renewal, historical account path, full dimensions, PNG MIME/extension, failure/retry, cancelled share, blob URL lifetime and byte-preserving QR upload.
- Full suite passed 278 cases in 65 files; production build passed. Existing unrelated packing warning and bundle-size advisory remain.

No real bank transfer or bank-app import was performed. PNG decode success verifies QR contents; individual bank-app gallery behavior and native iOS/Android save sheets still require device testing. No database migration is needed.
