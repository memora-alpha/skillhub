# Proposal Chat LearningPlan và lịch

## Thứ tự danh sách — 2026-11-04

- Proposal nhận/gửi dùng `createdAt DESC, id DESC` từ BE. Tab “Tất cả” gọi
  `GET /proposals?direction=all` với một cursor của BE, thay cho nối hai luồng.
  Giữ kiểm tra participant/status tại adapter và bộ lọc Request nhận hiện có.
- Chat dùng `lastActivityAt DESC, id DESC` từ BE trước phân trang. Mobile đọc
  `lastActivityAt` và lấy thời điểm lớn nhất giữa activity server, preview và draft
  cục bộ; preview cũ/chưa tải không đẩy chat mới xuống dưới. Timestamp bằng nhau
  dùng ID giảm dần. Thiếu field khi đọc API cũ thì fallback `createdAt`.
- List cache có phiên bản mới, không tái sử dụng cursor ID cũ hoặc cursor ghép
  nhận/gửi. BE trả 400 `INVALID_CURSOR` cho cursor cũ/sai scope; bắt đầu lại trang
  một. Cần deploy BE hỗ trợ `direction=all` trước bản mobile này.
- Chat là danh sách live: chat có tin mới có thể chuyển lên trước cursor đang
  tải; refresh từ trang đầu để nhận vị trí mới. Không có snapshot xuyên trang.
  Source/regression local không thay nghiệm thu API thật và Android/iOS.

## Phạm vi và nguồn

Phần BE còn cần bổ sung cho lỗi thời gian khi kiểm tra/chốt lịch được ghi riêng tại [bàn giao BE: chi tiết INVALID_SCHEDULE_ITEMS](backend-schedule-validation-gap.md), gồm endpoint, vị trí sửa service/filter/OpenAPI, response đề xuất, test và phần mobile cần nối. Đây là gap/đề xuất, chưa phải contract đã triển khai.

Đối chiếu source working tree cho [work Phase 05–06](../work/phase-05-proposal-learning-agreement/plan.md), không phải bằng chứng deployed API. Prefix HTTP `/api/v1`, auth/session/envelope theo [contracts index](README.md).

- Proposal/Chat: [HTTP contract](../../../../services/api/specs/008-connections/contracts/http.md), [proposal controller](../../../../services/api/src/modules/proposals/presentation/http/proposals.controller.ts), [DTO](../../../../services/api/src/modules/proposals/presentation/http/proposals.dto.ts), [conversations](../../../../services/api/src/modules/conversations/presentation/http/conversations.controller.ts).
- Plan/terms: [controller](../../../../services/api/src/modules/learning-paths/presentation/http/learning-paths.controller.ts), [DTO](../../../../services/api/src/modules/learning-paths/presentation/http/learning-paths.dto.ts), [service](../../../../services/api/src/modules/learning-paths/application/services/learning-paths.service.ts).
- Schedule: [controller](../../../../services/api/src/modules/scheduling/presentation/http/scheduling.controller.ts), [service](../../../../services/api/src/modules/scheduling/application/services/scheduling.service.ts).
- Mobile boundaries: [proposals-api](../../src/features/proposals/api/proposals-api.ts), [messages-api](../../src/features/messages/api/messages-api.ts), [learning-paths-api](../../src/features/learning-paths/api/learning-paths-api.ts), [schemas](../../src/features/learning-paths/api/learning-paths-contract.ts).
- Yêu cầu: SRS 1.6 BR-12..22, 18.13, 18.32–33, 18.39; [domain rules](../domain-rules.md).

## Proposal và Conversation

| Method / endpoint                                            | Mobile dùng                                     | Quyền / kết quả                                                          |
| ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| GET/POST `/proposals`                                        | List theo sent/received, status, cursor; create | Người gửi/nhận; mutation có Idempotency-Key                              |
| GET/PATCH `/proposals/:id`                                   | Detail; sửa hints PENDING với expectedVersion   | Chỉ participant; chỉ proposer sửa                                        |
| POST `/proposals/:id/accept`, `/reject`, `/withdraw`         | Quyết định với expectedVersion                  | Recipient accept/reject, proposer withdraw                               |
| GET `/conversations`, `/conversations/:id`                   | Danh sách cursor và metadata                    | Chỉ hai participants                                                     |
| GET/POST `/conversations/:id/messages`                       | History/cursor/sequence và gửi                  | Publication 201 hoặc 202 processing; clientMessageId và immutable intent |
| GET `/conversations/:id/message-deliveries/:clientMessageId` | Recovery gửi chưa rõ                            | Sender-only; không suy đã gửi từ HTTP timeout                            |
| POST `/conversations/:id/read`                               | Read watermark                                  | Chỉ tăng theo tin đã thấy; event không tự đánh dấu đọc                   |

Nguồn LEARNING_REQUEST dùng learningRequestId; server suy parties/skill. DIRECT_SEARCH dùng recipientSharingSkillId; người gửi muốn học từ chủ Sharing Skill và không cần sở hữu kỹ năng đó. ExchangeType/credit/count/duration/candidateSlots chỉ là hints. `candidateSlots` hiện là nullable text, không phải timestamp array. Terminal proposal giữ lịch sử; accept trả proposal + conversation, chưa tạo Path/Session/Hold. Mobile hiển thị Request hiện hành và gửi expectedRequestVersion khi accept nguồn Request.

Chat attachment upload/status/private download hiện có adapter và scanner state; giữ giới hạn theo backend policy. SRS 1.6 mục 18.12/CHAT-002 cho phép gửi tệp tối đa 15 MB, kiểm định dạng/kích thước/malware. Nút đính kèm trong Chat mở document picker thiết bị trực tiếp; file được upload và hiển thị trạng thái tại Chat, chỉ gửi sau khi đọc lại trạng thái READY. Hủy chọn giữ lựa chọn cũ; lỗi upload/send giữ tệp và caption để thao tác lại. Kết quả 202 chưa phải đã xuất bản; recovery giữ clientMessageId và payload gốc, chỉ do người dùng kích hoạt. Route đính kèm cũ dùng chung controller để giữ deep link tương thích.

Theo StoredFileState của BE (`services/api/src/infrastructure/storage/file.types.ts`), REJECTED/SCAN_FAILED/UPLOAD_FAILED/CLEANUP_PENDING/DELETED hiển thị lý do và hướng dẫn bỏ/chọn lại tệp, không tiếp tục ghi đang chờ quét hoặc đưa nút GET status như thao tác khởi động lại scan. QUARANTINED/SCANNING vẫn cho kiểm tra trạng thái; chỉ READY mới gửi. Khi tin đã được nhận và còn processing/uncertain, ưu tiên recovery cùng intent, không hướng dẫn upload mới từ trạng thái file. Không tự retry upload/mutation.

Thẻ tệp hiển thị trong bubble theo phía gửi/nhận, có tên, loại và dung lượng; không tạo bubble chữ rỗng khi gửi không caption. Tải tệp vẫn qua API riêng theo conversation/message/attachment, chỉ mở URL còn hạn và phiên hiện tại; chặn nhấn tải lặp khi đang xử lý. Inbox hiển thị giờ cho hôm nay, `Th 2`…`Th 7` cho những ngày trước trong tuần lịch hiện tại (bắt đầu thứ Hai), và `25 thg 10` cho các tuần trước; thêm năm khi khác năm. Mốc ngày tính theo múi giờ thiết bị.

