# Kế hoạch quyền Staff, báo cáo, lộ trình, đánh giá và quản trị giao dịch

Ngày lập plan: 2026-11-06. Trạng thái: đã bắt đầu triển khai backend theo yêu cầu ngày 2026-11-08.
Cập nhật phạm vi: 2026-11-08 — nới lỏng uy tín do thành viên khác phụ trách.
Cập nhật bổ sung: 2026-11-08 — Admin quản lý giao dịch Credit và Payment.
Yêu cầu chỉ kiểm tra/lập plan trước đây được thay bằng yêu cầu tạo branch/worktree
và bắt đầu implementation ngày 2026-11-08. Code nằm trong các worktree riêng;
chưa commit, push, áp migration hoặc deploy. Trạng thái từng phần ở implementation.md.

## 1. Phạm vi và các quyết định đã chốt

- Staff được học, dạy và trao đổi với USER hoặc STAFF khác như người dùng bình
  thường trên cùng tài khoản; quyền vận hành là phần bổ sung do Admin cấp/thu hồi.
- Bổ sung cơ chế quản trị quyền và bảng gán/điều chỉnh quyền riêng cho Staff,
  tái sử dụng danh mục quyền hiện hữu; không tạo lại bảng Permission đã có.
- Kỹ năng/bằng chứng xác minh do Staff bổ sung chỉ Admin được duyệt. Staff không
  được tự duyệt hoặc duyệt kỹ năng của Staff khác, kể cả có quyền duyệt thông thường.
- Staff xác nhận nhóm báo cáo cùng một sự cố để xử lý đồng loạt, phân theo
  LOW/MEDIUM/HIGH/CRITICAL.
- Staff được trao đổi với các bên ngay trong case được giao.
- BE tổng hợp dữ liệu để card danh sách và trang chi tiết Learning Path hiển thị
  thống nhất: giai đoạn học, tiến độ, buổi tiếp theo, vấn đề, quyết toán và hành động
  theo người đang đăng nhập. Giữ status nghiệp vụ hiện tại.
- Bổ sung tổng hợp đánh giá nhận được trên hồ sơ người dùng để người khác xem;
  cần API đọc riêng ngoài review hiện chỉ dành cho participant của từng Path.
- Bổ sung Admin quản lý giao dịch toàn hệ thống: tra cứu ledger/operation, ví,
  đơn nạp Payment, đối soát và xử lý các trường hợp cần xem xét theo quyền.
- Người dùng đã yêu cầu triển khai trong các branch/worktree riêng.
- Đã chốt bổ sung: công khai cả review cũ và mới cho thành viên đã đăng nhập;
  case trao đổi riêng từng bên với Staff được giao; giao dịch đợt đầu chỉ tra cứu/
  đối soát, thao tác đổi Credit để sau khi chốt quy tắc.

Phần nới lỏng uy tín được loại khỏi phạm vi thực hiện của plan này theo yêu cầu
ngày 2026-11-08 vì đã có thành viên khác phụ trách. Không triển khai trùng policy,
chuyển tiếp restriction hoặc thay đổi giao diện hạn chế thuộc phần việc đó.

Phần hỗ trợ người mới tạm bỏ khỏi phạm vi và thứ tự thực hiện theo yêu cầu mới.
Không lên lịch thay đổi điểm uy tín, badge, ưu tiên gợi ý hoặc xác minh người mới.
Các nhóm thiếu hụt khác trong đợt audit trước vẫn là backlog riêng, không tự động
trở thành đầu việc triển khai của plan này.

## 2. Kết quả kiểm tra source hiện tại

### Quyền tài khoản và Staff

- Schema đã có `Role`, `Permission`, `RolePermission`; mỗi User hiện có một
  `roleId`. Chưa có bảng cấp/ghi đè quyền theo từng người trong schema hiện tại.
- `grants()` đọc quyền theo role hiện tại, không tự kế thừa quyền USER cho STAFF.
  Seed STAFF có quyền kiểm duyệt và một số quyền hồ sơ/kỹ năng, nhưng thiếu các
  quyền tạo Proposal, chat participant và đọc/tham gia Session mà USER đang có.
- `LearningRequestAccessService.assertUserAction()` còn bắt buộc role USER;
  chỉ bổ sung grant cho STAFF sẽ chưa mở được đầy đủ luồng Learning Request.
- Admin đã có API tạo/gán/gỡ STAFF, chưa có API quản trị tập quyền riêng từng Staff
  trong controller quản trị User đã kiểm tra.
- Auth có đọc quyền hiện hành trong `principal()` và `assertLive()`; cần mở rộng
  cùng nguồn quyền này, tránh một endpoint vẫn dùng bộ quyền cũ.
- SRS V1.6 phân biệt quyền Staff và Admin. Yêu cầu mới bổ sung quyền tham gia như
  USER cho STAFF, không đồng nghĩa STAFF kế thừa quyền ADMIN.

Nguồn kiểm tra, đường dẫn tính từ `services/api`:

- `prisma/schema.prisma:362` (Role, Permission, RolePermission).
- `src/modules/users/infrastructure/persistence/prisma-users-repository.ts:119`
  (grants), `:213` (seedRoles).
- `src/modules/learning-requests/application/services/learning-request-access.service.ts:35`.
- `src/modules/users/presentation/http/administration.controller.ts`.
- `src/modules/auth/application/services/sessions.service.ts:79` và `:127`.

### Report và quyền Staff

- Report có claim, NEED_MORE_INFO, resolve/reject; chưa có nhóm sự cố và severity.
- Hàng chờ Staff đang giới hạn 100 case, chưa phân trang.
- Chưa có API trao đổi trong case hoặc người dùng phản hồi NEED_MORE_INFO.
- Chat hiện tại kiểm tra participant, chưa có quyền Staff trao đổi theo case.
- Report đã có adjustment/reversal và áp dụng vi phạm theo quyền. Xử lý nhóm
  phải giữ các kiểm tra này và tránh nhân tác dụng theo số người báo cáo.

Nguồn kiểm tra:

- `src/modules/reports/application/services/reports.service.ts`
- `src/modules/reports/presentation/http/reports.controller.ts`
- `src/shared/authorization/permission.catalog.ts`
- `src/modules/conversations/application/services/conversation-access.service.ts`
- `prisma/schema.prisma`

### Dữ liệu danh sách, chi tiết và quyết toán lộ trình

- `LearningPathsService.listMinePage()` đã phân trang và trả title, counterpartId,
  exchangeType, status và version; chưa có các trường tổng hợp phục vụ card.
  Counterpart hiện là ID, không phải một object hồ sơ đối tác đầy đủ.
- `detail()` giới hạn theo hai participant, trả agreement/plans/schedules/sessions,
  nhưng chưa có overview và danh sách attentionItems tổng hợp.
- `reports/mine` và mineDetail lọc `reporterId = actor.userId`. Case từ đối tác
  và case hệ thống với reporterId null không nằm trong quyền đọc này.
- `openSystemSessionCase()` có thể tạo case ATTENDANCE_UNVERIFIABLE,
  MAKEUP_EXPIRED, MAKEUP_LIMIT_REACHED và đưa Path sang DISPUTED.
- Khi mọi Session đã COMPLETED, `refreshPathStatus()` vẫn giữ Path DISPUTED nếu
  còn tranh chấp; không thể dùng riêng Path.status để biết đã học xong hay chưa.
- `settlement-status` đã có status, reasonCode, nextAction, autoSettlementAt và
  xác nhận quyết toán hai bên; chưa trả tham chiếu cụ thể tới case/change request.
  Code hiện kiểm tra settledAt trước CANCELLED, nên không lấy nhãn settlement này
  làm giai đoạn học. Luồng dừng có thể xử lý Credit và đặt Path CANCELLED.
- Một số command hiện chặn theo Path DISPUTED, ví dụ xác nhận hoàn thành Session.
  Projection đọc phải phản ánh đúng các chốt chặn hiện hành theo từng thao tác;
  không nhân việc có report thành khóa mọi hoạt động, cũng không hứa cho phép
  hành động mà command vẫn từ chối.
- Session detail đã có attendance/deadlines/allowedActions/progress, nhưng có thể
  gọi ensureDetermined và ghi outcome khi đọc. Không gọi API detail này lặp theo
  từng card để tổng hợp danh sách; cần contract đọc theo lô không gây ghi dữ liệu.

