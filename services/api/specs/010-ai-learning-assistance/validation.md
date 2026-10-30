# Planning validation

Ngày: 2026-10-23. Trạng thái: tài liệu thiết kế; implementation/runtime Pending.

## Đã kiểm tra

- User scope: backend, ba capability, moderation bốn nguồn, advisory-only giữ
  word-filter/Staff decisions hiện có. Chat report-triggered được ghi là đề xuất
  giới hạn bản đầu, không giả định quyền quét toàn bộ chat đã được duyệt.
- Đối chiếu SRS V1.6 nội dung LearningPlan và Request moderation; đọc source owners,
  scoped AGENTS/constitution v1.2.0 và Spec Kit plan workflow.
- Read-only research bổ sung: live Request edit cũng moderation; Sharing Skill
  visible/restore và metadata-only version; chat get(id) cần scope/receipt checks;
  Review create đã update reputation; Plan draft CREATE/REVISE tách quyền.
- Provider docs kiểm tra 2026-10-23: JSON schema limitations, semantic validation,
  model availability, safety và tier-dependent rate limits; links ở research.md.
- Design review độc lập không thấy blocker; đã đồng bộ reason bắt buộc cho claim
  và expectedAnalysisRunId khi close (null chỉ nếu chưa có run; FAILED vẫn có ID).

## Chưa thực hiện

- Không implementation AI mới, không sửa Prisma/migration/config/runtime code.
- Không gọi provider, gửi private chat/review/profile hoặc dùng API key.
- Không build/lint/test ứng dụng cho thay đổi chỉ tài liệu; mọi suite trong
  quickstart là kế hoạch kiểm chứng sau khi code.
- Chưa push/deploy hoặc migrate/seed DB; lượt lập kế hoạch không thay đổi branch.
- Chưa phê duyệt content policy, privacy/retention, budget và eval thresholds.

## Document checks

Spec Kit setup-plan và check-prerequisites -Json đã chạy thành công, nhận đúng
feature folder và research/data-model/contracts/quickstart. HAS_GIT=false là
giới hạn discovery đã biết của API-local Spec Kit, không phải workspace thiếu Git;
Git branch được đọc riêng từ root, không tạo nested repository.

Không có before_plan hook. after_plan chỉ có optional agent-context update;
đã thử chạy script nhưng Python3 launcher lỗi StandardOutputEncoding trên máy
Windows. Fallback cập nhật đúng một plan path trong managed SPECKIT markers của
services/api/AGENTS.md, không sửa script/Python hoặc các chỉ dẫn ngoài markers.
feature.json cũng được trỏ sang feature này để lần tiếp theo resume đúng plan.

PASS: 8 Markdown documents, mọi local link resolve được; không có template
placeholder còn sót hoặc trailing whitespace. git diff --check cho hai process
files thay đổi không báo lỗi. Không dùng kết quả tài liệu để tuyên bố tests/runtime
đã pass.
Design review không phải bằng chứng feature đã có trong source hoặc production.

## Kiểm tra trước commit tài liệu (2026-10-31)

- Giữ nguyên phạm vi thiết kế; không thêm implementation, migration hoặc endpoint.
- Sửa năm link source sau khi dev chuyển sang application/services và
  presentation/http. Cả 8 Markdown và 21 local links đều tồn tại trên source hiện tại.
- Spec Kit feature.json và managed marker của AGENTS.md cùng trỏ tới
  specs/010-ai-learning-assistance; plan.md tồn tại và vẫn ghi rõ design draft.
- Verification AI là phần riêng đã commit tại 5603cffd, chưa được bật/deploy.
  Các thông tin provider/model trong research là ghi nhận ngày 2026-10-23;
  phải xác minh lại khi triển khai, không coi là bằng chứng availability hiện tại.
- Không có placeholder TODO/TBD hoặc trailing whitespace. git diff --cached
  --check được dùng để kiểm tra phần tài liệu stage trước commit.
- Không chạy lại application tests cho thay đổi chỉ Markdown/Spec Kit metadata;
  không dùng kiểm tra tài liệu để tuyên bố runtime AI learning assistance đã hoạt động.
