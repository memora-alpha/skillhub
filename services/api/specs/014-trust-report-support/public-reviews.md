# Public reviews — backend draft

Branch feat/public-reviews, base dev 30d9221d. Quyết định người dùng 2026-11-08:
công khai review cũ và mới cho thành viên đã đăng nhập.

- GET /api/v1/profiles/:userId/reviews?limit=20&cursor=... trả data.items,
  data.summary và meta.pagination. Target profile phải ACTIVE.
- GET /api/v1/me/reviews?direction=received|sent cùng paging; mặc định received.
  Summary luôn mô tả đánh giá nhận được của chủ tài khoản.
- Profile hiện hữu bổ sung reviewSummary: reviewCount, averageRating (null nếu
  chưa có), ratingDistribution 1–5. Reader đăng ký từ Reviews, tránh import vòng.
- Items chỉ có review ID, rating, comment, createdAt và reviewer public tối thiểu.
  Chiều sent có reviewee. Tác giả không ACTIVE trả null; không lộ pathId/email.
- hiddenAt khác null bị loại theo semantics hiện hữu; chưa thêm moderation API,
  chưa thêm cơ chế chỉ ẩn comment nhưng giữ sao vì policy đó chưa chốt.
- Không đổi điều kiện tạo review, điểm uy tín hay phạm vi đọc Path. Không cần
  migration dữ liệu để công khai cả review cũ. Cursor ràng buộc user/direction.

Validation: TypeScript/build/ESLint và 4 test summary, cursor, quyền profile,
projection riêng tư đạt. Chưa test PostgreSQL thật/HTTP API mới/mobile/web.
Constitution: owner/store pass thiết kế; runtime/storage integration pending.
Chưa commit/deploy.
