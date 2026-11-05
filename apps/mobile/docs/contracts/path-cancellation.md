# Dừng lộ trình và quyết toán

Đối chiếu source backend `aefd324f` ngày 2026-11-05, tiếp nhận bản `14880432`: [contract013](../../../../services/api/specs/013-learning-cancellation/contracts.md), [amendment PR79](../../../../services/api/specs/013-learning-cancellation/session-policy-amendment.md), controllers và services tương ứng. API participant dừng lộ trình không đổi. Requirement SRS1.6 §18.20 chưa chốt tỷ lệ phạt/refund; không áp tỷ lệ completion cho termination. Tích hợp mobile tại [work](../work/path-cancellation/status.md).

Tất cả đường dẫn dưới `/api/v1`, Bearer auth, participant của Path. Shared HTTP runtime bóc envelope, kiểm session generation và giữ cache riêng; adapter parse UUID, status/version/amount/timestamp và kiểm ID của response.

| Endpoint | Dữ liệu mobile dùng |
| --- | --- |
| GET `/learning-paths/:id/termination-requests` | Array tối đa100: id/pathId/kind/status/version/requester/reason/timestamps/responseNote/resolution/operationId/awaitingPolicy/blockedByDispute |
| POST cùng URL | `{reason}` 3–1000 ký tự; `Idempotency-Key` giữ cùng mã khi explicit retry ý định cũ |
| POST `.../:requestId/response` | `{expectedVersion,accept,note?}`; chỉ partner khi PENDING; từ chối chuyển STAFF_REVIEW |
| POST `.../:requestId/withdraw` | `{expectedVersion}`; chỉ requester trước khi thực thi |
| POST `.../:requestId/escalate` | `{expectedVersion,reason}`; participant chuyển nhân viên xem xét |
| GET `/learning-paths/:id/settlement-status` | status/reasonCode/nextAction/settledAt/lastCheckedAt/attemptCount/retryable |
| POST `/sessions/paths/:id/settlement-consent` | `{expectedVersion}` lấy từ `pathVersion` của settlement-status, không tự dùng currentVersion của Path; xác nhận tài chính riêng của participant hiện tại |

Open statuses: PENDING/ACCEPTED/STAFF_REVIEW. Terminal: REJECTED/WITHDRAWN/EXPIRED/APPLIED. Request chỉ được tạo cho Path SCHEDULED/ACTIVE/DISPUTED đã lock và chưa settled. Tạo, đồng ý hay escalation không tự hủy Session hoặc giải phóng Held. Backend luôn kiểm quyền/version/deadline/policy/dispute trong transaction.

APPLIED có `operationId` và resolution `{policyReference,reason,allocations:[{allocationId,refund,counterpartyPayment,platformFee}]}`. Các amount là chuỗi thập phân chính xác; không cộng, prorate hoặc suy owner từ vị trí array. Quyết định REJECTED có outcome/reason. Ledger dừng dùng RELEASE/ADJUSTMENT/PLATFORM_FEE; không tự đổi nhãn các khoản này thành PENALTY. Link sổ ví dùng luồng owner hiện có.

Settlement statuses: NOT_LOCKED/WAITING_SESSIONS/WAITING_DISPUTE_WINDOW/WAITING_DISPUTE/WAITING_TERMINATION/READY/RETRYING/NEEDS_REVIEW/SETTLED/TERMINATED. `retryable` nói về server, không phải quyền gọi Admin hoặc tự gửi lại quyết toán; đọc trạng thái chỉ GET, consent là POST riêng. NEEDS_REVIEW dẫn help; dispute dẫn danh sách báo cáo của mình.

PR79 bổ sung `pathVersion`, `autoSettlementAt` (UTC hoặc null) và `immediateSettlement:{ownApprovedAt,partnerApprovedAt,canApprove}`. Adapter giữ các fields này; legacy response thiếu fields mới vẫn đọc được trạng thái nhưng không mở xác nhận tài chính. Mobile hiển thị mốc hết thời gian chờ, trạng thái đồng ý riêng của mỗi bên và bước xem lại trước khi người dùng bấm đồng ý. Không dùng completion làm consent, không tính 48 giờ từ đồng hồ client.

UI theo yêu cầu tiếp theo: màn đang học không hiện card quyết toán hoặc nút “Kiểm tra lại quyết toán”. Khi các buổi của cả hai chiều đã COMPLETED (hoặc Path đã settled), màn mở bước4 Hoàn tất với tổng kết gọn, giữ ba bước trước chỉ đọc. Trước settled chỉ ghi “Đã hoàn tất các buổi học”; sau SETTLED mới ghi “Lộ trình đã hoàn thành” và mở sổ ví/đánh giá theo điều kiện hiện có. Countdown là thông tin hiển thị làm tròn lên giờ từ `autoSettlementAt`, không đổi trạng thái khi đồng hồ tới0. Deadline thiếu thì không tự dựng48h. Blocker/retry thay countdown bằng cảnh báo thực tế.

“Đồng ý quyết toán sớm” mở modal xác nhận: vàng cho việc bỏ thời gian chờ, đỏ cho lưu ý báo cáo sau quyết toán không tự hoàn Credit. “Để sau” chỉ đóng phần xác nhận. Recovery khi gửi lỗi vẫn giữ explicit retry/read; không tự replay. `FormNotice` thêm tone warning màu vàng theo token sẵn có, các tone hiện hữu giữ nguyên. Màn hủy giữ read settlement để làm mới ví khi terminal nhưng không hiển thị thêm card Credit; quyết định APPLIED có link sổ ví ngay bên dưới phân bổ.

