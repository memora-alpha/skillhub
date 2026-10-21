# Trạng thái Phase 05–06

Cập nhật: 2026-10-22T01:09:20+07:00.

**Ready for review — source complete; acceptance pending.** Mobile đã đồng bộ quy tắc sửa đổi trước chốt của BE `187beab` và timeline lộ trình/lịch; checks source đạt để bàn giao. Chưa đóng phase sản phẩm.

## Kết quả hiện tại

| Phần | Hiện trạng |
| --- | --- |
| Proposal & Chat | Đã tích hợp API: preflight điều kiện gửi, quản lý đề xuất/trạng thái trên Request, accept mở conversation; Chat HTTP/SSE, phân trang mới → cũ, read/delivery và form xác nhận. |
| Plan & Schedule | Đã tích hợp API: ba bước Cách học → Lộ trình → Lịch; quyền teacher/learner, ONE_WAY/TWO_WAY, exact-version confirmation và backend validation/finalize. PATCH sửa lịch trước chốt, prefill giờ cũ và hiển thị lịch thiếu buổi NEEDS_REVISION. |
| UI và navigation | React Native theo theme/font app; avatar, card, timeline/footer; chi tiết lộ trình dùng chung timeline với chi tiết lịch, bỏ số tròn/khung bao lặp, giữ nội dung từng buổi. Back theo nguồn và mở thỏa thuận trực tiếp từ Chat. Polling nền 30s kết hợp kéo tải lại. |
| Fixture/runtime | Route Proposal/Chat/Agreement/Plan/Schedule dùng API, không fallback fixture. `learning-paths/preview` còn cho Community/Sessions chưa tích hợp; không được đọc bởi route thỏa thuận API. |

`learning-paths` đã gom vào `api`, `components`, `hooks`, `screens`, `schemas`, `utils`, `preview`; root chỉ giữ public entries `index.ts`, `state.ts`, `policy.ts`.

## Bằng chứng kiểm chứng gần nhất

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| Full mobile tests | **454/454 PASS**, fail 0, skipped 0 sau toàn bộ sửa đổi API/timeline; chạy bằng binary local theo package script. Log ignored: `.expo/phase-05-precommit-tests.log`. |
| ESLint, TypeScript, structure | PASS; structure kiểm 562 source files. Dùng binary local vì pnpm wrapper định cài lại dependencies và dừng ở lỗi no-TTY; không cài/purge modules. |
| Web export | PASS tại `.expo/phase-05-precommit-export`; chứng minh bundle, không thay nghiệm thu native/API. |
| Diff | Prettier toàn bộ file thay đổi và whitespace PASS; chỉ sửa apps/mobile. Không push. |
| Timeline lộ trình/lịch | Dùng chung nét đứt cam và chấm cam viền nhạt, đồng bộ cả editor lịch. Reader/navigation harness mô phỏng SVG; 18/18 test navigation PASS và full suite ở trên đã bao gồm thay đổi này. Chưa kiểm giao diện trên thiết bị. |
| API đang triển khai | **Chưa nghiệm thu** end-to-end với hai tài khoản. |
| Android/iOS và nghiệm thu người dùng | **Chưa thực hiện** cho phiên bản bàn giao hiện tại. |

Regression kiểm no-op/same-version đúng flag và resource, sửa plan giữ cách học/chiều đối ứng, lịch thiếu không confirm/finalize, quyền teacher/lock, PATCH và prefill giữ giây của lịch cũ, uncertain giữ draft. Lưu terms y nguyên đã tự xác nhận không confirm/gửi Chat thêm; phần chưa xác nhận vẫn confirm. Không coi host mocks hoặc web export là nghiệm thu quyền/ledger/API thật.

## Giới hạn và dependency còn mở

- **P05-API-DEP-T78:** Chưa có conflict state/validation giữa hai chiều trước confirm. Final-validation/finalize vẫn kiểm trùng; teacher có thể dùng PATCH sửa lịch chưa khóa sau lỗi kiểm tra. Hủy schedule riêng chưa có API mobile xác minh.
- Theo BE mới: sửa plan không reset cách học; cùng số buổi giữ xác nhận lịch, đổi số buổi cần sửa/xác nhận lịch lại. Sửa terms cần xác nhận lại terms, phần tương thích được BE giữ. Mobile luôn đọc projection server; chưa xác minh deployment BE.
- Create path/plan/schedule thiếu server idempotency; lookup path theo conversation bị giới hạn danh sách tối đa 100. Khi unknown hoặc chưa đủ bằng chứng, mobile chặn gửi mới và yêu cầu đối chiếu.
- Inbox sắp xếp theo activity của các conversation đã tải; chưa có last-message/unread summary hoặc batch context từ backend. Không khẳng định thứ tự/tổng unread của các trang chưa tải.
- Dạy thử tùy chọn vẫn là backlog tương lai; hủy/quyết toán và các phần chưa có API không được triển khai bằng fixture trong luồng thật.

## Bước tiếp theo

1. Thực hiện **P05-S99-T02** theo [plan](plan.md) trên môi trường API và hai tài khoản/ví test được cho phép.
2. Kiểm Android/iOS: keyboard/picker, Back/gesture, foreground/background và mất phản hồi; đối chiếu trạng thái server khi confirm/finalize.
3. Ghi kết quả nghiệm thu cùng phần cần sửa; chỉ đổi trạng thái phase khi đạt các tiêu chí, không tự ghi người dùng đã chấp thuận.

[Contract](../../contracts/proposal-learning-agreement.md) sở hữu chi tiết nghiệp vụ/API. [History](history.md) giữ các checkpoint và task ID cũ để tra cứu; status này chỉ cập nhật hiện trạng và bằng chứng còn hiệu lực.