Nguồn đối chiếu tại workspace hiện tại; không dùng đường dẫn D:/FPTU trong đoạn
tham khảo làm bằng chứng cho checkout này:

- `src/modules/learning-paths/application/services/learning-paths.service.ts:316`
  và `:414`.
- `src/modules/reports/application/services/reports.service.ts:83`, `:340`, `:355`.
- `src/modules/learning-paths/application/services/path-settlement-status.service.ts:19`.
- `src/modules/learning-paths/application/services/path-termination.service.ts:408`.
- `src/modules/learning-sessions/application/services/session-transitions.ts:95`.
- `src/modules/learning-sessions/application/services/learning-sessions.service.ts:394`
  và `:621`.

## 3. Staff tham gia như USER và được Admin cấp quyền bổ sung

### 3.1. Quyền tham gia và quyền vận hành độc lập

- Giữ một tài khoản, một role STAFF; không yêu cầu Staff tạo thêm USER hoặc đổi
  role qua lại để học. Kế thừa tập quyền tham gia thông thường bằng cơ chế resolve
  quyền, không tự chuyển schema sang đa role.
- Bao phủ hồ sơ/kỹ năng, Learning Request, Proposal, chat/file, Learning Path,
  plan/lịch, Session/LiveKit, ví, review và report của chính mình theo điều kiện
  hiện hữu. STAFF↔USER và STAFF↔STAFF cùng áp dụng quyền owner/participant.
- Điều chỉnh các gate chỉ chấp nhận USER ở luồng tham gia; vẫn giữ các gate Admin
  ở thao tác quản trị nhạy cảm. Cùng role STAFF không tạo quyền đọc tài nguyên của nhau.
- Hạn chế tài khoản, reputation, điều kiện kỹ năng, lịch trùng, Hold/Credit và
  quota vẫn áp dụng như người dùng bình thường; quyền Staff không bỏ qua chúng.
- Với kỹ năng của STAFF, đã chốt chuyển Admin duyệt; không chuyển sang Staff khác.
  Đề xuất chặn tự xử lý các case/nội dung khác do mình tham gia hay sở hữu;
  phạm vi xung đột lợi ích ngoài quan hệ trực tiếp cần chốt thêm.

### 3.2. Bảng quyền và cách Admin điều chỉnh

Thiết kế đề xuất để cụ thể hóa yêu cầu thêm bảng quyền:

| Thành phần                                | Vai trò                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `Permission` hiện có                      | Danh mục hành động backend đã hỗ trợ.                                        |
| `RolePermission` hiện có                  | Bộ quyền mặc định theo role.                                                 |
| `UserPermissionOverride` mới, tên dự kiến | Admin GRANT/DENY quyền vận hành cho từng STAFF; liên kết User và Permission. |
| Audit hiện có                             | Lưu người thay đổi, lý do, trước/sau và thời điểm.                           |

- Bảng mới dự kiến có userId, permissionId, effect, updatedBy, updatedAt, version;
  duy nhất theo userId + permissionId. Danh mục quyền không bị nhân bản.
- Với STAFF: quyền hiệu lực là quyền tham gia USER cộng quyền vận hành mặc định
  và GRANT riêng, sau đó trừ DENY trong phạm vi quyền vận hành; restriction tài
  khoản/nghiệp vụ vẫn được kiểm tra riêng. DENY thắng GRANT/default.
- Không có override thì dùng default; xóa override nghĩa là khôi phục default,
  không đồng nghĩa thu hồi. API phải phân biệt grant, deny và reset rõ ràng.
- Admin điều chỉnh quyền trong catalog được phép cấp cho Staff. Thêm một mã
  permission vào database không tự tạo chức năng mới nếu backend chưa có handler.
  Quyền phân quyền, thay đổi role Admin và quyền tài chính đặc biệt không tự mở
  cho Staff; danh sách quyền được ủy quyền cần chốt trong ma trận trước triển khai.
- Dự kiến API đọc catalog, đọc quyền hiệu lực/nguồn quyền của từng Staff, cập nhật
  override theo expectedVersion. Mỗi thay đổi cần Admin hiện hành, quyền quản trị
  tương ứng, reauth và audit nguyên tử trong PostgreSQL.
- Tập trung resolve quyền tại owner users/auth; mọi guard, HTTP, SSE và giao tiếp
  case phải dùng cùng kết quả. Thu hồi áp dụng với thao tác tiếp theo và kết nối
  đang mở; chốt cách invalidation/revalidation cho SSE trong thiết kế kỹ thuật.
- Khi gỡ STAFF, override vận hành mất hiệu lực; đề xuất thu hồi các grant riêng
  và ghi audit để lần gán lại STAFF không hồi sinh quyền cũ ngoài ý muốn. Các
  lịch sử học, ví và chat participant vẫn giữ nguyên quyền sở hữu.
- Seed/redeploy không được ghi đè quyết định Admin hoặc làm sống lại quyền đã deny.
  Có kế hoạch chuyển đổi Staff cũ, quyền default và xử lý case đang giao khi thu hồi.

### 3.3. Ma trận quyền cần công bố

| Hành động                                 | USER           | STAFF          | Điều kiện bổ sung                                                           |
| ----------------------------------------- | -------------- | -------------- | --------------------------------------------------------------------------- |
| Học/dạy/trao đổi của bản thân             | Có             | Có             | Owner/participant và đầy đủ điều kiện nghiệp vụ.                            |
| Xem tóm tắt vấn đề của Path mình tham gia | Có             | Có             | Chỉ projection dành cho participant.                                        |
| Duyệt xác minh kỹ năng của USER           | Không          | Khi được cấp   | Quyền duyệt tương ứng và điều kiện hồ sơ; Admin có quyền cũng có thể duyệt. |
| Duyệt xác minh kỹ năng của STAFF          | Không          | Không          | Chỉ Admin có quyền duyệt tương ứng; không được ủy quyền lại cho STAFF.      |
| Nhận/xử lý case, gom nhóm, đổi severity   | Không          | Khi được cấp   | Quyền tương ứng, assignment và kiểm tra xung đột lợi ích.                   |
| Trao đổi với các bên theo vai trò xử lý   | Không          | Khi được cấp   | Case được giao; quyền khác với chat participant.                            |
| Điều chỉnh quyền Staff                    | Không          | Không          | Admin có quyền quản trị phân quyền.                                         |
| Adjustment/reversal/override tài chính    | Không mặc định | Không mặc định | Giữ các chốt chặn tài chính hiện hữu; không suy từ quyền chat/moderate.     |

Quyền cụ thể cho grouping/severity/case communication sẽ được đặt tên trong
contract; không mặc định mọi Staff đều có tất cả thao tác mới. Quyền participant
không phụ thuộc việc Staff còn được giao case vận hành hay không.

### 3.4. Kỹ năng của Staff chỉ Admin được duyệt — quyết định đã chốt

- Staff vẫn được thêm Sharing Skill và nộp evidence trên tài khoản của mình.
  Kỹ năng mới giữ UNVERIFIED; thêm vào hồ sơ không tự tạo nhãn VERIFIED.
- Quyết định approve/reject hồ sơ xác minh của chủ sở hữu STAFF thuộc Admin có
  permission tương ứng. Staff không được tự duyệt hoặc duyệt cho đồng nghiệp;
  cấp `skill-verification:approve/reject` thông thường không vượt qua ràng buộc này.
- Hồ sơ của USER tiếp tục dùng quyền Staff/Admin hiện hữu; không chuyển toàn bộ
  việc duyệt kỹ năng sang Admin. Quyền quản trị skill catalog là nghiệp vụ riêng.
- Backend phải kiểm tra cả quyền người duyệt và role chủ sở hữu dưới cùng ranh
  giới transaction/lock với quyết định, kể cả đường retry/idempotency. Không chỉ
  ẩn nút trên FE. Queue/action metadata phải chỉ đúng hồ sơ nào cần Admin xử lý.
- Role thay đổi khi hồ sơ còn PENDING cần kiểm tra lại: USER lên STAFF phải vào
  luồng Admin duyệt. Đề xuất hồ sơ nộp khi là STAFF vẫn cần Admin nếu sau đó bị gỡ
  role; cần chốt việc lưu role lúc nộp và quy tắc chuyển tiếp trước triển khai.
