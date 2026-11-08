# Learning path overview — backend draft

Branch feat/path-overview, base dev 30d9221d. Không có migration.

- GET /api/v1/learning-paths/mine bổ sung learningStage, progress hai chiều,
  nextSession, attentionCount/primaryAttention/primaryAction, settlement, evaluatedAt.
- GET /learning-paths/:id có overview và attentionItems; GET /:id/overview đọc
  cùng projection. status nghiệp vụ vẫn có trong response hiện hữu.
- GET /:id/cases và /:id/cases/:caseId/summary đọc theo participant, bao gồm case
  đối tác/hệ thống. Không trả reporter/evidence/description/note nội bộ.
- Settlement-status dùng cùng overview reader khi runtime DI đầy đủ, thêm
  relatedItems/nextActionTarget và giữ các trường hiện hữu.
- Stage ưu tiên STOPPED khi CANCELLED/terminationApprovedAt; không suy COMPLETED
  chỉ từ settledAt. DISPUTED có thể đi cùng LEARNING_FINISHED. Thiếu dữ liệu trả
  stage null/reason. Progress chỉ đếm COMPLETED, dùng version plan đúng thỏa thuận.
- Batch reader không gọi ensureDetermined hoặc provider; query count theo lô.
  Action attendance tái sử dụng sessionAttendanceView, không nới command policy.

Validation: TypeScript/build/ESLint, 11 test gồm regression HTTP/list/detail đạt.
Chưa có PostgreSQL test thật, client integration hoặc load/query plan. Cursor
case dùng ID anchor; chưa có endpoint attention pagination riêng và chưa đo tải
lộ trình có số lượng case lớn. Chưa ghép với incident/thread metadata mới.
Constitution: derived projection và owner contracts pass thiết kế; real storage
consistency/performance pending. Chưa commit/deploy.
