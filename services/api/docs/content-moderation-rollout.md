# Triển khai kiểm duyệt nội dung

## Bộ từ cấm toàn hệ thống

Backend áp dụng bộ từ cấm cho nội dung mới đi qua các luồng moderation, kể cả khi tắt hoặc chỉ quan sát kết quả OpenAI. Tin nhắn trong phòng học LiveKit dùng kênh gửi trực tiếp, nằm ngoài phạm vi của bộ lọc backend. Report vẫn tiếp nhận trích dẫn nguyên văn. Bằng chứng Report được giữ riêng trong case.

Trong bước bootstrap của bản triển khai mới, chạy `pnpm --filter api db:seed-configuration` và `pnpm --filter api identity:seed` trước khi đưa API và worker mới vào phục vụ. Hai lệnh tạo `contentModeration.profanityRuleSet` và cấp quyền Admin `content-moderation:configure`. Seed thêm bộ mặc định khi key chưa có. Khi lưu cấu hình thành công, yêu cầu mới dùng phiên bản vừa lưu. Tệp đang chờ chia sẻ có thể ở trạng thái chờ kiểm lại nếu phiên bản đổi. Tệp Office hoặc tệp không trích xuất được chữ theo quy trình hiện tại cần xử lý trước khi chia sẻ.

Dùng Swagger hoặc HTTP client với Bearer token Admin. Đường dẫn gốc là `/api/v1/admin/content-moderation/profanity-rules`.

| Thao tác | Yêu cầu |
| --- | --- |
| Đọc cấu hình | `GET` trả `rules`, `version` và `effectiveAt`. Dùng danh sách đang lưu làm bản nháp trước khi bổ sung hoặc sửa quy tắc. |
| Thử bản nháp | `POST /preview` nhận `{ "rules": [...], "text": "Bài tập cá tím" }`. Kết quả cho biết quy tắc khớp, số mục thêm/sửa/tắt và mẫu mặc định đổi quyết định. |
| Áp dụng cả danh sách | `PUT` nhận `{ "expectedVersion": 1, "rules": [...], "reason": "Cập nhật từ cấm" }`. Mỗi mục gồm `id`, `term`, `aliases` và `enabled`. Gửi toàn bộ danh sách muốn áp dụng. Với `409`, đọc lại bản mới rồi hợp nhất các chỉnh sửa. |
| Xem và phục hồi lịch sử | `GET /revisions` hỗ trợ `?before=<version>`. `POST /rollback` nhận `expectedVersion`, `targetVersion` và `reason`, tạo một phiên bản hiệu lực mới có audit. |

Ví dụ một mục để thêm vào danh sách hiện tại:

```json
{ "id": "qa-ca-tim", "term": "cá tím", "aliases": ["ca tim"], "enabled": true }
```

Trên staging, gọi `PUT`, ghi lại phiên bản trả về rồi gửi câu mẫu qua chat, hồ sơ, đánh giá và tệp ảnh tiếng Việt. Tắt mục vừa thêm, gọi `PUT` và kiểm tra lại trên một instance API khác. Tin đã được backend chấp nhận để giao đi giữ kết quả trước đó khi tiếp tục giao hoặc retry. Tài khoản Staff hoặc User nhận `403` khi gọi API quản trị.

Kiểm duyệt qua OpenAI được cấu hình theo loại nội dung. Với cấu hình hiện tại chưa khai báo mode, hệ thống tiếp tục áp dụng các quy tắc có sẵn của SkillHub. Cấu hình sản phẩm đi qua backend. API key dùng runtime secret.

## Chạy thử

1. Chạy `pnpm --filter api build` và các ca `test/content-moderation` bằng dữ liệu tổng hợp.
2. Sau khi có project key dành cho staging, chạy từ `services/api`.

   ```powershell
   node scripts/evaluate-content-moderation.mjs --send-synthetic-fixtures
   ```

   Lệnh chỉ gửi text trong fixture đã commit. Các mẫu cần ngữ cảnh dùng để phát hiện trường hợp Omni cần hỗ trợ bằng chính sách riêng. Output gồm ID mẫu, kết quả, độ trễ và điểm của các nhóm được model gắn cờ.

3. Sau khi quyền riêng tư, dữ liệu gửi và ngưỡng chất lượng được duyệt, bật `CONTENT_MODERATION_MODES=chat:observe` trên staging. Đo độ trễ, timeout, chặn nhầm, bỏ sót và khối lượng Staff cần xem. Chỉ chuyển từng nhóm sang `enforce` khi đạt tiêu chí đã duyệt.

## Thiết lập trên Coolify