Tệp đã chọn nằm trong thanh soạn Chat dưới dạng tile gọn có ×; caption và tệp dùng chung nút Gửi. × tuân theo khóa upload/delivery hiện có, không bỏ intent đang gửi hoặc chưa rõ kết quả. Không thay giới hạn một tệp mỗi lần chọn, 15 MB, scan READY, refetch trước send hoặc cơ chế recovery của controller.

Nếu GET download trả URL đã hết hạn, không mở link và hiện thông báo nhấn lại tệp để lấy URL mới; không tự retry request hoặc gửi lại message. Lượt nhấn mới xóa cảnh báo cũ; kiểm phiên và chống nhấn tải lặp vẫn giữ.

SSE chỉ chứa references, hydrate qua authorized HTTP. Chat text hoặc gợi ý lộ trình không tạo confirmation. Không có public SSE event cho thay đổi plan/terms/schedule: detail đọc lại mỗi 30 giây khi focus/app active, dừng khi blur/background/error/terminal/session cũ; còn refresh focus/foreground và invalidation sau command. Chỉ GET, không replay mutation.

## Điều hướng Inbox theo nguồn trao đổi — 2026-11-06

Inbox dùng metadata nhóm từ `GET /conversations/inbox`, có hai tab không số:
**Theo yêu cầu học** (`LEARNING_REQUEST`, mặc định) và **Trao đổi trực tiếp**
(`DIRECT_CONVERSATION`). Tab đầu gom theo `learningRequestId`; cùng đối tác ở
hai bài vẫn là hai nhóm. Tab trực tiếp giữ từng Conversation riêng. Mỗi
Proposal/Conversation giữ nguyên quan hệ, participant và quyền server; lời mời
chưa chấp nhận tiếp tục quản lý ở màn Đề xuất.

Tab được lưu bằng `/messages?tab=requests|direct`; giá trị thiếu/sai dùng requests.
Back từ chat trực tiếp về `/messages?tab=direct`, chat theo bài về tab Đoạn chat
của bài đó. Thứ tự hoạt động hiện có được giữ riêng trong từng tab. API Inbox
chưa có query lọc loại: mobile lọc các trang dùng chung, giữ cursor/hasNextPage,
đọc tiếp khi tab chưa có hàng nhưng vẫn còn trang. Không báo rỗng từ một trang
chỉ có loại khác; lỗi/pending/denied vẫn theo runtime. Chỉ bật preview cho hàng
đang thấy thuộc tab đang mở; chuyển tab remount list để bắt đầu từ đầu.

Màn `/messages/request/[id]` có hai tab không số: Đề xuất nhận được/Đoạn chat.
Chỉ owner projection của Request được mở list received với `learningRequestId`;
`PENDING` là mặc định, bộ lọc hỗ trợ `REJECTED` và Tất cả. Denied không sử dụng
owner/title cũ từ cache. Tab chat lọc Conversations theo ID bài trước khi đọc
history/preview; Back từ Chat dùng `learningRequestId` từ conversation đã authorize.
List còn trang chưa được coi là rỗng. Thẻ Inbox hiển thị số Proposal nhận được
ở mọi trạng thái và số Conversation theo metadata nhóm của BE. Không giả total
unread hoặc tổng preview từ số trang client. Preview dùng tin gần nhất của các chat đã tải, tách khỏi updatedAt
của Proposal để sự kiện đề xuất mới không thay nội dung tin nhắn. Chỉ prefix tên
người gửi khi metadata message và authorized profile khớp; outgoing giữ “Bạn:”.

Nhãn nhóm ưu tiên tiêu đề Request được phép đọc. Khi Request detail denied/missing,
mobile chỉ đọc skill của Proposal liên kết có cùng request ID và đúng participant,
rồi hiển thị kỹ năng + mã Request; không dùng lại tiêu đề riêng tư từ cache. Trên
thẻ, mã là phần tử riêng không shrink để không bị cắt theo tên dài. Chưa có skill
thì báo chưa đọc được tên kèm mã; header cũng có mã fallback. Pull refresh tải lại
Request detail đang active theo key owner/session, không tải lại toàn bộ feed.
Không có thay đổi quyền backend để đọc tiêu đề gốc của bài không còn công khai.

Inbox khởi tạo trang `/learning-requests/mine` trước khi đọc các preview và dùng
owner projection đúng key user/session để hiển thị tên ngay. Detail mode của thẻ
opt-in cache mine: bản có version mới hơn không bị ghi đè bởi snapshot cũ; known
detail/list denial luôn chặn reuse. Cache còn mới không phát GET detail bổ sung,
thẻ readonly giữ snapshot own còn được phép đọc kể cả khi stale và để query mine
làm mới khi focus/pull/invalidation, tránh bật N GET khi qua TTL. Bài không có trong trang
mine tiếp tục GET detail. `AbortSignal` được truyền đến API để hủy queued GET khi
blur. Pull refresh cập nhật mine trước, rồi chỉ retry active detail chưa có snapshot
mine mới đủ version. Không tăng concurrency hoặc sửa chính sách quyền backend.

## LearningPath và LearningPlan

| Method / endpoint                            | Payload dùng                                         | Kết quả / ràng buộc                                                           |
| -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| GET `/learning-paths/mine`                   | Query `limit` và `cursor` tùy chọn                    | Summary theo createdAt và ID giảm dần; tối đa 100 mỗi trang. Hành trình dùng 20 mỗi trang. |
| GET `/learning-paths/:id`                    | Không body                                           | Current agreement, plans, schedules, sessions; chỉ participant                |
| POST `/learning-paths`                       | conversationId, exchangeType, các terms theo loại    | `{id,version,status}`; chưa Hold, không server idempotency                    |
| PATCH `/learning-paths/:id`                  | expectedVersion và terms, không conversationId       | Đổi terms tăng agreement version; no-op giữ version, `unchanged: true`        |
| POST `/learning-paths/:id/plans`             | skillId, learningGoal, totalSessions, sessionOutline | Teacher tạo chiều của mình; không server idempotency                          |
| PATCH `/learning-paths/plans/:planId`        | expectedVersion và nội dung                          | Chỉ teacher; đổi nội dung tăng plan version, giữ agreement; no-op giữ version |
| POST `/learning-paths/plans/:planId/confirm` | expectedVersion                                      | Learner xác nhận current linked plan version                                  |
| POST `/learning-paths/:id/confirm`           | expectedVersion                                      | Xác nhận terms của chính caller; đủ plans + hai confirmations mới CONFIRMED   |

ONE_WAY: teacherId/learnerId là hai participants, negotiatedCredit >0, tối đa 2 chữ số thập phân; một plan. TWO_WAY: totalCreditPerUser >=20; hai plan đối ứng do hai teacher tạo. Role không suy từ proposer/recipient. Outline phải đủ đúng số buổi (1–100); mobile kiểm schema và server là thẩm quyền cuối cùng.

