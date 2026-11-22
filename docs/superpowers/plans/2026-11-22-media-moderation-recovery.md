# Kế hoạch sửa kiểm duyệt tệp DOCX, ảnh và PDF

**Mục tiêu** — Tệp hợp lệ đi đến `READY`. Backend phân biệt tệp đang chờ xử lý, nội dung bị chặn, nội dung cần xem xét và lỗi kỹ thuật để QA tra được theo từng `fileId`.

**Thiết kế** — Giữ bước quét mã độc trước kiểm duyệt nội dung. Worker trích xuất theo định dạng, áp dụng bộ từ cấm và AI theo cấu hình, rồi lưu kết quả cuối cho đúng phiên bản tệp. Giữ phạm vi thay đổi ở backend và dùng các contract upload/status hiện có.

**Nền tảng** — NestJS, Prisma/PostgreSQL, BullMQ, Sharp, Tesseract và Poppler. Tham chiếu `services/api/docs/content-moderation-rollout.md` và các test trong `services/api/test/content-moderation`.

**Triển khai** — Backend đã bổ sung đọc nội dung DOCX, đọc lớp chữ PDF, log theo tệp, trạng thái kiểm duyệt và retry riêng. Với định dạng chưa hỗ trợ, lần này chỉ đổi lỗi upload sớm ở chat. Luồng tài liệu và bằng chứng Report giữ contract upload hiện có. Phần theo dõi trạng thái tự động trên FE và đo p95 trên Coolify cần nghiệm thu riêng.

## Chẩn đoán

- **DOCX đã xác nhận trên Coolify.** Tệp `9cefc676-19c8-4766-931b-ae58aa80607e` có trạng thái lưu `READY`, verdict `CLEAN`, một lần quét và kết quả `REVIEW / MEDIA_REVIEW_REQUIRED`. `MediaModerationService` kiểm tra tên tệp rồi chuyển sang kết quả mặc định vì chưa có nhánh DOCX.
- **PNG/PDF đã tái hiện local, nguyên nhân cụ thể trên Coolify còn cần xác nhận.** Mẫu PNG và PDF sạch đều nhận `REVIEW / MEDIA_REVIEW_REQUIRED` sau khi bản giả lập AI trả `ALLOW` cho tên tệp. Tesseract local thiếu dữ liệu `vie`. Thử lại với đường dẫn Tesseract không tồn tại cho cùng kết quả. Code hiện gom lỗi chuẩn hóa ảnh, render PDF, OCR và định dạng chưa hỗ trợ vào một mã. Dockerfile có cài cả `vie` và `eng`; kết quả local chưa chứng minh lỗi thiếu ngôn ngữ trên server.
- **Kết quả lỗi có thể bị giữ mãi.** `FileContentModeration` coi `REVIEW` đã lưu là kết quả hiện hành nếu cùng generation, SHA-256 và bản bộ từ cấm. Gọi status lần nữa không lên lịch xử lý lại. Lần kiểm tra danh sách ngôn ngữ Tesseract bị reject cũng được giữ trong promise suốt vòng đời worker.
- **Log `ALLOW` trong Coolify là kết quả từng lượt AI.** Nó có thể chỉ ứng với tên tệp. `GET .../status` trả góc nhìn cuối của API, còn mã HTTP `304` chỉ phản ánh cơ chế kiểm tra cache. Dữ liệu hiện có không cho thấy `304` gây giữ tệp.

## 1. Chẩn đoán theo tệp và công cụ trích xuất

**Phạm vi** — `media-text-extractor.ts`, `media-moderation.service.ts`, `file-content-moderation.ts`, `file-scan.queue.ts`, Dockerfile và script kiểm tra runtime mới.

