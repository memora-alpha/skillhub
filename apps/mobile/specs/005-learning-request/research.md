# Research — Tiếp tục Learning Request mobile

Ngày rà soát: 2026-10-12. Nhánh `feat/mobile-learning-request`, HEAD `c52ec74`
cộng working-tree implementation đã có. Đây là source/design audit, không phải
lần chạy API/native mới. Giữ nguyên spec, contracts checkpoint, tasks, checklist
và validation trước planning.

**Sau implement2026-10-12:** Các phần "chưa" trong R03/R04/R05/R07 bên dưới là
source audit trước thay đổi. M01..M05 đã có source/regression; M06 có harness
loopback và web evidence, không còn dùng script tạm ngoài repo. Native/Tag/API
thật vẫn Pending. Kết quả thực hiện và giới hạn transport replay xem
[validation](validation.md), [fixtures](validation/fixtures.md) và [tasks](tasks.md).
Không thay decisions/scope planning hoặc biến fixture thành backend readiness.

## Nguồn và kết quả

- SRS 1.6: đọc nội dung Word mục 6.4, 18.10 và BR-07..12. FR-LR-01..08,
  LR-001..009 vẫn khớp phạm vi đã chốt: request/moderation/search, owner cancel
  trước lock, không self-proposal; accept chỉ mở negotiation. Notification Reject
  vẫn là DEP-01/spec riêng, không bị loại bỏ khỏi yêu cầu SRS tổng thể.
- [Spec](spec.md), [contracts](contracts.md), [tasks](tasks.md),
  [checklist](checklist.md), [validation](validation.md) và mobile README/docs.
- Mobile `src/features/learning-requests`, Profile/Search/Discovery/Auth routes,
  shared HTTP và tests. Các task tick đều có source tương ứng; các AC đầy đủ
  vẫn mở do thiếu real-runtime/native evidence.
- Backend controller/DTO/use cases/dependency wiring được đọc để xác minh,
  không sửa backend và không gọi mutation. B01..B06 trong [plan](plan.md) là
  điều kiện của owner API, không phải task backend được giao trong nhánh này.

## R01 — Tiếp tục feature hiện có

**Decision**: Dùng spec 005 và source hiện có. Chỉ thêm plan/research/data model,
contracts theo interface và quickstart. Tasks/checklist giữ nguyên byte và dấu tick.

**Rationale**: Các task đã tick có API/runtime source. Tạo lại spec sẽ làm mất
history và dễ kéo notification/Proposal hoặc mock policy vào scope.

**Alternatives considered**: Chạy specify mới hoặc thay tasks bằng template —
không phù hợp yêu cầu giữ công việc đã hoàn thành. Câu “Bản Draft...chốt gaps
trước plan/tasks” được ghi nhận ở checkpoint plan; sau analyze I1 đã cập nhật
wording trong spec để phản ánh plan/tasks và phần mobile hiện có. Đây là sửa
mô tả trạng thái tài liệu, không đổi requirement hoặc xác nhận API/native ready.

## R02 — API và trạng thái do server quyết định

**Decision**: Giữ HTTP/Auth session transport và Query key theo user/generation.
Parse allowlist owner/public và pagination meta; không dùng DTO backend trực tiếp
trong mobile. effectiveStatus ưu tiên khi GET/mine có; mutation dùng status rồi
invalidate/refetch. Không tự chuyển state từ time hoặc chat.

**Rationale**: Owner payload không có public Skill/Tag/owner labels. Readiness
Skills HTTP độc lập với LR internal Catalog. Không có contract idempotency LR.

**Alternatives considered**: Local store mirror, optimistic publish/cancel,
client moderation, fake success/fallback fixtures — không giữ authority/session.

**Evidence**: `context.tsx:18`, `api/requests-api.ts:47`, `types.ts:23`,
`utils/request-policy.ts:22`; backend contracts checkpoint giữ nguyên.

## R03 — Conflict và unknown outcome

**Decision**: Bổ sung M01/M04: giữ transient draft trong editor để đọc/đối chiếu
bản server mới; mọi targeted mutation xác nhận response.id đúng target trước
sync/toast/navigation. Người dùng quyết định tiếp tục theo snapshot mới; không
auto resend, nâng version hoặc merge giữ một bản overwrite không được chọn.

**Rationale**: Hiện 409 khóa resend và giữ form, nhưng “Kiểm tra yêu cầu đã lưu”
dismissTo detail làm unmount draft (`request-editor-screen.tsx:95`). Detail/Skill
reads kiểm ID; edit/action chưa kiểm (`requests-api.ts:90-107`). Test wrong ID
hiện chỉ chứng minh detail, không chứng minh targeted mutation.

**Alternatives considered**: Dismiss rồi dựng lại từ cache, tự tăng version,
lưu draft qua logout/offline hoặc tìm create result theo title — sai scope hoặc
không biết request đã commit. Unknown create vẫn cần Mine và quyết định thủ công.

## R04 — Expiry và freshness

