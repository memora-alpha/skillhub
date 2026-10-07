# Learning Request: đối chiếu SRS V1.4 → V1.5

**Ngày đối chiếu:** 2026-10-06. **Kết quả:** Core SH-030–034 không có thay đổi yêu cầu trực tiếp. Plan cập nhật tích hợp LearningPath/LearningPlan, TWO_WAY/ONE_WAY và completion toàn thỏa thuận. Sau review, user chọn option A cho cả 8 policy; chỉ bộ keyword/category thực tế còn cần PO duyệt. Giữ 7 task triển khai.

## Nguồn và cách đối chiếu

- Cũ: [SRS V1.4](../../../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx), baseline của bản plan trước.
- Mới: [SRS V1.5](../../../../docs/SRS_SkillHub_V1.5-1.docx), revision 03/10/2026 trong bảng lịch sử tài liệu. User cung cấp file `C:\Users\MSI-PC\Downloads\SRS_SkillHub_V1.5-1.docx`; bản trong repo là bản sao nguyên nội dung, không chỉnh file nguồn.
- SHA-256 V1.5, 107750 bytes: `14096c3fbc6915b155a5d04d802918bdd157d8beaadc0c1e106241876501fc36`.
- So sánh text trong paragraphs và table cells của `word/document.xml` theo thứ tự tài liệu, đồng thời đọc các section downstream thay đổi. Đây là đối chiếu nội dung yêu cầu, không đánh giá khác biệt định dạng/trang của DOCX.
- Sheet SH-030–034 vẫn là nguồn task/owner/dependency đã đọc trong [spec](spec.md); lượt này không cập nhật sheet hoặc xem status sheet là implementation evidence.

## Các yêu cầu Learning Request giữ nguyên

| Phần SRS                          | Kết quả đối chiếu          | Hệ quả cho plan                                                                                                                                                   |
| --------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.4, FR-LR-01–08                  | Toàn bộ nội dung không đổi | Create/publish, moderation, edit/cancel, browse/filter/recommendation giữ scope SH-030–034.                                                                       |
| 8.2, state machine LR             | Không đổi                  | DRAFT/PENDING_MODERATION/OPEN/REJECTED/NEGOTIATING/MATCHED/CLOSED/CANCELLED/EXPIRED giữ nguyên.                                                                   |
| 18.10, fields/validation/rules LR | Không đổi                  | title 10–120, description 20–3000, goal 10–1000, Skill ACTIVE, tags ≤10, slots ≤5; currentLevel/expiresAt vẫn optional. Không thêm giá/loại trao đổi vào Request. |
| 18.31, moderation                 | Không đổi                  | Word/pattern filter, Staff decision, reject reason 10–500, notification và re-publish/re-filter giữ nguyên.                                                       |
| BR-07–12, AC-03/04                | Không đổi                  | Cancel trước lock giữ Proposal history; không self-proposal; Accept chỉ Chat/NEGOTIATING, chưa Hold/Session.                                                      |

## Thay đổi ảnh hưởng đến tích hợp

| Thay đổi trong V1.5                                                  | Trước ở V1.4                                                      | Cập nhật plan Learning Request                                                                                                                                                                                                                                                            | Nguồn V1.5                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| LearningPath trở thành thỏa thuận tổng, có LearningPlan theo learner | Một trong hai User tạo một LearningPath; A/B confirm cùng version | Làm rõ ownership/thuật ngữ. TWO_WAY đúng hai plan A→B/B→A; ONE_WAY đúng một plan teacher→learner. LR không tạo LearningPlan tables. Request skill/goal chỉ là nhu cầu ban đầu; hai plan có thể khác skill.                                                                                | BR-13/14; 18.13/32/39          |
| Xác nhận plan và thỏa thuận độc lập                                  | Tập trung vào A/B confirm Path                                    | Caller lock flow kiểm tra teacher đúng author, learner confirm current plan version, A/B confirm current agreement version và lịch. Thiếu plan/confirmation hoặc version cũ chưa lock/MATCHED. Request version không thay thế plan/agreement version.                                     | FR-PATH-01–04; 18.39; AC-05/06 |
| ONE_WAY có role và Credit riêng                                      | Cam kết/Hold của cả hai, ≥20 Credit/User                          | LR create/publish/accept vẫn không giữ Credit. Downstream TWO_WAY Hold cả hai; ONE_WAY chỉ learner Hold negotiatedCredit, teacher không cần 20 Credit/Hold. Proposal.proposedCredit chỉ gợi ý theo loại trao đổi, không biến budgetCredit legacy thành field LR.                          | 6.14; 18.11/13/40; AC-20       |
| Hoàn tất/settlement theo toàn thỏa thuận                             | Toàn Session của Path, hoàn 96%/4% cho từng User                  | markClosed chỉ từ completion owner sau tất cả Session của mọi plan và settlement thành công cùng transaction, không đóng sau một plan TWO_WAY. Dispute/ledger rollback chưa CLOSED. TWO_WAY giữ 96%/4%; ONE_WAY trả teacher từ learner Held trừ fee snapshot, không hoàn 96% cho learner. | 18.19/39/40; AC-10/20          |
| Fee/threshold/refund ONE_WAY là policy riêng                         | Các rule tiền tập trung TWO_WAY                                   | Thêm dependency gate OP-13 cho downstream ONE_WAY; không tự lấy 4%/20 Credit làm default. Wallet owner chốt biểu diễn số tiền/rounding phù hợp constitution; LR không có monetary field.                                                                                                  | BR-44; OP-13; 18.40            |
| OTP sai lần 5 softban email 24 giờ                                   | Giới hạn theo challenge                                           | Thêm regression access: ACTIVE/session/grant hợp lệ không bị chặn LR chỉ vì OTP cooldown. Không implement OTP trong LR hoặc coi cooldown là account LOCKED.                                                                                                                               | BR-41; OTP-008; AC-19          |