Danh sách Hành trình dùng các nhóm Tất cả, Đang trao đổi, Chờ bắt đầu, Đang học, Chờ quyết toán, Hoàn thành, Đã dừng và Tranh chấp. Ưu tiên learningStage từ BE để tách LEARNING_FINISHED khỏi COMPLETED; thiếu/null stage thì dùng status. CONFIRMED chưa khóa lịch vẫn thuộc Đang trao đổi; SCHEDULED thuộc Chờ bắt đầu. DISPUTED luôn có nhóm Tranh chấp riêng, không bị gộp vào đã dừng/hoàn thành. Đây là bộ lọc trình bày, không thay trạng thái/quyền nghiệp vụ.

Bộ lọc áp dụng lên các trang đã tải, giữ nguyên thứ tự BE. Khi chọn nhóm cụ thể mà còn trang, hiển thị số lộ trình đã tải và hướng dẫn tải thêm; chưa có kết quả thì chỉ nói chưa thấy trong phần đã tải. Tải trang kế tiếp giữ nhóm đang chọn; hết trang thì bỏ chú thích và mới xác nhận không có kết quả trong nhóm. Không tự quét hết API khi đổi bộ lọc. Thứ tự toàn danh sách hiện vẫn createdAt DESC, id DESC theo cursor BE; sắp theo hoạt động nghiệp vụ mới nhất cần BE bổ sung contract/cursor tương ứng.

Source BE `GET /learning-paths/mine` hiện trả title từ conversation và overview khi projection có dữ liệu, cùng IDs, status, exchangeType, counterpartId, versions và timestamps. Mobile dùng title nếu có, fallback Lộ trình học cùng đối tác; giữ tên đối tác, hình thức học và một cập nhật ưu tiên có thật. Không tải detail riêng từng thẻ để bù dữ liệu thiếu hoặc suy learningGoal thành field API chưa trả.

Điều hướng sau chốt lịch: CTA “Xem các buổi học” ở progress/Hold và “Xem tất cả buổi học” ở thỏa thuận cùng mở `/paths/[id]/sessions`. `/paths/[id]/schedules` vẫn dùng để đề xuất, xem lại và xác nhận lịch từng kế hoạch trước chốt; không đổi nghiệp vụ Session.

Trên cùng màn thỏa thuận chỉ hiện một shortcut danh sách buổi học: nếu progress của bước Lịch học đã có link `/sessions`, bỏ shortcut chung bị trùng; ở các bước khác/Hoàn tất hoặc khi progress không có link thì dùng shortcut chung nếu đã có buổi học.

Nhãn bước Lịch học dựa vào `lockedVersion`: khác null thì hiện “Đã chốt lịch” với dấu hoàn thành, kể cả trong lúc các buổi đang diễn ra. Không dùng vị trí bước đang chọn để báo còn thống nhất; việc chốt lịch không tự mở bước4 hay xác nhận Credit đã quyết toán.

Thỏa thuận có bốn bước chung: Cách học → Lộ trình → Lịch học → Hoàn tất. Bước4 bị khóa trước khi đủ các buổi hoàn thành; khi đủ buổi hoặc đã quyết toán thì mặc định mở bước4 với tổng kết. Trong lúc chờ tài chính ghi “Chờ quyết toán”, chỉ đánh dấu bước4 đã hoàn thành khi Path COMPLETED có settledAt từ BE. Bấm lại ba bước đầu để đọc điều khoản, nội dung từng kế hoạch và lịch hiện tại; không có form sửa hay thao tác xác nhận/chốt lịch trong phần chỉ đọc. Không có mục “Xem lại thỏa thuận” thu gọn riêng. Đây là snapshot hiện tại được phép đọc, không phải lịch sử đầy đủ các phiên bản.

Detail schema giữ version, learnerConfirmedAt trên plan hiện hành; confirmation timestamps của agreement/schedule thuộc version được trả. Khi version đổi, mobile dùng snapshot mới, không giữ confirmation của bản cũ. Các ID/participant/outline/schedule shape được kiểm tại adapter.

Editor plan/schedule giữ snapshot đã mở và draft riêng khi polling có revision mới, không remount theo version hoặc tự reset nội dung đang nhập. Gửi bị khóa đến khi người dùng mở bản mới; callback của bản cũ và validation đang chạy cũng kiểm lại revision trước command. Nút mở bản mới reset draft theo snapshot mới nhất, không khả dụng khi command pending/unknown hoặc read đang lỗi. Thỏa thuận tạm chưa cho sửa giữ draft chỉ đọc; mất authorized data/đổi resource vẫn unmount, không giữ nội dung riêng tư qua denial.

## Schedule và finalization

| Method / endpoint                                 | Payload dùng                                           | Ràng buộc                                                                     |
| ------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| POST `/learning-plans/:planId/schedule-proposals` | expectedPlanVersion, items `{sessionNo,startAt,endAt}` | Teacher; path/plan đã CONFIRMED; số items khớp outline                        |
| PATCH `/schedule-proposals/:id`                   | expectedVersion, items `{sessionNo,startAt,endAt}`     | Teacher sửa trước khóa; gửi đủ buổi; đổi lịch cần hai bên xác nhận lại        |
| POST `/schedule-proposals/:id/confirm`            | expectedVersion                                        | Hai participants xác nhận cùng version; response có bothConfirmed             |
| POST `/learning-paths/:id/final-validation`       | Không body                                             | `{pathId,version,exchangeType,planCount,scheduleCount,ready:true}`; chưa Hold |
| POST `/learning-paths/:id/finalize`               | expectedVersion, header Idempotency-Key                | Server kiểm lại toàn bộ, Hold/lock/create Session nguyên tử                   |

Mobile nhập ngày/giờ bắt đầu qua DateTimeField dùng chung với Learning Request, nhập trực tiếp số phút nguyên từ 60–180 bằng bàn phím số; lịch tuần và từng buổi dùng cùng control. Có thể xóa giá trị rồi nhập lại; không tự kẹp số hoặc sửa giờ bắt đầu. Picker ngày/giờ vẫn giữ wheel trên iOS và control tương ứng trên Android/web. Giờ địa phương được chuyển sang timestamp có timezone, không thay payload hoặc giới hạn mỗi buổi. Trùng lịch, số dư, quyền và trạng thái do server quyết định. Không đọc ví fixture để giả quyết định validation. Finalize thành công trả pathId/version/status/sessions; đọc lại path để hiển thị trạng thái mới. ONE_WAY chỉ Hold learner; TWO_WAY Hold cả hai. Không settlement theo session.

### Cảnh báo trùng giờ trong editor React mobile

Nút Gửi đề xuất/Lưu thay đổi lịch bị disabled ngay khi draft trùng nội bộ, trùng chiều đối ứng trong Path hoặc trùng Session đã tải ở Path khác. Sửa ngày/giờ hết trùng thì nút mở lại khi các điều kiện đọc/submit khác hợp lệ. Input, nút Sửa từng buổi và Áp dụng lịch tuần vẫn dùng được để sửa xung đột; callback lưu cũng kiểm guard hiện tại. Preflight đọc mới trước POST/PATCH vẫn giữ để bắt xung đột vừa phát sinh.

