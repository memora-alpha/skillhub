# Plan — Spec 004

Cập nhật: 2026-10-12. Implementation theo [spec](spec.md) đã có ở `apps/mobile`;
chỉ root `pnpm-lock.yaml` đổi để đồng bộ bốn dependencies Expo mới: crypto,
document picker, image và network. Backend/shared
không đổi. Tiến độ và nghiệm thu theo [tasks](tasks.md)/[validation](validation.md).

## 1. Baseline trước implementation

- Expo `~57.0.26`, Expo Router, TanStack Query, React Hook Form và Zod đã có.
- Chưa có `src/features/skills` hoặc route My Skills.
- `ProfileScreen` và self-preview truyền `available=false`; Quản lý/Xác minh
  mở notice. `toOwnProfilePreview` trả `sharingSkills: []` do chưa tích hợp.
- `src/lib/http/client.ts` có Auth generation guards, JSON/multipart và renewal,
  nhưng chưa có Idempotency-Key; `response.ts` chỉ trả `payload.data`.
- QueryProvider mặc định không retry query/mutation. ProfilePreviewProvider chỉ
  lấy account projection. Giữ các boundary này khi thêm Skills.
- Backend skills/sharing-skills/verifications có source; runtime chưa kiểm chứng.

## 2. Bố trí implementation

`src/features/skills` sở hữu API parsers/adapters, form schema, query/mutation
hooks, screens/components và helpers evidence. Public exports qua `index.ts`.
`src/app` chỉ parse params/gate/render screen; không fetch/business logic.
Profile import Skills qua public API; Skills không import private Profile/Auth.
Chỉ tạo folder có file; giữ `screens` theo code hiện tại.

Theo architecture: source target ≤250 dòng, routes ≤80, views/components ≤220,
hooks/API/schema/utils ≤180; script hiện kiểm hard limit route100,
API/hooks/utils/schema250, source khác400. Không nâng giới hạn để thêm feature.

## 3. Thứ tự thực hiện

### A. Transport và contract

1. Thêm request option dành cho Idempotency-Key, chỉ JSON mutations cần key;
   không cho feature thay Authorization hoặc tạo axios riêng.
2. Thêm paginated request/parser giữ `data` và `meta.pagination` mà không thay
   return shape của `client.request` đang dùng trong Auth/account/avatar.
   Cả hai đường phải dùng chung session/renewal/error handling.
3. Parsers riêng cho catalog, own/public Sharing Skill, batch/evidence/file state;
   validate UUID/enum/version/decimal string và pagination. Unknown shape thành
   protocol error, không silently empty hoặc cast nested `skill` thành `PublicSkill`.
4. Guard quyền hiện tại bằng response server; không suy quyền chỉ từ role.
   Status/error mapping ở feature, không sửa thông điệp OTP để phục vụ Skills.

### B. Read và form flows

1. Query keys chứa generation/userId/resource/filter; catalog search reset pages.
   Dùng paginated/infinite query phù hợp; cancel/ignore kết quả search cũ.
2. Own detail lookup đúng sharingSkillId từ cache/list; cold start đi qua cursor
   tới ID hoặc hết dữ liệu, dừng khi đổi target/phiên. Không gọi endpoint giả.
3. Form create/edit với draft/baseline, code-point trim/NFC và decimal string/null.
   Pending synchronous lock; giữ draft và yêu cầu xem lại khi stale.
   Lưu form tạo có evidence: create → upload → READY → submit → refresh và
   dismiss về own list. Giữ ID server khi file/submit lỗi để retry không create
   trùng; không file thì chỉ create. Draft/fileIds chuyển theo ID vào Map phiên.
   Form edit kỹ năng hiện có vẫn có hành động gửi bằng chứng riêng.
4. Mutation intent giữ key/body trong phiên; tạo intent mới khi body/version đổi.
   Unknown outcome cung cấp refetch và explicit retry, không reset key tự động.
5. Visibility/xóa dùng returned DTO và invalidate các query phụ thuộc. Xóa dùng
   endpoint archive, bỏ bản khỏi cache/draft sau xác nhận server rồi về list.
   Tombstone theo phiên chặn response cũ/refresh lỗi làm bản đã xóa hiện lại;
   list/detail luôn dùng includeArchived=false, không có archive toggle/read-only UI.
6. Bộ lọc badge đọc các trang owner tới trang có kết quả khớp hoặc hết dữ liệu;
   giữ cursor server, chặn cursor lặp và tách query key theo filter.

### C. Evidence và verification

1. Xác định document picker và mở download phù hợp SDK 57/native/web, đọc Expo
   skills liên quan trước implementation. Cài Expo packages bằng expo install
   khi cần, giữ npm/pnpm lockfiles theo README; không đổi SDK.
2. Draft file riêng với localId/URI/name/MIME/size và status/fileId.
   Không encode toàn bộ file vào global store; không lẫn fileId/evidenceId/batchId.
3. Upload từng file, status từng file; status polling có bounded backoff, manual
   retry và AppState/focus/session cleanup. Thời gian chờ UI không phải SLA Staff.
4. Submit fileIds READY; retry JSON giữ key/body, retry multipart là upload mới.
   Sau submit bỏ draft đã gửi và refresh list/history/account/public self.
5. History/detail dùng response dedicated. `latestVerification` chỉ parse batch
   metadata cần thiết; không chứa file list. Badge không tính từ history page.
