# TypeScript và dữ liệu tại boundary

Đọc khi viết parser/type/form hoặc xử lý dữ liệu ngoài.

## Đang có và nguồn đối chiếu

[tsconfig](../../tsconfig.json), [AppError](../../src/lib/http/errors.ts), [response](../../src/lib/http/response.ts), [LR schemas](../../src/features/learning-requests/schemas/request-preferences.ts). strict/noUncheckedIndexedAccess và alias @/* đã bật.

## Quy chuẩn cho thay đổi mới

- Giữ `strict`, `noUncheckedIndexedAccess` và alias `@/*` theo cấu hình thực tế. Không tắt type checking để vượt kiểm tra.
- Không thêm `any`, `@ts-ignore` hoặc chuỗi ép kiểu `as unknown as T` để né validate/type design. Ngoại lệ do thư viện phải hẹp, có lý do cụ thể; không tạo exception file chung cho toàn app.
- **Cho phép và ưu tiên `unknown` tại boundary chưa được tin cậy**, sau đó narrow hoặc parse. Không cấm `unknown`: HTTP runtime hiện trả dữ liệu chưa xác thực bằng kiểu này.
- Dữ liệu API, route/deep link, storage, event/push phải được kiểm tra phần shape/giá trị thực sự dùng trước khi tác động vào UI hoặc nghiệp vụ. Dùng Zod hoặc parser/type guard sẵn có; không bắt viết hai lớp schema trùng nhau.
- Kiểm tra schema thất bại là protocol/validation error hoặc trạng thái không khả dụng phù hợp; không âm thầm thay bằng số 0, array rỗng hoặc fixture thành công.
- Nullable và optional có ý nghĩa khác nhau: giữ `T | null` và `field?: T` đúng contract. Không biến field thiếu thành giá trị hợp lệ.
- Giữ wire enum/string literal, ID và timestamp theo contract. Không đổi timezone, casing hoặc enum chỉ để tiện hiển thị.
- Timestamp API giữ dạng chuỗi trong DTO; parse tại nơi tính toán/hiển thị, có xử lý giá trị không hợp lệ và timezone.
- Monetary strings phải giữ chính xác theo contract; không đổi sang floating point để tính số dư/settlement hoặc so sánh tiền.
- Dùng `type`/`interface` nhất quán với khu vực source. Không bắt đổi toàn bộ sang một kiểu khai báo.
- Hàm public quan trọng, parser và API adapter nên có return type rõ. Internal callback đơn giản được phép dùng inference.
- Catch/error input là `unknown`, narrow bằng `instanceof`, type guard hoặc API của thư viện; không giả định mọi thrown value là Error.
- Không dùng non-null assertion để che điều kiện có thể thiếu ở runtime. Kiểm tra precondition rõ trước khi sử dụng.
- Giữ convention source đang có: component PascalCase, hook `useXxx`, các filename theo feature hiện tại. File mới theo convention gần nhất; không rename toàn repo sang kebab-case.
- Regex được đặt ở nơi parse/validate/format thích hợp, có ca kiểm tra khi logic phức tạp. Không tạo lệnh cấm regex ở mọi file khác mà không có lý do.
- Test ID có ý nghĩa, ổn định và không chứa PII/token. Không dùng text dịch hoặc chỉ số mảng làm định danh duy nhất cho hành vi quan trọng.

## Giới hạn và đề xuất

Chưa có lint rule đảm bảo mọi boundary đã parse; review theo dữ liệu thực dùng. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