Plan không bổ sung filter/recommendation theo exchangeType: SRS LR vẫn dùng skill/tag/keyword và Sharing Skill; exchangeType/vai trò/giá được chốt trong Chat/thỏa thuận. LearningPlan amendment sau LOCK thuộc downstream, không tự mở lại Request hoặc cho hủy trực tiếp.

## User decisions áp dụng vào implementation

| Chọn A               | Policy được ghi vào spec/plan                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expiry               | Mặc định 30 ngày từ publish; custom tối đa 90 ngày; edit/approve không gia hạn; rejected republish mở kỳ mới. Chỉ OPEN/PENDING_MODERATION tự expire.                 |
| Edit/cancel          | Skill bất biến sau publish đầu; sửa nội dung/preferences tới trước NEGOTIATING, luôn re-filter. Cancel tới trước Schedule LOCKED, giữ Proposal/Conversation history. |
| Tag                  | Dùng canonical Tag IDs do shared Catalog sở hữu; tối đa 10, không free-form.                                                                                         |
| Moderation           | Versioned Admin-managed rules, Staff quyết định; NFKC/case/space normalize, giữ dấu tiếng Việt; rule thiếu/lỗi/rỗng không auto-clean.                                |
| Permission/rejection | USER self-service/inbox grants; STAFF queue/review grants; ADMIN moderation qua grant tường minh; rejection notification IN_APP. Không inheritance.                  |

## Còn chờ

- **LR-D03 (initial data only):** PO duyệt category và keyword/pattern thật. Chưa tự sáng tác danh sách production.
- **Upstream runtime:** SH-022 Catalog/Tag, SH-023 Sharing Skill và Path/Schedule/Session/Wallet lock/completion adapters chưa có trong checkout.
- **OP-05:** In-app rejection đã chọn cho LR; email/push channels cho production notifications nói chung vẫn là open item.
- **OP-13:** Fee/min-max/refund/cancel/no-show ONE_WAY vẫn thuộc Path/Wallet owners.
- **OP-13 mới:** Fee/min-max/refund/cancel/no-show ONE_WAY là decision của downstream owner. Core LR có thể được triển khai/kiểm chứng riêng sau các gate của nó; end-to-end ONE_WAY cần policy/consumer thật.

Material FREE/PAID, entitlement/purchase/download, OP-14 và notification/audit riêng của plan/payment/material là scope của các module khác; không kéo vào migration hay rejection notification slice của LR.

## Tài liệu đã cập nhật

- [spec](spec.md): Baseline V1.5, thuật ngữ, lifecycle acceptance và dependencies; giữ fields/core requirements và 3 decision groups.
- [plan](plan.md): G3 và Task 2/5/7 bổ sung access regression, owner-flow/version/lock/completion checks theo V1.5. Vẫn 7 task, chưa tạo tasks.md hay implementation.
- [module ports](contracts/module-ports.md): Làm rõ preconditions/caller ownership của markMatched/markClosed/RequestLockReader, không thay signature hoặc mở HTTP action mới.
- [data model](data-model.md), [HTTP](contracts/http.md), [research](research.md), [quickstart](quickstart.md), [checklist](checklists/requirements.md), [validation](validation.md): Đồng bộ baseline, scope và evidence gates.

Mọi case kiểm thử mới trong plan là việc phải làm khi implement. Chưa có runtime Path/Schedule/Session/Wallet adapters trong checkout; fake protocol tests không chứng minh end-to-end hoặc financial correctness.
