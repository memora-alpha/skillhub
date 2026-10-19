# Kiểm chứng và review kỹ thuật

Đọc khi chọn checks, viết regression, review hoặc nghiệm thu.

## Đang có và nguồn đối chiếu

[package scripts](../../package.json), [checker](../../scripts/check-structure.mjs), [tests](../../tests), [profile tests](../../test/profile.test.mjs). test hiện dùng tsx --test tests/**/*.test.ts test/profile.test.mjs; test:profile dùng node --test.

## Quy chuẩn cho thay đổi mới

- Tại baseline đã đối chiếu, tests mobile dùng `tsx --test` và Node test runner, có cả `tests/` và `test/profile.test.mjs`. Hai nơi này đều đang được scripts gọi.
- Không chuyển sang Jest hoặc thêm UI/E2E framework trong migration. Khoảng trống test được ghi rõ, không giả nhận Node tests đã kiểm chứng native component.
- Test hành vi, state transition và side effect observable. Tránh test chỉ đọc source string hoặc sao chép implementation rồi assert cùng công thức, trừ kiểm tra cấu trúc có mục đích rõ.
- Bug logic nên có regression test thể hiện trigger và expected result. Financial/auth/concurrency cần ca lỗi/negative cases, không chỉ happy path.
- Async tests dùng dependency injection/fake clock/mock transport khi cần; không thêm sleep tùy ý làm tests chậm và dễ flake.
- Contract fixtures bám DTO thực tế, có malformed/missing/null/denied cases. Fixture hợp lệ không chứng minh backend deployment hoạt động.
- Preview/test host tách khỏi account client/cache/storage. Có nhãn và route guard phù hợp; không thể gửi payment thật từ preview.
- UI evidence xét trạng thái tương tác, responsive/large text và navigation cần thiết. Screenshot không thay test side effects hoặc ownership.
- Independent QR decode từ ảnh thực sự render là bằng chứng QR renderer; không chỉ decode lại chuỗi input hoặc coi đó là kiểm chứng ngân hàng.
- Ghi test command và môi trường thực sự dùng. Không cộng số test của focused suite và full suite nếu chúng trùng nhau.
- Không đánh dấu skip/NOT_RUN thành PASS. Không chạy lại full suite nhiều lần sau khi đã đạt mà không có thay đổi/lý do mới.
- Review nêu bug/blocker với trigger, tác động và file/line đã xác minh. Không yêu cầu refactor ngoài scope chỉ vì sở thích.

## Giới hạn và đề xuất

Không cài Jest/RNTL/MSW/Maestro; Node tests không chứng minh native component/device. Matrix payment nằm tại [wallet/payments](../contracts/wallet-payments.md). Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
