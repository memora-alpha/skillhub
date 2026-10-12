# Data model — Learning Request mobile

Design checkpoint 2026-10-12. Đây là model/projection mobile, không thêm bảng
database hoặc sửa Prisma/backend. [Contract checkpoint](contracts.md) giữ chi
tiết API; [plan](plan.md) ghi phần đã có, Mxx còn cần làm và Bxx dependencies.

## Entity và quan hệ

Learning Request thuộc một owner và một Skill; có các canonical Tag references
và 0..5 preferred time ranges. Auth/session quyết định owner khi tạo; client
không gửi ownerId. Skill/Tag/owner public labels là projections của API.

PreferredSlot là khoảng mong muốn, không phải Session/Schedule đã confirm.
Không có linked Proposal/Path ID trong DTO đang dùng, nên không dựng các link
nghiệp vụ đó từ request ID. Notification thuộc spec riêng.

## API create/edit input

| Field               | Kiểu/giới hạn contract                              | Current mobile                                                                                                 |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| title               | string, 10..120 code points theo text policy server | Client chỉ NFKC/trim/code points, không strip HTML/decode entities; sanitizer/moderation do server quyết định. |
| skillId             | UUID của Skill ACTIVE                               | Picker lookup thật; khóa khi owner publishedAt khác null.                                                      |
| description         | string, 20..3000 code points                        | Bắt buộc; render plain text.                                                                                   |
| learningGoal        | string, 10..1000 code points                        | Bắt buộc; không dùng field mẫu goal.                                                                           |
| currentLevel        | null hoặc NONE/BEGINNER/INTERMEDIATE/ADVANCED       | Chưa khai -> null; NONE là lựa chọn khác.                                                                      |
| verifiedTeacherOnly | boolean, create default false                       | Form Có/Không map boolean; điều kiện kỹ năng người dạy, không phải badge owner.                                |
| tagIds              | Optional max10 UUID distinct ACTIVE                 | API có; current RequestInput/form chưa có Tag edit. PATCH omission giữ tags. Chờ B05.                          |
| preferredSlots      | Array max5 `{startAt,endAt}` RFC3339 offset         | Dữ liệu ngày cụ thể đã lưu, hiển thị riêng và cho xóa; untouched giữ timestamp gốc.                            |
| expiresAt           | Optional/null hoặc future RFC3339 timestamp         | Null dùng hạn default khi publish; kiểm tra custom cuối cùng ở server.                                         |
| expectedVersion     | Safe positive integer                               | Chỉ PATCH/publish/cancel; lấy snapshot server, không tăng ở client.                                            |

PATCH bỏ field giữ nguyên; null chỉ cho currentLevel/expiresAt. Không có status,
moderationStatus, ownerId hoặc arbitrary version trong create. Tag clear trong
contract là `tagIds: []`, nhưng UI hiện chưa có thao tác đó. Không diễn giải
test encode tagIds thành evidence Tag picker đã hoàn thành.

Slots cần startAt > thời điểm kiểm tra và endAt > startAt; không áp duration
60..180 phút của Session. Client hỗ trợ nhập/validate; backend kiểm lại DB clock.
Giữ nguyên timestamp gốc (seconds/milliseconds/offset semantics) khi field không
đổi, không round theo chuỗi hiển thị phút rồi gửi lại mọi field.

## OwnerRequest

`ownerSchema` trong `src/features/learning-requests/types.ts` chọn các field:

| Nhóm             | Fields                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Identity/content | id, skillId, title, description, learningGoal                                 |
| Preferences      | currentLevel, verifiedTeacherOnly, tagIds, preferredSlots                     |
| Lifecycle        | status, moderationStatus, moderationRejectReason, version                     |
| Time             | requestedExpiresAt, expiresAt, publishedAt, createdAt, updatedAt              |
| Read state       | effectiveStatus optional trong parser; owner GET/mine trả, mutation không trả |