Draft của plan đang sửa giữ snapshot riêng; cảnh báo/trạng thái nút Lưu đối chiếu lịch chiều đối ứng từ projection Path mới nhất, kể cả khi version của plan đang sửa không đổi. Rời editor invalidates lượt lưu đang chờ: không gửi lệnh sau validation muộn, không tự chuyển màn từ response lưu cũ, kể cả đã quay lại editor. Lệnh đã gửi vẫn được runtime đọc/ghi cache theo kết quả xác nhận; không tự replay khi focus lại.

Editor đối chiếu ngay các buổi đang nhập với nhau và lịch `PROPOSED`/`PARTIALLY_CONFIRMED`/`LOCKED` của chiều còn lại trong Path đã đọc. Mỗi thẻ cần sửa có một khối cảnh báo ngắn: lịch/buổi đang gây trùng, ngày/khung giờ đã có và lời nhắc chọn giờ khác. Giờ đang nhập nằm ngay trên thẻ, không nhắc lại trong cảnh báo. Một cặp trùng nội bộ chỉ được giải thích ở buổi sau; các lý do giống nhau gộp lại, các Session đã cảnh báo trên thẻ không lặp trong panel lịch bận. Bỏ banner lỗi tổng trùng với chi tiết. Cảnh báo cập nhật khi sửa ngày/thời lượng, giữ phần giây của timestamp cũ. Hai buổi kết thúc/bắt đầu cùng thời điểm không bị coi là trùng. Submit mở đúng buổi cần sửa và giữ draft khi có xung đột đã biết trong Path.

Editor tự đối chiếu toàn bộ buổi đã điền với lịch dạy/học đã chốt của chính người dùng ở những Path khác qua public entry `sessions.useSessionList` và GET `/sessions/mine?from&to`; không cần mở Sửa từng buổi. Áp dụng lịch tuần cũng khởi động kiểm tra. Query bao phủ từ ngày đầu đến ngày cuối của draft, bắt đầu thêm một ngày trước vì endpoint lọc `startAt`, chỉ gửi `from`/`to`; không gọi riêng một request cho mỗi buổi. Chờ lần đọc đầu trước khi cho gửi; conflict đã biết hiện ngay ở thẻ buổi đang thu gọn và chặn submit, giữ draft/mở đúng buổi cần sửa. Guard so khớp timestamp cuối để callback cũ không dùng kết quả của draft khác.

Mở Sửa vẫn có đối chiếu riêng ngày đó (cả hai ngày nếu qua đêm). Cả hai cách giữ session scope, abort/focus refresh/cache 30 giây của Sessions runtime, bỏ `CANCELLED`, không tự coi Path hiện tại là xung đột với chính nó. Áp dụng lại cùng lịch cũng buộc refetch; ngay trước POST/PATCH, hook đọc lại Session và kiểm trên response mới thay vì chỉ dùng cache. Submit bị chặn khi read lỗi/denied, đang đọc hoặc response đủ 100 buổi (có thể chưa đầy đủ); hiển thị lỗi/giới hạn và giữ draft. Có số Session đã đối chiếu để không âm thầm coi response rỗng là bảo đảm khả dụng. Backend vẫn kiểm tra cuối.

`sessions.useSessionList` bổ sung metadata `queryKey` để guard lần kiểm tra đang chờ theo đúng user/generation/range; không đổi wire API hoặc chính sách cache/refresh của Calendar/Session list. Sau await, hook kiểm lại scope và timestamp draft; callback cũ hoặc duplicate preflight không được gửi tiếp. Regression múi giờ kiểm `2026-10-28T21:00:00+07:00`–`22:00:00+07:00` khớp Session `2026-10-28T14:00:00Z`–`15:00:00Z`.

Preflight mobile chỉ đọc lịch của tài khoản hiện tại. Backend kiểm tra lịch cả hai khi lưu và chốt. Mobile đọc khoảng trùng từ `details.conflicts` của `SCHEDULE_CONFLICT` và đối chiếu `details.userIds` của `INSUFFICIENT_AVAILABLE_CREDIT` với tài khoản hiện tại. Khi API không trả chi tiết hợp lệ, mobile dùng thông báo chung.

## Khoảng trống API và fixture

- Cập nhật ngày 2026-11-05 theo backend `14880432`: đã có API dừng lộ trình và trạng thái quyết toán. Mobile nối ở [contract hủy/quyết toán](path-cancellation.md) và [work](../work/path-cancellation/status.md). Không dùng `PathsPreviewProvider`/fixture để thay đổi status hoặc hiển thị Credit như giao dịch thật.
- Luồng Inbox/Chat/Attachment và thỏa thuận/plan/schedule/terms không có fixture runtime; route luôn dùng API và ID thiếu/sai báo không tìm thấy. `PathsPreviewProvider` còn phục vụ Community/Sessions chưa tích hợp API, không được đọc từ các route LearningPath API.
- Đây là kết quả đối chiếu source, không xác nhận production. Thực thi phân bổ Held khi dừng vẫn cần policy được operator duyệt và quyết định Admin; mobile không gọi endpoint execute hay tự suy số tiền.

Editor lịch có bộ điền theo tuần ở client: chọn thứ, ngày/giờ bắt đầu và thời lượng, áp dụng đúng số buổi trong plan rồi xem/sửa từng buổi trước khi gửi. Chỉ gửi items hữu hạn cùng expectedPlanVersion qua endpoint hiện có; không tạo recurrence resource, không tự confirm/Hold/Session. Ngày bắt đầu là mốc từ đó tìm các thứ đã chọn, giữ giờ địa phương; validation tương lai/thứ tự/thời lượng vẫn áp dụng cho toàn bộ draft. Áp dụng lại ghi đè draft sau thao tác rõ ràng, không tự chạy khi thay lựa chọn/refetch. Không có lưu nháp bền hoặc Google Meet tự tạo ở màn này. Khi refresh nền, chỉ khóa gửi; không khóa input để làm đóng picker. Lỗi đọc hoặc trạng thái không hợp lệ vẫn khóa thao tác.

## Failure và recovery

- Giữ shared ConnectionGate, session-scoped query keys và runtime.assertCurrent. 403/404 che private cached data; lỗi refresh thông thường giữ nội dung nhưng chặn command dựa snapshot lỗi.
- Conflict/version errors yêu cầu tải lại và xem bản hiện tại. Mapping an toàn trong connections/components.tsx; expiry, thiếu skill, thiếu Credit và lịch trùng không thành lỗi mạng.
- Proposal accept/create/update và finalize giữ immutable intent/Idempotency-Key khi kiểm tra lại. Không sinh key mới chỉ vì mất phản hồi. Finalize unknown có nút exact-intent retry và đọc trạng thái riêng.
- Create path/plan/schedule và revise không có server idempotency. Khi unknown, giữ draft đang mở, khóa gửi mới và đọc đối chiếu. `createPathOnce` còn chặn uncertain create trong bộ nhớ qua navigation; đây không phải durable recovery qua process restart. Không hứa tạo mới an toàn bằng cách retry tùy ý.
- Đợt UX sau review bỏ form gợi ý Chat riêng. Chat là hội thoại trực tiếp; tạo/mở lộ trình từ header. Draft editor vẫn giữ khi save/refresh lỗi; không lưu dữ liệu thật vào PathsPreview.

