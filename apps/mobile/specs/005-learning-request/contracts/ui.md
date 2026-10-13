# UI behavior contract — Spec 005

## Refresh2026-10-13

Form thêm nội dung có thể dạy, own public Sharing Skill multi-select, Tag lookup/
pagination/search và Credit mong muốn mỗi giờ. Chọn tối đa10, giữ selected IDs
chưa resolve label; lỗi lookup có retry, không thay dữ liệu mẫu. Weekly Save đã mở,
timezone editable và reopen giữ zone gốc. Legacy slots giữ/xóa riêng; weekly mới
thay lịch ngày cũ khi lưu. Card/detail có overview/offerings/credit/weekly từ BE.
Discovery có Tag selector ở panel draft, Apply gửi repeated IDs, Close bỏ draft,
Reset chờ Apply, chip xóa filter. Giữ lifecycle/Back/session/recovery; nghiệm thu
native/API thật tách riêng. Ghi chú layout/contract chưa có ở checkpoint cũ bên
dưới không áp dụng cho extension mới.

Design checkpoint 2026-10-12; giữ UI/scope đã chốt. Mxx là phần cần bổ sung,
không diễn giải thành source đã implement. Xem [plan](../plan.md) và
[HTTP contract](http.md).

## Entry points và navigation

| Entry/route                  | Hành vi                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| Profile -> /requests         | Yêu cầu của tôi, own API list và hàng tab status ngang             |
| /requests/new                | Create draft, không tự publish hoặc hold Credit                    |
| /requests/:id                | Own detail/state/reason, edit/publish/cancel khi được phép         |
| /requests/:id/edit           | Saved snapshot + draft; chỉ state cho phép, Skill khóa sau publish |
| /discover                    | Real feed; search cạnh nút Lọc, panel inline, applied chips        |
| /search tab Learning Request | Chuyển keyword tới Discovery real flow                             |
| /request/:id                 | Public detail; own projection chuyển own route                     |
| /explore/requests/:id        | Guest fixture preview; không gọi real LR API                       |

Auth gate áp dụng luồng thật. UUID validation trước HTTP. Back dùng history,
fallback own -> /requests (My Requests -> /profile), public -> /discover.
Create success replace editor bằng own detail; edit success dismissTo detail,
Back tiếp về màn trước editor, không push thêm editor/list.

Trong lúc pending fields/submit/back/tab actions khóa; hardware Back/gesture
phải giữ form mounted. Logout/account switch không giữ private draft/cache qua
phiên mới. Unknown mutation không hiển thị toast success hoặc tự điều hướng.

## Mine và Discovery

Mine có status server filter và clear bằng Tất cả; không dựng count theo trạng
thái từ một page. Discovery chỉ keyword/Skill UUID/scope feed-recommended hiện
tại. Áp dụng thay query; Đóng bỏ filter draft chưa apply; Đặt lại sửa draft rồi
Áp dụng mới có hiệu lực. Chip xóa một filter đang áp dụng. Search debounce hoặc
submit dùng keyword mới, clear phục hồi page đầu. Filter/query change không
giữ cursor hoặc kết quả muộn của key cũ.

Card dùng real title/learningGoal/level/state/date và public Skill/Tag/owner
projection. verifiedTeacherOnly là yêu cầu về kỹ năng người dạy, không badge owner.
Không thêm budget/số buổi/reputation/demo avatars hoặc sort control giả. Nhãn
“Đã tải N yêu cầu” chỉ đếm items đang có; “Mới nhất” không phải sort API tùy ý.

Loading, truly empty, filtered-empty, initial error, refresh error và next-page
error cần phân biệt. M03 kiểm footer/retry khi page sau lỗi và không chặn xem
items đã tải. Recommended503 hiển thị chưa khả dụng; user chọn feed bình thường
có chủ ý, không silently dùng feed dưới nhãn recommended.

## Editor và field behavior

Field mapping/limits theo [data model](../data-model.md); Vietnamese errors,
labels và hints dùng font/theme chung. Client chỉ NFKC/trim/đếm code points,
không strip HTML/decode entities hoặc mô phỏng moderation; server quyết định.
Skill API lỗi/empty/inactive không fallback
preview IDs. Tag picker/filter/clear giữ deferred B05; owner IDs không bị mất
do edit field khác. Public labels có thì hiển thị plain text.

preferredSlots cũ theo giờ thiết bị; HTTP vẫn RFC3339 tuyệt đối, max5/end>start,
không biến thành Session. Field thời gian untouched giữ exact server timestamps;
changed field kiểm thời điểm submit, test delayed submit trong M06. Deadline
custom do server quyết định giới hạn; không hứa clock client authoritative.

