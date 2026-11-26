# Kế hoạch triển khai kiểm duyệt và phân phối tệp chat an toàn

> Khi triển khai, áp dụng `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development`. Mỗi mục có checklist và ca kiểm chứng riêng.

**Mục tiêu** — Gửi được thẻ tệp sớm, mở quyền xem hoặc tải sau khi quét mã độc và kiểm duyệt nội dung đều đạt, sau đó tối ưu thời gian xử lý và bổ sung hiển thị ảnh.

**Kiến trúc** — PostgreSQL giữ kết quả kiểm tra, trạng thái truy cập, phiên bản tệp và sự kiện đã commit. MongoDB giữ tin chat và tham chiếu tệp. BullMQ chạy tác vụ nền, ClamAV và dịch vụ moderation kiểm tra nội dung, S3/R2 lưu riêng bản gốc và ảnh dẫn xuất. API kiểm quyền ở mọi lượt đọc bytes.

**Stack** — NestJS, TypeScript, Prisma/PostgreSQL, Mongoose, Redis/BullMQ, ClamAV `clamd`, Poppler, Tesseract `vie+eng`, Sharp, OpenAI Moderation và SSE hiện có.

**Phạm vi** — Hai yêu cầu BE ngày 26/11/2026 về tệp chat riêng. Web và Mobile tham gia kiểm tra hợp đồng và nghiệm thu. Phần triển khai client được theo dõi riêng nếu cần sửa màn hình, bộ tải ảnh hoặc SSE client. Chính sách các tệp tài liệu học, hồ sơ và bằng chứng Report giữ theo luồng nghiệp vụ của chúng. Giữ giới hạn chat hiện hữu theo repo, 15 MB/tệp, 5 tệp/tin và 50 MB/tin.

## Điểm xuất phát và quyết định thiết kế

- Hiện tại `chatAttachmentAvailability()` có thể trả `AVAILABLE` ngay khi bản ghi lưu trữ là `READY/CLEAN`. `FileScanWorker` chỉ chạy kiểm duyệt nội dung sau mốc đó. Test hiện có còn xác nhận tệp `READY/CLEAN` chưa có kết quả nội dung có thể đọc. Đây là phần sửa đầu tiên. [Chính sách hiện tại](../../../services/api/src/infrastructure/storage/chat-attachment-policy.ts) · [Worker hiện tại](../../../services/api/src/infrastructure/storage/file-scan.queue.ts) · [Test hiện tại](../../../services/api/test/connections/chat-attachment-availability.test.mjs)
- Chọn một điều kiện cấp quyền dùng chung cho cả bản gốc và ảnh dẫn xuất, với API xác thực làm nơi phục vụ bytes. Hướng dùng signed URL object storage có chi phí proxy thấp hơn nhưng việc thu hồi phải chờ URL hết hạn. Phương án API tăng tải truyền bytes nhưng cho phép kiểm quyền, trạng thái và thu hồi theo mỗi request.
- Giữ endpoint `/download` cấp thông tin tải theo hợp đồng `{ url, expiresAt }` trong giai đoạn chuyển đổi. URL mới trỏ về API. Đề xuất ràng buộc ID phiên và tài khoản trong ticket với phiên đang xác thực ở endpoint phục vụ bytes. Web có thể dùng proxy cùng origin có xác thực. Mobile gửi Bearer header hoặc tải vào vùng riêng của app trước khi mở. Các endpoint `preview` và `thumbnail` dùng cùng cơ chế cấp quyền. Luồng UI cần nghiệm thu thao tác mở ảnh và tải file với hợp đồng này.
- Tách quyền **gửi metadata** khỏi quyền **đọc nội dung**. `state: READY` trong upload status có thể được giữ để client cũ mở nút gửi sau finalize. Hợp đồng mới dùng `canAttach` cho việc gửi, `accessStatus` cho việc đọc và `moderationStatus` cho bước kiểm duyệt. `availability` trong lịch sử/delivery giữ tương thích và dùng cùng giá trị với `accessStatus`.
- Giữ điều kiện fail-closed cho chat ở mọi cấu hình. Nếu AI đang `observe`, `off`, thiếu kết quả hoặc thiếu cấu hình, tệp có thể gửi thẻ nhưng không đạt điều kiện `AVAILABLE`. Worker của chat cần một cấu hình enforcement thực sự khi mở tải. Kết quả từ khóa, ảnh và nội dung trích xuất đều phải đầy đủ. `ALLOW` dùng để theo dõi không có giá trị cấp quyền.