- [ ] Lấy mỗi loại một `fileId` PNG và PDF từ ca lỗi. Đối chiếu `detected_mime`, trạng thái DB, `scan_verdict`, kết quả cuối và revision đang chạy. Dùng mẫu tổng hợp tương đương để chẩn đoán trong container API, dưới user chạy worker và với đúng cấu hình đường dẫn lệnh.
- [ ] Thêm script `scripts/check-media-extraction.mjs` dùng extractor thật để kiểm tra Sharp, hai ngôn ngữ OCR, đếm trang, render PDF và OCR từng mẫu. Script in kết quả từng bước, mã lỗi và thời gian, dùng fixture tổng hợp và chạy được trong Docker mà không gọi OpenAI.
- [ ] Thay nhánh bắt lỗi chung bằng lỗi có mã và bước xử lý. Phân biệt công cụ thiếu, thiếu ngôn ngữ, timeout, dữ liệu lỗi, vượt giới hạn và định dạng chưa hỗ trợ. Cho phép probe ngôn ngữ thử lại sau lỗi với backoff và chia sẻ cùng một probe đang chạy.
- [ ] Ghi log tổng hợp sau khi đã lưu kết quả gồm `fileId`, generation, MIME, bước lỗi khi có, outcome, reason codes, mode và thời gian. Log cuối phải tra được bằng `fileId` và tránh nội dung tệp, tên tệp, stderr gốc và thông tin kết nối.
- [ ] Test lỗi PNG/PDF, Tesseract thiếu `vie`, timeout rồi phục hồi, và lọc dữ liệu riêng tư khỏi log. Chạy smoke test extractor trong image trước khi xác nhận lỗi cấu hình trên Coolify.

## 2. Hoàn thiện kiểm duyệt theo định dạng

**Phạm vi** — `media-text-extractor.ts`, bộ đọc DOCX mới, `media-moderation.service.ts`, policy upload và test mẫu.

- [ ] PNG/JPEG/WebP tiếp tục chuẩn hóa ảnh, OCR `vie+eng`, kiểm tra bộ từ cấm trên chữ trích xuất, và gọi AI cho ảnh/chữ theo mode. Ảnh hợp lệ không có chữ vẫn cần kết quả kiểm tra phần hình ảnh khi AI bật.
- [ ] PDF có lớp chữ sẽ kiểm tra thêm phần chữ gốc, đồng thời giữ kiểm tra ảnh và OCR cho từng trang trong giới hạn 12 trang. Thử PDF scan, PDF hỗn hợp chữ và ảnh, PDF có nội dung ở trang sau, PDF mã hóa và vượt giới hạn. Bất kỳ trang hoặc kênh nội dung bắt buộc nào chưa kiểm tra xong đều không được duyệt.
- [ ] Hỗ trợ DOCX bằng bộ đọc ZIP/XML giới hạn kích thước giải nén, số entry và kích thước ảnh. Kiểm tra chữ hiển thị trong nội dung tài liệu, bảng, header, footer và chú thích. Đưa ảnh nhúng thuộc định dạng hỗ trợ qua cùng luồng ảnh. Bỏ truy cập tài nguyên bên ngoài, vô hiệu XML external entities và từ chối tệp có thành phần nội dung không thể kiểm tra. Dùng test cho DOCX sạch, từ cấm trong bảng/header, ảnh chứa chữ, DOCX lỗi và gói vượt giới hạn.
- [ ] Với upload mới thuộc phạm vi kiểm duyệt, trả lỗi rõ cho định dạng chưa hỗ trợ thay vì tạo tệp chờ vô hạn. Rà danh sách định dạng chat và tài liệu trước khi triển khai vì policy upload hiện còn nhận các định dạng Office khác. Giữ quy tắc hiện tại cho bằng chứng Report.

## 3. Hoàn thiện trạng thái và chạy lại các tệp đang kẹt

**Phạm vi** — `file-content-moderation.ts`, `file-scan.queue.ts`, `file-attachment.service.ts` và Swagger status của chat/những luồng dùng chung.

