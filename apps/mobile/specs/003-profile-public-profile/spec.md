# Spec 003: Hồ sơ cá nhân và hồ sơ công khai

**Ngày cập nhật:** 2026-10-09. **Nhánh:** `feat/mobile-profile`.
**Workspace:** `apps/mobile`. **Trạng thái:** Đã có own/edit profile qua API và
public self-preview; hồ sơ người khác vẫn dùng dữ liệu mẫu. Own/edit đã kiểm chứng
với API thật qua LAN/CORS trực tiếp và Android emulator; iOS/thiết bị thật,
pending Back native và đối chiếu Public Profile Figma còn pending.

## 1. Mục tiêu và nguồn yêu cầu

Người dùng xem đúng hồ sơ của mình, cập nhật các thông tin được phép và xem được
phiên bản công khai mà không lộ thông tin riêng tư. Khi xem người khác, danh tính
và dữ liệu của người đang xem phải tách biệt với hồ sơ đang được mở.

Nguồn nghiệp vụ là [SRS V1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
FR-PRO-01/02/03, PRO-001/002/003, mục 18.7, BR-31 và FR-REV-04.
Spec tuân thủ [AGENTS.md repository](../../../../AGENTS.md),
[domain rules](../../docs/domain-rules.md) và
[API contracts](../../docs/api-contracts.md).
[Plan](plan.md) ghi cách triển khai, dependencies và bằng chứng kiểm chứng.
Theo dõi công việc ở [tasks.md](tasks.md), nghiệm thu ở
[checklist.md](checklist.md) và bằng chứng kiểm chứng ở [validation.md](validation.md).

SRS mô tả sản phẩm đầy đủ; spec này triển khai một phần của FR-PRO-01/02/03.
Danh hiệu và public profile qua API vẫn là phần cần bổ sung,
không được coi là hoàn thành chỉ vì màn hình đã có.

## 2. Phạm vi và dữ liệu

Spec 001 cung cấp foundation; spec 002 cung cấp Auth/account shell, phiên đăng
nhập, HTTP client và own-account API. Spec 003 tái sử dụng các phần này.

| Luồng                                 | Nguồn dữ liệu trong phạm vi hiện tại       | Hành vi                                                          |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Hồ sơ cá nhân `/profile`              | Own account từ API qua Auth spec 002       | Xem tên, avatar, headline, bio và thống kê được hỗ trợ.          |
| Chỉnh sửa `/edit-profile`             | Draft từ hồ sơ đã lưu; lưu qua API hiện có | Sửa `fullName`, `headline`, `bio`, chọn/upload/xóa avatar.       |
| Tự xem `/profiles/[userId]`           | Projection công khai từ own account đã lưu | Không dùng draft chưa lưu hoặc dữ liệu mẫu thay thế.             |
| Hồ sơ người khác `/profiles/[userId]` | Fixture được nhận diện rõ là dữ liệu mẫu   | Xem thông tin công khai, kỹ năng và các trạng thái tải/lỗi/rỗng. |
| Kỹ năng của tài khoản thật            | API own/public self, do spec 004 sở hữu    | Xem trạng thái tải/lỗi/rỗng thật; Quản lý mở My Skills.          |

Theo yêu cầu bổ sung, editor chọn ảnh, preview rồi upload khi Lưu; theo dõi trạng thái
QUARANTINED/CLEAN/REJECTED/DELETED và xóa avatar qua API hiện có. Hủy bỏ ảnh chưa upload.
Không mở rộng phạm vi sang CRUD My Skills, evidence,
timezone/locale setup, title/achievement, reviews, chat/proposal, wallet,
discovery hoặc backend/schema. Các action chưa hỗ trợ chỉ mở thông báo hiện có,
không tạo bản ghi nghiệp vụ hoặc thông báo thành công giả.

Theo yêu cầu bổ sung, sắp xếp lại own profile và Cài đặt: chuyển thông tin riêng
tư vào mục Tài khoản, thêm đặt lại mật khẩu qua luồng OTP hiện có, quản lý đăng
xuất, trợ giúp, giới thiệu và phiên bản app. Thông tin hồ sơ công khai được gộp
vào Trợ giúp; Giới thiệu SkillHub giữ riêng, không có mục Quyền riêng tư.
Thêm entry Múi giờ/Ngôn ngữ/Thông báo để triển khai sau: disabled, ghi “Sắp có”,
không có form hoặc lưu lựa chọn. Không thêm API hay chức năng đổi email/xóa tài khoản.

## 3. Luồng người dùng

### US-01 — Xem hồ sơ của mình (P1)

Người dùng đã đăng nhập mở tab hồ sơ hoặc entry hồ sơ trong account menu để xem
thông tin của đúng tài khoản đang hoạt động.

- **FR-01:** Tên, headline, bio, avatar, reputation và `verifiedSkillCount`
  lấy từ own account đã lưu; không gán thông tin mentor mẫu.
- **FR-02:** Reputation do server quản lý, thang nghiệp vụ 0–100, khởi tạo 50.
  Nếu API trả `null`, hiển thị dấu gạch, không tự gán 50. Counter bằng 0 là giá trị
  hợp lệ; không thay bằng số mẫu hoặc tính từ các màn learning demo.
- **FR-03:** Không hiển thị `completedSessionCount` trên own/public profile.
  Chưa có contract số Learning Path hoàn thành; không đổi nhãn số buổi thành số path.
  Thêm ô “Lộ trình hoàn thành” hiển thị “—”/“Sắp có” ở own/public self-preview,
  không gán 0 hoặc suy ra giá trị khi chưa có dữ liệu hỗ trợ.
- **FR-04:** Nội dung optional đã xóa giữ nguyên nghĩa rỗng; bio rỗng có thông báo
  “Chưa có giới thiệu”. Avatar thiếu dùng fallback theo identity hiện có.
- **FR-05:** Email chỉ thuộc ngữ cảnh riêng tư của own account. Bỏ huy hiệu mẫu
  và số dư Credit demo; không tự gán danh hiệu hoặc số dư khi chưa có dữ liệu thật.
- **FR-06:** Có entry chỉnh sửa và “Xem hồ sơ công khai”. Reputation, counter và
  trạng thái xác minh chỉ đọc; không cho người dùng tự thay đổi.

**Nghiệm thu độc lập:** Đăng nhập hai tài khoản lần lượt; own view và account menu
phản ánh đúng từng tài khoản. Tài khoản mới nhận dữ liệu server khởi tạo 50/0;
không có kỹ năng hoặc huy hiệu mẫu được trình bày như thành tích thật.

### US-02 — Chỉnh sửa hồ sơ (P1)

Người dùng sửa tên, dòng giới thiệu và bio, lưu hoặc hủy mà không làm mất dữ liệu
đã lưu hay tác động sang phiên tài khoản khác.

| Field      | Quy tắc                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullName` | Bắt buộc; trim đầu/cuối; 2–100 Unicode code points; có ít nhất một chữ; chỉ chữ, dấu kết hợp, khoảng trắng, apostrophe thẳng/cong và hyphen theo contract BE. |
| `headline` | Không bắt buộc; 0–120 ký tự theo quy tắc đếm của validator BE hiện có.                                                                                        |
| `bio`      | Không bắt buộc; 0–1000 ký tự theo quy tắc đếm của validator BE hiện có.                                                                                       |

- **FR-07:** Draft khởi tạo từ hồ sơ đã lưu; không dùng placeholder như giá trị
  thật. Chuỗi rỗng của headline/bio là yêu cầu xóa nội dung. Không trim hai field
  này hoặc tự thay bằng câu giới thiệu mặc định.
- **FR-08:** Tên sau trim không đổi, headline và bio không đổi thì không gửi
  mutation. Draft không hợp lệ hiển thị lỗi tại field và không gửi request.
- **FR-09:** Một lần lưu hợp lệ gửi một thao tác cập nhật logic. Trong khi pending,
  khóa field, nút lưu/hủy và back của editor để tránh gửi lặp hoặc bỏ draft giữa
  chừng. Hiển thị trạng thái “Đang lưu...”.
- **FR-10:** Khi API xác nhận thành công, dùng hồ sơ trả về để đồng bộ own view,
  home/menu và self-preview; báo thành công và quay về `/profile`. Không tự dựng
  bản hồ sơ đã lưu từ draft trước khi request thành công.
- **FR-11:** Lỗi validation/server/network giữ draft và thông báo lỗi tại form; không báo
  lưu thành công hoặc tự gửi lại mutation. Nếu mất phản hồi, kết quả server có thể
  chưa rõ; không coi draft là bằng chứng dữ liệu server đã đổi hay đã rollback.
- **FR-12:** Hủy hoặc back khi không pending bỏ draft và quay về `/profile`.
  Vào lại editor lấy dữ liệu đã lưu. Logout/đổi tài khoản bỏ draft cũ; response,
  callback hoặc timer của phiên cũ không cập nhật cache, UI hoặc điều hướng phiên mới.
- **FR-13:** Thay ảnh đại diện dùng chọn/preview/upload và theo dõi trạng thái
  theo FR-23..25. Preview draft không được coi là avatar đã công bố.

**Nghiệm thu độc lập:** Sửa/lưu rồi mở lại, xóa headline/bio, hủy draft, lưu lặp,
API lỗi và đổi phiên khi request đang chạy đều giữ đúng dữ liệu và identity.

### US-03 — Xem hồ sơ công khai (P1)

Người dùng mở hồ sơ của một target cụ thể hoặc tự xem hồ sơ công khai của mình.

- **FR-14:** Route `/profiles/[userId]` nằm ngoài tabs và dùng auth gate hiện có.
  “Công khai” là giới hạn field được xem, không có nghĩa cho phép guest truy cập.
- **FR-15:** Target được xác định bằng `userId`; thiếu, blank, param dạng mảng
  hoặc ID không được resolver hỗ trợ dẫn tới unavailable. Không chuyển sang viewer
  hoặc mentor mẫu để che lỗi target. Demo IDs chỉ phục vụ fixture, không gửi tới BE.
- **FR-16:** Public display model chỉ lấy allowlist ở mục 4. Không có nút sửa,
  thông tin riêng tư hoặc quản lý kỹ năng của target. Account menu chung luôn thuộc
  viewer đang đăng nhập; mở menu không thay target thành viewer.
- **FR-17:** Self-preview dùng cùng dữ liệu own account đã lưu sau projection;
  chưa tích hợp skill list nên hiển thị chưa kết nối, dù counter xác minh khác 0.
  Hồ sơ người khác phải ghi rõ “dữ liệu mẫu”.
- **FR-18:** Với kỹ năng có dữ liệu, hiển thị tên, level và badge khi chính skill
  có `verificationStatus === VERIFIED`. Không suy ra badge toàn tài khoản từ
  `emailVerified`, reputation hoặc `verifiedSkillCount`.
- **FR-19:** Phân biệt loading, ready, unavailable, error có retry và danh sách
  kỹ năng đã tải nhưng rỗng. Retry không đổi viewer; đổi target hoặc account phải
  bỏ kết quả/timer cũ và không lóe dữ liệu target trước.
- **FR-20:** Back dùng lịch sử navigation; nếu không có lịch sử thì về `/profile`.
  Không sửa discovery/chat để thêm entry trong feature này.

**Nghiệm thu độc lập:** Self-preview, fixture có kỹ năng, fixture rỗng, target
không tồn tại và retry đều có đúng identity, nội dung và trạng thái.

- **FR-23:** Chọn một ảnh JPG/PNG/WebP ≤5MB, preview trong draft; chỉ upload multipart
  field `image` khi Lưu. Hủy không upload/xóa ảnh. Profile/avatar là các request độc lập;
  nếu profile đã lưu nhưng avatar lỗi, thông báo đúng phần đã lưu và giữ draft ảnh để thử lại.
- **FR-24:** POST avatar trả 202 QUARANTINED; theo dõi status theo generation của phiên.
  Chỉ CLEAN refresh own account và avatar công khai. REJECTED/DELETED không công bố
  ảnh draft. Đây là kiểm tra nội dung/quét malware tự động theo spec API FR-009,
  không phải Staff duyệt từng avatar. PRO-004 của SRS quy định moderation khi vi phạm.
  Khi lưu ảnh, hiện một toast "Ảnh đã tải lên, đang kiểm tra."; không có dòng trạng
  thái dưới avatar. Chờ lâu/lỗi/từ chối báo qua toast một lần khi trạng thái thay đổi.
  CLEAN tự cập nhật ảnh; nút kiểm tra lại chỉ hiện ở own/editor khi chờ lâu/lỗi.
- **FR-25:** Xóa ảnh dùng DELETE khi Lưu. Lỗi/pending giữ draft và chống lưu trùng;
  đổi account không để callback/status cũ ảnh hưởng phiên mới. Chờ lâu hoặc refresh
  hồ sơ lỗi có thông báo/kiểm tra lại; URL avatar ký 60 giây được làm mới ở own account.

- **FR-26:** Own profile dùng kiểu dáng commit `ac4590d`: summary/thống kê trên thẻ
  trắng, avatar 64px, public preview riêng; grid hai cột (Ví Credit, Tài liệu của tôi,
  Hành trình của tôi, Đánh giá về tôi, Thành tích, Cài đặt) rồi giới thiệu/kỹ năng.
  Hành trình của tôi mở màn `/my-learning` được bảo vệ theo phiên, có hai tab Yêu cầu học
  và Lộ trình; mặc định Yêu cầu học, quay lại Hồ sơ và không có chuông trên header.
  Hai tab dùng chung danh sách mẫu yêu cầu/lộ trình đã có, gồm bộ lọc và link
  tạo/chỉnh sửa/chi tiết tương ứng. Dữ liệu ghi rõ bản xem thử; không nối API
  Learning Request/Path trong thay đổi điều hướng này. `/requests` và `/paths`
  chuyển về `/my-learning?tab=requests|paths`, không có danh sách riêng bị lặp.
  Đổi tab đồng bộ URL; link từ Lịch học tới tab Lộ trình, back hub về Hồ sơ.
  Đánh giá về tôi vẫn hiện thông báo chưa kết nối. Amendment 2026-10-13.
  Bỏ huy hiệu mẫu và số dư demo. Thông tin riêng tư giữ trong Cài đặt → Tài khoản.
  Summary có uy tín/kỹ năng xác minh và ô Lộ trình hoàn thành “—”/“Sắp có”.
  Own hero có “Danh hiệu · Sắp có”; chưa chọn/hiển thị danh hiệu thật trên public.
  Số Learning Path và danh hiệu chờ contract hỗ trợ. Header mobile bỏ avatar/menu tài khoản, dùng tab Hồ sơ;
  màn Hồ sơ có tiêu đề và chuông, màn con có nút quay lại. Web rộng ≥640px giữ menu.
- **FR-27:** Cài đặt có Tài khoản (email/xác minh/trạng thái từ own identity),
  email là thông tin chính; trạng thái dùng nhãn rõ ràng, có ghi chú riêng tư.
  Màn chỉ đọc không lặp tên hoặc nút chỉnh sửa hồ sơ.
  Đặt lại mật khẩu qua OTP email, đăng xuất phiên hiện tại/tất cả thiết bị.
  Nút đăng xuất phiên hiện tại nổi bật với nền đỏ nhạt, viền và biểu tượng đỏ.
  Reset chỉ thành công sau token hợp lệ; xóa credential cục bộ sau reset thành
  công từ phiên signed-in, không để callback cũ ảnh hưởng account mới.
- **FR-28:** Cài đặt gồm nhóm Tài khoản và bảo mật, Tùy chọn ứng dụng, Thông tin
  và hỗ trợ và nút Đăng xuất. Tùy chọn ứng dụng có Múi giờ, Ngôn ngữ, Thông báo;
  cả ba disabled, ghi “Sắp có”, không có mũi tên hoặc thao tác/lưu lựa chọn.
  Trợ giúp gộp hướng dẫn và thông tin hồ sơ được công khai; Giới thiệu SkillHub là
  mục riêng. Không có mục Quyền riêng tư. Version app hiển thị ở cuối trang.

## 4. Ranh giới dữ liệu và quyền riêng tư

| Đối tượng         | Field được phép trong public display model                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Profile           | `userId`, `fullName`, `headline`, `bio`, `avatarUrl`, `reputationScore`, `verifiedSkillCount`, `completedSessionCount`, `sharingSkills`. |
| Mỗi Sharing Skill | `id`, `skillId`, `name`, `level`, `description`, `experienceYears`, `verificationStatus`.                                                |

Projection phải chọn field tường minh, kể cả skill lồng bên trong; không spread
raw identity/account/catalog/evidence vào model công khai. Các field trong model
không bắt buộc đều xuất hiện thành một section UI.

- **FR-21:** Không đưa email, phone, ngày sinh, timezone/locale, role,
  accountStatus/account metadata, payment, password/token, evidence hoặc private
  file/document URL của target vào nội dung public. Avatar chỉ dùng URL dành cho
  việc hiển thị avatar đã được backend cho phép; không dùng storage key/evidence URL.
- **FR-22:** Headline/bio/skill text render bằng native `Text`, không diễn giải
  HTML, script hoặc tự tạo liên kết riêng tư. Client rendering không thay thế yêu
  cầu sanitize bio của SRS; backend sanitizer còn là gap cần xác minh.

## 5. Yêu cầu trải nghiệm

- Tái sử dụng shell, Avatar, theme, typography, form và component hiện có; giữ
  layout own/edit theo reference Figma đã cung cấp. Public view dùng component
  chung và còn cần đối chiếu reference riêng trước khi nghiệm thu visual.
- Safe area, nội dung dài, bàn phím và large text không che field/nút hoặc gây
  tràn ngang ở width 320/375/430. Control có label, trạng thái disabled/pending và
  vùng chạm theo quy ước ứng dụng; badge không chỉ thể hiện bằng màu.
- Dữ liệu real account và fixture phải được phân biệt bằng nội dung dễ hiểu với
  người dùng; không đưa chi tiết implementation vào thông báo lỗi thông thường.

## 6. Tiêu chí nghiệm thu và kiểm chứng

| Mã    | Tình huống                                                                              | Kết quả cần đạt                                                                              |
| ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AC-01 | Own view của tài khoản mới/cũ; reputation `null`; counter 0                             | Đúng identity/server values; không bịa thống kê, skill hoặc thành tích.                      |
| AC-02 | Tên 1/2/100/101 code points, tiếng Việt dựng sẵn/tổ hợp, punctuation và ký tự cấm       | Đúng biên validation và trim; lỗi không gửi request.                                         |
| AC-03 | Headline 120/121, bio 1000/1001; emoji và presentation selector                         | Đếm đồng nhất với BE; clear bằng chuỗi rỗng được lưu.                                        |
| AC-04 | Draft không đổi; nhấn lưu lặp; save thành công                                          | Không gửi khi không đổi; có pending guard; đồng bộ own/home/menu/self-preview bằng response. |
| AC-05 | API lỗi hoặc mất kết nối; hủy/back; mở lại editor                                       | Draft giữ khi lỗi, bỏ khi hủy; không báo thành công giả hoặc tự retry mutation.              |
| AC-06 | Logout/đổi account trong editor hoặc lúc lưu/tải target                                 | Dữ liệu/cache/callback cũ không tác động phiên mới.                                          |
| AC-07 | Raw fixture cố ý chứa private fields và evidence lồng trong skill                       | Public projection loại bỏ toàn bộ field ngoài allowlist; public view không render chúng.     |
| AC-08 | Self-preview; target khác; kỹ năng VERIFIED và các trạng thái khác                      | Đúng target; menu thuộc viewer; badge chỉ trên skill VERIFIED; dữ liệu mẫu được nhận diện.   |
| AC-09 | Signed-out/deep link; ID thiếu/blank/mảng/không tồn tại; đổi target; back không history | Auth gate đúng; unavailable không fallback sang user khác; back về `/profile` khi cần.       |
| AC-10 | Loading, error/retry, skill rỗng và skill chưa kết nối                                  | Các trạng thái phân biệt rõ; retry không làm mất viewer hoặc hiển thị target cũ.             |
| AC-11 | Text có markup, safe area, keyboard, large text, width 320/375/430                      | Text không thực thi markup; nội dung và control vẫn đọc/thao tác được.                       |
| AC-12 | Quality checks và kiểm tra diff                                                         | Mobile typecheck/lint/structure/tests pass; chỉ sửa phạm vi được phép.                       |
| AC-13 | Chọn ảnh, Hủy; file sai định dạng/quá lớn                                               | Preview riêng; Hủy không upload; ảnh sai bị chặn.                                            |
| AC-14 | QUARANTINED → CLEAN/REJECTED/DELETED, scan chậm, refresh lỗi                            | Chỉ CLEAN thay avatar; giữ ảnh cũ khi chờ/từ chối, có feedback/retry.                        |
| AC-15 | Upload/delete lỗi; profile đã lưu một phần; đổi account lúc upload                      | Giữ draft; báo đúng kết quả; không lưu trùng hoặc cập nhật nhầm phiên.                       |

- **AC-16:** Hồ sơ sắp xếp theo summary → grid shortcut hai cột → bio → skills,
  Thông tin riêng tư nằm ở Cài đặt; không có huy hiệu mẫu, số dư demo hoặc số buổi;
  width 320/430/900 không tràn ngang.
- **AC-17:** Header mobile không có avatar, tab Hồ sơ/shortcut vẫn truy cập được;
  web rộng giữ menu tài khoản. Cài đặt mở Tài khoản đúng own identity, Trợ giúp,
  Giới thiệu SkillHub và version; không có mục Quyền riêng tư. Đăng xuất
  hiện tại/tất cả có xác nhận, hủy không gửi request, lỗi có thể thử lại.
- **AC-18:** Đặt lại mật khẩu từ signed-in dùng email hiện tại/OTP/reset token;
  lỗi giữ form/phiên, lưu trùng chỉ một request, thành công trở về đăng nhập.
  Callback reset cũ không xóa phiên mới; guest recovery vẫn hoạt động.

Khi triển khai hoặc thay đổi code, chạy từ `apps/mobile`: `npm run check-types`,
`npm run lint`, `npm run check-structure` và `npm test`.
`npm run test:profile` kiểm tra riêng các helper/fixture của profile; không thay
thế integration tests hoặc nghiệm thu UI.

Chỉ xác nhận mục đã có bằng chứng. Web/fixture tests không chứng minh gọi API thật,
đúng native keyboard/large text hoặc pixel-match Figma. Không đánh dấu toàn bộ
FR-PRO hoàn tất khi các phần ngoài phạm vi vẫn còn pending.

## 7. Dependencies và các điểm còn thiếu

| Mã     | Điểm còn thiếu                                                                    | Cách xử lý trong spec này                                                                                                |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GAP-01 | API public profile và skill list chưa được mobile tích hợp                        | Giữ fixture cho target khác; own/self skill list ghi chưa kết nối. API backend đã có không đồng nghĩa mobile đã gọi.     |
| GAP-02 | SRS có `completedLearningPathCount`, contract hiện tại có `completedSessionCount` | Ẩn số buổi; ô Lộ trình hoàn thành chỉ “—”/“Sắp có”, không ánh xạ số path. Count thật cần contract riêng.                 |
| GAP-03 | SRS yêu cầu sanitize bio; chưa có bằng chứng sanitizer trong update path đã đọc   | Render text thuần ở mobile và ghi gap; không sửa backend trong task mobile.                                              |
| GAP-04 | Timezone/locale setup và chọn selected title chưa được triển khai                 | Entry Cài đặt và Danh hiệu chỉ “Sắp có”, không lưu lựa chọn hoặc gán danh hiệu. Avatar đã được bổ sung theo yêu cầu.     |
| GAP-05 | Website, rating, learned/taught totals chưa có profile contract                   | Không dùng field/counter khác thay thế; không đưa lên public view.                                                       |
| GAP-06 | Pending Back native, iOS/thiết bị thật và Public Profile Figma riêng              | LAN/CORS trực tiếp và Android keyboard/save/reopen/chữ lớn 130% đã kiểm chứng; các mục còn lại theo checklist.           |
| GAP-07 | Real avatar scan chưa hoàn tất trên môi trường local                              | Lần upload trước còn QUARANTINED sau 90 giây. ClamAV local đã bật, PING/INSTREAM đạt; cần xác nhận toàn luồng API CLEAN. |

Mọi mở rộng sang API public/skills phải cập nhật scope và plan trước
khi triển khai. Không tự tạo endpoint, field, enum hoặc chính sách nghiệp vụ mới.

Phần kế tiếp được đặc tả riêng ở [spec 004](../004-skills-management/spec.md):
quản lý Sharing Skill, evidence/xác minh và nối own/public self skill list.
Spec 004 đã triển khai own/public self skills và quản lý/xác minh; bằng chứng và
gates API/native thuộc validation của spec đó. Public profile API cho người khác
và title/counter gaps vẫn ngoài phạm vi.

## Public profile integration — 2026-10-13

Other UUID profiles now load the public-profile API and public skills when reached
from a real Learning Request's Xem hồ sơ button. This user-authorized amendment
supersedes the earlier fixture-only scope for those targets. Self-preview and
explicit demo profiles retain existing behavior. This does not integrate Proposal,
chat, a public request list, public reviews or unprovided reputation/title rules.