## Hợp đồng trạng thái chung

| Điều kiện | `moderationStatus` | `accessStatus` |
| --- | --- | --- |
| Finalize hợp lệ, chờ quét hoặc đang xử lý | `PENDING` | `PENDING_SCAN` |
| Malware `CLEAN`, mọi phần nội dung yêu cầu đạt, bằng chứng đúng tệp/chính sách và chưa bị thu hồi | `APPROVED` | `AVAILABLE` |
| Kết quả chưa rõ, không kiểm tra đủ phạm vi hoặc cần Staff xem | `REVIEW_REQUIRED` | `PENDING_SCAN` |
| Malware hoặc nội dung bị chặn, hoặc Staff thu hồi | `BLOCKED` | `REVOKED` |
| Lỗi kỹ thuật đã hết lượt tự động | `FAILED` | `UNAVAILABLE` |

`canAttach` áp dụng cho tệp của người gửi đã finalize, đúng định dạng, đang `PENDING` hoặc đã `APPROVED`, sau khi kiểm tra quyền Conversation và ràng buộc tệp–tin theo đường gửi hiện có. Thẻ đã gửi tiếp tục hiển thị trạng thái mới. Khi trả metadata, kiểm tra quyền Conversation và vai trò người gửi/người nhận tương ứng. Giá trị public dùng để hiển thị trạng thái. Mỗi lần đọc bytes kiểm quyền và trạng thái trực tiếp từ dữ liệu có thẩm quyền. Giữ tác vụ Staff hiện có để xem metadata và thu hồi có audit. Các ca `REVIEW_REQUIRED` tiếp tục bị khóa trong thiết kế này. Quyền Staff phê duyệt ngoại lệ là quyết định nghiệp vụ riêng.

## Phần 1 — Secure Attachment Moderation & Pipeline Optimization

### 1. Chặn quyền đọc sớm ở mọi đường dẫn

**File chính** — `chat-attachment-policy.ts`, `file-attachment.service.ts`, `file-storage.service.ts`, `conversations.service.ts`, `chat-download-ticket.service.ts`, `chat-attachment-content.controller.ts`, `chat-attachment-moderation.controller.ts` và `chat.repository.ts`.

