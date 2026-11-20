# Triển khai kiểm duyệt nội dung

Kiểm duyệt qua OpenAI được cấu hình theo loại nội dung. Với cấu hình hiện tại chưa khai báo mode, hệ thống tiếp tục áp dụng các quy tắc có sẵn của SkillHub. Cấu hình sản phẩm đi qua backend. API key dùng runtime secret.

## Chạy thử

1. Chạy `pnpm --filter api build` và các ca `test/content-moderation` bằng dữ liệu tổng hợp.
2. Sau khi có project key dành cho staging, chạy từ `services/api`.

   ```powershell
   node scripts/evaluate-content-moderation.mjs --send-synthetic-fixtures
   ```

   Lệnh chỉ gửi text trong fixture đã commit. Các mẫu cần ngữ cảnh dùng để phát hiện trường hợp Omni cần hỗ trợ bằng chính sách riêng. Output gồm ID mẫu, kết quả, độ trễ và danh sách nhóm vi phạm.

3. Sau khi quyền riêng tư, dữ liệu gửi và ngưỡng chất lượng được duyệt, bật `CONTENT_MODERATION_MODES=chat:observe` trên staging. Đo độ trễ, timeout, chặn nhầm, bỏ sót và khối lượng Staff cần xem. Chỉ chuyển từng nhóm sang `enforce` khi đạt tiêu chí đã duyệt.

## Thiết lập trên Coolify

1. Rebuild và redeploy API từ revision có thay đổi này bằng Dockerfile của repo. Bản self-host hiện dùng `NODE_ENV=development` và entrypoint hiện tại tự áp dụng migration khi khởi động. Image cài sẵn OCR tiếng Việt/Anh, Poppler và bộ mẫu tiếng Việt. Build kiểm tra các công cụ bằng chính tài khoản `node` chạy API.
2. Trong **Environment Variables** của dịch vụ API, thêm `OPENAI_API_KEY` dưới dạng runtime secret và `CONTENT_MODERATION_MODES=chat:observe`. Model và timeout dùng mặc định nếu đã phù hợp. Để test upload, kiểm tra `STORAGE_ENABLED=true`, cấu hình S3/R2, Redis, `CLAMAV_HOST` và `CLAMAV_PORT` hiện có. Dùng các địa chỉ mà container API truy cập được. Worker dùng các lệnh OCR/PDF trên PATH trong image.
3. Trong terminal của container API đang chạy, kiểm tra công cụ và gọi OpenAI với bộ mẫu tổng hợp đã đóng gói.

   ```sh
   tesseract --list-langs
   pdfinfo -v
   pdftoppm -v
   node scripts/evaluate-content-moderation.mjs --send-synthetic-fixtures
   ```

4. Trên môi trường QA dùng dữ liệu test, đặt `CONTENT_MODERATION_MODES=chat:enforce,media:enforce` rồi redeploy để kiểm tra hành vi chặn. Gửi một tin hợp lệ và một mẫu bị model gắn cờ qua Conversation đã mở. Kiểm tra tin hợp lệ đi vào lịch sử, tin bị chặn trả `422`, và ảnh/PDF mới chỉ gửi được sau khi trạng thái tệp là `READY`. Sau QA, trả lại chế độ rollout đã thống nhất.

## Nội dung và bằng chứng

- Chat bị chặn trả `422 CONTENT_MODERATION_BLOCKED`. Khi người dùng sửa, client gửi yêu cầu mới. Lỗi tạm thời trả `503 CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE`, dùng lại cùng ID cho lần thử tiếp theo của đúng nội dung đó.
- Learning Request vẫn dùng quy tắc sẵn có và `PENDING_MODERATION` theo SRS. Review lộ trình chờ duyệt chỉ hiển thị cho tác giả và Staff có quyền. Reputation được ghi khi chấp nhận review.
- Report hợp lệ đi vào case trước khi phân loại. Chỉ bật phân loại mô tả hoặc tin trong case sau khi duyệt chính sách dữ liệu của từng loại. Bằng chứng tệp trong Report vẫn đi theo quyền của case.
- `media:enforce` yêu cầu tệp mới có kết quả đúng checksum trước khi chia sẻ. Ảnh đi qua phân loại ảnh và OCR tiếng Việt/Anh. PDF đi qua render từng trang trong giới hạn của worker. Tệp Office, lỗi đọc và nội dung vượt giới hạn kiểm tra vẫn bị giữ chờ. Chốt đường xử lý và định dạng được phép trước khi bật chế độ này.
- Tệp cũ trong bản nháp hoặc chưa xuất bản cần tải lại để kiểm duyệt nếu trước đó chưa có kết quả. Tệp đã hết số lần thử sau lỗi tạm thời cũng cần tải lại. Kiểm tra các bản nháp đang chờ và thống nhất đường xử lý nội dung giữ chờ trước khi bật `media:enforce`.
- Khi chạy API trực tiếp ngoài Docker, cài Tesseract với dữ liệu `vie` và `eng`, cùng Poppler `pdfinfo` và `pdftoppm` trên PATH của worker. Có thể cấu hình đường dẫn cho từng chương trình trong biến môi trường của API.

## Theo dõi và rollback

Theo dõi từng bề mặt bằng outcome, mã nhóm, phiên bản policy và thời gian xử lý. Khi cần tạm dừng enforcement, đổi mode của đúng bề mặt về `observe` hoặc `off` theo quyết định vận hành. Quy tắc liên hệ trong chat, kiểm tra an toàn tệp và phân quyền Report tiếp tục chạy. Xác nhận job đang chờ và tệp đã tồn tại trước khi đổi lại sang `enforce`.