Không có skill.name, tags.label hoặc owner.id trong owner DTO. Tên Skill được
resolve qua `/skills/:id`; lỗi dùng nhãn không khả dụng, không gắn Skill mẫu.
Owner tags có IDs thì giữ và ghi rõ tên chưa có lookup. Các field moderation
reviewer/flagged categories không nằm trong allowlist UI người dùng.

`requestedExpiresAt` là lựa chọn nhập, `expiresAt` là deadline đã áp dụng.
DRAFT chưa publish có thể chưa có expiresAt. Default 30 ngày và custom tối đa
90 ngày từ publish là policy backend đang có, không phải rule client độc lập.
Edit/approve không gia hạn; re-publish sau rejected theo kỳ hạn server trả.

## PublicRequest và PublicRequestDetail

| Projection    | Fields                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Summary       | id, title, learningGoal, currentLevel, verifiedTeacherOnly, status, createdAt, expiresAt |
| Public nested | skill `{id,name}`, tags `[{id,label}]`, owner `{id,displayName}`                         |
| Recommended   | Summary + matchScore                                                                     |
| Detail        | Summary + description, preferredSlots, version                                           |

Không có private contact, evidence, budget, số buổi, exchanged skill, reputation,
memberSince hoặc avatar URL trong projection này. Avatar dùng initials fallback,
không gán ảnh/badge của fixture. Không trải raw owner/moderation DTO vào public UI.

## SkillOption và Tag readiness

Current skillSchema chọn `{id,name,status}`; status ACTIVE/INACTIVE/ARCHIVED.
Picker chỉ chọn ACTIVE; query q NFC/trim 2..100 ký tự. Lookup labels không chứng
minh LR Catalog assertion port đã nối. Backend authoritative check vẫn bắt buộc.

Tag object trong public LR là `{id,label}`. B05 cần contract lookup có canonical
ID/label/ACTIVE policy và pagination, trước khi mở Tag selection/filter/clear.
Không đặt endpoint hoặc quan hệ Skill/Tag mới ở data model này.

## Page và cache identity

Envelope list: `data: T[]`, `meta.pagination: {limit,nextCursor,hasMore}`.
Mobile Page giữ items/nextCursor/hasMore; hasMore phải khớp việc có nextCursor.
Không có total. Cursor opaque, gắn scope/filter/actor và recommended snapshot.

Query key hiện tại bắt đầu `['learning-requests',userId,generation]`; list thêm
scope/filters, detail thêm id, Skill lookup thêm id/q. Infinite cache giữ pages và
pageParams; đổi filter/session không tiếp tục cursor của key cũ. Cancellation
không thay session guard: result của generation cũ vẫn phải bị bỏ.

Feed/mine: createdAt DESC,id DESC. Recommended: matchScore DESC rồi createdAt
DESC,id DESC. Tag ANY kết hợp AND với keyword/Skill; mobile không sort cục bộ.

## Draft và recovery state

Current RequestDraft giữ title/skillId/description/learningGoal strings,
currentLevel enum hoặc chuỗi rỗng, verifiedTeacherOnly Có/Không, slots/expiry
chuỗi giờ thiết bị. React Hook Form giữ input; initial snapshot trong memory dùng
để diff PATCH và giữ untouched timestamps. Logout/account switch unmount/reset.

UI2026-10-12 sau correction của user: RequestDraft thêm weeklyAvailability string
JSON cho các rows `{weekday: MON..SUN hoặc rỗng, startTime, endTime: HH:mm hoặc rỗng}`.
Đây chỉ là representation draft, không thuộc RequestInput/response. Max5, đủ thứ/
hai giờ, end>start trong cùng ngày, không overlap cùng thứ; không áp60–180 phút.
Chọn thứ khác giữ clock; Hủy picker không thay draft, Xong mới cập nhật. Save disabled
khi có weekly rows; draftToInput còn guard từ chối trước HTTP, không silent drop
hoặc tạo ngày giả. Conflict keep draft giữ weekly choices, discard/logout xóa.
Contract weekly thật còn pending B08; đề xuất preferredAvailability gồm IANA
timeZone và weeklySlots, chưa gửi API hoặc suy lịch lặp từ preferredSlots cũ.
Timestamp field untouched vẫn giữ seconds/milliseconds từ snapshot server;
clear ranges/expiry giữ semantics []/null. Chỉ expiry còn picker ngày/giờ theo thiết bị.