Correction UI2026-10-12: thời gian ưu tiên chọn thứ từ Thứ2..Chủ nhật và clock
Từ/Đến; clock disabled trước khi chọn thứ. Weekly draft max5/end>start/no overlap
cùng thứ; không duration cap của Session. HTTP chưa có lịch tuần: giữ choices
trong form, notice "Lịch theo tuần chưa hỗ trợ lưu.", Save disabled và conversion
guard. Không map sang ngày cụ thể hoặc gửi contract tự đoán. B08 mở mới tích hợp.
preferredSlots cũ hiển thị "Khoảng ngày đã lưu", chỉ giữ/xóa; không suy thành tuần.
Thêm giờ rảnh khóa ở5. Không còn textarea hoặc placeholder ISO yêu cầu nhập tay.
Picker giữ lựa chọn tạm, Hủy không sửa form, Xong mới áp dụng; pending/conflict
khóa picker và bỏ lựa chọn chưa xác nhận. Xóa range cuối gửi explicit preferredSlots
[]; Dùng hạn mặc định clear custom expiry thànhnull. Hạn đăng bài dùng calendar
React Native chung để số ngày theo font app12/lineHeight18, thứ11/header13,
ô ngày cao tối thiểu44 và không phụ thuộc font của native graphical picker. iOS clock
dùng Expo UI SwiftUI wheel; Android dùng Expo UI compatibility picker; web hour/minute selects13.
Field giờ dùng font theme13 và full-width để native picker không bị ép nửa hàng. Native device
evidence vẫn tách khỏi typecheck/bundle/web.

Save chỉ điều hướng sau parsed success. No-change giữ form và thông báo không
thay đổi, không PATCH. M01 bổ sung latest-server comparison cho409 ngay trong
editor: giữ draft, version snapshot gốc, đọc mới không tự thay baseline; user
chọn bỏ draft hoặc tiếp tục có chủ ý. Quyền/state mới không cho sửa thì khóa.
Read network/503 lỗi giữ draft và báo chưa so sánh được. GET detail404/403 chuyển
sang unavailable/không được phép, ẩn baseline/reason và khóa mutation, giữ draft
trong bộ nhớ cùng phiên cho đến khi thoát hoặc đọc lại thành công; không hiển thị
snapshot bị từ chối như còn quyền truy cập. Không giữ draft qua logout.
Mutation403/429 giữ input nếu session còn hợp lệ, không success/auto resend;
401 theo Auth chung. Unknown create hướng dẫn Mine,
không ghép kết quả theo title hoặc tự POST lại.

## Detail, moderation và action authority

Own status và moderationStatus là hai trục khác nhau. REJECTED hiển thị reason
từ snapshot server hiện tại; edit/re-publish thành công không tái dùng reason
cũ nếu response đã bỏ. Không dựng flagged keywords/reviewer metadata cho user.

Refetch focus/foreground/manual lấy state bên ngoài. M05: network/503 giữ dữ liệu
lần đọc trước với notice stale, không gắn reason/OPEN cache với quyết định mới.
GET detail404 -> unavailable, GET detail403 -> không được phép; cả hai ẩn cached
content/reason và khóa action đến khi GET success đúng phiên. Không áp quy tắc
ẩn resource cho mutation403 chỉ vì thao tác bị từ chối. Retry success cập nhật
snapshot, không tự approve từ time.

M02: Cached OPEN/PENDING deadline đã qua cần GET trước edit/cancel, khi vào editor
bằng deep link và trước PATCH có thay đổi nếu form mở qua deadline. Loading/
navigation guards áp cả read và mutation. GET lỗi chặn action, giữ draft cùng
phiên, xử lý404/403 theo M05; GET success xét effectiveStatus/version mới.
State không editable thì khóa; version đổi phải đối chiếu/explicit choice M01,
không tự thay baseline/PATCH lại. Không local viết EXPIRED, áp deadline cho
NEGOTIATING/MATCHED/CLOSED hoặc lặp GET do clock lệch.

Cancel có confirmation; Giữ yêu cầu không POST. NEGOTIATING gọi cancel nhưng
server kiểm lock,503 giữ trạng thái. MATCHED/CLOSED/CANCELLED/EXPIRED không cho
edit/publish/cancel LR. Không dựng link Path/Session khi response không có ID.

Real public detail hiện chỉ giải thích Proposal/public profile chưa tích hợp;
không vào form/store mock. Notification inbox/push/mark-read/deep link thuộc
spec riêng, owner reason vẫn đọc trực tiếp từ LR.

## Accessibility và evidence

Nunito/theme/signed-in chrome chung, card/section/control tái sử dụng. Status
không chỉ bằng màu; có labels và selected/disabled/expanded states. Test content
tiếng Việt dài, font scale130%, width320/375/430, safe area/keyboard/scroll để
không che CTA. Các width360/390 web trước đây là evidence bổ sung.