## Dependency và giới hạn

1. Backend chưa có lookup path theo conversation/paging: nếu mine có đủ 100 và không thấy conversation, mobile chặn create; không suy danh sách đã đầy đủ.
2. Đã tích hợp PATCH sửa schedule chưa khóa. Hủy schedule riêng chưa có API mobile xác minh; reschedule Session sau lock thuộc luồng khác.
3. Dạy thử **tùy chọn dự kiến**, chưa có API booking/session trước plan; làm sau, không có UI/mock trong phase này. Chat đi qua xác nhận cách học rồi tạo/xác nhận plan, không có bước dạy thử.
4. Kiểm tra lịch chồng giờ giữa hai chiều vẫn qua `POST /learning-paths/:id/final-validation` sau khi mỗi lịch đủ hai xác nhận; `finalize` kiểm tra lại. PATCH cho phép teacher sửa lịch sau lỗi kiểm tra, tạo version chưa có xác nhận. Muốn tự động phát hiện và buộc sửa trước confirm cần conflict state trong GET hoặc validation endpoint trước confirm cùng gate phía backend. Mobile không tự giả conflict state; final validation vẫn là authoritative gate trước Hold.
5. Endpoint source có không chứng minh deployment, policies/grants/scanner/LiveKit hoặc native UAT. Bằng chứng hiện hành tại [status](../work/phase-05-proposal-learning-agreement/status.md).

## UI đã hợp nhất sau review

- Gửi proposal thành công về `/proposals?tab=sent&status=PENDING`; danh sách có Nhận được/Đã gửi/Tất cả và bộ lọc trạng thái riêng. Accept một action vẫn revalidate source/version trên server. Reject/withdraw xác nhận inline; route close cũ chuyển về detail.
- Header Chat dùng **Thỏa thuận**, mở bước hiện hành của conversation: **Cách học → Lộ trình → Lịch học → Hoàn tất**. Chỉ render nội dung bước được chọn, cho xem lại bước đã hoàn tất. Tạo path về Cách học, không đi thẳng editor. Gửi và đồng ý cách học / Gửi và đồng ý thay đổi gọi create/revise rồi confirm chính caller ở version vừa lưu trong cùng thao tác; đối tác xác nhận riêng. Mở form hoặc đọc lại không tự confirm. Thẻ tin nhắn vẫn mở riêng detail; người học xác nhận đúng version và giữ detail, nút Tiếp tục thỏa thuận mở bước hiện hành.
- Cách học gồm hình thức, vai trò và Credit; dùng POST path/confirm trước khi có plan (backend cho phép), không đòi path.status CONFIRMED để mở bước Lộ trình. Policy mobile yêu cầu đủ hai timestamps đúng currentVersion trước create/edit/confirm plan, kể cả deep link. TWO_WAY mỗi người tự tạo chiều mình dạy; ONE_WAY chỉ teacher. Plan cũ vẫn đọc được trước khi xác nhận cách học.
- Add/sửa plan giữ agreement version và xác nhận cách học. Sửa terms thực sự tăng agreement version và cần hai bên xác nhận lại terms; mobile theo snapshot mới, chỉ mở lịch khi đủ cả plans/terms và status CONFIRMED. Không tự sao chép confirmation ở client.
- Thẻ Chat mang `fromConversation` được kiểm UUID và đối chiếu conversation của authorized path. Detail/overview Back ưu tiên history; detail chia sẻ có fallback về Chat ngay khi loading/error, link cũ thiếu nguồn fallback `/messages`. Không tự đưa người đọc sang danh sách cá nhân. Bỏ nút Về cuộc trò chuyện trong các màn API của flow; dùng Back trên header theo nguồn mở.
- Chat GET mine trước khi rời màn: đúng một path của conversation thì push thẳng overview kèm `fromConversation`; không có/nhiều kết quả mới mở entry tạo/chọn. Entry legacy đúng một kết quả chỉ redirect, không render card trong lúc chờ chuyển; lỗi/refresh chưa xong không redirect. Lookup chặn bấm lặp, hủy khi blur và không navigate sau session cũ. Giữ giới hạn 100 và chặn tạo khi chưa biết danh sách đầy đủ; không thêm API lookup giả.
- Save plan/schedule và Tiếp tục thỏa thuận dùng `dismissTo` để quay về màn đã có; nếu không có đích trong stack thì thay màn hiện tại. Editor, proposal và attachment Back ưu tiên history, fallback theo nguồn phù hợp. Legacy terms/Hold/close aliases cũng dismiss về đích thay vì tạo bản trùng. Không sửa global navigator hoặc xóa màn My Learning hợp lệ từ hồ sơ; chỉ loại màn trung gian/thao tác lặp trong flow này.
- Plan gửi qua `messageText` hiện hữu với liên kết `skillhub://paths/{pathId}/plans/{planId}?version=N`. App nhận dạng định dạng đầy đủ thành thẻ đọc chi tiết; link không tạo confirmation, không giả SYSTEM message. Mở thẻ vẫn GET path/kiểm membership và planId; đọc bản hiện hành và cảnh báo khi khác version chia sẻ. Không có API lịch sử plan version để giả xem bản cũ.
- Inbox lấy preview từ history của các row được mount; query key nằm dưới `conversations` để SSE/reconnect invalidation cùng cập nhật. Không N+1 ngoài các row được render; đây là giới hạn hiện tại khi list metadata chưa có lastMessage/unreadCount. Sắp lại các conversation đã tải theo activity trong preview/thread cache cùng phiên; không khẳng định thứ tự của các trang chưa tải hoặc giả tổng chưa đọc/online presence.
- Inbox API dùng card ba dòng: tên và thời gian; preview rút gọn nổi bật; chủ đề bài học nhỏ/xám ở cuối, không icon sách hoặc mã kỹ thuật trên card. Avatar tròn 40px. Mã vẫn có trong header/accessibility để đối chiếu khi cần. Dùng banner Đề xuất của bạn mở danh sách có cả Nhận được/Đã gửi. Không giả tổng số cuộc trò chuyện hoặc metadata tìm kiếm chưa có; không còn màn Inbox fixture.
- Chưa đọc: server history tính incoming readAt theo watermark của viewer, outgoing readAt theo đối tác. Mobile đánh dấu có tin chưa đọc khi trang đang tải chứa incoming readAt null, không lấy outgoing chưa được đối tác đọc làm dấu mới. Card dùng tên/preview đậm, thời gian/chấm màu bên phải và nền nhẹ; không có số đếm hoặc chấm presence trên avatar. Query loading/error không hiện dấu từ snapshot lỗi; không clear optimistic chỉ vì bấm card. SSE message-created/reconnect vẫn đọc lại history; read-updated hydrate thêm conversations/preview của đúng conversation để đồng bộ trạng thái đã đọc. Không tăng watermark hoặc phát mutation mới từ inbox.
- Đây là phát hiện bằng chứng chưa đọc trong trang history hiện có, không là unread summary toàn conversation: nếu trang mới nhất chỉ có outgoing, incoming chưa đọc ở trang cũ hơn có thể chưa được đánh dấu. Chưa có tổng unread/batch summary từ backend; không đi quét mọi trang để giả total. Server GET và read receipts hiện hành vẫn là nguồn quyết định; API/native acceptance riêng.
- Ngữ cảnh gắn proposal của conversation: GET `/proposals/:id` kiểm id, parties, requestId, source và conversationId khi có. LEARNING_REQUEST ưu tiên title từ GET `/learning-requests/:id`; DIRECT_SEARCH dùng name từ GET `/skills/:id` và nhãn Lời mời trực tiếp. Request 403/404 fallback skill/nhãn nguồn, không dùng title cũ; proposal denial, lỗi network/protocol không được coi là đọc context thành công. Mã phụ là 8 ký tự cuối proposal UUID, chỉ hỗ trợ nhận diện, không thay UUID dùng cho navigation/quyền. Header Chat có cùng ngữ cảnh ở dòng dưới hàng tên/avatar; full width để đọc được ở 320px.
- Context query nằm dưới session-scoped `conversations/context`, dùng runtime ReadAccess/signal/focus refresh hiện hành và được share giữa inbox/Chat. Không tải toàn bộ LearningPaths để suy tên, không gộp chat theo user hoặc giả một conversation chỉ có một plan. Backend list chưa có context summary/batch nên mỗi row mount thêm GET proposal và request/skill; là giới hạn hiệu năng cần theo dõi khi nghiệm thu, không thêm endpoint hoặc sửa backend trong lượt này.
- Terms sửa/confirm chỉ hiện ở bước Cách học. Đã gửi và tự xác nhận thì chỉ chờ đối tác, không có nút Kiểm tra cập nhật ở trạng thái thường. Unknown giữ intent, chặn gửi mới, chỉ lúc lỗi mới hiện đọc trạng thái/exact retry. Nếu save đã biết thành công, retry chỉ confirm id/version đã lưu, không lặp create/revise. Save unknown vẫn cần reconciliation theo giới hạn backend. Lịch dùng date/time picker đã có của Learning Request (public export), finalize embedded ngay màn lịch. Legacy terms/hold routes giữ tương thích bằng redirect.
- `FlowPage/FlowSection` bám app theme, shell và typography; FeaturePage chỉ thêm section prop có default cũ, không đổi giao diện consumer khác. ChatHeader/Composer dùng API conversation; không thêm trạng thái đã đọc/online giả.