- Đây là bổ sung quyền trong plan, không yêu cầu sửa code hiện tại. Source đang
  cấp quyền approve/reject cho cả STAFF/ADMIN nhưng `VerificationsService.decide()`
  chưa đối chiếu người duyệt với chủ sở hữu hoặc yêu cầu Admin khi owner là STAFF.

Nguồn: `src/modules/skills/domain/skill-policy.ts:4`,
`src/modules/sharing-skills/application/services/sharing-skills.service.ts:190`,
`src/modules/verifications/application/services/verifications.service.ts:217`.

## 4. Kế hoạch nhóm report và severity

- Tách report gốc của từng người khỏi nhóm sự cố chung; giữ reporter, reason,
  description, evidence và lịch sử. Staff xác nhận đây là cùng sự cố và ghi lý do.
- Cùng người bị báo cáo hoặc cùng reason không tự động chứng minh cùng sự cố.
  Cho phép xem trước các case trước khi gom. Các report về cùng tài liệu có thể
  thuộc các order khác nhau; vẫn phải giữ quyền và quyết định tài chính theo order.
- Staff phân loại LOW/MEDIUM/HIGH/CRITICAL. Chốt tiêu chí nhận diện, thẩm quyền
  đổi mức và quy tắc chuyển cấp. Severity phục vụ ưu tiên, không tự động kết tội
  hoặc quyết định số điểm/Credit bị trừ.
- Hàng chờ có phân trang, lọc severity/status/handler/nhóm và thứ tự ổn định.
  Case cũ chưa phân loại không bị tự gán mức độ.
- Quyết định nhóm kiểm tra lại quyền, assignment và phiên bản từng case;
  thực hiện nguyên tử, lưu audit và thông báo kết quả theo quyền từng bên.
- Cùng một vi phạm trong cùng sự cố không bị phạt nhiều lần theo số report.
  Hoàn tiền/adjustment cho nhiều giao dịch vẫn cần kiểm tra từng giao dịch;
  không nhân bản một quyết định Credit lên toàn bộ nhóm.
- Giữ chặn settlement nếu còn case độc lập chưa được giải quyết. Thiết kế
  retry, rollback và thao tác đồng thời trước khi triển khai.

Cần chốt thêm: gom/tách sau khi nhóm đã đóng; report mới phát sinh về sự cố cũ;
trường hợp một nhóm có nhiều vi phạm hoặc nhiều giao dịch; giới hạn batch và SLA.

## 5. Kế hoạch Staff trao đổi trong case

- Giao tiếp nghiệp vụ xử lý case được giới hạn theo case được giao, kiểm tra
  role/permission hiệu lực, assignment và quan hệ người dùng với case tại backend.
  Giới hạn này không áp dụng cho chat/học thông thường mà Staff là participant.
- Đề xuất mỗi bên có thread riêng với Staff để tránh lộ nội dung riêng hoặc
  danh tính người báo cáo. Phòng chung và ghi chú nội bộ là các lựa chọn cần chốt.
- Người dùng phản hồi NEED_MORE_INFO và bổ sung evidence theo giới hạn file,
  quyền sở hữu, scan và quyền tải hiện hữu.
- Thu hồi quyền hoặc chuyển người xử lý phải có hiệu lực với lần đọc/gửi tiếp.
- Staff là một bên trong vụ việc chỉ dùng quyền participant của mình; không tự
  nhận case hoặc dùng quyền vận hành để đọc thông tin riêng của đối tác.
- Không mở quyền đọc toàn bộ chat riêng của người dùng. Quyền xem chat liên
  quan đến tranh chấp là hạng mục khác, cần ranh giới và audit riêng nếu yêu cầu.
- Theo kiến trúc hiện hữu: PostgreSQL giữ case, membership/quyền và metadata;
  MongoDB giữ message. Không gọi Mongo/SMTP/FCM trong transaction nghiệp vụ PG.
- Thiết kế receipt/outbox chống gửi trùng, thông báo không chứa nội dung nhạy cảm,
  phân trang lịch sử và phục hồi khi một datastore lỗi.
- Case trong cùng nhóm vẫn giữ ranh giới người nhận riêng. Gom nhóm xử lý không
  tự thêm tất cả reporter vào cùng phòng hay mở bằng chứng giữa các case.

## 6. API đọc tổng hợp cho card và trang chi tiết Learning Path

Phần này bổ sung read model theo viewer, không thay state machine hoặc enum trạng
thái lưu trữ để phục vụ UI. Các tên field/mã dưới đây là contract dự kiến, chưa
phải API đã có. Tất cả route dưới đây thuộc prefix `/api/v1`.

### 6.1. Bổ sung dữ liệu danh sách lộ trình

Mở rộng `GET /learning-paths/mine`, giữ field và pagination hiện tại:

| Field dự kiến      | Ý nghĩa và quy tắc                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `learningStage`    | Giai đoạn học độc lập với status nghiệp vụ và vấn đề phát sinh.                                                      |
| `progress`         | Tổng hoàn tất/tổng buổi; tách `learning` và `teaching` theo viewer.                                                  |
| `nextSession`      | Session/plan, startAt/endAt, trạng thái, vai trò LEARNER/TEACHER; null khi không còn buổi phù hợp.                   |
| `attentionCount`   | Tổng vấn đề đang cần chú ý trong phạm vi viewer được biết; không phải độ dài trang attentionItems.                   |
| `primaryAttention` | Một vấn đề ưu tiên cùng key dùng tại trang chi tiết; null khi không có.                                              |
| `primaryAction`    | Mã hành động và tham chiếu đích đã kiểm tra quyền; ví dụ xem vấn đề/xác nhận buổi/xem buổi tiếp theo/xem quyết toán. |
| `settlement`       | Tóm tắt trạng thái quyết toán, reasonCode và tham chiếu liên quan từ cùng policy với settlement-status.              |

- Lấy Path theo trang trước, sau đó tổng hợp sessions, outcomes, report, change
  request và settlement bằng truy vấn theo lô qua owner contracts. Không gọi
  thêm một chuỗi HTTP/transaction cho mỗi card; không materialize outcome hoặc
  gọi provider khi dựng read model. Đo query count không tăng tuyến tính theo số card.
- List và detail dùng cùng bộ quy tắc projection, cùng cách tính theo viewer và
  thời điểm đánh giá. Trả `evaluatedAt` để phân biệt thay đổi dữ liệu giữa hai lần
  tải; trong một response phải dùng snapshot nhất quán, không ghép các trạng thái
  trước/sau một quyết định xử lý. Không cache dùng chung giữa các viewer.
- Progress sau khóa lịch dựa vào plan/version của thỏa thuận đã khóa; chỉ đếm
  buổi được công nhận COMPLETED. Buổi học bù/đổi lịch không nhân đôi buổi gốc.
  Trước khóa dùng tổng buổi của plan hiện hành nếu đã xác định, kèm basis rõ ràng;
  thiếu plan thì tổng null, không mặc định 0/0 là hoàn thành.
- TWO_WAY tính riêng chiều mình học và mình dạy; chiều không tồn tại ở ONE_WAY
  trả null. Buổi CANCELLED không tính hoàn tất; giữ số buổi gốc khi Path đã dừng
  để không biến lộ trình dở dang thành 100% bằng cách bỏ các buổi còn lại.
- nextSession chọn buổi đang diễn ra trước, rồi buổi kế tiếp theo startAt và id
  để ổn định; không chọn occurrence cũ đã hủy/thay lịch. Buổi đang cần xếp học bù
  là attention, không tự tạo thời gian hẹn. Có nextSession không đồng nghĩa được
  join; quyền hành động do policy thực tế quyết định.

### 6.2. Tách giai đoạn học, vấn đề và quyết toán

Ba trục trả độc lập: `learningStage`, `attentionItems`/tóm tắt attention và
`settlement`. Giữ nguyên `status` hiện tại để tương thích client cũ.

Thứ tự phân loại giai đoạn đề xuất, cần hoàn thiện bảng quyết định từ policy owner:

| Giai đoạn hiển thị | Nguồn xác định                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đã dừng            | Path CANCELLED hoặc quyết định dừng đã APPLIED; ưu tiên cao nhất, kể cả có settledAt. Yêu cầu dừng mới gửi/được đồng ý nhưng chưa thực thi chưa đủ điều kiện. |
| Hoàn tất           | Hoàn thành nghiệp vụ và quyết toán hợp lệ, không phải nhánh dừng. Không suy ra chỉ từ settledAt.                                                              |
| Đã học xong        | Có tập Session hợp lệ, mọi buổi bắt buộc được công nhận COMPLETED, chưa kết thúc toàn bộ nghiệp vụ/quyết toán. Có thể đồng thời có case đang xử lý.           |
| Đang học           | Thỏa thuận đã khóa và có tiến triển thực tế theo lifecycle/attendance/completion hiện hành, chưa học xong.                                                    |
| Chờ bắt đầu        | Thỏa thuận/lịch đã khóa, đã có buổi và chưa có tiến triển học.                                                                                                |
| Đang chuẩn bị      | Đang soạn/chốt plan, điều khoản hoặc lịch, chưa khóa toàn bộ thỏa thuận.                                                                                      |

- Khi Path DISPUTED, đối chiếu lockedVersion, đúng tập Session, attendance/outcome
  hiện hành và các mốc completion; không ép thành một giai đoạn riêng "tranh chấp"
  và không mặc định luôn là "Đang học".
- Session DISPUTED/AWAITING_CONFIRMATION không tự coi COMPLETED chỉ vì endAt
  đã qua. Trường hợp đã kết thúc giờ học nhưng chưa xác nhận vẫn cần attention;
  định nghĩa "Đã học xong" ở bảng trên là hoàn tất buổi được hệ thống công nhận.
- Không suy đoán lịch sử trước DISPUTED nếu dữ liệu không đủ; đề xuất stage null
  cùng reasonCode thiếu/không nhất quán dữ liệu. Chốt fallback trong contract trước
  triển khai, không thêm giá trị vào enum database chỉ để lấp khoảng trống này.
- Ví dụ hợp lệ: "Đã học xong" + "Có báo cáo đang xử lý" + "Chờ giải quyết trước
  quyết toán". Path đã dừng nhưng xử lý Credit xong vẫn hiển thị "Đã dừng".

### 6.3. Overview và danh sách vấn đề

Mở rộng `GET /learning-paths/:pathId` với `overview` và `attentionItems`. Overview
chứa cùng dữ liệu tổng hợp như card; detail không tự tính lại bằng quy tắc khác.
Nếu danh sách vấn đề dài, trả trang đầu và pagination riêng, kèm API đọc trang
tiếp dự kiến `GET /learning-paths/:pathId/attention-items`.

Mỗi attention item dự kiến có:

- Key ổn định, type, reasonCode, nguồn và các tham chiếu case/incident/change
  request/session/plan được phép công bố; severity có thể null khi chưa phân loại.
- Trạng thái xử lý và `waitingOn` theo viewer: SELF, COUNTERPART, STAFF, SYSTEM,
  nhiều bên khi có bằng chứng tương ứng, hoặc UNKNOWN khi không đủ thông tin.
  Không đoán NEED_MORE_INFO đang chờ ai chỉ từ reporterId.
- `impacts` cụ thể: chặn quyết toán, chặn một thao tác Session, cần xếp học bù,
  cần xác nhận, hoặc không chặn. Mỗi ảnh hưởng có reasonCode và phạm vi tài nguyên.
- Deadline nếu owner có dữ liệu; không tự tạo SLA. Không lộ raw lỗi hạ tầng,
  description, ghi chú xử lý hoặc file evidence chỉ vì chúng nằm cùng case.
- `allowedActions` theo người đang đăng nhập, gồm action code và target có loại/id;
  action không khả dụng có reasonCode phù hợp. Không trả đường dẫn FE hard-code.

Nguồn vấn đề gồm report của cả hai bên và hệ thống, kiểm tra attendance, xác nhận
Session, học bù/đổi lịch, yêu cầu hủy/dừng và chốt chặn quyết toán. Không quy mọi
vấn đề thành report; không biến lỗi kỹ thuật thành lỗi của participant.

Quy tắc ưu tiên dự kiến: việc viewer phải làm có hạn, vấn đề ảnh hưởng buổi học
hoặc quyết toán, các việc đang chờ bên khác; severity và thời hạn là đầu vào,
kèm tie-break ổn định bằng thời điểm/key. Thứ tự chi tiết cần chốt bằng ma trận;
không sử dụng severity như kết luận bên nào sai.

Một nguồn được nhắc lại ở report và settlement phải có cùng key hoặc quan hệ
nguồn rõ ràng, tránh đếm một vấn đề hai lần. Nhóm incident chỉ gom các tham chiếu
viewer được phép biết; không gộp mất các ảnh hưởng/việc cần làm khác nhau. Định
nghĩa attentionCount là số vấn đề hiển thị sau chuẩn hóa, không phải số report
toàn hệ thống hoặc số hành động. primaryAttention phải có mặt trong cùng tập đó.

Projection dùng policy kiểm tra hành động của command. Các chốt chặn Path DISPUTED
hiện có vẫn được mô tả đúng theo từng thao tác. Nếu cần nới một chốt chặn nghiệp
vụ thì tách thành thay đổi command/policy riêng; không làm ngầm trong API đọc.
Command luôn kiểm tra lại quyền, version và trạng thái khi thực thi.

### 6.4. API tóm tắt vụ việc cho participant

- Dự kiến `GET /learning-paths/:pathId/cases` và
  `GET /learning-paths/:pathId/cases/:caseId/summary`, qua contract do reports sở hữu.
  Có pagination; dựa vào participant của Path và quan hệ case với chính Path đó.
- Bao gồm case do mình gửi, đối tác gửi và hệ thống tạo. Giữ nguyên ngữ nghĩa
  `reports/mine`; không nới mineDetail thành trả mọi nội dung cho participant.
- Chỉ trả type/reason an toàn, tình trạng, ảnh hưởng, deadline được công bố,
  next action và tham chiếu thích hợp. Quyền summary khác quyền đọc evidence,
  nội dung reporter, ghi chú nội bộ, attendance thô và thread trao đổi từng bên.
- Summary phục vụ cả USER và STAFF đang là participant. Người ngoài Path không
  được đọc dù biết caseId; Staff chưa có quyền xử lý không được dùng summary để
  truy cập case ngoài các Path mình tham gia.
- Case nhóm liên quan nhiều Path/order chỉ lộ phần thuộc phạm vi viewer; không
  lộ danh tính/report khác thông qua incident membership hoặc số đếm.
- Case hệ thống reporterId null vẫn có nguyên nhân và hướng xử lý. Nếu dữ liệu
  legacy không có target cho NEED_MORE_INFO, trả UNKNOWN/CONTACT_SUPPORT; việc
  ghi người cần phản hồi/deadline mới thuộc thiết kế giao tiếp case, không bịa dữ
  liệu ở API đọc. Nhóm này có thể cần metadata lưu trữ khi triển khai giao tiếp.

### 6.5. Tận dụng settlement-status và phân công BE/FE

- Giữ API `GET /learning-paths/:pathId/settlement-status` và các field hiện hữu.
  Bổ sung `relatedItems`/tham chiếu có kiểu đến case, termination request hoặc
  quyết định/operation mà viewer có quyền xem, và `nextActionTarget` tương ứng.
- Nếu có nhiều blocker, trả danh sách/tóm tắt và đích overview/attention phù hợp;
  không chọn một case tùy ý rồi khiến FE tưởng đó là vấn đề duy nhất.
- Dùng chung logic trạng thái, xác nhận hai bên, thời hạn và điều kiện settlement
  cho API riêng, card và detail. Không gọi API đang lock Path lần lượt cho mỗi
  card; tách policy đánh giá đọc và dữ liệu batch khỏi command/khóa tài chính.
- Read model không tự tính lại số tiền, tạo settlement, resolve report hoặc đổi
  trạng thái nghiệp vụ. Không sửa nextAction cũ thành mã khác mà thiếu kế hoạch
  tương thích; ưu tiên thêm dữ liệu đích và projection mới.
- BE chịu trách nhiệm nguồn dữ liệu tổng hợp, reason/impact, quyền xem, action và
  đích theo viewer. FE quyết định nhãn ngôn ngữ, màu, bố cục, mở Tổng quan mặc định
  sau khi chốt và đưa vấn đề lên đầu; không tự suy quyền từ role/status.
- Web/mobile chỉ có checklist tích hợp contract trong plan này; chưa sửa UI.

