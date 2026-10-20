# Spec 004: Quản lý kỹ năng chia sẻ và xác minh

**Ngày:** 2026-10-09. **Workspace:** `apps/mobile`.
**Cập nhật:** 2026-10-15; checklist tách checks để commit và AC cần API/native thật.
**Trạng thái:** Đã triển khai mobile và kiểm tra bằng fixtures; nghiệm thu API
thật/scanner và Android/iOS còn pending, xem [validation](validation.md).
**Nhánh hiện tại:** `fix/mobile-skill`; implementation nền trên `feat/mobile-skills`
và các amendment ngày 2026-10-12/13 đã được chia commit theo chức năng.

## 1. Mục tiêu và nguồn yêu cầu

Người dùng quản lý đúng kỹ năng của tài khoản đang đăng nhập, chọn kỹ năng từ
danh mục chuẩn, điều chỉnh thông tin/hiển thị và gửi bằng chứng để Staff xét duyệt.
Hồ sơ cá nhân và tự xem hồ sơ công khai phải phản ánh dữ liệu đã lưu, có phân biệt
kỹ năng tự khai, file đã quét an toàn và kỹ năng đã xác minh.

Nguồn: [SRS 1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
FR-SK-01..04, BR-02..06, SK-001..004, mục 18.8–18.9 và BR-28 về privacy.
Contract được đối chiếu read-only với
[API skills](../../../../services/api/specs/007-skills/contracts/http.md)
và controllers/services/repositories hiện có; khi văn bản khác source, xem mục 7.
Tuân thủ [hướng dẫn repo](../../../../AGENTS.md),
[architecture](../../docs/architecture.md), [domain rules](../../docs/domain-rules.md)
và [API contracts](../../docs/api-contracts.md).

Theo dõi [plan](plan.md), [tasks](tasks.md), [checklist](checklist.md) và
[validation](validation.md). Spec 001–003 cung cấp foundation, Auth/session,
own profile và tự xem profile. Không đánh dấu hoàn thành bằng màn hình/fixture.

## 2. Phạm vi và điểm vào

| Luồng                  | Phạm vi triển khai                                                             |
| ---------------------- | ------------------------------------------------------------------------------ |
| Kỹ năng của tôi        | Danh sách thật, xem chi tiết, phân trang; không hiện kỹ năng đã xóa.           |
| Thêm/sửa               | Chọn catalog ACTIVE; level, mô tả, số năm kinh nghiệm, hiển thị công khai.     |
| Ẩn/xóa                 | Ẩn giữ bản ghi; xóa khỏi UI dùng archive phía hệ thống để giữ lịch sử.         |
| Xác minh               | Chọn/upload 1–5 file, chờ READY, submit, lịch sử/chi tiết và mở file riêng tư. |
| Hồ sơ cá nhân          | Thay thông báo chưa kết nối bằng own list; Quản lý mở Kỹ năng của tôi.         |
| Tự xem hồ sơ công khai | Đọc public skill projection của chính mình; không lấy toàn bộ own list.        |

Menu hồ sơ bỏ shortcut “Xác minh kỹ năng”. Xác minh nằm trong form kỹ năng hoặc
Quản lý → chọn kỹ năng; phần đánh giá trên hồ sơ công khai vẫn giữ. Menu hiện có
“Đánh giá về tôi” chưa kết nối và “Hành trình của tôi” với hai tab yêu cầu học/lộ trình,
theo cập nhật spec profile ngày 2026-10-11.
Routes: `/my-skills`, `/my-skills/new`,
`/my-skills/[sharingSkillId]`, `/my-skills/[sharingSkillId]/edit`,
`/my-skills/[sharingSkillId]/verify` và
`/my-skills/[sharingSkillId]/verifications/[verificationId]`.
Mọi route cần Auth;
Back dùng history, không có history thì về danh sách hoặc `/profile`.

UI cập nhật theo yêu cầu: “Quản lý” là liên kết nhỏ cạnh tiêu đề Kỹ năng chia sẻ,
không thêm dòng hướng dẫn bên dưới. My Skills mở danh sách với nút `+ Thêm kỹ năng`
gọn ở đầu bên trái. Form thêm/sửa nhóm thông tin và bằng chứng riêng; lựa chọn
trình độ/hiển thị dùng các ô chọn có trạng thái rõ ràng.
Danh mục chọn dùng các dòng tên/mô tả và dấu chọn; không gán cùng icon sách cho
mọi kỹ năng. Danh sách/chi tiết dùng tên, nhãn trình độ, trạng thái và mô tả;
màn chi tiết nhóm nút
chỉnh sửa/hiển thị, hành động xác minh và xóa.
Các nút hành động giữ icon theo chức năng (sửa, hiển thị, xóa,
làm mới); chỉ bỏ icon minh họa mặc định bị lặp cho mọi kỹ năng.
Lưu thêm/sửa thành công tự quay về Kỹ năng của tôi. Gửi bằng chứng ở chi tiết là link không icon, căn giữa dưới Xóa kỹ năng; nút gửi trong form dùng màu primary của app. “Làm mới” nhỏ
cạnh phần thông tin kỹ năng, hỗ trợ kéo xuống refresh cả kỹ năng/lịch sử.
Khối Kỹ năng chia sẻ trên own/public profile dùng chung danh sách gọn không có đường phân cách:
không icon sách/mũi tên, tên/badge cùng hàng khi đủ chỗ, trình độ trong nhãn nhỏ
bên phải. VERIFIED có nhãn xanh “Xác minh”; UNVERIFIED không hiện nhãn trên
profile, PENDING/REJECTED vẫn hiện trạng thái. Riêng tư ở dưới tên khi cần.
Tên dài và màn hẹp cho phép xuống dòng; không cắt mất nhãn trạng thái.
Profile ban đầu hiện 5 kỹ năng; Xem thêm mở tiếp từng nhóm 5. Khi trở lại profile
thu gọn về 5, giữ các trang đã tải để tránh đọc lại không cần thiết.

Ngoài phạm vi: tìm người dạy/discovery và FR-SK-06/07, direct invitation/Proposal,
learned skills FR-SK-05, Learning Path, title/achievement, Staff/Admin screens,
quản lý catalog, khôi phục archive, public profile API cho người khác,
backend/schema/shared packages. Target profile demo của spec 003 và proposal
tiếp tục ghi rõ dữ liệu mẫu; không gửi demo IDs tới API.

## 3. Luồng và yêu cầu

### US-01 — Xem và chọn kỹ năng (P1)

- **FR-01:** Own list dùng `GET /me/skills` với `includeArchived=false`; không có
  tùy chọn Gồm/Ẩn bản lưu trữ. Kỹ năng đã xóa không hiện trong own/public profile.
  Phân biệt initial loading, empty, error/retry, refreshing và lỗi tải trang tiếp.
  Chỉ nói “Chưa có kỹ năng” sau response thành công; mất mạng không thành list rỗng.
- **FR-02:** Catalog dùng `GET /skills`; chỉ chọn ID từ kết quả ACTIVE.
  Search trim/NFC; rỗng bỏ `q`, 1 ký tự không gửi search, 2–100 ký tự hợp lệ.
  Đổi search phải bỏ cursor cũ và bỏ response của search trước. Không tự thêm tên
  skill, tag hoặc taxonomy khi chưa có trong danh mục.
- **FR-03:** Dùng cursor opaque, limit mặc định 20 (1–50). Không suy ra hết dữ liệu
  từ số phần tử; dedup theo ID và dùng `hasMore/nextCursor`.
  Bộ lọc Tất cả/Đã xác minh/Đang chờ xác minh/Chưa xác minh có cache riêng. Đã xác minh là VERIFIED;
  Đang chờ xác minh dùng latestVerification.status=PENDING hoặc badge PENDING.
  Một kỹ năng VERIFIED có yêu cầu mới PENDING hiện cả hai nhãn và thuộc cả hai bộ lọc.
  Chưa xác minh gồm UNVERIFIED/PENDING/REJECTED. API owner chưa có tham số lọc
  badge nên mobile đọc tiếp các trang chưa có kết quả khớp, giữ cursor server.
  Không báo rỗng trước khi đọc hết trang hoặc biến lỗi tải thành danh sách rỗng.
  Thanh lọc cuộn ngang một hàng, ở ngoài vùng cuộn dọc của danh sách. Đổi thẻ
  giữ vị trí/kích thước thanh lọc; dữ liệu đã tải phù hợp có thể làm placeholder
  trong lúc chờ GET, không báo empty hoặc bật load-more từ placeholder. Không
  kích hoạt pull-to-refresh indicator khi chỉ đổi bộ lọc.
- **FR-04:** Chi tiết dùng bản own đã tải; deep link/cold start phải tìm đúng ID
  qua own list chưa xóa, phân trang. API chưa có GET own skill detail.
  Deep link tới detail/edit/verify/history của kỹ năng đã xóa báo không khả dụng,
  không hiển thị bản read-only hay bằng chứng cũ.
  Chỉ kết luận không khả dụng khi đã đọc hết list thành công hoặc server từ chối;
  không lấy skill đầu tiên hoặc dữ liệu tài khoản khác làm fallback.

### US-02 — Thêm và chỉnh sửa (P1)

- **FR-05:** Create gửi `skillId`, `levelId`, `description`, `experienceYears?`,
  `isVisible?`; không gửi userId, verificationStatus hoặc dữ liệu evidence.
  Không tạo hai Sharing Skill chưa archive cho cùng catalog ID; 409 phải có
  feedback và refresh list. Không tự sửa bản cũ khi create bị trùng.
- **FR-06:** Theo BE amendment 2026-10-14, level chọn từ danh mục ACTIVE của
  kỹ năng qua `GET /skills/:skillId/levels`, là thông tin tự khai. Form hiển thị
  name/description của cấp độ đã chọn; không cố định bốn mức hoặc tự quy đổi
  chứng chỉ. Đổi kỹ năng xóa levelId đã chọn; tải lỗi/rỗng không tạo lựa chọn giả.
  Own/public/detail và kỹ năng dạy lại trong Learning Request dùng skillLevel.name;
  level code là string mở, hỗ trợ B2/N3. Metadata legacy null giữ nhãn cũ.
  Level đã INACTIVE vẫn giữ được khi chỉ sửa field khác, PATCH không gửi levelId.
  Mô tả trim/NFC, 20–1500 Unicode code points theo policy hiện tại.
  Số năm tùy chọn 0–60, tối đa một chữ số thập phân; gửi decimal **string** hoặc
  `null` khi xóa, không gửi số JSON. UI có thể nhận dấu phẩy rồi chuẩn hóa dấu chấm.
- **FR-07:** Edit khóa `skillId`, PATCH chỉ field thay đổi và `expectedVersion ≥ 1`
  lấy từ bản đã đọc. Hủy không lưu; form invalid/không thay đổi không gửi request.
  Không tự đổi badge khi sửa level/mô tả. Đổi catalog ID cần tạo bản mới.
- **FR-08:** Pending khóa Lưu và chống double tap đồng bộ; xử lý Back/đóng editor
  nhất quán với spec 003. Lỗi giữ draft. `STALE_VERSION` tải bản mới và yêu cầu
  người dùng xem lại trước khi gửi; không tự ghi đè draft bằng dữ liệu mới.
- **FR-09:** JSON mutations có `Idempotency-Key` theo tài khoản/operation và payload.
  Retry cùng thao tác/kết quả chưa rõ giữ key và body; đổi body/version dùng key mới.
  Không auto-retry mutation do network/5xx; cung cấp kiểm tra dữ liệu đã lưu và
  retry có chủ đích. Refresh token trong cùng phiên phải giữ nguyên key/body.

### US-03 — Ẩn và xóa khỏi hồ sơ (P1)

- **FR-10:** `isVisible=false` chỉ ẩn khỏi public/search; owner vẫn thấy và có thể
  hiện lại. Public self-preview dùng public endpoint nên không lộ skill ẩn/archive.
- **FR-11:** UI dùng “Xóa kỹ năng”, xác nhận gỡ khỏi hồ sơ/danh sách và giữ
  lịch sử hệ thống. Vẫn POST `.../archive` với expectedVersion và key để giữ lịch sử
  hệ thống. Hủy dialog không gửi. Chỉ sau response có archivedAt mới loại ID khỏi
  cache own/public/detail/evidence draft, dừng query cũ và quay về My Skills với
  toast. Refresh lỗi sau đó không làm kỹ năng xuất hiện lại. Không dùng DELETE
  hoặc xóa lịch sử Session/Review. Quyết định UI này theo yêu cầu ngày 2026-10-11;
  không có giao diện xem lại kỹ năng đã xóa.
- **FR-12:** Có request PENDING thì archive bị 409 `VERIFICATION_PENDING`.
  UI giải thích và refresh trạng thái; badge VERIFIED không đủ để biết không có
  pending batch. Không tự hủy yêu cầu hay coi việc ẩn là archive.

### US-04 — Gửi bằng chứng (P1)

- **FR-13:** Chỉ owner của bản chưa archive gửi bằng chứng. Một lần submit gồm
  1–5 `fileIds` khác nhau; PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP. Không dùng policy ảnh
  avatar 5MB hoặc chat 15MB cho evidence. Cap kỹ thuật hiện tại tối đa
  10.000.000 bytes/file; config server có thể nhỏ hơn (GAP-03).
- **FR-14:** Chọn file là draft; hủy picker không thay đổi draft. Nhấn “Gửi yêu cầu
  xác minh” tự upload từng file chưa có fileId rồi chờ kiểm tra; không có nút
  tải từng file riêng. Upload
  multipart field `file` qua evidence-files, không gọi API avatar. Bỏ file khỏi
  draft không xóa evidence đã submit; chưa có API xóa upload nên không hứa xóa
  server ngay. Retry upload có thể tạo fileId mới và không auto-replay bytes.
  Khi tạo kỹ năng, bấm Lưu tạo Sharing Skill trước, ghi DTO đã xác nhận rồi về
  Kỹ năng của tôi ngay. Tác vụ gửi trong SkillsProvider tiếp tục nén/upload các
  file đã chọn, chờ READY và submit yêu cầu xác minh;
  không có nút gửi riêng trong form tạo. Không chọn file thì chỉ tạo kỹ năng.
  Metadata bằng chứng không hợp lệ chặn Lưu trước khi create. Nếu kỹ năng đã được
  tạo nhưng upload/scan/submit lỗi, card hiện Gửi chưa hoàn tất và hiện toast lỗi
  nói rõ kỹ năng đã lưu nhưng bằng chứng chưa hoàn tất. Giữ draft/fileIds theo
  skillId trong phiên để mở lại kỹ năng và thử gửi bằng chứng, không tạo lại.
  Nếu create/update chưa được xác nhận thành công, ở lại form với lỗi.
  Retry submit giữ key/body cả khi mở lại màn; không tự retry ghi dữ liệu khi
  resume hoặc mất mạng.
  Rời màn không dừng tác vụ gửi; gửi thành công hoặc đổi phiên xóa draft.
  Không lưu file draft vào storage lâu dài. Amendment theo yêu cầu 2026-10-14.
  Chọn file không tự gửi yêu cầu và không đổi badge.
- **FR-15:** 202 QUARANTINED chỉ xác nhận tiếp nhận. Poll status theo file/session;
  QUARANTINED/SCANNING là chờ, READY mới đủ điều kiện submit.
  REJECTED/SCAN_FAILED/UPLOAD_FAILED/DELETED không thể submit; trạng thái lạ
  phải chặn an toàn. Lỗi/quá thời gian kiểm tra cho phép kiểm tra lại, không coi
  file đã sạch. Tác vụ tiếp tục khi đổi màn; dừng khi app background hoặc đổi phiên; resume
  phải đọc lại trạng thái, không tự upload/gửi lại. Nếu một file lỗi, giữ fileId
  các file đã tải thành công để lần gửi có chủ đích tiếp theo tái sử dụng. Một
  lượt gửi dùng tối đa hai worker nén/upload từng file rồi kiểm tra scan cùng
  lúc (tối đa 5 file). Poll tối đa 48 lần/file: ban đầu chờ 0,5 → 1 → 2 → 3 giây,
  sau lần đọc thứ 24 chờ 5 giây (tổng 183,5 giây chờ, chưa gồm HTTP). Card phân
  biệt chuẩn bị/tải lên/kiểm tra/gửi yêu cầu; sau 24 lần báo kiểm tra lâu hơn dự
  kiến. Một scan lỗi kết thúc dừng các scan đang chờ, giữ fileId cho retry.
  Hết lượt mà file còn QUARANTINED/SCANNING giữ WAITING_SCAN và nút Kiểm tra lại,
  không báo upload lỗi hoặc Chờ duyệt. Kiểm tra lại dùng IDs cũ, không tải lại
  bytes; chỉ READY mới submit. Lỗi upload đợi các upload đã bắt đầu trả kết quả
  và giữ IDs trước khi mở retry. Double tap bị khóa từ trước bước upload.
- **FR-16:** Submit JSON `fileIds`, `title?` (0–120), `description?` (0–500)
  với key; hai field áp dụng cho batch file mới, không gửi tên field SRS
  `evidenceTitle/evidenceDescription`. Nút gửi enable khi có 1–5 file hợp lệ và
  metadata hợp lệ; pipeline chỉ gọi submit JSON khi mọi file READY. Không cần
  người dùng tự nhấn upload hoặc kiểm tra trạng thái trước khi gửi.
  Thành công 201 tạo request PENDING, chưa có nghĩa Sharing Skill VERIFIED.
  Luồng Gửi riêng bắt đầu tác vụ thì tự quay về chi tiết kỹ năng; form tạo
  có bằng chứng theo FR-14 quay về My Skills. Khi server xác nhận submit mới báo
  toast Đã gửi yêu cầu xác minh. Refresh chạy nền sau xác nhận
  của server, không kéo dài thời gian khóa nút Lưu/Gửi. Card hiện spinner nhỏ và
  Đang gửi bằng chứng…, Chờ duyệt sau response PENDING hoặc Gửi chưa hoàn tất +
  Thử lại khi lỗi; vẫn mở chi tiết và giữ badge VERIFIED riêng. Form gửi
  không có link “Kiểm tra lịch sử đã gửi”; lịch sử nằm ở màn chi tiết.
- **FR-17:** Chỉ một batch PENDING cho một Sharing Skill; backend quyết định và
  trả 409 nếu có batch khác. File đang scan không phải batch PENDING của Staff.
  Có thể gửi batch mới sau quyết định; file mới cần duyệt riêng. Kỹ năng đã
  VERIFIED vẫn có thể có batch PENDING mà badge tiếp tục VERIFIED.

Ảnh lớn hơn 2 MB được thử re-encode JPEG quality 0,9 trên thiết bị trước upload;
giữ nguyên pixel dimensions/toàn bộ ảnh, chỉ dùng kết quả nhỏ hơn và hợp lệ.
Ảnh nhỏ, PDF/Word và file đã có ID giữ nguyên; nén lỗi/bản lớn hơn dùng bản gốc.
Owner có thể chọn Giữ ảnh gốc trước upload. Nén không cấp quyền xác minh hoặc
bỏ qua cap/scan. Tác vụ/draft chỉ trong phiên; đóng app không bảo đảm tiếp tục.

### US-05 — Theo dõi xác minh và đồng bộ hồ sơ (P1)

- **FR-18:** History/detail dùng endpoint owner riêng; hiển thị thời gian server,
  quyết định, lý do reject/revoke và file metadata dưới dạng text, không HTML.
  `latestVerification` trong own response không thay thế history/files; thiếu
  lý do không được tự tạo lý do. Chỉ refresh/retry khi cần; không giả định realtime.
- **FR-19:** Phân biệt badge kỹ năng UNVERIFIED/PENDING/VERIFIED/REJECTED,
  batch PENDING/APPROVED/REJECTED và evidence
  PENDING/APPROVED/REJECTED/REVOKED. Không thêm REVOKED vào badge kỹ năng.
  Approved không tự hết hạn; mobile không tính lại aggregate từ trang history.
- **FR-20:** Mở evidence cần lấy `{url,expiresAt}` mới từ endpoint download owner;
  dùng URL ngắn hạn, không lưu vào public profile/cache lâu dài/log/toast.
  File không READY hoặc quyền bị từ chối phải có feedback. Không tự đoán storage
  key, URL hoặc hứa link hết hiệu lực ngay khi quyền thay đổi.
- **FR-21:** Sau mutation thành công invalidate own list, public self skills,
  history/detail liên quan và refresh own account khi counter có thể đổi.
  Khi xác minh chỉ đổi version/status, form đồng bộ baseline nếu các field sửa
  và trạng thái archive vẫn y hệt bản đang sửa. Nếu nội dung server khác, vẫn
  yêu cầu xem/so sánh và rebase có chủ đích; không thay draft.
  Counter `verifiedSkillCount` do server trả, không đếm từ một trang list hoặc
  số file approved. Lỗi refresh sau mutation đã thành công phải báo riêng,
  không báo “chưa lưu” hay tự gửi mutation lần nữa.
- **FR-22:** Profile integration dùng public projection tường minh; không truyền
  owner metadata, private evidence, reviewer IDs hoặc reasons sang public view.
  Tự xem skill list public có loading/error/empty/load-more thật, không chỉ preview
  20 items. Nhấn một kỹ năng mở chi tiết công khai: tên, level, toàn bộ mô tả,
  số năm kinh nghiệm tự khai và badge. Route `/public-skills/[userId]/[sharingSkillId]`
  tìm Sharing Skill qua public list của đúng userId, phân trang khi cần; không
  dùng own list/cache hoặc catalog detail thay thế. Kỹ năng ẩn/xóa/sai owner hoặc
  không còn public báo không khả dụng; read lỗi có retry, không gọi history,
  evidence/download và không có edit/delete/submit. Profile user khác tiếp tục
  theo fixture boundary của spec 003, mở chi tiết mẫu từ field public đã có;
  không bịa mô tả/kinh nghiệm thiếu. Amendment theo yêu cầu 2026-10-13.
- **FR-23:** Cache/request/draft/poll/callback ràng buộc userId và session generation.
  Logout/đổi account dừng hoạt động cũ, xóa dữ liệu riêng tư; callback cũ không
  toast, navigate, expire phiên mới hoặc cập nhật cache tài khoản mới.
- **FR-24:** UI theo theme/component hiện có, accessibility label và nhãn trạng
  thái bằng chữ. Kiểm tra safe area, keyboard, Android Back, chữ lớn 130%, widths
  320/375/430. Trước khi thêm picker/UI dependency phải kiểm tra SDK 57 và khả năng
  chạy Expo Go/web; không nâng SDK hoặc đổi cấu trúc toàn app trong spec này.
- **FR-25:** Kết quả thao tác lưu, ẩn/hiện, archive, chọn file và gửi bằng chứng
  dùng toast; không chèn banner thông báo vào nội dung form/detail. Lỗi field và
  trạng thái tải/không khả dụng vẫn hiển thị tại vùng liên quan. Nút xóa có
  nền đỏ nhạt, chữ/icon đỏ. Dung lượng evidence hiển thị KB/MB theo đơn vị thập
  phân, cùng cap 10 MB. Ảnh JPEG/PNG/WEBP có preview từ URI local ngay khi chọn;
  PDF/Word giữ dạng file. Preview lỗi không làm mất file, không tự upload hoặc
  thay điều kiện scan READY trước khi submit.
- **FR-26:** Chú thích form ngắn gọn, không lặp hướng dẫn tự upload hoặc các dòng
  giới hạn ký tự dưới field; lỗi validation vẫn hiển thị khi cần. Giới hạn định
  dạng/số lượng/dung lượng gộp tại vùng chọn file. Ảnh có nút × trên góc phải của
  preview; tài liệu có nút × cạnh tên file. Nút xóa có tên truy cập kèm tên file,
  vùng chạm tối thiểu 44 px và khóa trong lúc gửi. Phần hiển thị nút × dùng
  vòng tròn 32 px và icon 14 px để gọn hơn.
- **FR-27:** List kỹ năng trên profile và hồ sơ công khai không có đường ngăn
  giữa các kỹ năng. Gửi bằng chứng ở detail là link không icon, căn giữa dưới
  Xóa kỹ năng; nút gửi trong form
  dùng primary, nút sửa/ẩn nền surface có viền và nút xóa giữ màu đỏ nhạt. Vùng bằng chứng
  có hai lựa chọn: Chọn ảnh mở thư viện hệ thống, Chọn file mở PDF/Word. Cả hai
  dùng chung draft, cap 5 file/10 MB mỗi file, preview và luồng tự upload khi gửi;
  hủy chọn không làm mất draft, khóa cả hai trong lúc chọn/gửi.
  Hai nút chọn ảnh/file cùng hàng, gọn và giữ vùng chạm ít nhất 44 px; hint nguồn
  giữ cho trình đọc màn hình. Preview draft cao tối đa 160 px; ảnh trong history
  là thumbnail 72 px cạnh tên/dung lượng, request detail vẫn có ảnh lớn.
- **FR-28:** Sau response submit xác nhận, cập nhật bản yêu cầu vào cache owner,
  history/detail và các bộ lọc đã tải trước khi refresh/điều hướng; không tự đoán
  version của kỹ năng hoặc tạo pagination giả. Nếu refresh lỗi, lịch sử vẫn hiện
  bản vừa gửi và chặn gửi trùng. Chỉ giữ snapshot PENDING đến khi server trả quyết
  định mới. Chi tiết/list đọc lại khi quay về hoặc app trở lại foreground;
  không tự gửi mutation. Đang chờ duyệt không có link gửi và form không có picker/
  nút gửi; sau quyết định có thể gửi lại. Ảnh bằng chứng đã gửi hiện trong history/
  request detail bằng URL owner ngắn hạn, không dùng URI draft. URL chỉ ở state
  của ảnh, không lưu cache bền; xóa khi blur/background/đổi phiên/hết hạn. Lỗi ảnh
  có thao tác tải lại và không làm mất lịch sử.
- **FR-29:** Badge trạng thái dùng các tone xanh đã xác minh, vàng chờ duyệt,
  trung tính ấm chưa xác minh và đỏ từ chối, với nền/viền nhẹ và chữ rõ. Token dùng
  chung ở danh sách, chi tiết và profile; nhãn trình độ dùng cam đất nhẹ.
- **FR-30:** Own/public profile và profile mẫu hiện tối đa 5 kỹ năng ban đầu.
  Xem thêm mở tiếp 5 dòng từ dữ liệu đã tải, chỉ fetch trang sau khi cần. Lỗi trang
  sau giữ các dòng đang hiện; không báo hết dữ liệu hoặc tăng phần hiển thị khi
  fetch lỗi. Ẩn Xem thêm khi không còn dữ liệu/cursor, không suy ra từ page size.
- **FR-31:** Kỹ năng của tôi yêu cầu xếp mới nhất trước. Mobile giữ thứ tự các
  lần tạo đã được xác nhận trong phiên: bản mới nhất ở đầu, không đổi thứ tự khi
  edit/visibility/refresh; không mất bản vừa tạo nếu nó chưa nằm trong trang API
  đang tải. Giữ cursor/filter/version server và loại bản đã xóa. Thứ tự thời gian
  tạo của toàn bộ dữ liệu cũ và sau khởi động lại còn phụ thuộc GAP-09; không suy
  thời gian từ UUID, catalog hoặc lần gửi bằng chứng.

## 4. Contract áp dụng

Base `/api/v1`; envelope success có `data`, list có `meta.pagination`.
ID là UUID; cursor opaque; experienceYears decimal string/null;
fileSizeBytes integer string; timestamps do server trả.

| Endpoint                                                       | Vai trò                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| GET `/skills`, `/skills/:skillId`                              | Catalog ACTIVE; detail catalog không phải detail Sharing Skill. |
| GET `/me/skills`                                               | Owner list, includeArchived/cursor/limit.                       |
| POST `/me/skills`                                              | Create, 201, Idempotency-Key.                                   |
| PATCH `/me/skills/:sharingSkillId`                             | Edit/visibility, 200, expectedVersion và key.                   |
| POST `/me/skills/:sharingSkillId/archive`                      | Archive, 200, expectedVersion và key.                           |
| GET `/profiles/:userId/skills`                                 | Public projection phân trang; spec này dùng self UUID.          |
| POST `/me/skills/:sharingSkillId/evidence-files`               | Một multipart file, 202; không replay như JSON mutation.        |
| GET `/me/skills/:sharingSkillId/evidence-files/:fileId`        | Scan/storage status, không trả storage key.                     |
| POST `/me/skills/:sharingSkillId/verifications`                | Submit batch, 201, Idempotency-Key.                             |
| GET `/me/skills/:sharingSkillId/verifications`                 | Owner history, cursor/limit.                                    |
| GET `/me/skills/:sharingSkillId/verifications/:verificationId` | Owner detail/files/reasons.                                     |
| GET `/me/skills/:sharingSkillId/evidence/:evidenceId/download` | URL download ngắn hạn sau kiểm tra quyền/file.                  |

400 invalid/cursor; 401 theo Auth renewal; 403 quyền; 404 không khả dụng;
409 trùng/version/pending/file chưa READY; 413 cap; 415 format/MIME;
429 rate limit; 503 storage/scan/policy. Không coi mọi 409 là cùng một lỗi;
dùng mã known-shaped khi có, fallback an toàn khi không có mã.

## 5. Điều kiện nghiệm thu

| AC    | Tình huống                                            | Kết quả cần chứng minh                                                            |
| ----- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| AC-01 | Own list 0/1/>20, lỗi trang sau, includeArchived      | Đúng list, empty/loading/error tách biệt; không mất trang trước hoặc trùng ID.    |
| AC-02 | Catalog q rỗng/1/2/100/101, đổi search nhanh          | Chỉ request hợp lệ; reset cursor; response cũ không ghi đè.                       |
| AC-03 | Add hợp lệ/duplicate/skill inactive                   | Lưu thật và reopen đúng; không tự tạo catalog/free-text hoặc record trùng.        |
| AC-04 | Form biên, Unicode, decimal, clear/Hủy/no-change      | Payload đúng string/null; invalid/Hủy/no-change không mutate.                     |
| AC-05 | Edit stale version, double tap, timeout sau commit    | Draft còn; không ghi đè/trùng; retry giữ key/body đúng thao tác.                  |
| AC-06 | Ẩn/hiện, xóa/Hủy, xóa có pending                      | Owner/public đúng; xóa về list, không xem lại; lịch sử hệ thống còn; lỗi giữ bản. |
| AC-07 | File sai/0 bytes/quá cap, picker cancel, 1/5/6 file   | Không submit draft invalid; xử lý MIME/413/415 từ server.                         |
| AC-08 | QUARANTINED/SCANNING/READY và scan lỗi                | Submit chỉ READY; 202 không bật badge VERIFIED; poll dừng/resume đúng.            |
| AC-09 | Submit duplicate/pending, mất response, retry         | Một batch theo thao tác; không gửi lại bytes hoặc tăng badge cục bộ.              |
| AC-10 | Approved cũ + pending mới, reject/revoke              | Badge/batch/file đúng và lý do thật; không expiry hoặc enum sai.                  |
| AC-11 | History nhiều trang, download hết hạn/sai owner       | Đúng ID/files; URL mới đúng quyền, private không vào public/cache/log.            |
| AC-12 | Mutation thành công nhưng refresh lỗi                 | Báo đã lưu/chưa cập nhật; không auto-mutate lại hoặc đếm counter cục bộ.          |
| AC-13 | Logout/đổi account/target trong list/save/upload/poll | Không lộ dữ liệu, callback hoặc request A dưới credentials B.                     |
| AC-14 | Deep link cold start/ID lạ/bản archive                | Tìm đúng ID qua list; unavailable sau kiểm tra; Back có fallback.                 |
| AC-15 | Own/self profile, public list >20, target demo        | Skills thật đúng visibility; demo boundary còn rõ; không lộ evidence.             |
| AC-16 | Android/iOS/web, keyboard/Back/chữ lớn                | Controls truy cập được, không tràn ngang; evidence mỗi nền tảng ghi riêng.        |

## 6. Thành công và kiểm chứng

Hoàn thành khi AC có bằng chứng tương ứng, checks mobile đạt và có luồng thật
add/edit/visibility/archive, upload → READY → submit → decision → refresh.
Fixture dùng cho race/error/edge cases; không thay bằng chứng API/native.
Nếu scanner hoặc thiết bị chưa sẵn sàng, ghi pending cụ thể, không tick toàn spec.

## 7. Dependencies và điểm cần làm rõ

| Gap    | Bằng chứng/ảnh hưởng                                                                                        | Xử lý trong spec                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 | HTTP `RequestOptions` chưa nhận key; `readPayload` bỏ `meta`.                                               | Thêm hỗ trợ JSON idempotency/paginated result trong `apps/mobile/src/lib/http`; giữ API caller cũ và có regression tests.               |
| GAP-02 | Không có own detail endpoint; BE đã có restore command khi đối chiếu ngày 2026-10-12.                       | Detail đi qua owner list chưa xóa; ID đã archive không khả dụng trong mobile. Restore vẫn ngoài phạm vi UI spec này.                    |
| GAP-03 | SRS dùng cap config; upload/attach source có hard ceiling 10.000.000 bytes, chưa có config endpoint mobile. | Client chỉ precheck ceiling; server có thể nhỏ hơn và trả 413/503. Không quảng cáo cap cố định là quy tắc SRS.                          |
| GAP-04 | API contract markdown nói INACTIVE có thể hiện public; repository thực tế lọc catalog ACTIVE.               | Ghi chênh lệch; mobile dùng kết quả server, không ghép own data để công khai INACTIVE. Cần thống nhất contract trước discovery.         |
| GAP-05 | SRS SK-002 nhắc nội dung trọng yếu theo policy; service hiện không reset badge khi edit.                    | Không tự định nghĩa policy hoặc revoke ở mobile; giữ badge server, ghi dependency nếu policy thay đổi.                                  |
| GAP-06 | Chưa có document picker/file opener chuyên evidence trong mobile.                                           | Chọn giải pháp tương thích SDK/platform trong implementation; không cài package trong task soạn spec.                                   |
| GAP-07 | Contract API đang ghi planned; đã thấy source nhưng chưa gọi runtime skills/evidence trong task này.        | Cần integration checks độc lập; source không chứng minh service/storage/scan đang chạy đúng.                                            |
| GAP-08 | `latestVerification` owner hiện là raw batch, chưa có files và Swagger type cụ thể.                         | Typed allowlist cho phần cần dùng; detail/history lấy endpoint riêng, không cast sang đầy đủ VerificationResponse.                      |
| GAP-09 | BE owner list phân trang theo UUID tăng dần và không trả createdAt/param sắp xếp.                           | Ưu tiên bản mới tạo trong phiên; sắp toàn bộ mới nhất trước cần BE trả createdAt và phân trang theo createdAt DESC/id. Không tự sửa BE. |

`apps/mobile/AGENTS.md` chưa có trong checkout ngày 2026-10-09; đã có khi đối
chiếu ngày 2026-10-12. Các lần tiếp tục áp dụng hướng dẫn workspace và constitution
mobile hiện tại; việc đối chiếu BE không mở rộng phạm vi thay đổi sang backend.

Checkpoint implementation: GAP-01 đã giải quyết bằng paginated transport/key;
GAP-06 dùng `expo-document-picker ~57.0.3` và `expo-linking`; GAP-08 dùng typed
allowlist summary, riêng history/detail. GAP-02..05 vẫn giữ workaround/contract
boundary. GAP-07 chưa đóng: catalog local trả rỗng ở lần kiểm tra cũ; ngày
2026-10-12 API local cổng 3001 không chạy, full API/scanner chưa nghiệm thu.

Cập nhật 2026-10-15: catalog trên `skillhub.memora.cam` đã được tạo/cập nhật và
đọc lại qua Admin/public API, gồm 43 level ACTIVE có mô tả. Đây chưa phải nghiệm
thu CRUD bằng mobile/User hoặc full evidence journey. Upload ảnh mẫu trên server
trả 503; GAP-07 vẫn mở. Checks commit, browser và JS/Hermes export đã đạt theo
[checklist](checklist.md); Android/iOS trên thiết bị vẫn Pending.

Đối chiếu BE ngày 2026-10-12: JSON mutation trả owner DTO hiện hành, kể cả replay;
lưu DTO trước refresh, giữ version/cursor server và cập nhật các list đã tải.
Response lịch sử/detail có version và quyết định được dùng để gỡ snapshot submit
cũ rồi đọc lại badge/version/counter từ owner/account. Web evidence dùng MIME
đã chuẩn hóa và chặn tên file có basename rỗng/extension nguy hiểm ở giữa theo BE.