## Gửi lại form đã xác nhận vào Chat

- Sau POST confirm thành công, cách học (kể cả create/revise+self-confirm), learner confirm plan và đồng ý từng schedule đều gửi form qua POST `/conversations/:id/messages`. Schedule dùng `bothConfirmed` từ receipt để phân biệt chờ người còn lại với đủ xác nhận của riêng chiều đó; không suy toàn Path đã đủ điều kiện hoặc đã chốt. Receipt `LOCKED` từ màn cũ không gửi thêm thẻ chưa chốt. Sau finalize thành công, mobile gửi một tin tổng hợp tổng số Session và khoảng ngày từ receipt, có nút Xem lịch học. Mobile không tạo notification/push riêng. Tin là TEXT của người thực hiện, không giả SYSTEM hay thay chứng cứ xác nhận phía backend.
- `confirmed-form.ts` mã hóa loại form, path/plan/schedule UUID và version trong liên kết `skillhub://confirmed/...`, kèm tiêu đề/tóm tắt hữu hạn. Parser kiểm loại/resource/version; malformed trở về text. Card mở GET authorized hiện tại và cảnh báo khi version thay đổi; không unlock nghiệp vụ từ nội dung tin.
- Tin chốt lịch dùng `skillhub://scheduled/{pathId}?version=N&sessions=N&startAt=...&endAt=...`; parser kiểm UUID, version, tổng buổi và thứ tự timestamp. Card dùng chung ChatWorkflowCard với cách học/lộ trình: nhãn Lịch học, badge Đã chốt, tổng buổi, khoảng ngày và Xem lịch học; không liệt kê từng buổi hoặc bản xác nhận. Căn phía người gửi, avatar và grouping dùng message đại diện; không giả SYSTEM. Inbox hiển thị tiêu đề ngắn.
- Thẻ xác nhận schedule mới giữ từng tin/chiều/người xác nhận và version trong history, không gộp với chiều khác hoặc receipt chốt. Link giữ dạng confirmed/schedule tương thích client cũ, thêm metadata `scheduleConfirmation=1`, `confirmedBy`, `teacherId`, `learnerId`, `bothConfirmed`; parser kiểm IDs, vai trò, version và sender khớp người xác nhận. Không kèm số buổi vì thẻ này không dùng để tổng hợp Session. Card phân biệt Lịch bạn dạy/Lịch bạn học, ai đã đồng ý/đang chờ ai, Đủ xác nhận nhưng Chưa chốt lịch. Link mở GET authorized với plan/schedule/version để cảnh báo bản lịch đã đổi. Nội dung chat chỉ là receipt lịch sử, không cấp quyền hay xác nhận trạng thái hiện tại.
- History tiếp tục gộp các tin chốt lịch và card xác nhận legacy theo conversation/path. Giữ message có sequence mới nhất làm đại diện để read watermark tiếp tục tiến; ưu tiên receipt chốt lịch, không bị legacy đến muộn hạ trạng thái. Chỉ có legacy thì báo Đã xác nhận lịch học, không suy ra đã chốt/tổng buổi từ history chưa đầy đủ. Tin thường, thẻ xác nhận mới và tệp không bị gộp, dữ liệu server không bị xóa. Mỗi thao tác finalize gửi một tin; duy nhất toàn server giữa nhiều người gửi vẫn cần BE.
- Sau thẻ đã được API chat xác nhận DELIVERED, mobile invalidate thread và các query conversations của đúng session (list, nhóm, preview). Thứ tự/preview dựa trên tin nhận được và activity BE; chưa đọc lấy từ incoming readAt thật, không tự đánh dấu cho đối tác. useLearningPath đã refresh khi focus/foreground và polling chỉ-đọc trong lúc thương lượng; mở lại màn tiếp tục đọc trạng thái server, không replay xác nhận.
- `clientMessageId` là UUID của exact confirmation intent. Gửi Chat thất bại được giữ riêng trong query cache theo session; retry chỉ gửi lại đúng body/ID. HTTP 202 có GET delivery thủ công; focus/reconnect không tự POST. Queue giữ qua navigation, bị purge theo runtime khi logout/session đổi, không bền qua app restart.
- Backend chưa đảm bảo confirm/finalize và gửi tin trong một transaction/outbox. App bị tắt sau nghiệp vụ trước POST có thể thiếu thẻ; cần backend event/outbox để bảo đảm tuyệt đối. Không dùng fixture để che lỗi API, không sửa backend.
- Chat mở bằng GET history không cursor (trang mới nhất), inverted list hiển thị cuối hội thoại; tải cũ dùng cursor khi lướt lên. Background refresh lấp gap bằng afterSequence, merge theo ID/sequence và giữ cursor của lịch sử đang tải. Đang đọc cũ có nút Tin nhắn mới, không chủ động kéo xuống; native anchor/keyboard cần nghiệm thu thiết bị.
- Avatar inbox/header/incoming/seen đọc `avatarUrl` từ GET `/profiles/:id`, kiểm userId khớp; dùng Avatar tròn và fallback hiện có. Không suy online từ profile hoặc SSE. Public entry `messages/state` chỉ exports hook/recovery component, không kéo screen vào learning-paths.