## 7. Phạm vi schema, dữ liệu và tương thích

| Hạng mục                                                | Dự kiến thay đổi lưu trữ                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dữ liệu tổng hợp Path, attention và participant summary | Ưu tiên projection từ dữ liệu hiện có; chưa thấy cần đổi enum nghiệp vụ hoặc migration chỉ để có nhãn UI. Kiểm tra index bằng query plan khi triển khai. |
| Quyền Staff riêng                                       | Cần thiết kế migration cho bảng override mới và seed/catalog có kiểm soát; tái sử dụng Role/Permission/RolePermission.                                   |
| Nhóm report, severity và chống xử lý lặp                | Cần schema/migration riêng cho incident, quan hệ, phân loại và dấu vết quyết định.                                                                       |
| Trao đổi case                                           | PG giữ metadata/membership/quyền; Mongo giữ message. Chi tiết thread, recipient và deadline có thể cần schema/index/migration.                           |
| Quản trị giao dịch                                      | Tái sử dụng wallet/ledger/operation/payment/receipt/finding; bổ sung metadata quyết định hoặc index khi thiết kế cần, không nhân bản ledger.             |

"Chưa cần migration" chỉ là đánh giá cho phần bổ sung API đọc hiện tại, không áp
dụng cho toàn bộ plan. Nếu muốn có giai đoạn lịch sử hoặc thông tin người cần
phản hồi mà hiện chưa lưu được, phải ghi rõ thiếu dữ liệu và cập nhật thiết kế;
không cam kết dựng được bằng cách đổi tên trường.

Các field đọc mới theo hướng additive, có null/fallback rõ ràng, giữ status cũ
và cursor danh sách. Công bố Swagger, mẫu ONE_WAY/TWO_WAY và ví dụ nhiều attention.
Không sửa migration đã áp dụng, không tự backfill severity hoặc cấp hàng loạt
quyền mới cho Staff hiện hữu trước khi có ma trận chuyển đổi.

## 8. Trình tự thực hiện sau khi được yêu cầu triển khai

1. Chốt ma trận quyền Staff/Admin, quyền default/riêng và phạm vi ủy quyền; hoàn
   thiện bảng suy ra learningStage, mức ưu tiên attention và trường được công bố.
2. Thiết kế contract đọc chung theo owner, ví dụ response và pagination; thiết
   kế bảng override, report group/severity, case thread cùng migration riêng.
3. Mở đầy đủ quyền tham gia cho STAFF và cơ chế Admin quản lý quyền; kiểm tra các
   luồng STAFF↔USER/STAFF↔STAFF, ràng buộc chỉ Admin duyệt kỹ năng STAFF và hồi quy
   USER trước khi thêm quyền case mới.
4. Làm nhóm report/severity/hàng chờ và xử lý chống lặp; tiếp theo giao tiếp,
   phản hồi NEED_MORE_INFO và bổ sung bằng chứng trong case được giao.
5. Làm participant case summary, projection chung và batch read; nối vào list,
   detail và settlement-status. Phần đọc có thể làm độc lập bước 4 cho report
   hiện hữu rồi bổ sung incident refs khi có, không để thiếu summary hệ thống.
6. Thiết kế và bổ sung tổng hợp review nhận được theo profile như mục 12.2, thống
   nhất phạm vi công khai và cách xử lý review cũ trước khi mở API/hiển thị.
7. Làm API/màn Admin tra cứu giao dịch và đối soát theo mục 13, trước các thao tác
   tài chính có ghi. Hoàn thiện policy, preview, quyền và nguồn tham chiếu cho
   adjustment/reversal hoặc recovery trước khi cho Admin thực thi.
8. Kiểm thử quyền, nhất quán đọc, hiệu năng, concurrency và cross-store; cập nhật
   contract cho FE và kế hoạch rollout từng hạng mục. Không đưa hỗ trợ người mới
   trở lại thứ tự thực hiện nếu chưa có yêu cầu mới.

## 9. Kiểm chứng dự kiến và các quyết định còn mở

Kiểm thử hành vi khi triển khai, chưa chạy hoặc xác nhận trong lượt sửa plan:

- Staff với User và Staff với Staff hoàn tất luồng Proposal → chat → plan/lịch
  → Session → settlement/review; restriction/Credit/ownership vẫn có hiệu lực.
- Admin grant/deny/reset, ghi audit, reauth, xung đột version; thu hồi trong phiên
  đăng nhập/SSE đang mở; đổi/gỡ/gán lại role; seed không hồi sinh quyền bị thu hồi.
- Staff tự xử lý nội dung/case mình tham gia bị chặn; quyền communication không
  cho resolve, grouping hoặc Credit nếu chưa được cấp các quyền tương ứng.
- Kỹ năng STAFF: tự duyệt và Staff khác duyệt đều bị từ chối; Admin có quyền duyệt
  được xử lý khi hồ sơ hợp lệ; Admin thiếu quyền không được phép. Kiểm tra cả
  approve/reject, role đổi khi PENDING và retry; kỹ năng USER vẫn theo quyền cũ.
- Group report đồng thời/retry không phạt trùng, không hoàn tiền sai order, không
  bỏ chặn khi vẫn còn một case độc lập; ranh giới riêng tư của case giữ nguyên.
- Cùng snapshot/viewer, card và overview giống stage/progress/attention/action;
  tiến độ TWO_WAY tách đúng hai chiều; dữ liệu trước khóa không thành hoàn tất 0/0.
- DISPUTED trước buổi đầu, giữa lộ trình, sau mọi buổi; đã dừng có settledAt;
  case mở sau settlement; Session đang chờ xác nhận, no-show và chưa xếp học bù.
- Nhiều vấn đề cùng lúc, nhiều case cùng incident, case đối tác và hệ thống;
  không lộ evidence/notes/thread hoặc tồn tại case ngoài phạm vi participant.
- Attendance/outcome của occurrence cũ không làm sai lịch mới; primaryAction
  trỏ đúng tài nguyên, không trỏ về reports/mine cho case ngoài quyền reporter.
- Cursor ổn định, null/legacy timestamps, count xuyên trang, không truy vấn N+1
  theo card; API đọc không ghi DB/gọi provider; lỗi nguồn không giả thành 0 vấn đề.
- Khi có implementation: lint/typecheck/build và test hành vi phù hợp; PG/Mongo
  thật cho quyền, transaction, idempotency và lỗi cross-store trong DB test riêng.
- Review công khai: tổng/sao trung bình/phân bố và items cùng tập dữ liệu được
  phép xem; không tính review bị ẩn, không tiết lộ Path riêng; phân trang ổn định,
  không có review trả averageRating null. Tách đánh giá nhận được và đã gửi.
- Quản trị giao dịch: quyền đọc/ghi độc lập, filter/cursor theo ngữ cảnh; không
  ghi Credit khi chỉ đọc/đối soát; retry/webhook/recovery đồng thời không top-up
  trùng; correction/reversal giữ ledger cũ, không âm ví hoặc làm sai Held.

Các điểm cần chốt trước khi triển khai phần phụ thuộc: catalog quyền được Admin
ủy quyền và default Staff cũ/mới; quy tắc xung đột lợi ích; tiêu chí severity/SLA;
gom/tách nhóm đã đóng; thread riêng/chung và ghi chú nội bộ; người cần phản hồi;
bảng stage/fallback/priority cuối cùng và phạm vi summary công khai cho participant.
Đây là các quyết định thiết kế còn mở, không phải yêu cầu xác nhận để lưu plan.

## 10. Constitution Check cho kế hoạch

| Nguyên tắc            | Trạng thái                   | Hướng xử lý                                                                       |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Scope/module          | Pass cho kế hoạch            | Backend là scope mặc định; UI chỉ khi yêu cầu riêng.                              |
| Store ownership       | Pass cho thiết kế định hướng | PG là authority nghiệp vụ; Mongo giữ message.                                     |
| Atomicity/idempotency | Pending                      | Chốt event identity, khóa và transaction theo contract.                           |
| Authorization         | Pending                      | Quyền tham gia + quyền Staff riêng, assignment/revocation và participant summary. |
| API/UTC/pagination    | Pending                      | Contract đọc additive, batch, null/fallback và consistency list/detail.           |
| Verification          | Pending                      | Đã có draft backend; kiểm chứng PG/Mongo thật và ghép branch còn pending.         |
| Module ownership      | Pass cho thiết kế định hướng | Reports gọi contracts của Reputation/Credit, không ghi thẳng ví.                  |
| Delivery/recovery     | Pending                      | Thiết kế outbox/receipt và kiểm chứng cross-store trước rollout.                  |

