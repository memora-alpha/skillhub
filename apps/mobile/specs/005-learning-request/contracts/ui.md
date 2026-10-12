# UI behavior contract — Spec 005

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