Thiết kế M01 bổ sung hai bản tách biệt trong cùng editor: user draft hiện tại và
latestServer snapshot đọc lại sau conflict. Chỉ explicit user choice mới chọn
baseline mới để tiếp tục edit; không silent merge hoặc tự dùng version mới.
Không lưu bản nhập qua logout/offline. Read failure không xóa draft gốc.

Mutation state gồm pending, failure và blocked unknown/conflict; đây là client
control state, không phải business status. Pending khóa submit/fields/navigation.
M04 kiểm ID targeted result trước khi chuyển nó vào detail/cache/toast/navigation.
Success sync detail + invalidate mine/feed/recommended; failure không giả success.

## State transitions mobile được phép yêu cầu

| State hiệu lực     | Edit  | Publish | Cancel LR     | Transition authority                                          |
| ------------------ | ----- | ------- | ------------- | ------------------------------------------------------------- |
| DRAFT              | Có    | Có      | Có            | Create -> DRAFT; publish -> OPEN/PENDING; cancel -> CANCELLED |
| OPEN               | Có    | Không   | Có            | Edit re-moderation -> OPEN/PENDING; expiry/lock do server     |
| PENDING_MODERATION | Có    | Không   | Có            | Edit re-moderation; Staff approve/reject ở backend            |
| REJECTED           | Có    | Không   | Có            | Edit có thay đổi -> DRAFT, rồi publish riêng                  |
| NEGOTIATING        | Không | Không   | Có trước lock | Cancel kiểm authoritative lock reader                         |
| MATCHED/CLOSED     | Không | Không   | Không         | Chuyển sang luồng Path/Schedule ngoài scope                   |
| CANCELLED/EXPIRED  | Không | Không   | Không         | Chỉ đọc history/state hiện tại                                |

Skill chỉ đổi trước lần publish đầu: DRAFT sau reject không tự cho đổi nếu
publishedAt còn có giá trị. No-change edit không PATCH và không reset REJECTED.

GET có effectiveStatus EXPIRED cho OPEN/PENDING quá hạn khi worker chậm. Không
local-expire NEGOTIATING/MATCHED/CLOSED. Thiết kế M02 dùng local deadline để yêu
cầu GET trước action, editor deep link và PATCH có thay đổi khi form mở qua
deadline, rồi xét effectiveStatus/version backend. Version đổi qua đối chiếu/
explicit choice M01; GET lỗi khóa mutation và giữ draft cùng phiên. Không GET
loop vì clock lệch. Network/503 giữ last-read với notice stale; GET detail404/403
ẩn cached server content/reason và khóa action đến read success đúng phiên (M05).
Mutation403/429 giữ input cùng phiên, không tự gửi lại và không suy quyền đọc từ
kết quả mutation; Auth/logout vẫn quyết định tuổi thọ draft.

## Implementation checkpoint 2026-10-12

Editor source giữ `initial` (baseline), RHF draft, `latest` và mode
compare/unknown/readonly/expiry/denied trong memory của mounted form. GET thành
công chỉ cập nhật latest; explicit keep/discard mới thay baseline. Keep giữ
field local đã đổi và nhận field server chưa chỉnh; publishedAt mới khóa Skill.
No-change sau baseline được chấp nhận vẫn không PATCH.

Read-denial marker nằm trong query metadata cùng resource/session generation,
không lưu persistence. GET404/403 latch đến GET success đúng phiên, kể cả remount
rồi network/503; mutation response không tự clear/read-deny marker. Query cleanup
khi logout/đổi generation xóa marker; không giữ draft qua Auth expiry/logout.
Các helper request-preflight/read/recovery/list-query và hooks sử dụng model này;
[validation](validation.md) tách automated/web với API/native còn Pending.
