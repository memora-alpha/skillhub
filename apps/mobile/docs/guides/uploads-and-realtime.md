# Uploads evidence và realtime

Đọc khi chọn/upload/media, scan, listeners, chat hoặc notification.

## Đang có và nguồn đối chiếu

[skills API](../../src/features/skills/api/skills-api.ts), [prepare-evidence](../../src/features/skills/utils/prepare-evidence.ts), [evidence-scan](../../src/features/skills/utils/evidence-scan.ts), [compress-evidence](../../src/features/skills/utils/compress-evidence.ts), [evidence-compression](../../src/features/skills/api/evidence-compression.ts). Có hai worker, tối đa48 reads/file, báo chậm sau24 reads; JPEG quality0.9 cho ảnh >2_000_000 bytes, không crop/resize.

## Quy chuẩn cho thay đổi mới

- Kiểm tra MIME/extension/size/count theo contract và policy thực tế; không lấy giới hạn của avatar áp cho evidence/chat/materials.
- Tên/metadata picker không chứng minh nội dung file hợp lệ. Không mở rộng format do app có thể chọn được file đó.
- Presigned upload phải giữ method/headers/expiry/etag và các bước hoàn tất theo contract. Không áp một flow upload duy nhất cho mọi endpoint.
- Phân biệt chọn file, chuẩn bị/nén, upload bytes, malware scan, submit và review chuyên môn. “Upload xong” không đồng nghĩa “đã xác minh”.
- Avatar CLEAN và evidence storage READY là các state khác nhau; dùng đúng contract từng domain.
- Giữ concurrency, bounded polling và explicit retry hiện có; không tăng workers hoặc polling vô hạn mà chưa đánh giá.
- Retry tiếp tục từ bước đã xác nhận; giữ uploaded ID nếu còn hợp lệ, không upload trùng mọi file khi scan chậm.
- Evidence hiện có session-owned jobs tiếp tục sau navigation và pause khi background theo quyết định đã ghi. Không hứa OS background execution hoặc phục hồi sau process kill nếu chưa triển khai.
- Image re-encoding hiện có điều kiện và quyền giữ original; không crop/resize/đổi bytes tài liệu ngoài yêu cầu. Nếu mô tả threshold/quality, đối chiếu source mới nhất.
- Cancel/logout/archive/dispose xử lý đúng owner và job state. Kết quả upload phiên cũ không cập nhật profile/skill của phiên mới.
- Public UI không mount owner-only evidence/history/actions hoặc phát private download request. Không chỉ ẩn bằng opacity.
- Test storage thật/ClamAV/scan completion được tách khỏi fixture upload tests; response 202 không đủ chứng minh toàn bộ chuỗi đã thành công.

## Realtime, notification và chat

Tiếp trong `guides/uploads-and-realtime.md`:

- Chỉ mô tả realtime contract mà backend/source mobile có căn cứ: event type, payload projection, ID/version/cursor nếu có, auth, reconnect/replay và quyền truy cập.
- Không tự thêm SSE client, WebSocket hoặc push service trong migration. Domain chưa tích hợp phải ghi rõ.
- Listener có cleanup theo owner/session; reconnect có backoff/budget phù hợp, không phát command nghiệp vụ để “đồng bộ lại”.
- Event trùng hoặc đến muộn không tạo duplicate item/notification hoặc làm lùi confirmed state. Dùng ID/version/order do contract cung cấp; không invent exactly-once guarantee.
- Chọn invalidate/refetch hay reconcile event data theo contract domain. Không mặc định mọi event của hệ thống chỉ có nhiệm vụ invalidate.
- Chat phải phân biệt gửi local, server accepted, delivered và read nếu contract có các trạng thái đó. Không suy ra read receipt từ việc màn chat đang mở.
- Attachment/chat ownership và signed URL expiry theo server. Không giữ URL riêng tư như link công khai lâu dài.
- Notification read/unread, badge và destination phải có nguồn server hoặc nhãn preview rõ. Không trộn notification mẫu vào tài khoản thật.
- Kết nối thông báo được bổ sung theo feature cần nó; không dời tất cả notification đến cuối roadmap hoặc tự mở rộng spec cũ từng loại trừ notification.

## Giới hạn và đề xuất

Avatar CLEAN khác evidence READY. Chưa xác minh mobile SSE/WebSocket/push integration cho các domain; Message/Proposal runtime hiện dùng mock. Không tạo event schema từ màn mẫu. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
