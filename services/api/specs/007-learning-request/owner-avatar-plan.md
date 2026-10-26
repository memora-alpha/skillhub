# Plan bổ sung avatar người đăng Learning Request

Ngày: 2026-10-26. Trạng thái: **Đã được người dùng duyệt và triển khai backend;
kiểm chứng local hoàn tất, smoke staging/mobile còn chờ**.

## 1. Mục tiêu và phạm vi

Bổ sung `owner.avatarUrl: string | null` vào ba response public:

- `GET /api/v1/learning-requests`: từng phần tử trong `data`.
- `GET /api/v1/learning-requests/recommended`: từng phần tử trong `data`.
- `GET /api/v1/learning-requests/:id`: `data.owner` khi trả public detail.

Ví dụ phần owner sau thay đổi:

```json
{
  "owner": {
    "id": "22222222-2222-4222-8222-222222222222",
    "displayName": "Nguyễn An",
    "avatarUrl": "https://storage.example/skillhub/avatars/example?signature=example"
  }
}
```

`avatarUrl` luôn có mặt: URL ký khi avatar hiện tại được phép hiển thị, `null`
khi chưa có avatar hoặc avatar không ở trạng thái `CLEAN`. Không trả chuỗi rỗng,
URL mặc định hoặc bỏ field. Ví dụ URL ở trên chỉ minh họa cấu trúc, không phải
URL dùng thực tế.

“Public” là projection được người xem có quyền đọc, không phải truy cập ẩn danh.
Giữ nguyên auth, permission, scope, expiry, pagination, filter và recommendation.
Owner detail và moderation detail là hai projection riêng, không thêm owner vào
chúng trong bản fix này. Không sửa mobile/web, schema, migration hoặc rate limit.

## 2. Hiện trạng đã xác minh trước triển khai