Users/auth sở hữu phân quyền; Credit/Payments sở hữu truy vấn và command tài chính
Admin, PostgreSQL giữ ledger/audit nguyên tử và provider calls ở ngoài transaction.
Reports sở hữu case/group/severity và public summary;
learning-paths điều phối overview theo contract đọc của learning-sessions,
scheduling, reports và Credit/settlement. Mọi projection là dữ liệu dẫn xuất,
không là nguồn trạng thái thứ hai; không tạo vòng phụ thuộc giữa các module.

Không đề xuất ngoại lệ constitution. Đây là tài liệu kế hoạch, không phải bằng
chứng tính năng đã deploy. Draft backend từ ngày 2026-11-08 nằm ở các worktree
được ghi trong implementation.md; database, seed và deployment chưa bị thay đổi.

## 11. Kiểm tra bổ sung: hạn chế đăng bài và đánh giá của tôi

Đối chiếu source ngày 2026-11-06 theo yêu cầu kiểm tra, không sửa implementation.
Phần này giữ kết quả kiểm tra source ngày 2026-11-06 để tham khảo lịch sử;
không chứng minh hiện trạng sau phần uy tín do thành viên khác thực hiện.
Không triển khai sửa các khoảng trống uy tín từ mục này. Tổng hợp đánh giá công
khai vẫn thuộc phạm vi ở mục 12.2; hỗ trợ người mới vẫn tạm bỏ.

### 11.1. Ngưỡng uy tín chặn đăng Learning Request

Ngưỡng tạo hạn chế trong `ReputationService.applyRestriction()` là dưới 40.

| Điểm sau sự kiện cập nhật uy tín | Hạn chế do LOW_REPUTATION                                     |
| -------------------------------- | ------------------------------------------------------------- |
| 50–100                           | Không tạo hạn chế do điểm thấp.                               |
| 40–49                            | WARNING, chưa khóa đăng bài do điểm.                          |
| 30–39                            | CREATE_NEW_ACTIVITY trong 1 ngày (24 giờ).                    |
| 20–29                            | CREATE_NEW_ACTIVITY trong 3 ngày.                             |
| 10–19                            | CREATE_NEW_ACTIVITY trong 7 ngày và cờ REQUIRE_STAFF_REVIEW.  |
| 0–9                              | CREATE_NEW_ACTIVITY trong 30 ngày và cờ REQUIRE_ADMIN_REVIEW. |

- Cả tạo bản nháp và publish Learning Request đều gọi eligibility. Module bind
  eligibility sang `SkillActorService.assertAllowed()`, kiểm tra restriction còn
  hiệu lực (`startsAt <= now < endsAt`, chưa revoked), scope CREATE_NEW_ACTIVITY
  hoặc learning-request:create, rồi trả 403 NEW_ACTIVITY_RESTRICTED.
- Endpoint không trực tiếp so điểm với 40. Vì vậy điểm dưới 40 nhưng restriction
  hết hạn/không tồn tại không tự bị chặn bởi gate này; điểm từ 40 trở lên vẫn có
  thể bị chặn bởi quyết định vi phạm độc lập hoặc restriction khác.
- Khi một sự kiện cập nhật đưa điểm lên ít nhất 40, code thu hồi restriction có
  reason LOW_REPUTATION; không tự gỡ ADJUDICATED_VIOLATION. Khi vẫn dưới 40, mỗi
  lần apply mới có thể kéo hạn tới now + số ngày tương ứng, kể cả delta không âm;
  code giữ hạn cũ dài hơn nếu có. Chưa thay đổi policy này trong lượt kiểm tra.
- GET /reputation/me đã trả điểm, level và activeRestrictions gồm scope/reasonCode/
  endsAt; mobile có màn hiển thị. Lỗi đăng bài NEW_ACTIVITY_RESTRICTED hiện chưa
  có thông điệp riêng trong error mapping mobile, nên rơi về thông báo 403 chung.

Khoảng trống so với SRS V1.6 mục 18.34:

- Cờ REQUIRE_STAFF_REVIEW/REQUIRE_ADMIN_REVIEW đã được tạo nhưng chưa tìm thấy
  consumer/gate hoặc quy trình duyệt mở lại; chúng không giữ khóa hoạt động mới
  sau endsAt trong eligibility hiện tại. Chưa thấy bước bắt buộc xác nhận đã xem
  cảnh báo/policy trước mở lại ở mức 20–29.
- Luồng tạo Proposal hiện kiểm tra permission proposal:create và tài khoản,
  nhưng chưa thấy kiểm tra CREATE_NEW_ACTIVITY như Learning Request. Helper
  `SkillActorService.require()` chỉ chặn ALL hoặc scope đúng permission được
  yêu cầu, nên restriction uy tín này chưa bao phủ Proposal theo SRS.
- Đây là kết luận từ source, không xác nhận restriction của một tài khoản hay
  dữ liệu production. Không đổi ngưỡng hoặc quyết định tự mở/đóng khóa tại đây.

Nguồn backend, tính từ `services/api`:

- `src/modules/reputation/application/services/reputation.service.ts:32`, `:46`,
  `:250` và `:303`.
- `src/modules/users/application/services/skill-actor.service.ts:37` và `:73`.
- `src/modules/learning-requests/learning-requests.module.ts:67`.
- `src/modules/learning-requests/application/use-cases/create-learning-request.use-case.ts:91`.
- `src/modules/learning-requests/application/use-cases/publish-learning-request.use-case.ts:167`.
- `src/modules/proposals/application/services/proposals.service.ts:190`.
- `src/modules/reviews/application/services/reviews.service.ts` (history).

Nguồn mobile, tính từ root repo: `apps/mobile/src/lib/http/errors.ts`,
`apps/mobile/src/features/learning-requests/utils/request-policy.ts`,
`apps/mobile/src/features/community/components/reputation-summary.tsx`.

### 11.2. Đánh giá đã viết và đánh giá nhận được

Kết luận: đã có đánh giá theo từng Learning Path; chưa có chức năng tổng hợp
"đánh giá của tôi/về tôi" đầy đủ trên tất cả lộ trình.

- BE có POST /learning-paths/:pathId/reviews: participant đánh giá đối tác khi
  Path COMPLETED và settledAt khác null; tối đa một review mỗi người mỗi Path,
  1–5 sao, comment tối đa 1.000 ký tự, cập nhật uy tín người nhận.
- BE có GET cùng route để hai participant xem review chưa bị ẩn của Path đó.
  Chưa có API reviews/mine/me hoặc truy vấn danh sách theo reviewerId/revieweeId
  xuyên các Path; GET /reputation/me là lịch sử điểm, không thay thế danh sách review.
- Mobile có mục "Đánh giá về tôi" dẫn tới /reviews. Màn này tải Learning Path,
  lọc COMPLETED và yêu cầu mở từng Path để xem/viết đánh giá. Bên trong có phân
  biệt "Bạn đã đánh giá" và "Đánh giá nhận được", đã gọi API thật trong source.
- Chưa có hai danh sách tổng hợp đã gửi/nhận được, lọc theo chiều đánh giá,
  pagination riêng cho review, thống kê tổng/sao trung bình của tài khoản.
  Nhãn "Đánh giá về tôi" hiện chưa phản ánh đúng nội dung trang đích.
- Adapter mine() hiện đã tải tiếp các trang Path tới hết cursor. Dòng thông báo
  chỉ dựa vào 100 Path ở ReviewsScreen là nhãn cũ, không phải giới hạn 100 thật
  của adapter hiện tại; không dùng nhãn này làm bằng chứng review bị cắt trang.
- Backend lọc hiddenAt nhưng vẫn chặn gửi trùng kể cả review cũ bị ẩn. Mobile
  xác định đã gửi từ review còn hiển thị, nên trạng thái này cần metadata riêng
  nếu sau này hoàn thiện màn tổng hợp; không coi review bị ẩn là chưa từng gửi.
- Trong source web đã tìm chưa thấy màn/API client đánh giá lộ trình tương ứng;
  không lấy màn xem lịch sử uy tín của Staff làm bằng chứng "đánh giá của tôi".