- Receipt Chat chỉ hiển thị một avatar ở outgoing non-SYSTEM có sequence lớn nhất với readAt trong thread đã tải; readAt của incoming là trạng thái đọc của chính viewer nên không dùng làm receipt đối tác. Queue confirmed-form-deliveries dùng queryFn: skipToken vì chỉ subscribe query cache, không có GET endpoint và không expose refetch. Invalidation/focus không được gửi lại form.

## Editor LearningPlan

- Sau mất kết quả xác nhận lịch, timestamp xác nhận của chính người dùng trong snapshot hiện tại đủ để UI ghi nhận đã đồng ý; không suy xác nhận của mình từ đối tác. Thông báo được giữ qua refresh nền, thao tác vẫn chặn khi đang tải/read lỗi. Đọc lại không tự gửi Chat: action gửi cập nhật dùng recovery/identity cũ để lấy receipt và hoàn tất thẻ. Lịch đã khóa không tiếp tục recovery thẻ xác nhận chờ chốt; actor/Path/plan/schedule/version/trạng thái mới dùng scope command mới.
- Khi finalize vẫn uncertain, lỗi409 trả về trong replay không tự quyết định kết quả lần chốt gốc. UI ưu tiên cảnh báo/đường kiểm tra cùng lần chốt; không đồng thời gắn lỗi thời gian hoặc mở CTA nạp Credit. Kết quả chắc chắn mới hiển thị lỗi chi tiết hoặc trạng thái đã khóa; giữ guard không tạo lần chốt mới và identity cũ.
- Feedback gửi/sửa/xác nhận phân biệt lỗi đã bị từ chối với kết quả chưa rõ: lỗi có banner rõ; uncertain dùng warning và kiểm tra trạng thái/đúng intent trước, không hiển thị lời khuyên gửi mới. Form kế hoạch/lịch giữ feedback cạnh nút gửi trong footer và giữ draft. Khi đồng ý lịch chưa rõ kết quả, nút xác nhận mới và handler đều bị khóa; tải trạng thái không tự xác nhận lại. Nếu chỉ gửi thẻ Chat lỗi, thông báo nêu rõ nghiệp vụ nào đã lưu và action chỉ kiểm tra/gửi lại thẻ.
- Kết quả đủ điều kiện gắn với dữ liệu Path, trạng thái, điều khoản, kế hoạch và lịch đã kiểm tra. Refetch chỉ đổi overview.evaluatedAt hoặc attention không làm mất kết quả. Thay nội dung/version thật cần kiểm tra lại; đang refresh/read lỗi vẫn chặn chốt. BE tiếp tục xác nhận điều kiện trong transaction finalize.
- Kiểm tra/chốt lịch trả `INVALID_SCHEDULE_ITEMS` với [chi tiết BE](backend-schedule-validation-gap.md): invalidItems định danh plan/schedule/version/teacher/learner/buổi và bốn reason, kèm evaluatedAt/giới hạn thời lượng. Mobile validate details, ưu tiên reason/giờ DB/policy server, đối chiếu đúng Path và snapshot đã gửi; mỗi buổi sai hiển thị lý do ngắn, kỹ năng/người dạy và khoảng giờ. Không tính lại bằng giờ thiết bị để thay kết luận BE. UI không lặp thời điểm máy chủ hay múi giờ trong từng lỗi. Khác owner/version/item hoặc Path đã đổi thì yêu cầu tải lại, không hiện link sửa từ lỗi cũ. API cũ/thiếu hoặc sai details giữ đối chiếu sơ bộ và hướng dẫn tải lại để có chi tiết mới nhất; không có bằng chứng thì không đoán lịch của ai sai. Nghiệm thu API triển khai/native còn mở.
- Chọn giờ Android dùng hai cột cuộn giờ/phút trong DateTimeSelector chung ngay từ lúc tạo lịch; iOS giữ wheel native, web giữ hai select. Các consumer lịch tuần/từng buổi, gợi ý lịch Learning Request và đổi lịch Session cùng nhận phần Android; không đổi payload hoặc giới hạn thời lượng. Expo UI Android đang cài không có wheel: spinner datetime-picker chuyển sang input, Picker appearance wheel chuyển sang dropdown; dùng ScrollView snap của React Native, không thêm dependency.

- Save plan/lịch kiểm lại trạng thái cho phép lưu mới nhất sau async form validation, ngoài revision snapshot. Nếu refresh báo lỗi hoặc command đang pending/unknown trong lúc validate, không gửi API và không reset draft. Schedule kiểm trùng lại trên timestamp cuối cùng sau khi khôi phục phần giây của lịch cũ; lỗi mở đúng buổi cần sửa và hiện tại field, không để Promise rejection hoặc gửi payload trùng lên server.

- UI nhập từng buổi bằng field array; POST/PATCH vẫn gửi `skillId`, `learningGoal`, `totalSessions`, `sessionOutline: [{content}]`, PATCH kèm expectedVersion. Đếm buổi theo số item, không theo newline. Newline trong cùng nội dung được giữ nguyên. Giới hạn hiện hành: mục tiêu 1–1.500 ký tự, 1–100 buổi, 1–2.000 ký tự/buổi.
- Chọn kỹ năng theo UUID. Mặc định chỉ hiện lựa chọn hiện tại; Xem thêm mở catalog từ API, có load-more theo cursor. Khi kỹ năng đã lưu chưa nằm trong trang catalog đã tải, dùng public GET skill hiện có để đọc tên, không giả tên hoặc tự thay ID.
- Chỉ teacher tạo/sửa plan của mình sau khi đủ xác nhận cách học; lưu về detail đúng plan/version. Không tự confirm hoặc tự share khi lưu. Unknown result giữ form và chặn gửi mới, mở đọc đối chiếu theo recovery hiện hữu.
- Save footer cố định của editor; vùng nhập dùng KeyboardFormScrollView. FeaturePage thêm `scrollable` default true và Input thêm `hideLabel` default false; consumer khác giữ hành vi cũ, label accessibility vẫn tồn tại khi ẩn label nhìn thấy.
- Không thêm reward, dự kiến thời lượng, kho template, hoặc lưu nháp bền vì contract hiện hành không có những dữ liệu/action này. Không dùng fixture thay API để điền các mục trên ảnh tham chiếu.

### Tiêu đề và mô tả buổi học

