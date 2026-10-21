# Nghiệp vụ mobile từ SRS hiện hành

## Nguồn và phạm vi

[SRS1.6](../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx) là yêu cầu toàn hệ thống; [SOURCE_OF_TRUTH](../../../docs/SOURCE_OF_TRUTH.md) là chỉ dẫn. Đã trích đọc nội dung OOXML liên quan trong migration, không sửa DOCX. Mục/ID dưới đây dùng để tra cứu; đây không phải bản sao SRS hoặc bằng chứng implementation. Quyết định người dùng chỉ ghi là đã xác nhận khi có nguồn thật. [Contracts](contracts/README.md) ghi wire/source khác yêu cầu.

## Account và hồ sơ

SRS18.2–18.4 và18.6/OTP-001..009: OTP sai lần5 softban normalized email24 giờ xuyên challenge/purpose; resend không reset, không LOCKED account/khóa password login hợp lệ. SRS mô tả cooldown429 có thời gian; contract identity che bằng400 trung tính và stage Redis trước tạo account: [chênh lệch auth](contracts/auth-account.md), không tự sửa backend/mobile để khớp một phía.

PRO-001..004: người dùng có thể là teacher/learner tùy thỏa thuận. Public profile chỉ dữ liệu công khai (tên/avatar/bio/reputation, danh hiệu/kỹ năng có quyền hiển thị), không email/phone/payment/credentials/private files. Profile public và own là projection riêng; path count không phải session count. Staff có thể moderation avatar vi phạm, khác malware scan trước publish. Title/count/timezone thiếu contract không trở thành dữ liệu mẫu.

## Sharing Skill và bằng chứng

SRS18.8–18.9/SK-001..004: chọn catalog, tự khai level/kinh nghiệm/mô tả không cấp badge VERIFIED. Giữ riêng learning skill sau hoàn tất Path với Sharing Skill chuyên môn đã xác minh. Evidence mới cần review riêng, approved evidence không tự hết hạn. Scan sạch chỉ cho dùng file, không duyệt chuyên môn. Hiding/soft-delete phải giữ lịch sử; quyền/public/private theo server. Rule cap/format/count/level catalog cụ thể do [skills contract](contracts/skills-evidence.md) sở hữu, không coi hard ceiling source là cap SRS cố định. Material-change edit cần policy owner, không reset badge client theo suy đoán.

## Learning Request và Proposal

SRS6.4,8.2,18.10; FR-LR-01..08/LR-001..009/BR-07..12: tạo nháp, publish qua moderation; flagged → PENDING_MODERATION, lý do từ chối chỉ owner theo contract; expiry/effectiveStatus theo server. FR-LR-04 có notification khi từ chối, DEP-01 vẫn phải theo dõi dù scope005 không triển khai inbox/mark-read/push. Bài thật và preview không được trộn.

SRS PP-002: pending Proposal có thể cập nhật/rút; accept chỉ mở negotiation/chat, không tạo Path/Session/Hold. Expiry/anti-spam/verified-skill eligibility/giới hạn gợi ý và rejection reason DTO cần contract thật. Constraint reason max1000 trong mock UI không tự thành rule backend. [Contract LR](contracts/learning-requests.md) giữ lịch sử boundary ở phase trước; Proposal/Chat và Plan/Schedule đã có API adapters trong source, được đối chiếu tại [contract thỏa thuận](contracts/proposal-learning-agreement.md) và [work 05–06](work/phase-05-proposal-learning-agreement/status.md).

## LearningPath LearningPlan và lịch

SRS phần Learning Path/Scheduling, chi tiết18.13,18.32–18.33 và18.39:

- LearningPath là thỏa thuận giữa hai participants. TWO_WAY đúng hai plan đối ứng A→B và B→A, mỗi teacher tự tạo plan dạy đối phương; ONE_WAY một plan teacher→learner. Không tạo/confirm thay đối phương.
- Learner confirm đúng version từng plan, A+B confirm điều khoản chung cùng version. Confirmation chung không thay learner confirmation. Learner đề nghị sửa qua Chat/revision, chỉ teacher/createdBy sửa; version tăng, confirmation cũ reset, trở lại PROPOSED.
- Chỉ khi đủ plan đã confirm mới tạo lịch; ScheduleProposal gắn learningPlanId, do teacher/creator đề xuất, số items bằng số buổi từng plan. TWO_WAY cần lịch cho cả hai plan, ONE_WAY cần một.
- A+B confirm cùng version mỗi lịch. Backend final validation kiểm quyền/state, conflict toàn lịch và số dư payer trước Hold/LOCK/tạo Session nguyên tử; fail rollback. Chat text hoặc UI button không thay confirmation command.