AC-16 cần Android và iOS: keyboard open/close, hardware Back/pending, gesture,
orientation/safearea/font. Fixture không chứng minh backend state/permission;
source có usePreventRemove không chứng minh hardware Back đã qua trên native.

## Implementation checkpoint 2026-10-12

M01 comparison/explicit choices, M02 expiry preflight, M03 paging footer và M05
cached-denial/last-read notice đã có source/fixture evidence. AppHeader/layout
expose disabled Back/header khi page pending; defaultfalse cho consumers khác.
Browser390 journeys và editor320/375/430 không overflow ngang; đây không phải
nghiệm thu font130%/keyboard/gesture native. Xem [validation](../validation.md)
và [fixtures](../validation/fixtures.md); các AC đầy đủ và gates vẫn mở.

## Form presentation — 2026-10-13

Theo mẫu HTML user cung cấp, editor dùng năm card: Nhu cầu học, Bạn có thể dạy,
Tùy chọn học tập, Thời gian ưu tiên và Hạn đăng bài. Input bo tròn, section có icon,
CTA lưu cố định dưới vùng cuộn. Giữ Nunito/theme và hành vi lưu nháp trước khi đăng;
không hiển thị lời hứa autosave hoặc tự publish sau khi lưu.

Kỹ năng dạy chỉ hiện chips đã chọn và nút mở danh sách. Khi mở có search tiếng Việt
có/không dấu, tối đa sáu lựa chọn ban đầu và Xem thêm. Search đọc tiếp từng page của
own skills vì endpoint hiện không có q; lỗi page giữ lựa chọn và có retry. Chỉ offering
công khai, chưa archive và Skill ACTIVE được thêm; giữ giới hạn 10 và explicit clear.

Bài mới lấy IANA timezone thiết bị từ requestDefaults; không cần nhập tay. Chỉ hiện
chú thích Giờ theo thiết bị cùng GMT offset. Bài có lịch tuần giữ timezone server đã
lưu; nếu khác thiết bị, hiện timezone của lịch đã lưu và không đổi giờ/ngày âm thầm.
Lịch tuần gửi weekday/HH:mm cùng IANA timezone; expiry vẫn là thời điểm UTC.

## Request detail presentation — 2026-10-13

Theo mẫu HTML mới: summary có accent strip, status pill, skill/level và
created/expiry metadata. Nhu cầu và mục tiêu gom trong một card; offering/teaching
text/Credit và weekly availability tách card riêng. Chỉ hiển thị dữ liệu contract;
không dựng badge giá Tiêu chuẩn hoặc iOS status/home indicator giả.

Không có nút Tải lại trạng thái ở normal detail. Focus/foreground và mutation sync
vẫn đọc trạng thái hiện tại. Draft publish đặt trong footer cố định; chỉ owner được
phép đọc thấy footer, state khác DRAFT ẩn. Edit và cancel/confirmation giữ policies,
version/preflight/session guards. Lỗi publish xuất hiện trong footer cùng thao tác
Thử kiểm tra lại (GET/reconciliation), không tự resend mutation. Read-denied và
network/stale reads giữ UI phục hồi đã có; lỗi không bị giấu khi bỏ reload thường trực.

Typography follow-up: dùng Nunito và tokens chung: title20/28, heading17/24,
body15/22, secondary13/18. Compact section chỉ thu padding/icon, không thu nhỏ
font tiêu đề. Labels dùng sentence case; skill và current level tách khỏi ngày tạo.
Ẩn moderation badge khi NOT_REQUIRED; trạng thái kiểm duyệt khác và reject reason
vẫn hiển thị. Trao đổi gồm teaching overview, kỹ năng với trình độ/xác minh, rồi
Credit và ghi chú; lịch tuần chỉ hiện tên thứ và khoảng giờ, không lặp chip thứ.

Subsection emphasis follow-up: Nhu cầu học tập, Mục tiêu kỳ vọng, Bạn có thể dạy,
Kỹ năng chia sẻ và Credit mong muốn dùng NunitoBold/body15 màu primary. Offering
card giảm padding dọc về8, tên/trình độ/xác minh đặt trong một hàng có wrap; không
cắt tên kỹ năng dài hoặc bỏ trạng thái xác minh. Áp dụng cho shared request detail.

## Compact list cards — 2026-10-13

Card trong Yêu cầu của tôi không hiển thị tên/avatar. Header chỉ có thời gian tạo
và status từ effectiveStatus; tiếp theo title tối đa2 dòng, tối đa3 chips cho skill,
current level và public tags nếu projection có labels. Không đưa goal, teaching
overview, offered skills, weekly schedule, teacher restriction hoặc expiry lên card;
những dữ liệu đó vẫn đọc trong detail. Footer có Credit mong muốn theo giờ và Xem
chi tiết; không suy giá theo lộ trình từ mẫu ảnh, không hiển thị0 khi Credit chưa đặt.
Public feed dùng cùng layout gọn, vẫn có owner identity để phân biệt người đăng.
Toàn card là một button mở route hiện có, CTA footer không tạo nested button.