- Hai ô editor là cách trình bày của cùng `sessionOutline[].content`: dòng đầu là tiêu đề bắt buộc; các dòng sau là mô tả tùy chọn. Không thêm field JSON, marker hoặc checklist/rich text; tổng nội dung tối đa 2.000 ký tự, số buổi vẫn theo array.
- Nội dung cũ một dòng hiển thị thành tiêu đề, không tự sinh mô tả; nội dung nhiều dòng hiển thị dòng đầu/những dòng còn lại, giữ xuống dòng trong mô tả. Reader dùng cùng adapter. Tiêu đề trống không được thay bằng mô tả khi submit. Chỉ nhập tiêu đề vẫn lưu được.
- Không thay đổi DTO/API backend: `SessionOutlineDto` chỉ có content, ScheduleItemDto chỉ có sessionNo/startAt/endAt. Đây không phải ghi chú xếp lịch. Nếu cần title/description là field độc lập, tài liệu đính kèm hay checklist có trạng thái, cần backend contract/migration riêng.

## Sửa đổi trước khi chốt

Đối chiếu BE `187beab` và [amendment rules](../../../../services/api/specs/008-connections/agreement-amendments.md). Các quy tắc này thay thế kết quả audit reset rộng cũ; lịch sử giữ trong work history/Git. Chỉ áp dụng trước finalize.

- PATCH agreement/plan/schedule trả `unchanged: true` và version cũ khi nội dung y nguyên. Mobile chỉ nhận cùng resource và đúng version theo flag; có thay đổi phải tăng đúng một. Lưu terms y nguyên khi caller đã xác nhận không gọi confirm hoặc gửi lại form Chat; nếu caller chưa xác nhận vẫn confirm version hiện tại.
- Sửa nội dung plan tăng plan version, giữ agreement version/xác nhận cách học và plan đối ứng. Learner chỉ xác nhận lại plan sửa. Không quay lại bước Cách học nếu terms không đổi; trạng thái và xác nhận luôn lấy từ GET server.
- Giữ số buổi: BE chuyển giờ và xác nhận lịch sang version lịch mới. Đổi số buổi: BE giữ giờ của các sessionNo còn lại, trả `NEEDS_REVISION` và xóa hai xác nhận lịch. Detail mobile chỉ cho thiếu items ở trạng thái này; vẽ đủ số buổi và đánh dấu buổi chưa có ngày giờ. Không confirm/finalize lịch thiếu.
- Teacher sửa lịch qua PATCH, điền sẵn giờ hiện có, gửi đủ items với expectedVersion. Lưu không tự confirm; lịch thay đổi cần hai bên xác nhận cùng version. NEEDS_REVISION đủ items được confirm theo contract, thiếu items cần teacher bổ sung. Picker không làm mất giây của lịch cũ nếu người dùng không đổi giờ; bộ áp dụng theo tuần chỉ ghi đè khi bấm Áp dụng.
- Sửa terms thực sự tăng agreement version và cần hai bên xác nhận lại terms. BE chuyển các plan/lịch còn tương thích sang projection mới, giữ xác nhận của phần không đổi. Mobile không tự phục hồi nội dung hoặc confirmation từ cache cũ.
- Sau lock không dùng editor sửa plan/terms/lịch trước chốt; reschedule/cancel Session theo API riêng. SRS1.6 BR-19/FR-PATH-04 vẫn là nguồn yêu cầu; chi tiết invalidation trước chốt đối chiếu amendment contract hiện hành, không giả test client là bằng chứng triển khai BE.

## Điều kiện gửi Proposal trước khi nhập — 2026-10-21T19:47:31+07:00

- Request: đọc public detail, kiểm OPEN/chưa hết hạn/không phải chính mình. `ProposalsService.create` luôn assertTeacherEligible với skill UUID của bài, cho cả hint ONE_WAY/TWO_WAY. Repository eligible yêu cầu own SharingSkill chưa archive, Skill ACTIVE, account ACTIVE và VERIFIED khi verifiedTeacherOnly=true; không yêu cầu own SharingSkill isVisible=true. Mobile dùng public entry `skills.useTeacherEligibility`, đọc GET /me/skills qua private Skills runtime/ReadAccess, đi hết cursor nếu chưa tìm đủ điều kiện, không lấy tên trùng làm UUID hoặc kết luận thiếu từ trang đầu.
- Direct: đọc public target SharingSkill ACTIVE của người khác; chỉ kiểm pending trùng theo recipient+skill. Không yêu cầu người gửi đã có kỹ năng đối ứng ngay lúc tạo vì backend không assertTeacherEligible ở nhánh DIRECT_SEARCH. Các vai trò/kỹ năng cụ thể tiếp tục thống nhất trong Chat/Agreement; không thêm gate sản phẩm ngoài contract.
- Pending preflight đọc GET /proposals?direction=sent&status=PENDING qua Connections runtime và đủ cursor tới khi có match/hết trang; Request theo requestId, direct theo recipientId+skillId/source. Khớp unique indexes backend. Row PENDING dù expiresAt đã qua vẫn được coi đang chờ theo status trả về, tránh giả đã giải phóng unique index trước expiry worker. Lỗi/partial pagination/repeated cursor không biến thành đủ điều kiện; không hiện form nhập được khi thiếu bằng chứng đọc.
- Recheck source/pending/teacher skill trước POST, chặn nếu source/policy đã đổi để UI đọc trạng thái mới; giữ command idempotency/unknown recovery và dữ liệu form khi read network error. Early state là hỗ trợ UX; quyền/quota/cooldown/state/race vẫn do POST trong transaction quyết định. Chưa có endpoint readiness hay public quota/cooldown configuration để kiểm tra đầy đủ trước gửi. Cần backend cung cấp kết quả readiness/reason/retry time nếu muốn bảo đảm UX sớm cho giới hạn gửi, account restrictions, cooldown và policy hints động; không hardcode giới hạn hoặc dùng POST tạo thử.
- Màn send dùng fixed footer/keyboard scroll bằng React Native, theme/Nunito hiện có. Không chép status bar, online/verified/rating/số buổi đối tác, Google Meet, bảo lãnh hoặc lưu nháp giả từ HTML. Giữ message10–1000 code points, Credit/session/duration/candidateSlots payload và edit consumer; giới hạn500 trong mẫu không phải contract. Mẫu lời nhắn được chọn chủ động và có thể sửa, không tự khai kinh nghiệm của user.

## Trạng thái Proposal cá nhân trên Request — 2026-10-21T20:52:03+07:00

- GET /proposals?direction=sent đọc đủ cursor qua runtime owner/session, chỉ lấy LEARNING_REQUEST theo learningRequestId. Feed dùng một shared query; trạng thái cá nhân không thay status của Request. PENDING/ACCEPTED mở proposal UUID hiện có; REJECTED/WITHDRAWN/EXPIRED hiển thị lịch sử và cho gửi lại khi bài OPEN/chưa hết hạn. Không đánh dấu đã gửi từ local optimistic flag hoặc suy chưa gửi từ trang đầu.
- Read loading/error/partial pagination khóa gửi mới ở detail; permission denial dùng ReadAccess purge hiện hành. Focus/app active/pull và existing mutation/SSE invalidation refresh index. Send screen tiếp tục preflight; POST backend vẫn authoritative khi race/policy thay đổi. Không thêm endpoint/backend hoặc fixture fallback. Lịch sử được ưu tiên active rồi mới terminal mới nhất khi nhiều proposal cùng bài.
