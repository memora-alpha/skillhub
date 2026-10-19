# Navigation deep link và form

Đọc khi đổi routes, Back, validation hoặc submit.

## Đang có và nguồn đối chiếu

[route tree](../../src/app), [use-request-back](../../src/features/learning-requests/hooks/use-request-back.ts), [use-request-form](../../src/features/learning-requests/hooks/use-request-form.ts), [auth schemas](../../src/features/auth/schemas/auth-schemas.ts). Có Expo Router/RHF/Zod và form controllers hiện hữu.

## Quy chuẩn cho thay đổi mới

- Giữ Expo Router tree đang có; link tới route files thực tế. Không tạo route duplicate để né sửa Back behavior.
- Phân biệt push/replace/back/fallback theo luồng. Dùng history khi có, fallback có ngữ cảnh khi không; tránh tạo hai bản detail sau Save.
- Route param là dữ liệu ngoài: validate ID, enum/tab và destination trước khi dùng. Resource ID đúng cú pháp vẫn cần auth/owner check.
- Không đưa amount, outcome, token hoặc dữ liệu nhạy cảm trên URL để làm nguồn kết luận nghiệp vụ.
- Deep link/push chỉ mở tài nguyên người dùng có quyền; xử lý hết hạn/không tồn tại/đăng nhập lại. Navigation không được tự phát mutation tài chính.
- Feature giữ namespace và public entry đã có. Root layout/provider đổi cần kiểm tra consumer và lifecycle, không mặc định cần ADR cho mọi thay đổi nhỏ.
- Form giữ cách dùng React Hook Form/Zod hoặc controller hiện có. Không ép chuyển toàn bộ form cũ cùng lúc.
- Validation local hỗ trợ nhập liệu; backend validation vẫn quyết định tính hợp lệ nghiệp vụ.
- Field error rõ, không xóa draft khi API lỗi, không để response của lần submit cũ ghi đè lần nhập mới.
- KeyboardType, autoComplete/textContentType, submit/next, secure text và focus theo field. Không log password/OTP/reset token.
- Dependent selections phải reset hoặc đánh dấu stale khi lựa chọn cha đổi; danh mục inactive/empty/loading/error được xử lý theo contract.
- Nếu save đã thành công nhưng refetch lỗi, giữ kết luận save thành công và báo refresh riêng; không khuyến khích người dùng submit lại một record đã tạo.
- Phân biệt Save, Publish, Submit verification, Confirm schedule và Confirm payment: không dùng một nhãn thành công chung để suy ra chuyển trạng thái khác.

## Giới hạn và đề xuất

Native keyboard/gesture phải kiểm đúng platform; route render hoặc helper tests không đủ. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