1. Rebuild và redeploy API từ revision có thay đổi này bằng Dockerfile của repo. Bản self-host hiện dùng `NODE_ENV=development` và entrypoint hiện tại tự áp dụng migration khi khởi động. Image cài sẵn OCR tiếng Việt/Anh, Poppler và bộ mẫu tiếng Việt. Build kiểm tra các công cụ bằng chính tài khoản `node` chạy API.
2. Trong **Environment Variables** của dịch vụ API, thêm `OPENAI_API_KEY` dưới dạng runtime secret và `CONTENT_MODERATION_MODES=chat:observe`. Model và timeout dùng mặc định nếu đã phù hợp. Để test upload, kiểm tra `STORAGE_ENABLED=true`, cấu hình S3/R2, Redis, `CLAMAV_HOST` và `CLAMAV_PORT` hiện có. Dùng các địa chỉ mà container API truy cập được. Worker dùng các lệnh OCR/PDF trên PATH trong image.
3. Trong terminal của container API đang chạy, kiểm tra công cụ và gọi OpenAI với bộ mẫu tổng hợp đã đóng gói.

   ```sh
   tesseract --list-langs
   pdfinfo -v
   pdftoppm -v
   node scripts/check-media-extraction.mjs
   node scripts/evaluate-content-moderation.mjs --send-synthetic-fixtures
   ```

4. Trên môi trường QA dùng dữ liệu test, đặt `CONTENT_MODERATION_MODES=chat:enforce,media:enforce` rồi redeploy để kiểm tra hành vi chặn. Gửi mẫu thể thao và mẫu đe dọa qua Conversation đã mở. Kiểm tra tin hợp lệ đi vào lịch sử, tin bị chặn trả `422`, và ảnh/PDF mới chỉ gửi được sau khi trạng thái tệp là `READY`. Sau QA, trả lại chế độ rollout đã thống nhất.

## Ngưỡng điểm của policy v2

Backend đọc `category_scores` trong các nhóm OpenAI gắn cờ. Với `violence`, điểm dưới 0,25 cho qua, từ 0,25 đến dưới 0,35 trả `REVIEW`, từ 0,35 trả `BLOCK`. Với `harassment`, `hate` và `sexual`, ngưỡng tương ứng là 0,40 và 0,60. Khi có nhiều nhóm, quyết định nghiêm nhất được áp dụng.

Các cờ nghiêm trọng `harassment/threatening`, `hate/threatening`, `illicit/violent`, `sexual/minors` và `violence/graphic` vẫn chặn theo cờ. `REVIEW` đi theo luồng hiện có của từng loại nội dung, gồm trả `422` cho chat. Nếu điểm bị thiếu hoặc không hợp lệ, backend xử lý như lỗi tạm thời của provider.

Các ngưỡng là giá trị ban đầu. Theo dõi trên mẫu tiếng Việt đa dạng ở `observe` và chạy lại đánh giá khi OpenAI cập nhật model. Nội dung giống nhau nhưng khác ngữ cảnh có thể nhận cùng kết quả khi model chỉ thấy nội dung của lần gửi.

## Nội dung và bằng chứng

- Chat bị chặn trả `422 CONTENT_MODERATION_BLOCKED`. Khi người dùng sửa, client gửi yêu cầu mới. Lỗi tạm thời trả `503 CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE`, dùng lại cùng ID cho lần thử tiếp theo của đúng nội dung đó.
- Learning Request vẫn dùng quy tắc sẵn có và `PENDING_MODERATION` theo SRS. Review lộ trình chờ duyệt chỉ hiển thị cho tác giả và Staff có quyền. Reputation được ghi khi chấp nhận review.
- Report hợp lệ đi vào case trước khi phân loại. Chỉ bật phân loại mô tả hoặc tin trong case sau khi duyệt chính sách dữ liệu của từng loại. Bằng chứng tệp trong Report vẫn đi theo quyền của case.
- `media:enforce` yêu cầu kết quả đúng checksum và phiên bản nội dung trước khi chia sẻ. Ảnh đi qua phân loại ảnh và OCR tiếng Việt/Anh. PDF được kiểm tra lớp chữ và render từng trang trong giới hạn của worker. DOCX được đọc chữ và kiểm tra ảnh nhúng hỗ trợ. Tìm `FileContentModeration` và `fileId` trong Runtime Logs để xem kết quả cuối. API status cho biết lúc đang chờ, cần xem xét hoặc xử lý thất bại qua trường tùy chọn `moderationStatus`. Bằng chứng Report tiếp tục dùng quyền của case.
- Với tệp cũ chưa gửi đã quét sạch, mở lại trạng thái tệp để lên lịch kiểm tra khi kết quả cũ hết hiệu lực. Tệp đã hết lượt thử và báo `SCAN_FAILED` cần tải lại sau khi nguyên nhân đã được xử lý. Kiểm tra các bản nháp đang chờ trước khi bật `media:enforce`.
- Khi chạy API trực tiếp ngoài Docker, cài Tesseract với dữ liệu `vie` và `eng`, cùng Poppler `pdfinfo` và `pdftoppm` trên PATH của worker. Có thể cấu hình đường dẫn cho từng chương trình trong biến môi trường của API.

## Theo dõi và rollback

Theo dõi từng bề mặt bằng outcome, mã nhóm, phiên bản policy và thời gian xử lý. Khi cần tạm dừng enforcement, đổi mode của đúng bề mặt về `observe` hoặc `off` theo quyết định vận hành. Quy tắc liên hệ trong chat, kiểm tra an toàn tệp và phân quyền Report tiếp tục chạy. Xác nhận job đang chờ và tệp đã tồn tại trước khi đổi lại sang `enforce`.