Màn hủy dùng form lý do ngắn và nút “Gửi yêu cầu hủy”. Bấm mở modal riêng để xem lại lý do và xác nhận; chưa xác nhận thì không POST. Modal nhắc lịch còn hiệu lực tới khi quyết định hủy được thực hiện và Credit chưa được hoàn ngay; không suy tỷ lệ phí/refund. Quay lại giữ draft; pending/uncertain giữ intent, không đóng modal bằng Back, error và explicit read/retry nằm trong modal. Request card chỉ mở ghi chú chuyển nhân viên khi chọn hành động đó, validate reason như API hiện có. Hiển thị kết quả giữ nguyên amounts và link sổ ví, không đưa policyReference nội bộ ra màn gọn; field vẫn được validate trong adapter.

Phản hồi trên mobile: người nhận PENDING chỉ thấy “Đồng ý hủy” / “Không đồng ý”. Modal không đồng ý giải thích chuyển STAFF_REVIEW, có lý do tùy chọn. “Nhờ hỗ trợ” là hành động phụ dành riêng người gửi PENDING còn hạn, modal yêu cầu reason3–1000 ký tự. Sau ACCEPTED hoặc STAFF_REVIEW không hiện nút hỗ trợ. Đây là giới hạn hiển thị/command guard của mobile; BE hiện vẫn cho participant escalate yêu cầu ACCEPTED còn mở. Quyền rút yêu cầu của người gửi trước thực hiện giữ theo BE. Tất cả accept/decline/withdraw/escalate xác nhận bằng modal; pending/uncertain khóa đóng/sửa và giữ recovery ngay trong modal. Receipt hợp lệ từ server được dùng để cập nhật trạng thái card ngay cả khi refresh danh sách chậm/lỗi; không tự gán trạng thái thành công hoặc sửa Credit.

Request còn mở chỉ có một warning gộp `blockedByDispute` và `awaitingPolicy`, nói rõ đã gửi yêu cầu nhưng lộ trình chưa hủy. Entry trên thỏa thuận dùng query termination hiện có; PENDING/ACCEPTED/STAFF_REVIEW của viewer đổi nhãn thành “Đã gửi yêu cầu hủy”, của đối tác là “Xem yêu cầu hủy”; vẫn chỉ điều hướng tới màn hủy. Row đóng không được coi là đang gửi; denied không tái dùng cache để gán nhãn. Form chỉ đổi sang đã gửi/khóa nút sau receipt hợp lệ, không suy từ thao tác bấm.

Consent chỉ sau khi đủ Session COMPLETED; cả hai đồng ý bỏ riêng thời gian chờ report window. Dispute, termination, nguồn Request và các ràng buộc fee/Held vẫn được BE kiểm tra. Blocking report mới xóa cả hai consent; sau giải quyết cần thao tác đồng ý mới nếu còn chờ. Report sau quyết toán không tự đảo ledger. Chưa có notification riêng cho một bên vừa đồng ý sớm; mobile lấy trạng thái bằng focus/foreground/polling hiện có.

Receipt200 `{pathId,approvedAt,bothApproved,settlement:{outcome,errorCode?}}`, outcome SETTLED/WAITING/RETRYING/NEEDS_REVIEW. BE lưu consent trước bước tài chính; RETRYING/NEEDS_REVIEW vẫn có thể đã ghi nhận consent, không phải lý do tự gửi lại POST. Mobile đọc lại status trước mỗi explicit send/retry; nếu consent đã có hoặc đã SETTLED thì chỉ refresh, không POST. Không gửi Idempotency-Key cho endpoint này vì contract dùng consent của participant và expectedVersion. `STALE_PATH_VERSION` hoặc quyền thay đổi thì tải lại. Toàn bộ transport vẫn theo runtime user/generation và `replayAfterRenewal:false`.

POST không tự replay sau renewal. Timeout/protocol/5xx giữ ý định, khóa sửa và cho tải lại/explicit retry; 409 tải lại version hiện hành. Response/withdraw có replay theo semantics backend; escalation dựa expectedVersion nên không thực hiện hai lần cùng version, có thể trả409 và cần tải lại. Row mới theo id/version thay row cũ, không cho phản hồi trên version đã cũ. Draft màn được reset khi user/generation/path đổi.

Focus/foreground và polling30 giây chỉ đọc; polling chỉ khi foreground/focus, còn open requests hoặc settlement chưa terminal, không error/denied. Khi request version thay đổi, invalidate Path/settlement/list. Khi status SETTLED/TERMINATED, invalidate Path/list và read ví của đúng owner/generation qua public hook Wallet; không sửa số dư local hoặc query phiên khác. Khi denied403/404, ReadAccess bỏ cache và ẩn private content. Refresh error giữ nội dung đã đọc kèm lỗi và khóa command.

Thông báo `learning-path.change.updated` gửi generic copy + `pathId,changeRequestId`, không chứa reason. Mobile Việt hóa template, validate IDs, dẫn `/paths/:id/cancel`, ưu tiên request khớp. Payload chưa có kind/sessionId nên nếu không khớp trong100 requests thì hiển thị hướng dẫn xem các buổi học. Không đoán yêu cầu đã được chấp nhận hoặc đã ghi Credit từ sự kiện. Chưa tích hợp cancellation request riêng từng Session trong work này.

Source/API adapter không chứng minh API đích đã deploy migration013 hoặc có policy được duyệt. Chưa có real-API/native acceptance cho luồng mới.

Ngoài phạm vi theo yêu cầu người dùng: không cập nhật schema, hạn mức học bù, giới hạn đổi lịch hay UI trong Session ở lượt đồng bộ PR79. Cần task Session riêng nếu muốn đưa các fields/rule mới đó lên mobile. Không thay API/luồng hủy Session bằng quyết định từ mobile.