Nguồn backend: `src/modules/reviews/presentation/http/reviews.controller.ts:30`,
`src/modules/reviews/application/services/reviews.service.ts:29` và `:83`.
Nguồn mobile, tính từ root repo:

- `apps/mobile/src/constants/navigation.ts` (Đánh giá về tôi → /reviews).
- `apps/mobile/src/features/community/screens/review-screens.tsx:25`.
- `apps/mobile/src/features/community/api/community-api.ts:55`.
- `apps/mobile/src/features/community/hooks/use-review-submission.ts:19`.
- `apps/mobile/src/features/learning-paths/api/learning-paths-api.ts` (mine).

Chưa chạy API thật hoặc thao tác trên tài khoản trong lượt kiểm tra này. Nếu
yêu cầu triển khai phần tổng hợp review sau đó, cần chốt contract sent/received,
quyền xem, hidden/submitted metadata và pagination trước khi làm BE/FE.

## 12. Phạm vi uy tín và tổng hợp đánh giá công khai

### 12.1. Nới lỏng uy tín — ngoài phạm vi, thành viên khác phụ trách

Theo thông tin người dùng ngày 2026-11-08, phần này đã có thành viên khác làm.
Loại khỏi đầu việc triển khai và kiểm thử riêng của plan này, bao gồm thay đổi
policy khóa theo điểm, xử lý restriction cũ và UI tương ứng. Đây là thông tin
phân công từ người dùng, không phải xác nhận đã merge hoặc deploy.

Khi triển khai các phần Staff/report/review có giao điểm, đối chiếu contract và
source tại thời điểm tích hợp để tương thích với phần việc đó; không tự khôi phục
policy cũ hoặc triển khai lại nới lỏng uy tín. Kết quả audit cũ ở mục 11.1 chỉ là
tham khảo có thời điểm. Tổng hợp đánh giá công khai bên dưới vẫn tiếp tục trong plan.

### 12.2. Tổng hợp đánh giá nhận được để người khác xem

Hiện trạng đã kiểm tra thêm:

- GET /profiles/:userId trả hồ sơ ACTIVE cho người đã đăng nhập, có điểm uy tín,
  số kỹ năng xác minh và số buổi hoàn thành; chưa có averageRating/reviewCount/reviews.
- Review đã lưu reviewerId, revieweeId, rating, comment, createdAt, hiddenAt và
  pathId; có index revieweeId. Có thể dùng làm nguồn tổng hợp, không cần lập bảng
  review mới hoặc yêu cầu người dùng đánh giá lại chỉ để có phần thống kê.
- Mobile public profile đã nối API thật cho hồ sơ/kỹ năng nhưng chưa render
  review tổng hợp. Những rating/comment trong mocks không chứng minh đã có tính năng.

Contract đọc dự kiến, prefix /api/v1:

| Phần                                      | Dữ liệu/phạm vi                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| reviewSummary trong GET /profiles/:userId | reviewCount, averageRating và ratingDistribution từ 1–5 sao, tính trên toàn bộ review nhận được và được phép công khai.                                      |
| GET /profiles/:userId/reviews             | Danh sách nhận được theo revieweeId, cursor/limit và thứ tự createdAt DESC, id DESC; người khác xem qua quyền profile.                                       |
| Mỗi review công khai                      | Review ID, sao, nhận xét được phép hiển thị, thời điểm và thông tin công khai tối thiểu của người đánh giá.                                                  |
| Đánh giá của chính tôi                    | Tách chiều đã gửi/nhận được; dùng cùng nguồn và quy tắc summary cho chiều nhận. Không công khai toàn bộ lịch sử đã gửi của một người qua endpoint nhận được. |

- Người xem dự kiến là thành viên đã đăng nhập, cùng phạm vi profile hiện hữu;
  không tự mở endpoint cho khách chưa đăng nhập hoặc cho công cụ tìm kiếm.
- Review vẫn chỉ được tạo bởi participant sau Path COMPLETED và đã quyết toán,
  mỗi người một lần mỗi Path. Người ngoài xem được review không có quyền gửi
  đánh giá hoặc đọc Path/session/chat/Credit liên quan.
- API mới dùng allowlist riêng, không trả nguyên row review có pathId và không
  dẫn người xem sang trang chi tiết lộ trình riêng tư. Thông tin reviewer chỉ
  lấy từ projection công khai; không thêm email, evidence hoặc ghi chú nội bộ.
- hiddenAt khác null không xuất hiện trong items hoặc thống kê. Summary và list
  phải cùng tập dữ liệu/điều kiện quyền; tổng được tính trên tất cả review hợp
  lệ, không chỉ trang hiện tại. Chưa có review: count 0, averageRating null và
  phân bố toàn 0; không hiển thị 0 sao như một đánh giá xấu.
- Sao trung bình và điểm uy tín là hai đại lượng khác nhau; không quy đổi 50/100
  uy tín thành 2,5/5 sao. Profile thể hiện số lượt cùng sao để người xem biết cỡ mẫu.
- TWO_WAY hiện có một review mỗi người mỗi Path, không phải hai review cho hai
  chiều. Thống kê không nhân đôi số lượt. Nếu cần phân loại "khi dạy/khi học",
  phải xác định cách biểu diễn BOTH cho trao đổi hai chiều trước khi thêm filter.
- Với tài khoản reviewer không còn hồ sơ công khai, cần chốt cách ẩn danh phần
  tác giả hoặc ẩn review; không làm summary và list dùng hai quy tắc khác nhau.
- Review hiện tại chỉ cho hai participant đọc. Cần chốt phạm vi công khai review
  cũ và thông báo hiển thị khi gửi review mới trước rollout; không coi hiddenAt
  null tự động chứng minh tác giả trước đây đã biết nhận xét sẽ công khai.
- Ưu tiên query dữ liệu có sẵn; chỉ bổ sung index nếu query plan cần. Nếu chọn
  công khai theo consent/version của review thì cần thiết kế field/migration
  riêng; chưa kết luận toàn bộ phần công khai chắc chắn không cần migration.
- Reviews sở hữu truy vấn/thống kê; profile gọi contract của Reviews. FE hiển thị
  summary và trang danh sách, không tự tải tất cả Path để tính sao. Nếu cache,
  xác định invalidation khi tạo/ẩn/khôi phục review và thay đổi quyền hồ sơ.

Nguồn backend, tính từ services/api: `prisma/schema.prisma:933`,
`src/modules/users/application/services/profile-reader.service.ts:16`,
`src/modules/users/presentation/http/users.controller.ts:92`,
`src/modules/reviews/application/services/reviews.service.ts:29` và `:83`.
Nguồn mobile, tính từ root repo:
`apps/mobile/src/features/profile/api/public-profile-api.ts`,
`apps/mobile/src/features/profile/screens/public-api-profile-screen.tsx`.

Phần này mới là thiết kế đọc và policy dự kiến. Chưa mở quyền xem review,
chưa công khai dữ liệu cũ và chưa thay đổi điểm hoặc restriction của tài khoản nào.

## 13. Admin quản lý giao dịch Credit và Payment

### 13.1. Phạm vi được bổ sung và hiện trạng source

Theo yêu cầu ngày 2026-11-08, đưa phần quản trị giao dịch từ backlog audit vào
phạm vi plan này. Bao gồm tra cứu toàn hệ thống, đối soát và luồng xử lý có quyền;
chi tiết quyền/tình huống được thực thi phải ghi rõ trước triển khai.

- WalletController hiện ở /me/wallet: số dư và lịch sử/detail của chính người
  dùng. Payment list/detail cũng lọc theo principal.userId; không phải Admin API.
- PaymentReconciliationReader và scripts/reconcile-payments.mjs đã có báo cáo
  đối soát chỉ đọc, tùy chọn lookup payOS; reader ghi rõ chưa có HTTP route.
- CreditAdjustmentPort đã có adjust/reverse gắn REPORT_CASE và được report gọi.
  Chưa có workflow quản trị tài chính độc lập; không thể chỉ đổi URL controller
  rồi bỏ ràng buộc nguồn quyết định này.
- Payment có REVIEW, receipt/finding và recovery có kiểm tra. Có enum REFUNDED
  không chứng minh đã có hoàn VND qua ngân hàng/provider hoặc quyền refund Admin.
