# Đối chiếu API Review

Thời điểm: 2026-11-13T17:12:07+07:00. Đã fetch `origin dev`; FETCH_HEAD là `5a70621d`, không khác baseline nhánh đang làm ở modules reviews/users. Kết luận dựa trên source và test cục bộ; chưa gọi API triển khai.

## Những phần backend đã bổ sung

| API (prefix `/api/v1`) | Dữ liệu và phạm vi |
| --- | --- |
| `GET /profiles/:userId/reviews` | Đánh giá nhận được của user, `{items, summary}`, phân trang cursor trong meta. Có IdentityGuard; public profile không đồng nghĩa anonymous. |
| `GET /me/reviews?direction=received|sent` | Danh sách nhận hoặc gửi của người đăng nhập. `summary` luôn thống kê đánh giá **nhận được** của user, kể cả direction=sent. |
| `GET /me` và `GET /profiles/:userId` | Có `reviewSummary` trong profile: `reviewCount`, `averageRating`, `ratingDistribution`. |
| `GET /learning-paths/:pathId/reviews` | Nhận xét hiển thị của lộ trình, chỉ cho participant; có `pathId`, `reviewerId`, `revieweeId`. |
| `POST /learning-paths/:pathId/reviews` | Body `{rating, comment?}`. Backend tự lấy đối phương làm người nhận; mỗi người một lần/lộ trình, sau COMPLETED và settledAt. |
| `GET /staff/reviews`, `POST /staff/reviews/:id/moderation` | Staff/Admin có quyền kiểm duyệt ẩn/khôi phục, kiểm version và ghi audit; không đảo lịch sử reputation. |

Tổng theo user có từ commit `d770a661` (2026-11-08); kiểm duyệt được bổ sung ở `4581f6a0` (2026-11-09). Tổng số, trung bình và phân bố tính trên **toàn bộ** reviews nhận được còn hiển thị, không phải số items của trang hiện tại. Khi chưa có review, averageRating=null. Review bị ẩn không xuất hiện trong list hoặc summary; danh tính không ACTIVE thành null, profile không ACTIVE không cho đọc history.

Nguồn: [controller đọc](../../../../../services/api/src/modules/reviews/presentation/http/public-reviews.controller.ts), [service thống kê/phân trang](../../../../../services/api/src/modules/reviews/application/services/public-reviews.service.ts), [profile projection](../../../../../services/api/src/modules/users/application/services/profile-reader.service.ts), [service tạo](../../../../../services/api/src/modules/reviews/application/services/reviews.service.ts), [module đăng ký controllers](../../../../../services/api/src/modules/reviews/reviews.module.ts).

## Người dạy theo lộ trình

- Mobile xác định chiều học bằng `plans[].teacherId/learnerId`, và ONE_WAY đối chiếu thêm teacher/learner trong agreement. TWO_WAY mỗi người có chiều học riêng nên cả hai được đánh giá người đã dạy mình; không giới hạn mặc định vào participantA hoặc participantB.
- Trong ONE_WAY, mobile không mở form cho người dạy đánh giá người học. Người dạy vẫn xem được nhận xét lộ trình. Đây là giới hạn UI của phạm vi đánh giá người dạy.
- **Backend hiện rộng hơn UI:** service create chỉ kiểm participant, completion/settlement và duplicate, chưa kiểm reviewer phải là learner. Vì vậy gọi API trực tiếp vẫn có thể đánh giá đối phương là người học trong ONE_WAY. Lượt này không thay backend.
- Summary backend gộp theo `revieweeId`, chưa lọc theo teacher role, skill hoặc chiều học. Không diễn giải tổng này thành “chỉ đánh giá năng lực giảng dạy”. Item public không có pathId; không tạo link vào lộ trình riêng từ public review.

## Kiểm chứng

`pnpm --config.verify-deps-before-run=never --filter api test:public-reviews`: build và **4/4 tests PASS**, kiểm average null/weighted, cursor scope, loại review ẩn/thông tin riêng, danh tính inactive và profile không khả dụng. Bộ test dùng transaction fixtures, không kiểm database triển khai.

Lần build đầu gặp Prisma Client local cũ thiếu field. Chạy `db:generate` rồi chạy lại script đã đạt; chỉ tái tạo client ignored, không chạy migration/seed hoặc thay source backend. Log local ignored: `.expo/reviews-ui-api-generate.log`, `.expo/reviews-ui-api-check.log` trong mobile.