Dạy thử là tính năng tùy chọn dự kiến theo phạm vi người dùng giao cho work 05–06; chưa có API booking/session trước plan, không triển khai UI/mock trong phase này và không là blocker. Theo yêu cầu UX tiếp theo, mobile đi từ Chat → hai bên xác nhận cách học (hình thức, vai trò, Credit) → tạo/xác nhận LearningPlan → lịch học. Đây là thứ tự UI: API xác nhận terms hiện hành dùng chung, không có entity xác nhận hình thức riêng; đổi phiên bản cần xác nhận lại. Backend vẫn quyết định state và mọi validation/Hold.

## Session và settlement

SRS18.18–18.20/18.19: mỗi Session60–180 phút; reschedule chỉ hiệu lực khi hai người confirm trước startAt ít nhất60 phút, nếu thiếu confirmation lịch cũ giữ nguyên. Mỗi buổi cần cả hai xác nhận completion sau buổi; progress không settlement theo session. Khi toàn bộ sessions bắt buộc hoàn tất và không dispute giữ Credit, backend settlement một lần cho cả agreement.

SRS conversion/18.17/18.19 và bổ sung ONE_WAY:

- 1.000VND=1Credit; verified backend payment mới top-up, redirect/QR không chứng minh trả tiền. Không withdrawal/cash-out hoặc chuyển Credit tùy ý.
- TWO_WAY cam kết >=20Credit/người cho toàn agreement, Hold cả hai; khi hoàn tất mỗi người nhận lại96% Held của chính mình,4% phí.
- ONE_WAY negotiatedCredit>0 (tối đa2 decimal), chỉ learner Hold; hoàn tất teacher nhận96%, platform4%. Không áp ngưỡng20 cho teacher.
- Ledger append-only/Release/settlement/rounding/policy thuộc backend. Mobile đọc projection; không tự tính số dư hay ghi ledger. Cancellation/no-show/dispute chưa chốt phải để câu hỏi, không tự dùng công thức completed settlement cho canceled.

## Chat LiveKit review report và materials

Chat chỉ participants, attachment tối đa15MB theo SRS nhưng format/scan/expiry/ownership theo contract domain; không áp cap này cho avatar/evidence/materials. LiveKit token short-lived do backend cho participants; secret không ở client. Join/leave không chứng minh completion; join window/cancel/no-show còn cần policy/contract, không tự điền production value.

Review sau hoàn tất Path, rating integer1–5, mỗi người review đối phương tối đa một lần/Path. Reputation khởi tạo50, khoảng0–100 theo server policy; client không tính penalty. Learning issue report gắn Path/Session; material/order report không bắt buộc hai IDs đó. Dispute có thể block settlement, reviewer UI không tự release.

SRS18.41 và bổ sung Digital Materials: FREE price0, PAID price>0 dùng Credit, entitlement/private download phải kiểm quyền; nếu price/version đổi trước confirm yêu cầu xác nhận snapshot mới. Không lộ file storage key/private URL. Phí PAID/refund/dispute window/version retention cần owner chốt trước production; không tự mượn4% học tập hay giới hạn Chat. Không thêm Google Play billing/subscription/activation-code từ sản phẩm khác.

## Khác biệt cần giữ rõ

SRS có changelog cũ nhắc settlement từng session và mô tả đăng ký PENDING_VERIFICATION; các đoạn nghiệp vụ hiện hành18.19/bổ sung nêu settlement cuối agreement. Khi nguồn nội bộ mâu thuẫn, giữ locator/đối chiếu và xin chốt phần ảnh hưởng, không lấy dòng changelog làm rule hiện hành. [State machines](state-machines.md) phân biệt state thật và sơ đồ mong muốn. [Migration](migration.md) ghi các giới hạn khảo sát; [roadmap](roadmap.md) không xác nhận modules chưa tích hợp đã có backend.
