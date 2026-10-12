# Spec 005: Learning Request trên mobile

**Ngày soạn:** 2026-10-11. **Nhánh:** `feat/mobile-learning-request`.
**Workspace:** `apps/mobile`. **Trạng thái:** Đã triển khai phần mobile có contract;
chưa nghiệm thu end-to-end với runtime backend. Xem [tasks](tasks.md) và
[bằng chứng kiểm tra](validation.md).

## 1. Mục tiêu và nguồn yêu cầu

Người dùng quản lý nhu cầu học của mình từ bản nháp đến đăng bài, theo dõi
kiểm duyệt, sửa hoặc hủy khi được phép; người dùng khác tìm được các bài đang
mở. Trạng thái và kết quả thao tác lấy từ backend, không được suy ra từ mock,
đồng hồ thiết bị hoặc việc mở Chat.

Nguồn nghiệp vụ là [SRS 1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
mục 6.4, 8.2, 18.10, FR-LR-01..08, LR-001..009, BR-07..12 và AC-03/04.
Tuân thủ [hướng dẫn repository](../../../../AGENTS.md),
[kiến trúc mobile](../../docs/architecture.md),
[domain rules](../../docs/domain-rules.md) và
[state machines](../../docs/state-machines.md).

[HTTP contract backend](../../../../services/api/specs/007-learning-request/contracts/http.md)
là contract tích hợp, không thay thế SRS. Các policy TTL 30/90 ngày, skill bất biến
sau publish và canonical Tag IDs đến từ quyết định đã ghi trong spec backend;
không coi chúng là giá trị mặc định do SRS quy định. [Checkpoint contract](contracts.md)
ghi các khác biệt giữa tài liệu và source ở `dev` commit `c52ec74`.

Spec ghi phạm vi đích. [Checklist](checklist.md) tách kiểm tra mobile bằng fixture
khỏi nghiệm thu API thật và thiết bị Android/iOS.

## 2. Baseline trước triển khai, được xác minh tại dev c52ec74

| Khu vực                            | Bằng chứng hiện có                                                                                                                        | Phần cần thay đổi                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| My Requests, editor, own detail    | `src/features/learning-requests/context.tsx`, `screens.tsx`: local state, ID mẫu, lưu nháp/publish/cancel cục bộ.                         | CRUD qua API, version, trạng thái thực, lỗi và phân trang.                                                |
| Discovery và public request detail | `src/features/discovery`: imports fixture; filter Credit/số buổi và đảo thứ tự cục bộ.                                                    | Feed/search/filter qua API; chỉ hiển thị field có contract.                                               |
| Skill/tag picker                   | `src/features/skills/catalog.ts`: `catalog-react` và các ID mẫu; tag nhập tên kỹ năng.                                                    | UUID thật và canonical Tag IDs; không đồng nhất Skill với Tag.                                            |
| Proposal entry                     | `SendProposalScreen.tsx` tìm request trong fixture discovery; store Proposal/Chat là mock.                                                | Chặn chuyển request thật vào luồng gửi/accept Proposal mẫu.                                               |
| Guest/search preview               | `product-shell/screens/public-screens.tsx`, `notification-search-screens.tsx` dùng fixture discovery.                                     | Giữ ranh giới demo rõ ràng; phần tìm Learning Request thật dùng cùng contract với Discovery và auth gate. |
| Backend LR wiring                  | `LearningRequestsModule` gắn Catalog, owner projection, lock reader và Sharing Skill reader vào `UnavailableLearningRequestDependencies`. | Đây là dependency bên ngoài mobile; có controller không chứng minh API dùng được end-to-end.              |

`UnavailableLearningRequestDependencies.assertAllowed` đã gọi Reputation service;
không được suy từ tên class rằng eligibility cũng luôn trả 503. Các method Catalog,
owner projection, lock state và Sharing Skill snapshot hiện trả 503 tường minh.

## 3. Phạm vi

| Luồng                        | Route mobile                                     | Mức ưu tiên                   |
| ---------------------------- | ------------------------------------------------ | ----------------------------- |
| Xem/lọc yêu cầu của tôi      | `/requests`                                      | P1                            |
| Tạo bản nháp                 | `/requests/new`                                  | P1                            |
| Xem trạng thái, publish, hủy | `/requests/[id]`                                 | P1                            |
| Sửa bài                      | `/requests/[id]/edit`                            | P1                            |
| Browse/search/filter         | `/discover`, phần Learning Request của `/search` | P1                            |
| Xem bài trong feed           | `/request/[id]`                                  | P1                            |
| Gợi ý theo Sharing Skill/Tag | Chế độ gợi ý trong Discovery                     | P2; phụ thuộc adapter backend |

Tái sử dụng Auth/session, HTTP client và Query provider hiện có. Thay mock cho
các luồng Learning Request thật; fixture chỉ dùng trong môi trường preview/test
được nhận diện rõ. Không tự chuyển sang fixture khi API lỗi.

Không triển khai Staff/Admin moderation, cấu hình rule, CRUD Sharing Skill/evidence,
API public profile, Proposal/Invitation/Chat, Path/Plan/Schedule, Session hoặc Wallet.
Notification sẽ có spec riêng: inbox, đánh dấu đã đọc, điều hướng từ notification,
push/email/realtime đều ngoài phạm vi spec 005. Learning Request chỉ đọc trạng thái
kiểm duyệt và lý do từ chối từ own detail.
Không sửa `services/api`, schema hoặc shared packages trong task này.

## 4. Luồng người dùng và yêu cầu chức năng

### US-01 — Quản lý yêu cầu của tôi (P1)

- **FR-01:** Người đã đăng nhập xem `/mine` của phiên hiện tại, có phân trang,
  refresh và lọc trạng thái server hỗ trợ. Phân biệt chưa có bài, không có kết quả
  theo bộ lọc, loading, error và lỗi tải trang tiếp theo.
- **FR-02:** Own detail hiển thị nội dung đã lưu, status, moderationStatus,
  expiresAt và lý do từ chối hiện tại nếu có. Dùng `effectiveStatus` khi GET
  trả field này; không chỉ dựa vào persisted status để mở action.
- **FR-03:** Có đủ nhãn tiếng Việt cho DRAFT, PENDING_MODERATION, OPEN, REJECTED,
  NEGOTIATING, MATCHED, CLOSED, CANCELLED, EXPIRED. `moderationStatus` là trục
  riêng; APPROVED không đồng nghĩa MATCHED hoặc lịch đã khóa.
- **FR-04:** ID route phải là một UUID hợp lệ; thiếu/blank/mảng/ID demo không gọi
  API và không fallback sang bài khác. GET detail trả 404 hiển thị bài không khả
  dụng, ẩn nội dung/reason/action đã cache, không tiết lộ bài private tồn tại.
  GET detail trả 403 hiển thị không được phép, ẩn snapshot/reason và khóa action
  đến khi GET thành công trong đúng phiên; không dùng cache như quyền truy cập.
  Back dùng lịch sử; fallback own
  detail/editor về `/requests`, feed detail về `/discover`.

**Nghiệm thu độc lập:** Hai tài khoản nhìn thấy đúng own list; mọi trạng thái,
empty/error/retry và deep link đều có hành vi đúng, không lẫn bài mẫu.

### US-02 — Tạo và lưu bản nháp (P1)

| Field gửi API         | Validation và ý nghĩa                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `title`               | Bắt buộc, 10–120 Unicode code points sau chuẩn hóa theo contract.                                                   |
| `skillId`             | Bắt buộc, UUID của Skill ACTIVE từ catalog thật.                                                                    |
| `description`         | Bắt buộc, 20–3000 code points; backend sanitize.                                                                    |
| `learningGoal`        | Bắt buộc, 10–1000 code points; không gửi field mẫu `goal`.                                                          |
| `currentLevel`        | Optional/null hoặc NONE, BEGINNER, INTERMEDIATE, ADVANCED; null khác tự khai NONE.                                  |
| `tagIds`              | Optional, tối đa 10 UUID distinct, canonical Tag ACTIVE; không gửi tên tự do.                                       |
| `preferredSlots`      | Optional, tối đa 5 `{startAt,endAt}`, tương lai, end > start; RFC3339 có offset hoặc UTC `Z`.                       |
| `verifiedTeacherOnly` | Optional boolean, mặc định false khi tạo; là điều kiện của Sharing Skill người dạy, không phải badge của owner.     |
| `expiresAt`           | Optional/null để dùng hạn mặc định lúc publish; custom timestamp tương lai, giới hạn cuối cùng do backend kiểm tra. |

- **FR-05:** Form có lỗi theo field và giữ draft khi validation/API/network lỗi.
  Client đếm code points trên text NFKC/trim; không dùng UTF-16 `.length` cho giới
  hạn nghiệp vụ. Client chỉ NFKC/trim/đếm code points, không strip HTML hoặc decode
  entities để mô phỏng sanitizer backend. Backend sanitize/validate và moderation
  là nguồn quyết định cuối cùng; client không báo nội dung chắc chắn được duyệt.
- **FR-06:** Picker lấy UUID thật và tên để hiển thị; không gửi preview ID, slug
  hay dùng Skill ID thay Tag ID. Catalog lỗi có retry; không có Skill ACTIVE thì
  chưa tạo được bài. Tag catalog chưa có contract là gap, không tự tạo taxonomy.
- **FR-07:** Khoảng ưu tiên hiển thị múi giờ thiết bị rõ ràng và chuyển thành
  timestamp tuyệt đối khi gửi. Đây không phải lịch đã confirm; không áp hạn
  60–180 phút của Session vào preferredSlots. Đồng hồ thiết bị chỉ hỗ trợ nhập,
  không quyết định expiry cuối cùng.
  User sửa yêu cầu UI2026-10-12: thời gian ưu tiên chọn thứ trong tuần rồi hai
  giờ rảnh, lặp hằng tuần; max5, end>start trong cùng ngày, không chồng nhau cùng
  thứ. Đây là yêu cầu mới ngoài contract timestamp SRS18.10, chờ B08/GAP-09.
  Weekly draft chỉ giữ trong mounted form; Save bị khóa khi còn weekly rows,
  có thông báo ngắn. Không đổi thành lần xuất hiện tiếp theo hoặc âm thầm bỏ.
  Không tự gửi field mới. preferredSlots ngày cụ thể đã lưu vẫn hiển thị riêng,
  giữ exact timestamps khi untouched và có thể xóa explicit [].
  Hủy lựa chọn giữ giá trị cũ, Xong mới cập nhật field. Hạn riêng có thể bỏ để
  dùng mặc định backend; không tự áp deadline từ picker.
  Lịch chọn hạn dùng font app: số ngày12, thứ11, tháng13; ô ngày cao tối thiểu44.
- **FR-08:** “Lưu bản nháp” gửi POST create, chỉ điều hướng đến own detail sau
  201 với ID/version server trả về. Lưu nháp không publish, không giữ Credit,
  không yêu cầu số dư, số buổi hay exchangeType. Create/publish chỉ dành cho User
  ACTIVE có grant phù hợp và không bị policy hạn chế hoạt động mới; backend kiểm
  tra lại quyền/eligibility. Mobile không suy quyền từ tên role hoặc số điểm tự tính,
  và không biến OTP softban thành lệnh cấm tạo bài.
- **FR-09:** Back/Hủy editor khi không pending bỏ draft chưa lưu; vào lại lấy
  dữ liệu đã lưu. Không tự lưu qua logout hoặc sang tài khoản khác. Không thêm
  persistent offline draft vào phạm vi này.

**Nghiệm thu độc lập:** Tạo/lưu/mở lại bằng API, các biên độ dài, UUID/tag/slot
không hợp lệ, optional fields và catalog lỗi không sinh dữ liệu thành công giả.

### US-03 — Publish và theo dõi moderation (P1)

- **FR-10:** Publish là action riêng trên DRAFT đã lưu, gửi `{expectedVersion}`.
  Khi thành công, dùng response: OPEN thông báo đã đăng; PENDING_MODERATION
  thông báo đang chờ duyệt/chưa nhận Proposal. Không mặc định mọi bài phải vào queue.
- **FR-11:** REJECTED hiển thị `moderationRejectReason` cho owner, render text
  thuần. Không dùng lý do mẫu, không tự tái tạo lý do từ keyword, và không lộ
  flagged categories/rule list/reviewer metadata trong UI người dùng.
- **FR-12:** Khi quay lại màn hình hoặc refresh, đọc lại trạng thái để nhận kết
  quả Staff approve/reject. Không tự chuyển OPEN sau một khoảng chờ hoặc giả định
  có websocket/push; cập nhật theo response mới nhất của đúng request/phiên.
- **FR-13:** Lý do kiểm duyệt hiển thị theo own detail hiện tại. Sau sửa hoặc
  re-publish thành công, bỏ lý do cũ nếu response không còn lý do đó. Khi refresh
  do network/503, báo chưa cập nhật được và giữ dữ liệu đã tải như trạng thái
  lần đọc trước; không suy approve/reject mới hoặc dùng reason mẫu thay thế.
  GET detail trả 404/403 áp FR-04, không giữ snapshot/reason trên màn như dữ liệu
  vẫn được phép xem. Lỗi mutation 403 không tự phủ nhận quyền đọc detail.

**Nghiệm thu độc lập:** Publish clean/flagged, Staff approve/reject bên ngoài
mobile, reload/app foreground, refresh lỗi và lý do sau sửa/re-publish đều phản ánh
đúng bản server đã đọc. Mobile không có nút approve/reject.

### US-04 — Sửa và đăng lại (P1)

- **FR-14:** Editor chỉ mở cho owner ở trạng thái hiệu lực DRAFT, OPEN,
  PENDING_MODERATION, REJECTED. Mọi state khác chỉ đọc. Skill chỉ được thay trước
  lần publish đầu tiên; dùng `publishedAt`, không chỉ status DRAFT để quyết định.
  Deep link vào editor cũng kiểm snapshot/state; bản GET mới không cho sửa phải
  khóa mutation, giữ draft trong bộ nhớ cùng phiên để không mất input.
- **FR-15:** PATCH gửi field thay đổi và `expectedVersion`; bỏ qua giữ giá trị,
  `tagIds: []`/`preferredSlots: []` xóa lựa chọn. Null chỉ gửi cho field cho phép.
  Draft không đổi thì không PATCH; REJECTED không đổi vẫn giữ rejected và hướng
  dẫn sửa nội dung trước khi đăng lại.
- **FR-16:** Sửa OPEN/PENDING_MODERATION chạy filter tại server, nhận OPEN hoặc
  PENDING_MODERATION theo response. Không luôn chuyển về DRAFT như preview hiện tại.
  Sửa REJECTED thành công về DRAFT rồi người dùng publish riêng để kiểm tra lại.
- **FR-17:** Edit/approve không tự gia hạn. Hạn custom và default được đọc lại
  từ server; re-publish sau REJECTED mở kỳ hạn mới theo contract. Nếu slot/hạn đã
  qua lúc thao tác, giữ form và hiển thị lỗi để cập nhật theo response backend.
- **FR-18:** 409 yêu cầu tải lại bản hiện tại, giữ draft riêng để người dùng đối
  chiếu. Không tự nâng expectedVersion và ghi đè hoặc tự gửi lại mutation.

**Nghiệm thu độc lập:** Sửa từng trạng thái, skill bất biến sau publish, clear
arrays, re-moderation, rejected re-publish và hai thiết bị cùng sửa đều đúng.

### US-05 — Hủy trước khi khóa và xem bài hết hạn (P1)

- **FR-19:** Owner ở DRAFT, OPEN, PENDING_MODERATION, REJECTED hoặc NEGOTIATING
  có thể yêu cầu hủy khi chưa khóa. Có xác nhận; “Giữ yêu cầu” không gửi request.
  POST cancel gửi `{expectedVersion}`, chỉ cập nhật CANCELLED sau success.
- **FR-20:** NEGOTIATING không sửa bài nhưng vẫn có thể yêu cầu hủy trước lock;
  server kiểm tra lock. MATCHED/CLOSED/CANCELLED/EXPIRED không có action sửa,
  publish hay hủy LR. Không xóa lịch sử Proposal hoặc tự điều hướng tới Path mẫu.
- **FR-21:** Lock/expiry/version conflict giữ trạng thái server hiện tại sau
  refetch và thông báo phù hợp. Path/Session chưa có ID liên kết trong LR DTO nên
  chỉ giải thích dùng luồng lộ trình đã liên kết; không dựng liên kết giả.
- **FR-22:** Backend áp expiry cho OPEN/PENDING_MODERATION ngay khi đọc, kể cả
  worker chậm. Cached OPEN/PENDING có deadline đã qua phải GET trước action,
  khi mở editor trực tiếp và trước PATCH có thay đổi, kể cả form mở qua deadline.
  GET lỗi chặn mutation và giữ draft trong cùng phiên; 404/403 áp FR-04.
  GET thành công xét effectiveStatus/version mới: không editable thì khóa;
  version đổi phải đối chiếu theo FR-18, không tự thay baseline rồi PATCH.
  Đồng hồ thiết bị chỉ kích hoạt GET, không ghi EXPIRED; không áp deadline cục bộ
  cho NEGOTIATING/MATCHED/CLOSED hoặc tự refresh lặp khi clock lệch.

**Nghiệm thu độc lập:** Cancel xác nhận/hủy dialog, cancel cạnh tranh với lock,
503 lock reader và expiry khi worker chậm đều không báo thành công giả.

### US-06 — Browse/search/filter và gợi ý (P1/P2)

- **FR-23:** Feed chỉ lấy OPEN còn hạn, search dùng `keyword`, skill dùng
  `skillId`, tag dùng `tagIds`. Tag ANY kết hợp AND với skill/keyword theo backend.
  Keyword tìm title/description/learningGoal theo source hiện tại; placeholder
  không hứa tìm tên người học khi chưa có contract hỗ trợ.
  Không gửi filter ngân sách/số buổi/category text hoặc sort tùy ý chưa hỗ trợ.
- **FR-24:** Search/filter chạy trên server và reset cursor khi đổi điều kiện;
  không lọc/đảo thứ tự trên một page rồi coi là toàn bộ kết quả. Feed/mine giữ
  thứ tự createdAt DESC, id DESC; load-more theo cursor opaque, dedupe theo ID.
  Response của query/target cũ không thay kết quả mới; lỗi load-more giữ page đã tải.
- **FR-25:** Card/detail dùng field thật trong projection. Bỏ budget, số buổi,
  duration, kỹ năng trao đổi lại, reputation/memberSince mẫu nếu không có contract
  riêng. Thiếu avatar dùng fallback, không gán avatar hoặc badge VERIFIED mẫu.
- **FR-26:** Gợi ý P2 dùng `/recommended`, không tính điểm ở client hay đòi mọi
  Sharing Skill phải VERIFIED. Nếu endpoint 503, hiển thị gợi ý chưa khả dụng;
  người dùng có thể chọn feed thường, không gắn nhãn “gợi ý” cho feed thay thế.
- **FR-27:** Tất cả API LR yêu cầu auth. Guest `/explore/requests/[id]` chỉ là
  preview demo hiện có, không gọi API LR hoặc ngụ ý guest được quyền browse thật.
  Deep link vào luồng thật đi qua auth gate.
- **FR-28:** Không self-proposal; chỉ OPEN còn hạn có thể là nguồn Proposal.
  Trong phạm vi này, request thật không chuyển vào form/store Proposal mẫu hoặc
  profile của một người mẫu. Các entry chưa tích hợp có thông báo “Sắp có”.
  Không báo gửi Proposal thành công, tạo Chat, NEGOTIATING, MATCHED, Session hay Hold.

**Nghiệm thu độc lập:** Search/tag/skill nhiều page, đổi query trong lúc tải,
recommended 503, owner mở bài của mình và guest deep link đều đúng scope.

## 5. Phiên đăng nhập, mutation và trải nghiệm

- **FR-29:** Mọi query/cache/draft/callback gắn userId và session generation.
  Logout/đổi account xóa dữ liệu phiên cũ; không để response cũ cập nhật UI, cache,
  toast, navigation hoặc dùng credential mới để phát lại mutation cũ.
- **FR-30:** Khóa action gửi lặp, field và back của editor trong khi pending;
  có loading label. Chỉ success response mới đồng bộ detail, mine, feed và
  recommended bị ảnh hưởng. Refetch sau foreground/focus để nhận thay đổi bên ngoài.
- **FR-31:** Không tự retry mutation khi timeout/mất phản hồi. Kết quả có thể đã
  commit; với ID đã biết, tải lại detail trước khi người dùng quyết định tiếp.
  Create chưa nhận ID cần hướng dẫn kiểm tra My Requests, không tự suy bài vừa
  tạo bằng title hoặc tự POST lại. Không giả định LR có Idempotency-Key hỗ trợ.
- **FR-32:** 400 giữ form và thông báo validation; 401 theo Auth chung; 403 báo
  không được phép; 404 unavailable; 409 refresh/đối chiếu; 429 cho thử lại có kiểm
  soát; 503/network cho retry đọc. Không coi 503 là danh sách rỗng hoặc lỗi moderation.
  GET detail 404/403 áp FR-04; mutation 403/429 giữ input nếu phiên còn hợp lệ,
  không báo thành công, tự gửi lại hoặc suy quyền từ cache. Nghiệm thu riêng account
  không ACTIVE, thiếu grant và policy hạn chế hoạt động mới theo response backend;
  401/session bị thu hồi vẫn theo Auth chung, không giữ draft qua logout.
- **FR-33:** Tái sử dụng theme/components/layout hiện có, safe area và keyboard
  handling. Text tiếng Việt dài, font scale 130%, width 320/375/430 không tràn
  ngang hoặc che nút; control có label và trạng thái disabled/pending. Trạng thái
  không chỉ biểu đạt bằng màu. Nội dung request/reason không diễn giải HTML.
- **FR-34:** Không log token/body/reject reason hoặc nội dung private. Public
  display model chọn field tường minh, không spread raw owner/moderation DTO.

## 6. Điều kiện nghiệm thu

| Mã    | Tình huống và kết quả bắt buộc                                                                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Own list/detail của hai account, auth/deep link, invalid UUID, private 404, cached detail ->404/403, account không ACTIVE/thiếu grant/policy hạn chế và429: đúng scope, Auth và không tự gửi lại.                                        |
| AC-02 | Các biên 9/10/120/121 title, 19/20/3000/3001 description, 9/10/1000/1001 goal; emoji, tiếng Việt tổ hợp, markup: client/code-point và backend validation được kiểm chứng riêng.                                                          |
| AC-03 | Catalog lỗi/empty/inactive; 0/10/11 tags, duplicate/non-UUID: chỉ UUID thật được gửi, không fallback ID mẫu.                                                                                                                             |
| AC-04 | 0/5/6 slots, ngày sai/thiếu offset/quá khứ/end <= start; timezone khác thiết bị/server: không tạo lịch hoặc áp duration Session.                                                                                                         |
| AC-05 | Save/reopen/cancel editor; create timeout; double tap: không báo thành công giả hoặc tự tạo trùng.                                                                                                                                       |
| AC-06 | Publish clean/flagged, config/rule lỗi, Staff approve/reject: đúng status/moderation và reason owner.                                                                                                                                    |
| AC-07 | Edit OPEN/PENDING/REJECTED, published skill immutable kể cả DRAFT sau reject, clear optional arrays, no-change: đúng payload và re-moderation.                                                                                           |
| AC-08 | Version conflict từ thiết bị khác hoặc Staff: giữ draft, refetch và không tự ghi đè bản mới.                                                                                                                                             |
| AC-09 | Cancel trước lock/khi NEGOTIATING; cancel sau lock/terminal; dialog hủy; lock 503: đúng kết quả, lịch sử còn nguyên.                                                                                                                     |
| AC-10 | Default/custom expiry, edit không gia hạn, re-publish; effectiveStatus EXPIRED khi job chậm, editor deep link/form mở qua deadline/pre-PATCH GET lỗi hoặc đổi version: khóa action, giữ draft/đối chiếu, không local-expire states khác. |
| AC-11 | Search/filter/tag ANY nhiều page, query đổi/race, cursor lỗi và page lỗi: thứ tự server, reset/dedupe đúng.                                                                                                                              |
| AC-12 | Recommended thật hoặc 503/snapshot đổi: không dùng feed thay thế như đã cá nhân hóa.                                                                                                                                                     |
| AC-13 | Refresh network/503 giữ last-read với notice; GET404/403 ẩn snapshot/reason và khóa action; response cũ/reason sau sửa/re-publish không thành quyết định mới.                                                                            |
| AC-14 | Logout/đổi account lúc tải/lưu/publish/cancel: response cũ không tác động phiên mới.                                                                                                                                                     |
| AC-15 | Request thật không vào Proposal/profile mock; guest preview không gọi API LR; card/detail không có budget/số buổi/badge mẫu.                                                                                                             |
| AC-16 | Android/iOS, keyboard, Back pending, font lớn, safe area và các width: có bằng chứng UI riêng, không suy từ web preview.                                                                                                                 |

Khi triển khai source, chạy từ `apps/mobile`: `npm run check-types`, `npm run lint`,
`npm run check-structure`, `npm test`. Test trọng tâm là schema/payload, projection,
pagination/race/session và lifecycle response; không dùng helper test làm bằng
chứng API thật. Nghiệm thu runtime cần create → publish clean/flagged → external
moderation → edit/re-publish/cancel và search nhiều page trên môi trường có dependency.

## 7. Dependencies và điểm cần làm rõ

**DEP-01 — Notification (spec riêng):** FR-LR-04/LR-004 của SRS yêu cầu backend
gửi notification khi Staff Reject. Spec 005 bao phủ hiển thị REJECTED và
`moderationRejectReason` của owner. Việc nhận/đọc notification, mark-read và deep
link sẽ được thiết kế, tích hợp và nghiệm thu trong spec Notification riêng.
Thiếu inbox mobile không chặn nghiệm thu core LR, nhưng chưa thể tuyên bố hoàn tất
toàn bộ FR-LR-04 end-to-end cho đến khi dependency Notification được nghiệm thu.

| Mã     | Điểm cần xác minh                                                                                                                     | Tác động/cách xử lý                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 | Catalog reader và public owner projection của LR chưa wired runtime; Skill API tồn tại nhưng là module riêng.                         | Create/publish/edit và feed/detail thật chưa được coi sẵn sàng. Mobile làm adapter/test fixture; nghiệm thu thật chờ backend owner, không sửa API trong task này. |
| GAP-02 | Chưa có HTTP contract Tag catalog cho mobile, mapping Skill/Tag chưa xác minh.                                                        | Không gửi Skill UUID thay Tag UUID. Contract picker/tag filter cần chốt trước triển khai phần tag; không tick hoàn tất FR-LR-01/07 khi còn thiếu.                 |
| GAP-03 | Lock reader và Sharing Skill snapshot hiện trả 503.                                                                                   | Cancel NEGOTIATING và recommended cần runtime riêng; các luồng khác không tự bị đánh dấu blocked nếu không gọi dependency này.                                    |
| GAP-04 | Moderation rule set thực tế/config và migrations chưa được nghiệm thu trong môi trường đang dùng.                                     | Không invent keyword hoặc dùng bộ lọc client; clean/flagged real acceptance chờ config hợp lệ.                                                                    |
| GAP-05 | Own DTO chỉ có skillId/tagIds; không có label snapshot hoặc linked Path/Proposal IDs.                                                 | Resolver tên cần catalog thật; không dựng tên hay deep link bằng fixture. Field thiếu giữ “Thông tin kỹ năng chưa khả dụng”.                                      |
| GAP-06 | TTL 30/90 từ policy backend; SRS chỉ nói theo config. API chưa có config discovery cho mobile.                                        | Không biến 30/90 thành nghiệp vụ client độc lập; server validate/custom và trả expiresAt. Nếu policy đổi, cập nhật contract trước UI copy.                        |
| GAP-07 | Proposal/Chat/public profile/guest preview vẫn mock; không có consumer API được mobile tích hợp.                                      | Entry trên request thật tạm “Sắp có”; FR-LR core không được tuyên bố đã hoàn thành Matching.                                                                      |
| GAP-08 | Backend spec cũ còn nhắc V1.5; GET owner có effectiveStatus, mutation response không có; PATCH DTO kiểm tra raw text trước sanitizer. | Dùng source checkpoint, bổ sung acceptance raw markup/Unicode; không giả định mọi response cùng shape/validation pipeline.                                        |

Các gap là câu hỏi contract hoặc điều kiện tích hợp, không phải yêu cầu mở rộng
backend đã được giao. Spec đã có plan/contracts/tasks và phần mobile được triển khai
theo checkpoint; recovery mobile đã có source/fixture evidence 2026-10-12,
Tag và nghiệm thu API thật/native còn pending theo task/gate.
GAP-09 / B08: user yêu cầu lịch rảnh lặp tuần (UI correction2026-10-12), nhưng API
chỉ lưu preferredSlots ngày cụ thể. UI draft đã có; lưu/reopen/public/matching lịch
tuần chưa có contract. Backend owner cần chốt timezone/weekday/HH:mm và compatibility;
T036 pending. Không coi phần lịch tuần hoàn tất từ fixture UI.

Redesign Figma, polling realtime, offline draft và policy mới ngoài yêu cầu đã chốt vẫn ngoài phạm vi;
tài liệu được bổ sung không chứng minh source hoặc API/native đã nghiệm thu.