| Vị trí                                                                                                                                | Hiện trạng                                                                                           | Ý nghĩa với bản fix                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/modules/learning-requests/application/ports/learning-request-dependencies.ts`                                                    | `RequestOwnerReader.readPublicOwners()` chỉ khai báo `id`, `displayName`                             | Cần mở rộng contract nội bộ, không gọi profile HTTP từ backend.                                   |
| `src/modules/users/application/services/skill-actor.service.ts`                                                                       | `readPublicOwners()` dùng `user.findMany`, chỉ select `id`, `fullName`                               | Nguồn dữ liệu thiếu avatar nằm tại adapter Users.                                                 |
| `src/modules/learning-requests/application/use-cases/list-learning-requests.use-case.ts`                                              | Feed/recommended dùng chung public projection; gom owner ID duy nhất rồi gọi reader một lần cho page | Giữ batching sẵn có, không chuyển N request phụ từ mobile thành N truy vấn profile trong backend. |
| `src/modules/learning-requests/application/use-cases/get-learning-request.use-case.ts`                                                | Detail chọn owner/moderation/public theo actor; public detail gọi cùng reader                        | Mở rộng đúng nhánh public mà không thay đổi quyền hoặc response private.                          |
| `src/modules/learning-requests/application/contracts/learning-request.types.ts` và `presentation/http/learning-requests.responses.ts` | Public summary, detail, recommendation dùng chung cấu trúc owner                                     | Cập nhật cả TypeScript và OpenAPI, tránh runtime có field nhưng Swagger thiếu.                    |
| `src/modules/users/application/services/profile-reader.service.ts`                                                                    | Profile chỉ tạo URL cho avatar `CLEAN` qua `AvatarStorage.url()`                                     | Dùng lại policy và storage adapter hiện hành.                                                     |
| `src/infrastructure/storage/avatar-storage.ts`                                                                                        | URL ký S3 có hạn 60 giây; credentials cấu hình trực tiếp                                             | Ký URL không cần tải ảnh; không đổi thành URL public lâu dài.                                     |
| `prisma/schema.prisma`                                                                                                                | User đã có `selectedAvatarRecord`, liên kết `AvatarAsset` hiện tại                                   | Không cần lưu thêm avatar trong Learning Request hoặc chạy migration.                             |

SRS V1.6, BR-28/PRO-002 cho phép avatar trong dữ liệu profile công khai và cấm
email/thông tin đăng nhập/thanh toán riêng tư. Yêu cầu field cụ thể trong ba API
là amendment từ yêu cầu hiện tại của người dùng, không diễn giải thành nghiệp vụ mới.

## 3. Các đề xuất và lý do

### A. Mở rộng reader Users đang có

- Thêm `selectedAvatarRecord` vào select trong `readPublicOwners()`, chỉ lấy
  `state`, `storageKey` cần để quyết định và ký URL.
- Inject `AvatarStorage` vào `SkillActorService`; provider này đã có trong
  `IdentityModule`. Giữ binding `REQUEST_OWNER_READER -> SkillActorService`.
- Chỉ ký cho avatar được User đang chọn và có state `CLEAN`. Không chọn avatar
  upload gần nhất hay một asset khác của người dùng.
- Trả allowlist `{ id, displayName, avatarUrl }`; không trả raw Prisma User,
  `selectedAvatarRecord`, `storageKey` dưới dạng field riêng hoặc scan metadata.

**Lý do:** Users tiếp tục sở hữu policy avatar; Learning Requests chỉ sử dụng
projection qua port hiện có. Cách này có phạm vi nhỏ, không tạo module/service
mới hoặc kéo toàn bộ profile/sharing skills vào feed.

### B. Giữ xử lý theo lô và không lưu snapshot avatar

- Duy trì một lần gọi `readPublicOwners()` cho các owner ID duy nhất trong page.
- Reader dùng một `findMany` với nested select, không `findUnique`/`profile()`
  trong vòng lặp; input rỗng trả `[]` ngay.
- Ký URL bằng `Promise.all` trên tập owner duy nhất; mỗi owner có avatar hợp lệ
  ký tối đa một lần mỗi response. List hiện giới hạn tối đa 100 phần tử.
- Không gọi `GET /profiles/:userId`, không đọc/HEAD object từ S3 để lấy URL.
- Không lưu URL ký trong Learning Request hoặc thêm cache Redis cho bản fix này.

**Lý do:** số lần đọc metadata không tăng tuyến tính theo từng card; cùng owner
ở nhiều card dùng chung kết quả. Prisma có thể thực thi relation bằng nhiều SQL
tùy chiến lược, nên tiêu chí là truy vấn theo lô với số query có giới hạn, không
khẳng định nested select luôn tương đương một SQL JOIN. Đọc avatar hiện tại giúp
response mới phản ánh đổi/xóa avatar mà không cần đồng bộ dữ liệu sao chép.

### C. Một contract owner rõ ràng, đồng bộ runtime và Swagger

- Khai báo một type `LearningRequestPublicOwner` tại application contracts gồm
  `id`, `displayName`, `avatarUrl: string | null`.
- Dùng type này trong `RequestOwnerReader`, `LearningRequestSummary.owner` và
  tham số owner của `projectSummary()`; detail kế thừa summary như hiện tại.
- Public list/detail dựng owner theo đúng ba field được phép, tránh chuyển tiếp
  object tùy ý nếu reader sau này được mở rộng.
- Dùng `LearningRequestPublicOwnerResponse` làm Swagger schema của
  `LearningRequestSummaryResponse.owner`, với ba field bắt buộc và `avatarUrl`
  string nullable. Detail/recommendation nhận schema qua inheritance hiện có.
  Điều chỉnh từ đề xuất inline ban đầu: test OpenAPI phát hiện khai báo inline
  `required: [...]` không đánh dấu `owner` bắt buộc ở cấp response. DTO riêng
  mô tả đúng cả hai cấp; test xác nhận generated schema thực tế.

**Lý do:** nullable và optional là hai contract khác nhau. Client cần phân biệt
“không có avatar” với field bị thiếu; type và Swagger phải mô tả cùng response.
Thêm field là thay đổi cộng thêm, giữ nguyên API v1; kiểm tra decoder nghiêm ngặt
của consumer khi rollout thay vì giả định mọi client đều bỏ qua field lạ.

### D. Giữ cùng thời hạn URL và semantics lỗi với profile

- Dùng nguyên `AvatarStorage.url()`, TTL hiện tại 60 giây.
- Không có avatar hoặc state `QUARANTINED`/`REJECTED`/`DELETED` -> `null`, vẫn
  trả Learning Request thành công; không gọi signer cho các trường hợp này.
- Không tìm thấy owner vẫn giữ lỗi projection unavailable hiện tại; không đổi
  thành owner giả hoặc âm thầm bỏ bài, vì sẽ ảnh hưởng pagination.
- Nếu signer lỗi, giữ luồng lỗi hiện hành, không nuốt lỗi rồi coi là “không có
  avatar”; test phân biệt lỗi kỹ thuật với `null`. Không log URL ký đầy đủ.

**Lý do:** nhất quán với API hồ sơ và quyền đọc storage hiện tại. Đổi TTL, bucket
public hay CDN cần đánh giá riêng về quyền/cache; không phải điều kiện để thêm
field. URL đã cấp và ảnh đã cache vẫn chịu chính sách hết hạn/cache hiện có,
không hứa thu hồi tức thì khi avatar đổi trạng thái.

**Ảnh hưởng mobile cần ghi rõ:** response mới đủ dữ liệu để bỏ profile lookup
chỉ phục vụ avatar, nhưng mobile cần dùng field mới thì số request mới giảm.
Đây là bước tích hợp riêng, không sửa app trong plan backend này. Signed URL
có thể hết hạn nếu list cache lâu rồi mới tải ảnh, đặc biệt khi cuộn xuống card
chưa từng render. Test smoke cả mở list ngay và mở từ cache sau 60 giây; nếu
client chưa có cách xử lý, cần thống nhất follow-up refresh projection hoặc
thiết kế URL/TTL/cache trước khi tuyên bố xử lý trọn vấn đề hiển thị avatar chậm.
Client cũ vẫn hoạt động nhưng chưa hưởng lợi; tải bytes ảnh qua URL vẫn cần.

## 4. Thứ tự triển khai sau khi plan được duyệt

1. Mở rộng type/port/Swagger; cập nhật public mapper và test doubles của reader.
2. Mở rộng select và ký URL trong reader Users; giữ transaction context đang có.
3. Thêm test hành vi và kiểm tra HTTP/OpenAPI; kiểm tra DI consumer của
   `SkillActorService` vì constructor có thêm dependency.
4. Cập nhật `contracts/http.md`, `contracts/module-ports.md`, `quickstart.md`
   của spec007 về field nullable, CLEAN-only và TTL 60 giây; liên kết amendment
   từ `plan.md`. Ghi kết quả thật vào `validation.md` sau khi chạy checks.
5. Rollout backend trước, smoke ba endpoint; bàn giao mobile dùng field mới.
   Không cần migrate, seed quyền hay thay biến môi trường. Rollback code sẽ
   bỏ field mới; client khi rollout cần chịu được response backend cũ.

Các file test dự kiến thay đổi: `test/learning-requests/query.test.mjs`,
`test/learning-requests/projection-http.test.mjs`; thêm
`test/learning-requests/owner-avatar.test.mjs` cho reader Users và đưa vào
script `test:learning-request` trong `services/api/package.json`. Rà soát test
khởi tạo trực tiếp `SkillActorService` tại learning-requests/skills và wiring
IdentityModule; chỉ cập nhật fixture/consumer cần thiết.

## 5. Kiểm thử và tiêu chí nghiệm thu

| Nhóm                 | Trường hợp và kết quả cần chứng minh                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract ba endpoint | Có avatar CLEAN -> `owner.avatarUrl` là string; không có avatar -> field hiện diện với `null`; kiểm tra JSON HTTP thực và public branch của detail bằng actor khác owner.                                          |
| Trạng thái asset     | Selected asset CLEAN được ký; absent/QUARANTINED/REJECTED/DELETED đều null và signer không được gọi; không lộ storage metadata.                                                                                    |
| Batching             | Nhiều bài trùng và khác owner: reader nhận IDs duy nhất đúng một lần; một batch findMany, không đọc profile từng owner, ký một lần mỗi owner hợp lệ; page rỗng không đọc owner. Kiểm tra ở cả FEED và RECOMMENDED. |
| Dữ liệu hiện tại     | Đổi/xóa selected avatar rồi đọc response mới: URL mới/null phản ánh dữ liệu hiện tại, không URL snapshot của bài đăng.                                                                                             |
| Scope/security       | Owner/moderation detail không bị thêm public owner; các case 401/403/404, bài private/hết hạn, private-field allowlist vẫn đúng. Missing owner và signer lỗi không bị biến thành avatar null.                      |
| Pagination/matching  | Filters, cursor, thứ tự và matchScore không đổi khi owner có/không có avatar.                                                                                                                                      |
| OpenAPI              | Owner yêu cầu cả ba field; avatarUrl string nullable tại summary/detail/recommendation; detail tiếp tục mô tả đủ các projection.                                                                                   |
| Tích hợp             | Qua PostgreSQL test database, chứng minh nested selection lấy đúng asset đang chọn và trạng thái; qua HTTP staging, URL CLEAN tải được ảnh và null không làm lỗi list.                                             |
| Consumer             | Chạy các regression Users/Skills chịu ảnh hưởng DI; smoke mobile mở ngay và list cache sau TTL. Khi mobile dùng field mới: không gọi profile chỉ để lấy avatar trong ba luồng này.                                 |

Checks dự kiến từ root, chạy tuần tự để tránh build cùng ghi `dist`:

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api test:learning-request
pnpm --filter api test:identity
pnpm --filter api test:skills
pnpm --filter api test:learning-request:integration
```

