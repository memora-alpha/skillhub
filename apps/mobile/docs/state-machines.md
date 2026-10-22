# Trạng thái và chuyển trạng thái cho mobile

Đọc khi hiển thị state hoặc thêm command. Nghiệp vụ do [domain rules/SRS](domain-rules.md) quy định, wire enums theo [contracts](contracts/README.md). Mobile không tự infer quyền chuyển trạng thái hoặc financial outcome. Graph nghiệp vụ dự kiến không phải DTO đã tích hợp.

## Đang có — connection và auth runtime

[Connection store](../src/lib/network/connection-store.ts) dùng reason:null/offline/unreachable và retrying:boolean. Nhãn AVAILABLE/OFFLINE/UNREACHABLE/RETRYING dưới là diễn giải, không wire enum:

    AVAILABLE → OFFLINE (device explicitly disconnected/unreachable)
    AVAILABLE → UNREACHABLE (transport failure)
    OFFLINE/UNREACHABLE → RETRYING → AVAILABLE hoặc giữ reason lỗi

Finish retry chỉ clear khi connected và không có failure mới trong ticket. [Network](network-state.md) sở hữu recovery; không replay mutation. SessionController dùng bootstrapping/guest/ready/offline/reauth, generation guards/single-flight tại [auth contract](contracts/auth-account.md); ready không phải AccountStatus.

AccountStatus thực tế theo [backend schema](../../../services/api/prisma/schema.prisma), không suy graph account bằng tên UI. PENDING_VERIFICATION là mô tả SRS; registration Redis draft backend chưa là account. Các suspended/deactivated transition trong tài liệu cũ không phải route mobile đã có; admin identity lock/unlock không thuộc scope app người dùng.

## Đang có — Sharing Skill và files

| Tài nguyên          | State / transition cần hiển thị                                                                                                                               | Nguồn                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Badge Sharing Skill | UNVERIFIED/PENDING/VERIFIED/REJECTED; aggregate server                                                                                                        | [skills contract](contracts/skills-evidence.md)               |
| Verification batch  | PENDING → APPROVED hoặc REJECTED                                                                                                                              | Cùng contract, không biến badge VERIFIED thành batch APPROVED |
| Evidence approval   | PENDING → APPROVED/REJECTED; APPROVED → REVOKED                                                                                                               | REVOKED không phải badge skill                                |
| Evidence storage    | UPLOADING → QUARANTINED → SCANNING → READY; retry SCANNING → QUARANTINED; terminal REJECTED/SCAN_FAILED và UPLOAD_FAILED/CLEANUP_PENDING/DELETED theo storage | Only READY submit, unknown không đủ điều kiện                 |
| Avatar storage      | QUARANTINED → CLEAN hoặc rejected/deleted theo avatar contract                                                                                                | CLEAN công bố ảnh, không review chuyên môn                    |
| Evidence job client | SENDING/WAITING_SCAN/FAILED/PENDING, chỉ trong session                                                                                                        | Không wire approval và không durable background queue         |

Approved cũ còn có thể giữ badge VERIFIED khi batch mới PENDING hoặc một file bị revoke; không tính lại aggregate từ một trang history. Poll/cadence/lifecycle thuộc guide và source, không nghĩa là SLA storage.

## Đang có — Learning Request

Wire enum mobile: DRAFT,PENDING_MODERATION,OPEN,REJECTED,NEGOTIATING,MATCHED,CLOSED,CANCELLED,EXPIRED từ [types](../src/features/learning-requests/types.ts). Các nhánh tiêu biểu:

    DRAFT → OPEN hoặc PENDING_MODERATION (publish/moderation)
    PENDING_MODERATION → OPEN hoặc REJECTED (server decision)
    OPEN → NEGOTIATING → MATCHED (workflow khác, không mobile tự set)
    OPEN → EXPIRED hoặc CANCELLED (policy/command server)