## Compact create action in learning hub — 2026-10-13

Bỏ intro Bạn muốn học gì tiếp theo và phần mô tả dưới intro khỏi own list.
Nút Đăng nằm trong rightAction của header Hành trình của tôi, chỉ hiện ở tab
Yêu cầu học; tab Lộ trình không có nút tạo Learning Request. Compact control
cao tối thiểu36, font secondary13, icon14, hitSlop4; không đặt height cố định
để text scaling vẫn tăng chiều cao. Giữ route /requests/new. Legacy own-screen
consumer cũng có create action trong header; feed giữ create control hiện có.

Learning hub width follow-up: khi MyRequestsContent nằm trong khung Hành trình
của tôi đã có gutter16, list bỏ padding ngang riêng20 để tránh lề cộng dồn36.
Card, bộ lọc và summary thẳng hàng với tab, cách mép khung16 mỗi bên; legacy own
screen và public feed vẫn giữ list gutter mặc định. Nội dung card giữ gọn như trên.

## Shared detail design from supplied HTML — 2026-10-13

Detail dùng bố cục chung: hero status/title/skill và topic tags, nhu cầu + mục tiêu,
card kỹ năng dạy lại xanh nhạt, lịch rảnh theo thứ, Credit riêng, cuối cùng là người
đăng chỉ trên public detail. Card radius24/padding18, Nunito/title20/heading17/body15
và secondary13; giữ chrome/safe area thật, không thay toàn app sang font HTML.
Hero không có accent strip; badge NOT_REQUIRED vẫn ẩn. Tags owner tiếp tục lookup
catalog/paging/retry, không đổi UUID hoặc dựng topic từ mô tả.

Nhiều khoảng giờ cùng thứ gom vào một hàng/chips; giữ nguyên HH:mm/IANA zone,
không chốt Session hay đổi thành ngày giả. Legacy preferredSlots vẫn hiển thị riêng.
Ngân sách phản ánh desiredCreditPerHour (CR/giờ), không hiển thị total lộ trình,
số buổi/duration hoặc mã REQ giả vì không có trong projection. Public requester card
chỉ dùng displayName/id và initials; không dựng Reputation, account verification
hoặc thời gian tham gia từ mẫu.

Owner detail ẩn requester card: DRAFT footer có Chỉnh sửa + Đăng yêu cầu; OPEN/
PENDING_MODERATION/REJECTED footer có Chỉnh sửa. Cancel/confirmation vẫn trong
content theo policy, state không editable không có footer. Publish error vẫn nằm
trong draft footer cùng GET reconciliation; lỗi khác trong content. Giữ guards
pending/blocked/session/version/read-denied và không thêm auto resend/reload thường.

Public footer có Xem hồ sơ mở `/profiles/[userId]` với owner ID và request ID.
Hồ sơ UUID người khác đọc API công khai thật; Back trở về chi tiết yêu cầu theo
history, fallback request ID hợp lệ hoặc Discover. Theo yêu cầu trực tiếp của user,
CTA Gửi đề xuất mở màn mock `/send-proposal` với public snapshot và mode mock-request.
Màn ghi rõ chỉ lưu trong phiên, chưa gửi tới người nhận. ID request/owner trong mock
store có prefix preview riêng; UUID thật chỉ dùng để quay lại chi tiết yêu cầu.
Không gọi Proposal/Chat API; nhánh Proposal riêng tiếp tục sở hữu tích hợp thật.

## Detail hashtag layout — 2026-10-13

Kỹ năng chính hiển thị riêng với icon sách, không thêm dấu hashtag. Trình độ nằm
dưới kỹ năng; nhóm Chủ đề chỉ xuất hiện khi request có tag. Hashtag dùng chip nền
trung tính, padding dọc4, khoảng cách6 và wrap theo chiều rộng khả dụng; label dài
được xuống dòng, không cắt tên. Owner/public dùng cùng kiểu chip và bố cục nhóm.
Owner tiếp tục lookup/paging/retry và giữ placeholder cho ID chưa có tên.

## Compact selection badges — 2026-10-13

SkillSelector and RequestMultiSelect choices use a wrapping badge layout instead
of full-width rows: secondary13/18 text, minimum height36, hitSlop4, gap8 and
bounded labels that wrap without truncation. Selected Skill remains highlighted;
selected Tags/offerings keep their remove action. Search, pagination, disabled/
pending states and10-item limits are unchanged. The shared Skill/Tag selectors
also keep this layout in discovery filters; no filter contract changes.