`test:learning-request`/integration tự build. Test tích hợp mới cần đưa vào suite
tích hợp hiện có; chỉ chạy với test database qua guard env của repo. Không có
hạ tầng thì ghi Pending, không coi mock test là bằng chứng PostgreSQL/S3 thật.
Không tăng scope thành benchmark toàn hệ thống; batching và network smoke là
bằng chứng phù hợp cho bản fix, không cam kết P95 hoặc hết mọi HTTP 429.

## 6. Constitution Check

Đối chiếu constitution v1.2.0, kiểm tra lại sau triển khai ngày 2026-10-26.
Các nguyên tắc scope/store/privacy/contracts/ownership đã được đối chiếu source
và test local. Verification: **Pass cho backend local** (126 Learning Request,
12 Identity, 13 Skills và 15 PostgreSQL/HTTP); smoke S3 staging/mobile vẫn Pending.
Bảng dưới giữ đánh giá thiết kế ban đầu; trạng thái triển khai tại đây và
[validation.md](validation.md) là bằng chứng mới nhất.

| Nguyên tắc            | Trạng thái                         | Áp dụng                                                                                                                             |
| --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Scope/modular     | Pass thiết kế                      | Chỉ backend Users/Learning Requests và tài liệu/test tương ứng.                                                                     |
| 2/3 — Store/atomicity | Pass thiết kế                      | PostgreSQL giữ User/AvatarAsset; đọc trong transaction context hiện có, không thêm write, migration hoặc transaction xuyên storage. |
| 4 — Auth/privacy      | Pass thiết kế                      | Giữ guards/scopes; chỉ avatar CLEAN và public owner allowlist.                                                                      |
| 5 — API/storage       | Pass thiết kế                      | Field bắt buộc nhưng nullable, Swagger đồng bộ, URL qua storage adapter hiện có.                                                    |
| 6 — Verification      | Pass local; Pending staging/mobile | Đã chạy suite backend và PostgreSQL/HTTP; xem validation.md cho phạm vi, công cụ và giới hạn.                                       |
| 7 — Ownership         | Pass thiết kế                      | Users đọc avatar; Learning Requests dùng reader port, không truy cập thẳng bảng User/AvatarAsset. Không lưu projection lâu dài.     |
| 8 — Jobs/events       | Không áp dụng                      | Không thêm job, event, webhook hoặc outbox.                                                                                         |

Không có constitution exception hoặc business rule mới cần đặt mặc định.
Điểm review chính: contract bắt buộc/nullable; tiếp tục TTL 60 giây; không đổi
owner/moderation projection; lỗi signer giữ cơ chế lỗi hiện tại; mobile consumption
và xử lý URL hết hạn là bước tích hợp cần được kiểm chứng riêng.
