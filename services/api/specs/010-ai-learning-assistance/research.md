# Research và quyết định

Ngày kiểm tra: 2026-10-23. Chỉ đọc source và tài liệu provider; không gọi Gemini
bằng dữ liệu người dùng hoặc kiểm tra runtime/deployment trong lượt này.

## R1 LearningPath và LearningPlan

Decision: AI sinh nội dung một LearningPlan, đúng chiều teacher→learner;
backend lấy direction từ current path, không tự tạo entity.
Rationale: LearningPathsService.addPlan/revisePlan có teacher/creator, count,
direction uniqueness và version; SRS V1.6 cần learner confirm đúng version.
Alternatives: AI tạo agreement hai chiều/auto-confirm vượt vai trò.

Source chưa có một permission catalog LearningPlan riêng đủ để mặc nhiên dùng
cho endpoint mới. Cần live guard/source application contract, không suy diễn JWT/
participant là đủ cho mọi chiều. CREATE kiểm tra chưa có direction, REVISE kiểm
tra teacher đồng thời creator/expectedPlanVersion; recheck completion và GET.

## R2 Draft qua API hiện có

Decision: JSON draft map DTO cũ, không auto-apply. Rationale: giữ owner rules,
version/confirmation, người dùng quyết định nội dung. Alternatives: tạo entity
rỗng trước model gây retry/version rối; model update trực tiếp bypass owner rules.

## R3 Hai tín hiệu moderation độc lập

Decision: giữ word-filter LR, AI advisory trên bốn nguồn theo lựa chọn người dùng.
Rationale: publish/moderate sở hữu state, review create cập nhật reputation cùng
tx. Alternatives: model quyết OPEN/PENDING hoặc sửa điểm theo sentiment bị loại.

Live Request edit đã chạy lại filter: hook publish/republish và edit OPEN/PENDING.
SharingSkill restore/visible cần hook; setVerification tăng entity version dù
không đổi text, nên dedupe bằng content hash/policy/prompt, giữ version để audit.
Request approve/reject chỉ nhận PENDING_MODERATION; case của bài OPEN không đổi
domain status để ép endpoint cũ chấp nhận.

## R4 Chat và review riêng tư

Decision: chat report-triggered, excerpt giới hạn do Conversations owner lấy;
Staff grant excerpt riêng. Review listForPath cũng participant-only. Không gửi
toàn bộ chat để viết plan. Rationale: PG membership + Mongo PUBLISHED messages,
không có blanket Staff history access. Alternatives: scan mọi tin hoặc cấp
membership cho Staff làm thay privacy model, ngoài bản đầu.

chat.get(id) không tự scope conversation/PUBLISHED. Contract phải kiểm tra
conversation/sender/PUBLISHED/sequence/digest/PG publication receipt; recheck
live authority sau Mongo I/O. Không có PG+Mongo transaction. PG excerpt là
derived evidence; worker không tự mở rộng context. Mất/hết hạn evidence không
được xem là sạch; pending runs bị cancel và detail trả unavailable.

## R5 Provider và model

Decision: Gemini JSON/schema nhỏ + backend semantic validation; model explicit
từng capability, benchmark trước rollout. Ứng viên gemini-3.8-flash; có thể đánh
giá gemini-3.5-flash-lite trên cùng corpus. Không đổi Verification AI model/prompt.

Rationale: [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
hỗ trợ schema/classification, có giới hạn schema phức tạp. JSON đúng shape không
bảo đảm values đúng: backend kiểm bounds/catalog/count/quote. Alternatives:
free text/regex parsing khó kiểm chứng; agent có tools không cần thiết.

[Models](https://ai.google.dev/gemini-api/docs/models) ghi 2.5 còn phục vụ nhưng
hạn chế truy cập theo lịch sử sử dụng, khuyến nghị model mới cho project mới.
Test chứng chỉ trước đây không chứng minh runtime/key mới dùng được 2.5/3.8.
Synthetic smoke test là G4; xác minh lại thông tin khi rollout.

[Safety guidance](https://ai.google.dev/gemini-api/docs/safety-guidance) yêu cầu
post-processing/evaluation. Safety block là không kết luận, không thay policy
SkillHub; không hứa model biết chính xác ý định/lừa đảo chỉ từ một tin nhắn.

## R6 Async và cost control

Decision: 202/poll, outbox/BullMQ, PG run với fencing/attempt/recovery, reserve quota
trước call; provider ngoài tx. Rationale: constitution và pattern outbox hiện có.
Alternatives: synchronous publish kéo dài HTTP/tx; queue-only mất enqueue gap.

[Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) phụ thuộc model,
project/tier. Local throttle/concurrency/budget độc lập; không mặc định quota
provider thành nghiệp vụ; retry có thể tốn lặp, không exactly-once provider calls.

## R7 Open policy là release gates

Hướng kỹ thuật đủ chia task. Categories/ngoại lệ, quyền xử lý nội dung,
retention/privacy terms, ngân sách và quality acceptance chưa được duyệt: giữ
G1–G4 explicit, flags off. Không tự thêm chế tài, confidence threshold hoặc thời
gian lưu dữ liệu riêng tư vào nghiệp vụ.