- Chưa thấy controller Admin quản lý toàn bộ ledger/Payment trong phạm vi source
  Credit/Payments đã kiểm tra. Đây là kiểm tra source, chưa xác nhận deployment.

Nguồn, tính từ services/api:

- `src/modules/credit/presentation/http/wallet.controller.ts:33`.
- `src/modules/payments/presentation/http/payments.controller.ts:58`.
- `src/modules/payments/application/use-cases/read-payments.use-case.ts`.
- `src/modules/payments/application/services/payment-reconciliation.reader.ts:148`.
- `scripts/reconcile-payments.mjs`.
- `src/modules/credit/application/ports/credit.ports.ts` (CreditAdjustmentPort).
- `src/modules/payments/application/services/payment-receipts.service.ts`.
- `prisma/schema.prisma:859` (CreditTransaction), `:890` (Payment), `:1407`
  (CreditOperation), `:1603` (PaymentReceipt), `:1636` (PaymentFinding).

### 13.2. Tra cứu giao dịch và đơn nạp toàn hệ thống

Các API đề xuất dưới prefix /api/v1, tên route sẽ chốt trong contract:

| API dự kiến                            | Chức năng                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET /admin/credit/transactions         | Ledger toàn hệ thống; lọc user, loại, trạng thái, khoảng thời gian, operation và tham chiếu nghiệp vụ.    |
| GET /admin/credit/transactions/:id     | Biến động Available/Held, số dư sau giao dịch, operation, nguồn và bút toán đảo liên quan.                |
| GET /admin/credit/operations/:id       | Gom các ledger entry thuộc một operation, tránh nhìn một entry thành toàn bộ giao dịch nghiệp vụ.         |
| GET /admin/users/:userId/wallet        | Available/Held và tham chiếu phân bổ Held của user theo quyền tài chính.                                  |
| GET /admin/payments                    | Đơn nạp toàn hệ thống; lọc user/status/thời gian và tìm theo Payment ID/order code/mã giao dịch provider. |
| GET /admin/payments/:id                | Quote cố định, Credit/VND, trạng thái, checkout, receipt/finding đã lọc và liên kết TOP_UP operation.     |
| GET /admin/payments/:id/reconciliation | Đối chiếu snapshot database, receipt và ledger; trả mã chênh lệch và thời điểm kiểm tra.                  |

- Có pagination cursor gắn với filter/viewer, thứ tự ổn định; thời gian UTC và
  hiển thị theo timezone FE. Số tiền dùng đơn vị chính xác và serialize BIGINT
  theo contract Credit hiện hữu, không chuyển qua số thực gây mất chính xác.
- Phân biệt payment nạp tiền ngoài hệ thống, CreditOperation và ledger entry.
  Giữ tham chiếu tới Learning Path/material order/report/termination decision
  đúng loại và quyền; không bắt mọi giao dịch đều có Payment ID.
- Bổ sung summary trên tập kết quả đã lọc khi cần: số bản ghi/trạng thái và số
  tiền theo loại. Không cộng toàn bộ amount ledger rồi gọi là doanh thu: Hold,
  chuyển nội bộ, phí và reversal có thể cùng phản ánh một nghiệp vụ. Credit và
  VND là hai đại lượng riêng; thống kê doanh thu toàn hệ thống vẫn ngoài mục này.
- Thông tin định danh và bằng chứng thanh toán dùng allowlist; không trả secret,
  signature, raw webhook hay dữ liệu ngân hàng không cần thiết ra bảng/detail.
- Tái sử dụng logic đọc/đối soát của owner Credit/Payments, không mở rộng endpoint
  /me để đọc tùy ý userId hoặc đọc trực tiếp bảng ví từ module quản trị.

### 13.3. Hàng chờ đối soát và các thao tác quản trị

- Tạo hàng chờ Payment REVIEW và chênh lệch giữa trạng thái Payment, provider,
  receipt và TOP_UP ledger; có reasonCode, ngày phát hiện, trạng thái xử lý và
  người xử lý nếu đã có. Việc ghi nhận xử lý cần owner metadata riêng khi thiết kế.
- Lookup payOS chủ động là thao tác riêng, có quyền/rate limit, thời điểm và kết
  quả xác minh. Gọi provider ngoài transaction PG; timeout phải là chưa xác định,
  không suy thành chưa thanh toán hoặc cho phép nạp lại tự động.
- Recovery chỉ theo state machine/quote bất biến và bằng chứng provider đã xác
  minh. Tái sử dụng điều kiện technical review hiện hữu; vấn đề sai số tiền,
  khác người nhận, thiếu danh tính hoặc nghi trùng không được coi là lỗi kỹ thuật
  để tự cho tiếp tục. Không thêm nút sửa trực tiếp status thành PAID.
- Adjustment/reversal độc lập: đề xuất workflow tạo yêu cầu/preview quyết định
  tài chính, nhập lý do và tham chiếu nghiệp vụ, xác nhận bằng reauth rồi thực
  thi qua Credit owner. Phạm vi loại operation được đảo, hạn mức, yêu cầu duyệt
  thứ hai và policy cần chốt; không mặc định mọi giao dịch đều có thể đảo.
- CreditAdjustmentPort hiện chỉ nhận REPORT_CASE. Muốn có quyết định Admin ngoài
  report cần mở rộng contract nguồn quyết định hợp lệ và audit/dedupe tương ứng;
  không tạo report giả hoặc bỏ kiểm tra target để tái sử dụng port.
- Bút toán điều chỉnh/đảo là bản ghi mới liên kết nguồn; không sửa/xóa ledger đã
  thành công hoặc gõ đè số dư ví. Kiểm tra số dư, nguồn Credit, Held, operation
  đã đảo và các case/quyết định liên quan dưới lock của owner.
- Mọi command có idempotency, kiểm tra quyền/trạng thái hiện hành, audit nhất
  quán với ledger/decision và thông báo sau commit qua cơ chế delivery phù hợp.
- Hủy đơn chưa trả tiền, hoàn Credit và hoàn VND là nghiệp vụ khác nhau. Nếu đưa
  hủy Payment vào Admin UI thì phải dùng policy/provider verification hiện hữu;
  không hủy PAID/REVIEW bằng cập nhật thủ công. Hoàn VND/withdrawal không tự được
  bổ sung chỉ từ yêu cầu quản lý giao dịch, cần policy/provider contract riêng.

### 13.4. Quyền, UI, lưu trữ và kiểm chứng

- Quyền tài chính đọc, đối soát/lookup, recovery, adjustment và reversal tách
  riêng; tên permission sẽ chốt trong catalog. API Admin yêu cầu role ADMIN và
  quyền tương ứng. Staff không tự có quyền tài chính nhờ report:moderate hoặc
  quyền trao đổi case; việc ủy quyền cho Staff chưa thuộc yêu cầu bổ sung này.
- FE dự kiến có bảng ledger/operation, bảng Payment, hàng chờ cần xem xét và
  detail liên kết. Hành động theo quyền và điều kiện backend; preview cho thấy
  ví/operation bị tác động, số tiền và lý do trước xác nhận thực thi.
- Giai đoạn đầu ưu tiên tra cứu/detail/đối soát; chỉ mở thao tác ghi khi đã có
  contract/policy đầy đủ. Đây là thứ tự thực hiện, không đánh dấu workflow ghi
  đã hoàn thiện chỉ vì đã có màn danh sách.
- PostgreSQL tiếp tục là authority ví/ledger/payment/audit. Tái sử dụng receipt,
  finding và operation hiện hữu; bổ sung record quyết định/lịch sử xử lý hoặc
  index khi cần. Chưa kết luận không cần migration cho toàn bộ phần quản trị.
- Kiểm chứng: Admin thiếu quyền và Staff bị chặn; filter/cursor nhất quán;
  tìm đúng provider ID; dữ liệu nhạy cảm không lộ; đối soát đọc không sửa ví;
  provider lỗi không đánh dấu PAID/FAILED sai; webhook/recovery/command retry
  không cộng Credit hai lần; adjustment/reversal đồng thời giữ số dư, nguồn tiền,
  ledger và audit nguyên tử. Dùng PostgreSQL thật cho các invariant tài chính.

Chưa sửa code, gọi provider, điều chỉnh giao dịch hay chạy migration. Phần nới
lỏng uy tín vẫn ngoài scope; phần quản trị này không thay thế cơ chế đó.