Không phải bảng exhaustive commands cho mọi state. Cancel/edit/re-publish/version/lock/expiry dùng [LR contract](contracts/learning-requests.md) và server response; tồn tại enum CLOSED không chứng minh nút close đã tích hợp. GET effectiveStatus có thể khác persisted status khi expiry worker chậm. Không local-expire NEGOTIATING/MATCHED/CLOSED, không infer moderation reason mới từ last-read cũ.

## Payment — backend projection và mobile coordinator

Đối chiếu BE `dev@1c8fb8d` ngày 2026-10-22: CREATED/PENDING có explicit cancel, nhưng chỉ backend xác nhận CANCELLED/EXPIRED. PAID/REVIEW từ chối hủy. CANCELLED là terminal: QR off, dừng polling, resolve correlation đủ điều kiện; không cộng/hoàn Credit client. PAYMENT_RECOVERY_PENDING vẫn CREATED/PENDING đang khôi phục, không tự terminal theo clock. `cancelUnconfirmed`/`cancelNotice` chỉ là trạng thái UI; timeout/busy giữ identity, retry explicit cùng key, lifecycle chỉ đọc. Source checkout BE ở nhánh mobile cũ hơn ref đối chiếu.

Backend enums/semantics cần tra [payment contract](contracts/wallet-payments.md); CREATED/PENDING/PAID/REVIEW và trạng thái cuối khác không được suy từ route state hoặc fixture. checkout:null/expiry/QR suppression không tự terminal. REVIEW không nghĩa failed và không cho tạo replacement an toàn; PAID không bị hạ chỉ vì related refresh lỗi. Mobile có create coordinator `loading/draft/review/claiming/unknown/known/blocked/ended`, durable claim native và owner status reads; stage UI không thay backend status. Explicit restore/check/replay tuân snapshot capabilities; lifecycle chỉ tự reads/restoration, không POST. [Status Phase03](work/phase-03-wallet-topup/status.md) ghi giới hạn kiểm chứng native/provider.

## Nghiệp vụ đích — Proposal Plan Schedule Session Report

Các sơ đồ giữ từ SRS/tài liệu mobile cũ để tra ý nghĩa, chưa xác nhận là backend wire enums/graph đầy đủ. Phải chốt domain contract trước triển khai phase tương ứng:

| Đối tượng           | Luồng khái niệm                                                                                               | Điều kiện cần bảo toàn                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Proposal/invitation | PENDING → ACCEPTED/REJECTED/WITHDRAWN/EXPIRED                                                                 | Accept chỉ mở negotiation, không Hold/Session; hiện mobile mock           |
| LearningPlan        | DRAFT → PROPOSED → CONFIRMED; revision → NEEDS_REVISION → PROPOSED version mới                                | Teacher/createdBy sửa, learner confirm đúng version, TWO_WAY2/ONE_WAY1    |
| LearningPath        | DRAFT → PROPOSED → PARTIALLY_CONFIRMED → CONFIRMED → SCHEDULED → ACTIVE → COMPLETED; nhánh DISPUTED/CANCELLED | Đủ plan và agreement confirmations; completed cần settlement theo backend |
| ScheduleProposal    | DRAFT → PROPOSED → PARTIALLY_CONFIRMED → LOCKED; NEEDS_REVISION/CANCELLED/EXPIRED                             | A+B cùng version, backend validation/Hold/LOCK nguyên tử                  |
| Session             | CONFIRMED → READY → ONGOING → AWAITING_CONFIRMATION → COMPLETED; DISPUTED/CANCELLED                           | Cả hai xác nhận; không settle từng buổi; LiveKit join không đủ            |
| Report/dispute      | OPEN → UNDER_REVIEW → RESOLVED/REJECTED/ESCALATED                                                             | Contract authority/eligibility, có thể block final settlement             |

CreditTransaction concepts TOP_UP/HOLD/RELEASE/PATH_RETURN/TEACHING_PAYMENT/TEACHING_EARNING/PLATFORM_FEE/REFUND/PENALTY/ADJUSTMENT không tự là enum đã dùng ở từng API. Render type/status/deltas server theo contract, không rewrite history hoặc tính settlement. Các gap chưa chốt nằm trong [roadmap](roadmap.md), không mở endpoint tưởng tượng.