- [ ] Duy trì `state` hiện có. Thêm trường vận hành tùy chọn cho endpoint owner để tách chờ kiểm duyệt, đang thử lại, `REVIEW_REQUIRED` và lỗi kỹ thuật, kèm mã lý do an toàn. Giữ `REJECTED` cho quyết định chặn rõ ràng. Lỗi kỹ thuật hết lượt thử dùng trạng thái cuối `SCAN_FAILED` ở response, đồng thời giữ verdict quét mã độc gốc trong DB. Một quyết định `REVIEW_REQUIRED` thật vẫn ngăn chia sẻ và có chỉ dẫn rõ về bước xử lý.
- [ ] Cho lỗi tạm thời dùng retry hữu hạn của BullMQ. Khi hết lượt thử, lưu trạng thái thất bại cuối thay vì để tệp chờ mãi. Chỉ ghi nếu ID, generation, checksum và phiên bản đánh giá vẫn hợp lệ.
- [ ] Đưa phiên bản triển khai bộ trích xuất vào kết quả và định danh job chạy lại. Recheck có chọn lọc với tệp chưa gửi/chưa xuất bản, đã quét sạch nhưng đang kẹt với mã cũ `MEDIA_REVIEW_REQUIRED` hoặc lỗi kỹ thuật có thể phục hồi. Gọi status nhiều lần chỉ tạo một job cho mỗi phiên bản. Kiểm tra riêng kết quả cũ của `observe` khi đổi sang `enforce` để tránh dùng nhầm kết quả chưa thực thi ở cổng chia sẻ.
- [ ] Test chuyển trạng thái khi có hai worker, bộ từ cấm đổi trong lúc job chạy, tệp đổi generation, retry cạn và worker khởi động lại. Kiểm tra cả Chat và Material vì hai luồng dùng chung storage.

## 4. Giảm thời gian chờ tệp đính kèm chat

- [ ] Đo từ lúc backend nhận đủ byte đến lúc API status trả `READY`. Ghi riêng thời gian chờ queue, quét mã độc, tải tệp từ storage, trích xuất, AI và lưu kết quả. Báo p50/p95 theo MIME, dung lượng và số trang. Dùng p95 dưới 5 giây với PNG/JPEG nhỏ trên QA làm mục tiêu thử nghiệm sau khi lấy baseline. Đo PDF/DOCX theo nhóm số trang và độ phức tạp.
- [ ] Sau khi quét mã độc sạch, cho xử lý song song có giới hạn các việc độc lập. So sánh thời gian kết thúc OCR với kiểm tra ảnh/tên tệp và chỉ ghi `ALLOW` khi đủ các kết quả bắt buộc. Với PDF, bắt đầu thử tối đa hai trang cùng lúc trên QA, giới hạn tổng tài nguyên worker và giảm concurrency nếu ảnh hưởng tải chung. Kiểm tra tài liệu dài không làm ảnh nhỏ phải xếp hàng quá lâu. Giữ đối chiếu generation và checksum khi ghi kết quả.
- [ ] Tách backoff cho lỗi moderation tạm thời khỏi khoảng chờ của job quét mã độc. Hiện hai bước dùng chung job với backoff cố định 65 giây, còn quét mã độc có lease 60 giây. Chỉ thử lại nhanh cho tệp đã `CLEAN` và lỗi tạm thời sau bước quét. Bảo toàn lease, giới hạn lượt thử và tôn trọng hướng dẫn retry của provider khi có. Đo số lần thử, thời gian phục hồi và tải worker trước khi tăng concurrency.
- [ ] Bàn giao cho FE cách đọc trạng thái: bắt đầu upload ngay khi chọn tệp, cho người dùng tiếp tục gõ, tự đọc lại status trong lúc chờ và dừng khi có kết quả cuối. Phía nhận chỉ thấy tin đính kèm sau khi tệp được phép chia sẻ. Phạm vi triển khai của plan là backend.

## 5. Nghiệm thu và rollout

- [ ] Chạy `pnpm --filter api build`, lint tệp thay đổi và suite backend `test/content-moderation`, `test/file-scan.test.mjs`, `test/connections/chat.test.mjs` cùng các ca upload tài liệu bị ảnh hưởng.
- [ ] Trên QA dùng image giống Coolify, kiểm tra PNG tiếng Việt, PDF có lớp chữ, PDF scan nhiều trang và DOCX. Tệp sạch phải lên `READY` và gửi thật thành công. Tệp có nội dung bị policy chặn phải `REJECTED` và không đến người nhận. Mô phỏng extractor lỗi và provider timeout để xác nhận lý do đúng, retry hữu hạn và trạng thái cuối.
- [ ] Đối chiếu từng ca bằng cùng `fileId` trong log cuối, API status và PostgreSQL. Chạy kiểm chứng recheck cho một tệp đang kẹt trước khi áp dụng theo lô nhỏ. Chỉ hướng dẫn FE sửa polling nếu API đã lên `READY` mà giao diện vẫn giữ trạng thái cũ. BE bàn giao contract và ca test cho FE.
