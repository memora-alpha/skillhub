# Learning Request lifecycle — thiết kế sửa STT 10 và 17

Ngày: 2026-10-29. Trạng thái: **Đã triển khai, xử lý final review và kiểm chứng local; chưa deploy hoặc sửa dữ liệu ứng dụng**.
Baseline planning: `9834cd3`, nhánh `fix/learning-request-service`; working tree
sạch trước khi bổ sung tài liệu này. Audit trước ở `232cb6b`; các commit mới chỉ
đổi frontend/lockfile/release-seeds, không đổi source API liên quan. Các caller và
DI đã được kiểm tra lại trên baseline planning. Phạm vi: `services/api`.

## 1. Kết quả cần đạt và quyết định đã chốt

Nguồn: [danh sách lỗi, STT 10 và 17](https://drive.google.com/file/d/1aSB0WGS1zBI0pUgUnLswp1MzuUzrqVqr/view),
SRS V1.6 ở `../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`
(BR-10, FR-LR-06, LR-007/008, mục 8.2), [spec](spec.md),
[owner contracts](contracts/module-ports.md), và source đã kiểm tra.

Người dùng đã chốt trong chat ngày 2026-10-29:

- Mỗi Request chỉ có **một LearningPath được chốt**. Có thể giữ nhiều Path nháp;
  hai LearningPlan đối ứng của TWO_WAY vẫn thuộc một Path.
- Chuẩn bị công cụ rà soát và bản xem trước để xử lý Request cũ theo Path,
  lịch và settlement thực tế. Chưa cho phép ghi sửa dữ liệu đang chạy.

Các quy tắc đã có, không hỏi/chốt lại:

- Accept Proposal chỉ mở Conversation và đưa Request vào NEGOTIATING.
- Finalize thành công đưa Request NEGOTIATING → MATCHED cùng Hold, khóa lịch,
  tạo Session và outbox trong một PostgreSQL transaction.
- MATCHED → CLOSED chỉ sau tất cả Session của mọi plan hoàn tất, không bị dispute
  chặn và settlement thành công, cùng transaction với completion/ledger.
- Owner được hủy đến trước khóa lịch, kể cả Path/plan đã CONFIRMED. Hủy giữ
  Proposal, Chat và các bản nháp; nguồn đã hủy không được tạo cam kết mới.
- Không thay tiền, phí, cutoff, quy tắc no-show, hoặc expiry của NEGOTIATING.

Không sửa mobile/web, không triển khai STT 16 hoặc luồng hủy Path/refund,
không sửa migration đã áp dụng, không commit/push/deploy trong phạm vi planning.

## 2. Bằng chứng hiện trạng

| Source                                                                                     | Hiện trạng                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/learning-requests/application/services/learning-request-lifecycle.service.ts` | `markMatched`/`markClosed` có CAS nhưng không có caller; chỉ `beginNegotiation` được Proposals gọi.                                                              |
| `src/modules/learning-paths/application/services/learning-paths.service.ts`                | `finalizeTx` khóa Path, Hold, tạo Session, khóa lịch và ghi outbox; chưa đọc/khóa Request. `create` chỉ đọc participants của Conversation.                       |
| `src/modules/learning-sessions/application/services/learning-sessions.service.ts`          | `settle` gọi PathSettlementPort; cả HTTP và completion worker đi qua hàm này. Chưa cập nhật Request.                                                             |
| `src/modules/credit/application/services/credit-ledger.service.ts`                         | Settlement hiện cập nhật Path COMPLETED, settledAt và ledger; giữ nguyên owner flow này.                                                                         |
| `src/modules/learning-requests/learning-requests.module.ts`                                | REQUEST_LOCK_READER vẫn bind UnavailableLearningRequestDependencies.                                                                                             |
| `src/modules/learning-requests/application/use-cases/cancel-learning-request.use-case.ts`  | Owner/expectedVersion được kiểm; NEGOTIATING luôn gọi reader dự phòng trả 503.                                                                                   |
| `prisma/schema.prisma`                                                                     | Path → Conversation → Request/Proposal đã đủ liên kết; nhiều Path trên một Conversation được phép. Không cần thêm matchedPathId để thực hiện quyết định đã chốt. |
| `test/learning-requests/lifecycle.test.mjs`                                                | Test helper dùng mock; một test còn chủ động chấp nhận adapter trả 503. Chưa chứng minh tích hợp finalize/settlement.                                            |

## 3. Cách thực hiện và lựa chọn

**Đề xuất của agent:** nối owner contracts trong transaction đang có và dùng row
lock của Request để chọn duy nhất một Path thắng. Đây là hướng duy nhất phù hợp
contract nguyên tử hiện hành. Giữ outbox cho sự kiện sau commit, không dùng job
để đồng bộ trạng thái Request. Không thêm cột liên kết hoặc bộ state machine mới:
liên kết hiện hữu và khóa/CAS đủ cho mọi writer được hỗ trợ.

Superpowers được dùng cho thiết kế, kế hoạch, TDD và verification/review.
Ponytail `full` áp dụng trong planning và implementation: reuse trước, sửa nguyên
nhân chung, không dependency mới, không abstraction dự phòng. Những test về race,
rollback, tiền và quyền là cần thiết, không bị cắt vì mục tiêu giảm diff.
Ponytail được đọc từ plugin cache đã có trên máy:
`C:/Users/MSI-PC/.claude/plugins/cache/ponytail/ponytail/4.10.0/skills/ponytail/SKILL.md`.

### Owner reader và DI

Thêm một concrete `LearningRequestPathReader` trong module Learning Paths,
implement port `RequestLockReader` đã có. Một module nhỏ
`LearningPathRequestStateModule` chỉ cung cấp/export reader này, không import
LearningRequestsModule. Learning Requests, Learning Paths và Learning Sessions
import module nhỏ này; Paths/Sessions sử dụng lifecycle export của Learning
Requests. Đồ thị DI không có vòng và không cần forwardRef.

Reader chỉ đọc dữ liệu Path/Conversation/Proposal và bằng chứng khóa; không tự
ghi Request, ledger hoặc tạo transaction lồng nhau. Nó có trách nhiệm:

- Resolve đúng nguồn bằng ID Path/Conversation, so requestId của Conversation
  với Proposal; kiểm Proposal ACCEPTED và cùng hai participants/owner nguồn.
  Hai requestId đều null là direct exchange; một bên null/mismatch là lỗi dữ liệu,
  không được lặng lẽ coi là direct exchange.
- Tìm các Path đã chốt của Request qua tất cả Conversation liên quan. Dùng
  `lockedVersion` là bằng chứng chính, kể cả status bị lùi do STT 16. Lịch LOCKED,
  Session đã tạo hoặc settledAt cũng chặn cancel khi dữ liệu cũ mâu thuẫn.
- Một Path chỉ CONFIRMED, không có bằng chứng khóa, vẫn được hủy Request.
- Cấp cùng một kết quả kiểm nguồn/Path thắng cho finalize, settlement và cancel.
  Không tìm bằng tên, skill hoặc cặp user thay cho foreign key.

Review amendment: một helper concrete `lockLearningPath` dùng chung cho các writer
Path, Scheduling, Session và tạo Report, lấy sorted participant locks trước Path.
Điều này ngăn inversion giữa finalize mới và User FK KEY SHARE của writer cũ;
không đổi policy hoặc luồng xử lý report-resolution ngoài phạm vi.

### Khóa và atomicity

Với mỗi transaction thay đổi lifecycle:

1. Đọc context bằng ID, kiểm membership trước khi khóa tài nguyên ngoài quyền.
2. Khóa các User liên quan theo UUID qua `lockUsers` hiện có. Cancel giữ khóa
   owner hiện có; reader không lấy thêm User lock sau Request.
3. Khóa Request qua lifecycle owner nếu có; đọc lại context để phát hiện thay đổi.
4. Khóa Path, rồi các plan/schedule/session cần thiết, rồi wallet theo thứ tự
   hiện có. Không lấy Request/User lock mới sau Path hoặc wallet.

Cancel và finalize cùng giữ Request lock trước khi quyết định. Cancel thắng:
Request CANCELLED và finalize từ chối trước Hold. Finalize thắng: Request MATCHED
và cancel trả 409. Hai Path cạnh tranh: chỉ một được Hold/tạo Session; Path còn
lại vẫn là nháp. Direct exchange bỏ bước Request nhưng giữ behavior và safeguards
hiện có. Đọc preflight không bảo đảm kết quả tương lai; finalize luôn kiểm lại.

### Lifecycle và retry

Lifecycle bổ sung `lockForPath(tx, requestId)` trả snapshot có id, ownerId, status
và version. `markMatched`/`markClosed` giữ chữ ký và CAS hiện có. Version Request
được đọc khi giữ khóa, không lấy agreementVersion thay thế.

- Fresh create/preflight/finalize phải chặn nguồn Request đã hủy hoặc không còn
  NEGOTIATING; existing finalized Path vẫn được đọc/replay đúng quyền.
- Fresh finalize kiểm không có Path khác đã chốt, giữ Request lock xuyên Hold,
  Session, khóa lịch và `markMatched`. Bất kỳ lỗi nào rollback toàn bộ.
- Retry finalize cùng Path/version giữ nguyên Session, Hold và version Request.
  Retry Path khác phải bị từ chối, không coi MATCHED chung là thành công.
- `settle` khóa nguồn trước Path và gọi `markClosed` sau khi settlement và các
  side effect completion hiện có thành công, trước commit. HTTP/worker dùng chung
  flow; nhánh already-settled chỉ no-op khi Request và Path đã nhất quán.
- Tất cả Session hoàn tất nhưng dispute window còn mở hoặc settlement lỗi:
  Request vẫn MATCHED. TWO_WAY hoàn tất một plan chưa được CLOSED.
- Legacy mismatch không được chữa ngầm bằng replay. Trả 409 và ghi nhận để rà
  soát; không tự đưa Request CANCELLED về MATCHED hay gọi lại ledger để sửa bài.

Mã lỗi đề xuất: `REQUEST_LOCKED` (cancel sau khóa), `REQUEST_ALREADY_MATCHED`
(Path nháp khác cố finalize), `REQUEST_LIFECYCLE_INCONSISTENT` (nguồn/bằng chứng
mâu thuẫn). Giữ `REQUEST_VERSION_CONFLICT` cho version cũ và
`REQUEST_NOT_AVAILABLE` cho nguồn không hợp lệ. Lỗi mới dùng envelope 409 hiện
có, không cần mở rộng HttpExceptionFilter/details. Wrong owner vẫn 404.

## 4. Rà soát dữ liệu cũ: chỉ đọc và preview

Thêm `scripts/reconcile-learning-requests.mjs`, dùng `pg` và helper UTC hiện có,
không bootstrap Nest để tránh khởi động worker. Bắt buộc env riêng
`LEARNING_REQUEST_RECONCILIATION_DATABASE_URL`, không fallback DATABASE_URL và
không in URL/credentials. Mặc định/duy nhất là dry-run; không có --apply.

Đọc trong transaction REPEATABLE READ READ ONLY; page theo request UUID với
`--limit` 1..1000 (mặc định 200) và `--after` UUID. Một page dùng snapshot riêng,
không tuyên bố toàn bộ nhiều lần chạy là một snapshot. Trả nextCursor và giờ DB.
JSON chỉ có IDs, version, trạng thái và evidence cần xem xét; không có nội dung
chat, thông tin cá nhân hoặc số dư ví.

Mọi marker LOCKED/appliedVersion đều là evidence cam kết, kể cả thiếu version.
Trước đề xuất repair phải đối chiếu version lịch đã apply, items, xác nhận và đúng
một Session history chưa supersede khớp ngày/giờ hiện hành. Lịch mới đang chờ
reschedule không làm mất hiệu lực lịch cũ; dữ liệu thiếu/mâu thuẫn là MANUAL_REVIEW.

| Kết quả                | Điều kiện / preview                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NO_CHANGE              | Trạng thái phù hợp và evidence nhất quán. Riêng không có Path khóa: chỉ hợp lệ với Request trước MATCHED, nguồn hợp lệ và hoàn toàn không có evidence cam kết.                                                    |
| NEEDS_REPAIR / MATCHED | NEGOTIATING, đúng một Path khóa; nguồn, lịch/Session và Hold đầy đủ, nhất quán.                                                                                                                                   |
| NEEDS_REPAIR / CLOSED  | Path COMPLETED, mọi Session COMPLETED và settlement SUCCESS/snapshots khớp; đề xuất chuỗi NEGOTIATING → MATCHED → CLOSED hoặc MATCHED → CLOSED.                                                                   |
| MANUAL_REVIEW          | Nhiều Path khóa, nguồn/participants mismatch, lock/Hold/Session/settlement thiếu hoặc mâu thuẫn, Request CANCELLED mà đã có cam kết, hoặc trạng thái không thể suy ra chắc chắn. Không chọn Path mới nhất để sửa. |

Output có expectedRequestVersion, candidatePathId, evidence và proposedTransitions.
Không xóa history, không Hold/settle/refund, không chuyển trạng thái thật. Tests
xác nhận DB/ledger/audit/outbox không bị sửa.

Kiểm inconsistency trước khi phân loại NO_CHANGE: MATCHED/CLOSED mà không có
Path đã chốt, hoặc có Session/Hold nhưng thiếu lockedVersion, luôn MANUAL_REVIEW.
Request đã CANCELLED chỉ NO_CHANGE khi không có evidence cam kết và nguồn/history
không mâu thuẫn; không dùng nhánh không có khóa để che dữ liệu tài chính thiếu.

## 5. Kiểm chứng và rollout

Unit/HTTP tests xác minh source mới sau build. PostgreSQL thật trên schema test
cách ly bắt buộc cho cancel-vs-finalize (cả hai bên thắng), hai finalize khác Path,
retry, failure injection và settlement rollback. Mock không chứng minh race/rollback.
Test ONE_WAY/TWO_WAY và direct exchange; retained Chat/drafts, owner/version,
status regression có lockedVersion, worker replay và thiếu/mismatch nguồn.

Không deploy trong công việc này. Trước rollout trên dữ liệu đang có: chạy preview
sơ bộ, review các NEEDS_REPAIR/MANUAL_REVIEW và chuẩn bị thay đổi dữ liệu được duyệt
riêng. Trong cửa sổ rollout được cho phép, dừng nhận và drain mọi HTTP writer
tạo/chốt/hủy thỏa thuận/Request cùng settlement workers; đợi transaction cũ kết
thúc. Chạy preview cuối và sửa dữ liệu đã được duyệt khi writers còn dừng; kiểm
lại, rồi chỉ khởi động phiên bản mới. Không chạy mixed versions: bản cũ không giữ
Request lock sẽ tạo mismatch sau preview. Không thêm feature flag mới.
Không bật strict lifecycle trên dữ liệu chưa xử lý vì có thể chặn settlement cũ.
Công cụ apply hoặc việc chạy sửa DB thật cần phạm vi/ủy quyền riêng. Rollback code
không đảo ledger hoặc tự lùi trạng thái; đóng băng rollout nếu xuất hiện mismatch.

## 6. Constitution check

| Nguyên tắc             | Đánh giá thiết kế / gate                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Scope/modular monolith | API-only; reader có owner và DI không vòng; không abstraction chung mới.                            |
| PostgreSQL / atomicity | Request, Path, Session, Hold/settlement và existing outbox cùng tx; real PG races/rollback đã pass. |
| Auth / privacy         | Giữ owner/version/membership; không trả dữ liệu nguồn/DB URL trong error hoặc report.               |
| Contract / UTC         | Không đổi payload thành công; 409 được mô tả trong Swagger/contracts; DB UTC.                       |
| Verification           | TDD theo task; real PG race/rollback bắt buộc trước claim hoàn tất.                                 |
| Owner boundaries       | Reader chỉ đọc; Request ghi qua lifecycle owner; tiền qua port hiện có.                             |
| Retry/jobs             | Reuse idempotency/outbox; worker và HTTP đi qua cùng settle flow.                                   |
| Governance             | Hai quyết định của user đã ghi ở mục 1; strict rollout cần preview dữ liệu cũ.                      |

Không có ngoại lệ Constitution được đề xuất. Người dùng đã duyệt và yêu cầu
triển khai; evidence implementation/runtime local ở [validation](validation.md).

## 7. Review thiết kế

Fresh builder review ngày 2026-10-29 phát hiện hai điểm đã bổ sung: thứ tự phân
loại lỗi dữ liệu phải đứng trước NO_CHANGE; rollout phải drain writers/workers và
không chạy lẫn code cũ/mới. Reviewer không thấy blocker đáng kể khác về linkage,
single-Path, cancel/finalize, settlement owner hoặc DI. Đây là review tài liệu,
không phải phê duyệt của người dùng hay bằng chứng implementation/runtime.

## 8. Final review và kiểm chứng implementation

Fresh final reviewer tìm hai lỗi P2: đảo thứ tự khóa User/Path với các writer
hiện có và preview suy luận từ lịch thiếu evidence. Đã tái hiện deadlock thật
(40P01) ở edit/finalize và review/settlement replay, cùng kết quả phân loại sai
khi thiếu appliedVersion/history. Các regression tương ứng chuyển RED → GREEN.

Helper cụ thể `lockLearningPath` thống nhất sorted participant → Path cho Path,
Schedule, Session, tạo report và tạo review; lifecycle vẫn khóa Request trước Path.
Preview kiểm tra lịch đã apply và history hiện hành, bao gồm reschedule đang chờ
xác nhận. Hai findings đã xử lý; Ponytail không yêu cầu abstraction/dependency
mới. Các policy STT 16, report-resolution, fee/refund/no-show không thuộc lượt sửa.

Các final gates và hướng dẫn preview/rollout được ghi ở [validation](validation.md)
và [quickstart](quickstart.md). Không commit/push/deploy hay repair dữ liệu thật.
