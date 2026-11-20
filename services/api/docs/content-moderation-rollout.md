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

## Nội dung và bằng chứng

- Chat bị chặn trả `422 CONTENT_MODERATION_BLOCKED`. Khi người dùng sửa, client gửi yêu cầu mới. Lỗi tạm thời trả `503 CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE`, dùng lại cùng ID cho lần thử tiếp theo của đúng nội dung đó.
- Learning Request vẫn dùng quy tắc sẵn có và `PENDING_MODERATION` theo SRS. Review lộ trình chờ duyệt chỉ hiển thị cho tác giả và Staff có quyền. Reputation được ghi khi chấp nhận review.
- Report hợp lệ đi vào case trước khi phân loại. Chỉ bật phân loại mô tả hoặc tin trong case sau khi duyệt chính sách dữ liệu của từng loại. Bằng chứng tệp trong Report vẫn đi theo quyền của case.
- `media:enforce` yêu cầu tệp mới có kết quả đúng checksum trước khi chia sẻ. Ảnh đi qua phân loại ảnh và OCR tiếng Việt/Anh. PDF đi qua render từng trang trong giới hạn của worker. Tệp Office, lỗi đọc và nội dung vượt giới hạn kiểm tra vẫn bị giữ chờ. Chốt đường xử lý và định dạng được phép trước khi bật chế độ này.
- Tệp cũ trong bản nháp hoặc chưa xuất bản cần tải lại để kiểm duyệt nếu trước đó chưa có kết quả. Tệp đã hết số lần thử sau lỗi tạm thời cũng cần tải lại. Kiểm tra các bản nháp đang chờ và thống nhất đường xử lý nội dung giữ chờ trước khi bật `media:enforce`.
- Bộ xử lý ảnh/PDF cần Tesseract với dữ liệu `vie` và `eng`, cùng Poppler `pdfinfo` và `pdftoppm` trên PATH của worker. Có thể cấu hình đường dẫn cho từng chương trình trong biến môi trường của API.

## Theo dõi và rollback

Theo dõi từng bề mặt bằng outcome, mã nhóm, phiên bản policy và thời gian xử lý. Khi cần tạm dừng enforcement, đổi mode của đúng bề mặt về `observe` hoặc `off` theo quyết định vận hành. Quy tắc liên hệ trong chat, kiểm tra an toàn tệp và phân quyền Report tiếp tục chạy. Xác nhận job đang chờ và tệp đã tồn tại trước khi đổi lại sang `enforce`.