6. Download lấy link mới khi bấm, không giữ signed URL như server entity;
   error/expired/permission denied hiển thị an toàn.

### D. Profile integration

1. Own list hook cấp trạng thái explicit cho ProfileSkills; empty chỉ sau load.
2. Self-preview đọc `GET /profiles/{ownUserId}/skills` với pagination và public
   allowlist; không truyền owner metadata hoặc lọc own list để giả kết quả server.
3. Mutation refresh counter bằng own account, không cộng/trừ cục bộ.
4. Giữ profile target demo và `/user/[id]` proposal fixtures theo spec 003;
   không mở rộng public-profile API hay liên hệ người dạy trong spec 004.

### E. Đối chiếu BE và sửa mobile — 2026-10-12

1. Create/edit/visibility lưu owner DTO vào cache phiên trước refresh; giữ phiên
   bản mới hơn đã đọc, cập nhật các list/filter đã tải mà không tạo pagination.
   Public chỉ cập nhật row đã có qua allowlist hoặc loại row không còn hiển thị;
   không ghép own list thành danh sách public mới hoặc tính counter cục bộ.
2. History/detail nhận quyết định cùng batch/version mới thì bỏ snapshot PENDING
   cũ và invalidate owner/detail/public/account. Badge/version của Sharing Skill
   vẫn phải đọc từ BE, không tính từ trạng thái batch.
3. Web multipart dùng MIME format đã kiểm tra khi File.type rỗng/generic;
   byte giữ nguyên. Precheck filename theo policy BE, gồm basename và extension
   nguy hiểm ở giữa. Backend restore đã có nhưng không mở UI restore trong spec này.
4. Kiểm chứng bằng tests cache/bytes/privacy/version và browser fixtures;
   API thật/scanner/native giữ pending nếu môi trường chưa sẵn sàng.

### F. Lưu form tạo kèm bằng chứng — 2026-10-12

`save-skill.ts` điều phối create/update và ghi snapshot ID trước file I/O;
`use-skill-save.ts` giữ bản đã tạo và trả về My Skills sau khi save được xác nhận,
kể cả evidence lỗi; toast lỗi nêu rõ phần chưa hoàn tất. Save chưa xác nhận thì
giữ form. VerificationForm cung cấp pipeline gửi cho ID vừa tạo, dùng chung
prepare/scan/session guards và idempotent submission với luồng gửi riêng.
Busy/metadata khóa form; bản đã tạo hoặc fileIds đã upload không bị gửi tạo lại.
Draft và submit intent được giữ theo skillId/phiên để mở lại và thử gửi, kể cả
unknown outcome. Form có gợi ý level cho ngôn ngữ/lập trình, không thêm API policy.

My Skills ghép các response create đã xác nhận trong scope phiên với các trang
đã tải, ưu tiên lượt tạo sau trước và chọn version mới hơn; không thay pagination.
Edit không đổi thứ tự tạo. BE chưa trả thời gian/sort owner list nên việc sắp toàn
bộ dữ liệu cũ theo thời gian tạo còn pending; xem GAP-09. Không mở phạm vi BE.

Constitution Check cho amendment: phạm vi mobile, shared HTTP/session, feature
boundary và server-authoritative badge/version/counter được giữ. Không thay BE,
SDK, dependency versions hoặc API contracts. Runtime/native evidence còn pending.

### G. Chi tiết kỹ năng công khai — 2026-10-13

PublicSelfSkillList mở route public-skills theo userId/Sharing Skill ID.
`find-public-skill.ts` chỉ đi qua public pagination; query/cache riêng không
lấy own detail, kể cả chủ hồ sơ tự xem. Screen reuse SkillCard đầy đủ nội dung,
không mount history/evidence/actions. Hidden/archive xóa cache public detail;
unknown/error không fallback sang dữ liệu riêng tư. Profile fixtures mở modal
chi tiết mẫu bằng field public có sẵn qua SamplePublicSkillRow. Không nối thêm
API hồ sơ người khác, không đổi BE/shared/dependencies. Kiểm chứng privacy,
pagination/cursor/cancel, hidden/sai owner, retry, navigation và các fixture.

## 4. Kiểm chứng cần có

Tests tập trung vào nguy cơ thật: HTTP key/meta và renewal không phá caller cũ;
pagination/filter race; decimal/Unicode; stale version/idempotent retry;
badge vs batch vs evidence; multipart không replay; logout/account switch.
HTTP fixtures phủ empty/error/409/413/415/503, delayed save/scan và response cũ.

Từ `apps/mobile`: `npm run check-types`, `npm run lint`,
`npm run check-structure`, `npm test`, `npm run test:profile` khi profile thay đổi.
Kiểm tra affected consumers Auth/account/avatar vì transport dùng chung.

API thật: create/reopen/edit/visibility/archive; own/public pagination; evidence
scan READY, submit, reviewer decision và refresh/download quyền đúng.
Review decision dùng môi trường/tài khoản test được phép, không triển khai Staff UI.
Native Android/iOS và web ghi riêng; fixtures/browser không chứng minh native picker.

Chỉ đánh dấu checklist khi có bằng chứng trong [validation](validation.md).
Các gap của spec không phải yêu cầu tự sửa backend; ghi lại và giữ scope mobile.
