# Trạng thái Phase 05–06

Cập nhật: 2026-10-22T00:17:21+07:00.

**Ready for review — source complete; acceptance pending.** Phần source đã bàn giao qua 5 commit, đến `5ee89e9`. Chưa đóng phase sản phẩm.

## Kết quả hiện tại

| Phần | Hiện trạng |
| --- | --- |
| Proposal & Chat | Đã tích hợp API: preflight điều kiện gửi, quản lý đề xuất/trạng thái trên Request, accept mở conversation; Chat HTTP/SSE, phân trang mới → cũ, read/delivery và form xác nhận. |
| Plan & Schedule | Đã tích hợp API: ba bước Cách học → Lộ trình → Lịch; quyền teacher/learner, ONE_WAY/TWO_WAY, exact-version confirmation và backend validation/finalize. |
| UI và navigation | React Native theo theme/font app; avatar, card, timeline/footer; Back theo nguồn và mở thỏa thuận trực tiếp từ Chat. Polling nền 30s kết hợp kéo tải lại. |
| Fixture/runtime | Route Proposal/Chat/Agreement/Plan/Schedule dùng API, không fallback fixture. `learning-paths/preview` còn cho Community/Sessions chưa tích hợp; không được đọc bởi route thỏa thuận API. |

`learning-paths` đã gom vào `api`, `components`, `hooks`, `screens`, `schemas`, `utils`, `preview`; root chỉ giữ public entries `index.ts`, `state.ts`, `policy.ts`.

## Bằng chứng kiểm chứng gần nhất

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| Full mobile tests | **448/448 PASS**, fail 0, skipped 0; chạy bằng binary local theo package script. Log ignored: `.expo/phase-05-final-review-tests.log`. |
| ESLint, TypeScript, structure | PASS; structure kiểm 558 source files. |
| Web export | PASS tại `.expo/phase-05-final-review-export`; chứng minh bundle, không thay nghiệm thu native/API. |
| Diff và Git hooks | Whitespace PASS; Prettier/commitlint của repo được giữ khi tạo commit. Không push. |
| API đang triển khai | **Chưa nghiệm thu** end-to-end với hai tài khoản. |
| Android/iOS và nghiệm thu người dùng | **Chưa thực hiện** cho phiên bản bàn giao hiện tại. |

Lượt review cuối sửa harness Hold UI (mock path/host và cleanup) cùng callback thẻ tin nhắn mẫu Home mở Inbox thật. Full suite chạy trước thay đổi callback Home một dòng; file Home được lint riêng sau sửa. Không coi host mocks hoặc các ảnh web/fixture trước đó là nghiệm thu native, quyền hay ledger thật.

## Giới hạn và dependency còn mở

- **P05-API-DEP-T78:** API chưa hỗ trợ phát hiện conflict trước confirm và sửa/hủy schedule chưa khóa. Hiện kiểm trùng qua final-validation/finalize; không có enforcement hoặc API sửa lịch được giả lập ở mobile.
- Backend đang reset xác nhận thỏa thuận rộng khi sửa plan. Mobile theo trạng thái/version trả về; cần backend phân loại thay đổi nếu muốn tránh quay lại bước Cách học cho sửa nội dung nhỏ.
- Create path/plan/schedule thiếu server idempotency; lookup path theo conversation bị giới hạn danh sách tối đa 100. Khi unknown hoặc chưa đủ bằng chứng, mobile chặn gửi mới và yêu cầu đối chiếu.
- Inbox sắp xếp theo activity của các conversation đã tải; chưa có last-message/unread summary hoặc batch context từ backend. Không khẳng định thứ tự/tổng unread của các trang chưa tải.
- Dạy thử tùy chọn vẫn là backlog tương lai; hủy/quyết toán và các phần chưa có API không được triển khai bằng fixture trong luồng thật.

## Bước tiếp theo

1. Thực hiện **P05-S99-T02** theo [plan](plan.md) trên môi trường API và hai tài khoản/ví test được cho phép.
2. Kiểm Android/iOS: keyboard/picker, Back/gesture, foreground/background và mất phản hồi; đối chiếu trạng thái server khi confirm/finalize.
3. Ghi kết quả nghiệm thu cùng phần cần sửa; chỉ đổi trạng thái phase khi đạt các tiêu chí, không tự ghi người dùng đã chấp thuận.

[Contract](../../contracts/proposal-learning-agreement.md) sở hữu chi tiết nghiệp vụ/API. [History](history.md) giữ các checkpoint và task ID cũ để tra cứu; status này chỉ cập nhật hiện trạng và bằng chứng còn hiệu lực.