- [ ] Viết regression trước khi sửa. Ca `CLEAN` + thiếu kết quả, `observe`, checksum/generation sai, bằng chứng stale, `REVIEW`, timeout, `FAILED` và `BLOCK` đều không được cấp URL hay trả bytes. Người gửi có thể gửi thẻ đã finalize khi còn chờ. Ca đủ điều kiện trả tệp. Tài khoản ngoài Conversation, session hết hạn, ticket dùng bởi tài khoản khác, ID tệp/tin/phòng không khớp và request sau thu hồi đều bị từ chối.
- [ ] Dùng `chatAttachmentAvailability(row, policy)` làm quyết định chung, chỉ công nhận bằng chứng `ALLOW` theo enforcement thực tế và đúng digest, generation, phiên bản policy hiện được chấp nhận. Kiểm tra binding tệp–tin tại lớp service. Áp dụng cho cấp và dùng URL, GET/HEAD/Range được hỗ trợ, bản gốc, preview và thumbnail. Mở stream sau khi kiểm tra, kiểm lại trước khi ghi bytes và đóng stream nếu quyền đã đổi trong lúc mở object. Tách điều kiện này khỏi cấu hình origin và khỏi khả năng gửi thẻ.
- [ ] Chặn nhánh ký URL S3/R2 cho `CHAT` tại service lưu trữ dùng chung. Xác minh cả origin, public bucket/custom domain, CDN và các route chia sẻ file khác. Endpoint đọc dùng xác thực, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` và cấu hình bypass CDN/proxy cache. Lượt tải mới, kể cả Range hoặc replay ticket cũ, kiểm lại quyền sau thu hồi. Bytes đã gửi đến thiết bị không thể thu hồi.
- [ ] Viết integration test HTTP và object storage riêng. Chạy ma trận quyền với người gửi, thành viên còn lại, outsider và Staff không tham gia. So sánh status/history/delivery và các biến thể trả bytes trước, trong và sau thay đổi trạng thái.

### 2. Ghi trạng thái nhất quán và xử lý nền có deadline

**File chính** — `prisma/schema.prisma`, `prisma/runtime-support.prisma`, migration mới, `prisma-stored-file.repository.ts`, `file-content-moderation.ts`, `file-scan.queue.ts`, `file-scan.processor.ts`.

- [ ] Test crash giữa finalize và enqueue, re-delivery, hai worker cùng nhận, lease cũ trả kết quả sau worker mới, thu hồi đồng thời với `ALLOW`, và deploy có tin đã gửi từ bản cũ.
- [ ] Ghi mốc `uploadFinalizedAt` khi lưu checksum và chuyển khỏi `UPLOADING`. Ghi kết quả nội dung với điều kiện generation/digest, policy snapshot và lease token vẫn khớp, theo giao dịch ngắn. Tách trạng thái quét mã độc khỏi quyết định nội dung. Dùng một `stateRevision` tăng đơn điệu cho trạng thái gửi ra ngoài. Giữ thu hồi cuối cùng khi worker chạy lại.
- [ ] Dùng `AbortSignal` xuyên suốt đọc object, socket scanner, Poppler/Tesseract, provider và nhóm tác vụ. Sau **30 giây**, ghi slow processing một lần và tiếp tục xử lý nền. Sau **120 giây kể từ lúc bắt đầu lượt**, hủy công việc còn chạy hoặc giải phóng worker xử lý cô lập, từ chối commit kết quả đến muộn. Hết retry vẫn khóa và chuyển `FAILED` hoặc `REVIEW_REQUIRED` theo nguyên nhân. SLA tổng vẫn đo từ lúc finalize, bao gồm chờ hàng đợi và retry.
- [ ] Đề xuất mặc định **3 lượt tổng cộng** với exponential backoff có jitter cho lỗi tạm thời. Lỗi xác định như tệp hỏng/không hỗ trợ chuyển trạng thái cuối hoặc `REVIEW_REQUIRED`. Dùng lại bằng chứng malware sạch và checkpoint cùng bộ phiên bản khi tiếp tục hợp lệ. Định danh job theo `fileId + generation + policy snapshot`, lease và điều kiện cập nhật trong Postgres ngăn chạy trùng hoặc công bố kết quả cũ kể cả sau khi BullMQ dọn job.

### 3. Tối ưu theo loại tệp, cache và ClamAV

**File chính** — `media-moderation.service.ts`, `media-text-extractor.ts`, `docx-content.ts`, `openai-moderation.client.ts`, `clamav-scanner.adapter.ts` và repository cache mới trong `infrastructure/storage`.

- [ ] Đo riêng tin chữ từ lúc vào bước moderation trong luồng gửi đến verdict, tách thời gian đọc rule, xử lý nội bộ và gọi provider. Kiểm batch/connection reuse ở client trước khi chỉnh deadline. Dùng kết nối tái sử dụng có giới hạn và giữ một request AI cho mỗi payload tin cần kiểm. So sánh P95 với ngưỡng 1 giây ở cùng mức tải. Khi provider chậm, ghi nhận miss và giữ lỗi retry theo mode `enforce`.
- [ ] Giữ bước kiểm tra binary/MIME hiện có. TXT đọc UTF-8 và kiểm nội dung theo đoạn có chồng lấn. JPEG/PNG/WebP chuẩn hóa một lần, chạy OCR và kiểm hình song song sau khi malware sạch, sau đó kiểm text OCR. DOCX đọc text sẵn có và kiểm toàn bộ ảnh nhúng được hỗ trợ. Dùng worker pool có giới hạn cho OCR/AI và kiểm tra filename mỗi lần gửi. Có thể tái sử dụng ảnh đã chuẩn hóa cho xử lý dẫn xuất nếu định dạng và chất lượng phù hợp.
- [ ] Với PDF, lấy text theo trang, nhận diện ảnh/vùng scan và kiểm toàn bộ phần hiển thị cần thiết. Text layer giúp bỏ lượt OCR lặp ở vùng xác định đã có chữ tin cậy. Vẫn kiểm ảnh nhúng và phần đồ họa, chạy OCR trang scan hoặc vùng thiếu/không khớp text. Khi không chứng minh được lớp text bao phủ an toàn, chạy fallback đầy đủ. Mở giới hạn **50 trang cho chat** kèm ngân sách RAM/pixel/trang và deadline. File mã hóa, thiếu trang hoặc vượt ngân sách đi `REVIEW_REQUIRED`. Test PDF lai có text lớp trên và ảnh có chữ, DOCX có nhiều ảnh và trang vi phạm cuối tệp để đo phạm vi trước/sau.
- [ ] Dùng cache server-side cho verdict của **bytes**, khóa bằng SHA-256 BE xác minh, MIME/surface, model revision, policy/profanity version, extractor revision và malware engine/signature version. Chỉ tái sử dụng kết quả dứt khoát, đủ phạm vi, chưa hết hạn. Tạo bằng chứng mới gắn với tệp/generation mới sau cache hit. Kiểm filename và quyền riêng từng tệp. TTL chỉ quyết định tái sử dụng cache, còn phiên bản được chấp nhận để phục vụ tệp đã duyệt nằm trong policy đọc. Ghim model hoặc dùng phiên bản cache quản trị có thể tăng khi model thay đổi để tránh tái sử dụng sai qua alias. Mặc định đề xuất cache TTL tối đa 24 giờ, cần hiệu chỉnh bằng số liệu.
- [ ] Dùng unique key + lease có hạn cho cache miss đồng thời trên nhiều worker. Worker thứ hai chờ kết quả hoặc thử lại sau khi lease hết, mỗi tệp vẫn có moderation state và event riêng. Không tái sử dụng lỗi/timeout/review. Test cùng bytes khác tên hoặc khác chủ, đổi policy/model/chữ ký, TTL hết, restart Redis và lỗi commit sau khi nhận kết quả provider.
- [ ] Đo số kết nối, thời gian `VERSION` và `INSTREAM` trên `clamd` hiện có trước khi điều chỉnh. Tối ưu probe hoặc kết nối daemon dựa trên kết quả, giữ kiểm chứng chữ ký trước khi tái sử dụng verdict. Khi daemon có nhiều phiên bản chữ ký hoặc đang cập nhật, chỉ cache hit nếu xác định được bộ chữ ký đáng tin cho lần đọc cache. Nếu chưa xác định được, chạy scan trực tiếp. Test daemon restart, đổi chữ ký và hash không khớp.

### 4. Giảm chờ queue và phát SSE sau commit

**File chính** — `file-scan.queue.ts`, `outbox-dispatcher.ts`, `application-events.service.ts`, `event-payload.ts` và migration sự kiện chat.

- [ ] Đo `finalize → outbox publish → worker start`. Tái sử dụng outbox bền vững, thêm đánh thức sau commit cho scan và SSE. Giữ polling làm đường phục hồi khi mất tín hiệu. Nếu nhịp thăm dò 1 giây vẫn chi phối P95, đo phương án giảm interval hoặc listener chuyên cho tệp trước khi đổi đường chung.
- [ ] Giới hạn concurrency riêng theo CPU/OCR, scanner, AI rate limit và memory. Ưu tiên upload tương tác và cache hit, giới hạn số PDF lớn/retry/backfill chạy cùng lúc và bảo đảm job dài vẫn được phục vụ. Kiểm load hỗn hợp và tuning từ baseline, giữ độ ưu tiên và chính sách công bằng trong cấu hình đã nghiệm thu.
- [ ] Phát `chat.attachment.availability.updated` cho hai thành viên khi trạng thái hiển thị đổi. Payload chứa ID tham chiếu và `stateRevision`, không chứa URL, key hay bytes. Dùng revision để chống trùng mà vẫn phát được chuỗi `AVAILABLE → PENDING_SCAN → AVAILABLE` khi phải duyệt lại. Giữ `chat.attachment.updated` cho người gửi ở màn upload. Test trạng thái đã đổi trước khi tin được giao, duplicate/sai thứ tự, client reconnect và hai API instance. Client có thể đọc lại REST để lấy trạng thái mới nhất.

## Phần 2 — Image Attachment Metadata & Secure Delivery

### 5. Metadata ảnh và hai kích cỡ dẫn xuất riêng tư

**File chính** — `file-format-detector.ts`, `file-storage.service.ts`, repository lưu metadata/ảnh dẫn xuất, `conversations.responses.ts`, `chat.repository.ts` và các controller Conversation. Tham khảo encoder/queue của `material-thumbnail.processor.ts` để tái sử dụng được phần xử lý ảnh tương thích.

- [ ] Trả `attachmentId`, `attachmentType: IMAGE | DOCUMENT`, `mimeType` đã xác minh, `fileSizeBytes`, `width`, `height`, `moderationStatus` và `accessStatus`. Với file chưa gắn vào tin, upload/status vẫn trả `fileId`. Kích thước là pixel sau orientation, `null` cho tài liệu hoặc metadata ảnh đang chờ. Đọc metadata bằng Sharp từ bytes đã xác minh và lưu theo generation. Đo riêng thời gian đọc và lưu metadata, gồm cả ảnh EXIF xoay.
- [ ] Tạo thumbnail và preview bằng Sharp trong worker sau khi xác minh mã độc. Kích cỡ đề xuất tối đa **320 px** và **1280 px** theo cạnh dài, giữ tỷ lệ và không phóng to. Encode lại, bỏ EXIF/GPS, giới hạn pixel/ảnh động và ghi vào private storage theo `fileId/generation/variant`. Bind dẫn xuất với digest của nguồn. Quản lý ghi lặp và dọn object mồ côi khi lỗi giữa storage và DB. `AVAILABLE` của bản gốc vẫn bắt buộc đạt Phần 1. Nếu derivative chưa có, endpoint ảnh giữ chờ và SSE cập nhật khi variant sẵn sàng. Lỗi dựng thumbnail không được thay đổi verdict moderation.
- [ ] Bổ sung `/preview` và `/thumbnail` vào contract hiện hữu, phục vụ qua API với quyền và policy từ Task 1. Ticket bind tới đúng phiên, tin, attachment và variant. Bản dẫn xuất trả `Content-Type` ảnh đã xác minh. History/delivery có thể trả đường dẫn endpoint và cờ variant sẵn sàng theo quyền. URL tải được cấp riêng khi đủ điều kiện, SSE chỉ báo client đọc lại.
- [ ] Test MIME khai sai, file ảnh hỏng, EXIF xoay, ảnh chạm giới hạn pixel, JPG có padding hợp lệ, tài liệu không có kích thước, preview/thumbnail pending hoặc thiếu, swap variant và lỗi dọn object. Kiểm tra từ môi trường triển khai rằng preview, download, Range và CDN trả cùng quyết định trước/sau thu hồi. Web và Mobile nghiệm thu tải ảnh với phiên xác thực, refresh qua SSE và xóa preview cache của app khi tệp bị thu hồi.

## Đo hiệu năng và nghiệm thu chung

| Metric P95 | Mục tiêu |
| --- | --- |
| Moderation tin chữ | ≤ 1 giây |
| Ảnh dưới 1 MB / ảnh 1–5 MB | ≤ 5 giây / ≤ 10 giây |
| TXT / DOCX thông thường | ≤ 5 giây / ≤ 10 giây |
| PDF có text layer | ≤ 15 giây |
| PDF scan 5–10 trang / 20–50 trang | ≤ 30 giây / ≤ 120 giây |
| Lượt hit cache còn hiệu lực | ≤ 500 ms |
| Chờ queue ở tải bình thường / phát realtime | ≤ 500 ms / ≤ 500 ms |
| Xử lý metadata ảnh thông thường | ≤ 200 ms |

- [ ] Ghi histogram `upload_duration_ms`, `queue_wait_duration_ms`, `malware_scan_duration_ms`, `text_extraction_duration_ms`, `ocr_duration_ms`, `ai_moderation_duration_ms`, `time_to_available_ms`, `total_moderation_duration_ms`, cộng thêm `image_metadata_duration_ms` và `realtime_event_dispatch_duration_ms`. Dùng counters để tính `cache_hit_rate`, `moderation_timeout_rate`, `moderation_failure_rate`. Dùng nhãn có tập giá trị hữu hạn như loại tệp, bucket dung lượng, cache hit/miss và outcome. Tránh ghi bytes, OCR text, token hoặc URL.
- [ ] Chuẩn hóa đồng hồ trước benchmark. Upload duration đo từ khi bắt đầu nhận upload đến finalize. Tổng moderation tính từ commit finalize đến verdict ghi bền vững, gồm queue, malware, trích text, OCR, AI và cập nhật. Queue wait tính từ finalize đến lần đầu worker bắt đầu. `time_to_available_ms` kết thúc khi commit quyền tải. Cache-hit SLA dùng cùng đồng hồ finalize → verdict. SSE đo từ commit trạng thái đến frame thực nhận qua proxy với client kết nối ổn định. Tính tỷ lệ timeout/lỗi theo lượt và theo tệp để phân biệt retry với lỗi cuối. Báo riêng số ca `BLOCKED`, `REVIEW_REQUIRED` và ca chưa có verdict khi chốt benchmark để tránh P95 thấp do loại mẫu chậm.
- [ ] Tạo fixture tổng hợp có đáp án, gồm tiếng Việt/Anh, ảnh ở hai nhóm size, TXT, DOCX nhiều ảnh, PDF text/lai/scan 5–10 và 20–50 trang, tệp trùng, ca lọt ở trang cuối và ca lỗi provider/scanner. Chạy cùng dataset, server, cấu hình và concurrency trước/sau, có lượt cold/warm cache và tải hỗn hợp. Ghi mật độ request, số worker, CPU/RAM, giới hạn provider, mạng, tỷ lệ loại tệp, cỡ mẫu, P50/P95/P99 và tỷ lệ lỗi. Baseline 20–50 trang hiện bị giới hạn 12 trang nên ghi **chưa hỗ trợ** cho nhóm đó, đồng thời đo coverage trên bản mới. Tách kết quả test provider giả khỏi benchmark dùng provider thật.
- [ ] Unit test decision table/cache/deadline. Integration test PostgreSQL, Redis, ClamAV, private storage và SSE. Security test quyền, link cũ, biến thể, header và cache. Concurrency test duplicate finalize, cùng hash trên nhiều worker, retry, policy bump và revoke race. Performance test theo bảng. Chạy `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api build`, `pnpm --filter api test:connections:regression` và `pnpm --filter api exec node --test test/connections/chat-attachment-availability.test.mjs test/content-moderation/*.test.mjs` cùng suite mới. Integration dùng DB, container và bucket QA riêng.

## Rollout và điều kiện bàn giao

1. **Đợt 1 — Đóng đường đọc sớm.** Áp migration bổ sung, triển khai API có policy và đường stream đã xác thực, phối hợp đổi khách tải được kiểm soát. Dừng writer cũ/canary cũ còn khả năng ký link chat trước cutover. Kiểm tra link object storage đã cấp trước đó. Chọn cách vô hiệu hóa theo prefix/credential dành riêng cho chat, hoặc thực hiện cửa sổ khóa cấp link rồi đợi TTL hết trước khi công bố invariant. Xác minh ở origin thực tế. Áp chính sách khóa cho tệp lịch sử thiếu bằng chứng đủ mạnh và chạy backfill riêng có giới hạn. Ca lịch sử được xét trên cùng rule mới.
2. **Đợt 2 — Bật pipeline và đo ở staging.** Kiểm tra migration và grant Staff hiện có, OpenAI enforcement cho chat, `clamd`, Redis, private R2/S3, worker retry, telemetry và SSE qua proxy. So sánh baseline và bản tối ưu. Nếu chậm, giảm tải hoặc đưa job về hàng chờ. Khi rollback, giữ bản API có điều kiện fail-closed hoặc khóa lượt đọc chat cho tới khi phục hồi.
3. **Đợt 3 — Bật metadata, preview, thumbnail.** QA trên local, staging, Web và Mobile iOS/Android. Chạy kịch bản hai người dùng qua `PENDING_SCAN → AVAILABLE → REVOKED` và các nhánh cần duyệt, lỗi provider, timeout, reconnect, cache/CDN và file lịch sử. Chỉ đánh dấu nghiệm thu khi các ca security đều đạt và P95 đạt trên profile tải đã chốt.

Các thông số còn cần thống nhất trước khi ký nghiệm thu gồm profile tải staging và cấu hình máy, ngân sách gọi provider, thời hạn cache thực tế, cửa sổ xử lý URL cũ/legacy backfill và thao tác Staff được phép với ca chưa rõ. Kế hoạch dùng proxy xác thực, cache TTL đề xuất 24 giờ, 3 lượt xử lý và khóa ca chưa rõ trong khi các thông số này được xác nhận.

## Constitution Check

| Hạng mục | Trạng thái |
| --- | --- |
| Ranh giới module và dữ liệu có thẩm quyền | Pass ở thiết kế. Storage giữ bytes và verdict, Conversations giữ quyền và hợp đồng. PostgreSQL giữ trạng thái và feed, MongoDB giữ tin, Redis giữ queue/cache hỗ trợ. |
| Giao dịch và idempotency | Pass ở thiết kế. Commit kết quả và event cùng transaction, I/O provider ở ngoài transaction, dùng lease và điều kiện phiên bản cho ghi hiệu lực. |
| Bảo mật, version và hợp đồng HTTP/SSE | Pending bằng chứng integration và kiểm tra origin/CDN. Swagger và hướng dẫn Web/Mobile cập nhật cùng contract. |
| Kiểm chứng p95 và rollout | Pending benchmark, staging và QA Web/Mobile. |
| Ngoại lệ kiến trúc | Not applicable. Thiết kế dùng các stack và ranh giới hiện tại. |