**Decision**: M02 dùng deadline như tín hiệu cần đọc lại, không như quyền sửa
server state. Cached OPEN/PENDING quá hạn cần GET trước edit/cancel, editor deep
link và trước PATCH có thay đổi khi form mở qua deadline. GET lỗi chặn mutation
và giữ draft cùng phiên; GET success xét effectiveStatus/version mới, version
đổi cần đối chiếu M01/explicit choice thay vì auto rebase/PATCH. Không lặp GET
do clock lệch. M05 chỉ giữ last-read với notice cho network/503; GET detail404/403
ẩn cached server content/reason và khóa action đến read success đúng phiên.
Mutation403/429 giữ input cùng phiên, không auto resend; account không ACTIVE,
thiếu grant và policy hạn chế hoạt động mới được kiểm riêng theo backend/Auth.

**Rationale**: `request-detail-screen.tsx:39` dùng cached version trực tiếp;
`use-requests.ts:12` chỉ refetch khi focus/foreground. `request-policy.ts:22`
đã không tự local-expire state, cần giữ điểm đúng đó. `request-content.tsx` đọc
reason từ response; wording stale chưa cụ thể.

**Alternatives considered**: Timer tự ghi EXPIRED hoặc tự coi MATCHED/CLOSED
expired — không đúng scope trạng thái. Polling/realtime mới chưa được chốt.

## R05 — Cursor recovery cần regression trước

**Decision**: Test nhiều page, snapshot đổi, `INVALID_REQUEST_CURSOR`, filter/
session race, transient next-page fail. Giữ refetch hiện có nếu test chứng minh
nó rebuild chain đúng; bổ sung restart-from-first-page và UX riêng khi cần.
Chặn load-more trong lúc query đang fetch; không auto retry mọi HTTP 400.

**Rationale**: Backend cursor lỗi trả HTTP 400 `message: INVALID_REQUEST_CURSOR`
(`list-learning-requests.use-case.ts:184`), khác INVALID_REQUEST_QUERY.
`readPayload` đưa message chỉ dạng mã an toàn vào AppError.code; không cần
top-level code mới. Current list có opaque cursor và query-key filter nhưng
chưa có regression cho recovery chain và fetch-more cạnh tranh refetch.

TanStack v5 refetch infinite query bắt đầu page đầu và xây lại cursor của các
page tiếp theo. Vì thế không đủ căn cứ nói `query.refetch()` luôn phát lại cursor
cũ hoặc chắc chắn không phục hồi snapshot. Removing/resetting query có thể
restart về nhóm đầu; test sẽ quyết định chỗ cần thay đổi. Nguồn:
[Infinite Queries](https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries).

**Alternatives considered**: Đảo/lọc trên page ở client, decode cursor hoặc retry
cursor cũ vô hạn — không thỏa FR-24. Reset tất cả HTTP 400 — che query validation.

## R06 — Tag và backend readiness

**Decision**: B05 chặn thiết kế endpoint/picker/clear/filter Tag cụ thể cho đến khi
owner API chốt canonical lookup. Current edit giữ tagIds bằng omission; public
tags dùng labels đã trả. Không ghi Tag clear UI là implemented.

**Rationale**: DB Tag/RequestTag tồn tại không chứng minh có HTTP lookup. Mobile
RequestInput hiện chưa có tagIds và form không cho sửa Tag. Các method Catalog,
owner projection, lock và matching của UnavailableLearningRequestDependencies
vẫn trả 503; eligibility thực tế dùng DB clock/Reputation.

**Alternatives considered**: Đoán `/tags`, nhập tên text, Skill UUID thay Tag UUID,
hoặc nối backend ngay từ plan mobile — vượt scope/contract.

**Readiness distinction**: Mine/own detail không gọi các adapter trên; feed rỗng
có thể success. Cancel NEGOTIATING mới cần lock reader; không gắn nhãn mọi cancel
blocked. Real acceptance cần dữ liệu có item và các adapter authoritative.

## R07 — UI, native và phạm vi evidence

**Decision**: Giữ font Nunito/theme/common card/filter UX đã được user chốt;
chỉ sửa UI phát hiện qua AC hoặc recovery cần thiết. Không redesign thêm hoặc
thêm native dependency ở phase plan. M06 tách fixture logic và native checks.

**Rationale**: Validation có web 360/390, 102 tests (10 LR tests), chưa có
Android/iOS, width 320/375/430 hoặc font scale 130%. Fixture server UI trước đó
là process tạm ngoài repo; chưa có harness tái lập được chia sẻ trong source.

**Alternatives considered**: Tick native từ web, coi helper tests là E2E, bỏ
dependency gap khi suite xanh — không đủ căn cứ.

## Kết luận cho Phase 1

Không có unknown về stack hoặc quyết định kỹ thuật cần đoán để thiết kế phần
mobile đã có contract. B05/B06 và integrations ngoài scope vẫn Pending với owner/
điều kiện mở khóa; không “giải quyết” bằng contract hoặc policy tự đặt.
Phase 1 có thể hoàn tất cho M01..M06; Tag interface cụ thể và real acceptance
tiếp tục chờ. Không hạ task đã tick, không tick thêm AC ở bước research.
