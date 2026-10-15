# Validation — Spec 004

## Rà soát trước commit — 2026-10-15

Checklist/tasks/plan/spec đã đồng bộ lại ngày 2026-10-15: phần kiểm tra mobile
để commit có checkbox riêng; AC-01..16 giữ trạng thái nghiệm thu tổng thể và
ma trận bằng chứng/phần còn thiếu. Admin catalog API thật được ghi riêng với
User/mobile acceptance; JS/Hermes export được tách khỏi chạy trên thiết bị.

Chạy lại trên working tree hiện tại: lint, check-types, structure (460 source
files), 296/296 tests mobile, 6/6 commit-scope tests, Prettier cho các file thay
đổi và git diff whitespace checks (staged/unstaged) đều đạt. Đã sửa formatting
của plan/checklist và cập nhật tài liệu active theo pnpm-only; giữ nguyên lịch
sử kiểm tra npm/pnpm của các revision cũ bên dưới.

Mobile `.gitignore`, README và staged deletion của npm lock đã được rà soát.
Theo yêu cầu cuối, giữ nguyên root `.gitignore`; các quy tắc mới chỉ áp dụng
trong mobile. Root pnpm-lock.yaml được xác minh
bằng pnpm 10.24.0: `install --lockfile-only --frozen-lockfile --ignore-scripts`
thành công trên cả 6 workspace; đây là kiểm consistency lockfile, không phải
cài sạch hoặc chạy mọi workspace. Expo dependency check offline báo up to date;
online check không hoàn tất vì quyền ghi cache Expo ngoài workspace.

Expo export all đạt Web 1977, Android 2422 và iOS 2485 modules, gồm Hermes
bundles native. Đây là JS/assets export, không phải build native binary hoặc
kiểm chứng trên thiết bị. Artifacts ignored ở `.expo/skills-commit-export/`.

Browser fixtures chạy lại trên web export hiện tại:

- `.expo/skill-commit-readiness-browser.cjs`: 5 nhóm/64 requests; level động,
  đổi catalog/reset selection, lookup lỗi/chậm, mô tả/tên dài 320/375/430,
  level lịch sử inactive, profile/detail, catalog rỗng, ẩn/hiện có version,
  hủy xóa không mutation và xác nhận archive chỉ một request rồi card biến mất.
- `.expo/evidence-background-browser.cjs`: 5 kịch bản tạo hai ảnh, partial
  failure/retry trên VERIFIED, nén, giữ ảnh gốc và scan lâu/kiểm tra lại. Mỗi
  trường hợp chỉ submit một lần sau READY; retry không upload lại ID đã có.
  Điều hướng fixture 164/124/175/75/116 ms; không phải benchmark API/native.
- Cả hai không có page error. Kết quả ignored tại
  `.expo/skills-validation/skill-commit-readiness-result.json` và
  `evidence-background-result.json`.

Rà 63 file thay đổi theo các mẫu private key, JWT, GitHub token và mật khẩu được
cung cấp: không phát hiện khớp. `.env`, `.expo` và npm lockfile được ignore;
specs vẫn được theo dõi. Không đổi services/api hoặc packages. Chưa stage thêm,
commit/push, gọi mutation API thật hoặc kiểm tra thiết bị trong lần rà soát này.
Không có lỗi source/check cản commit được phát hiện; native/full API/scanner
acceptance tiếp tục Pending, với lỗi upload 503 thật đã ghi nhận bên dưới.

## Pipeline và trạng thái scan lâu, mobile-only — 2026-10-15

Theo yêu cầu chỉ sửa mobile: không thay source/configuration/migration/deployment
BE. Hai worker pipeline chuẩn bị/nén rồi upload từng file. Upload lỗi đợi các
upload đang chạy kết thúc để giữ ID trước khi cho retry; không tự replay bytes.
Card hiển thị chuẩn bị/tải/kiểm tra/gửi request, giữ badge riêng. Poll 48 reads:
0,5/1/2/3 giây ban đầu, sau 24 reads dùng 5 giây; tổng 183,5 giây chờ, chưa gồm
HTTP. Sau 24 reads báo kiểm tra lâu; hết lượt còn QUARANTINED/SCANNING giữ trạng
thái WAITING_SCAN, toast thông tin và Kiểm tra lại. Kiểm tra lại giữ fileIds,
không upload lại, chỉ READY mới submit. Terminal scan/HTTP 503 vẫn là lỗi;
pause/session/archive và submit intent giữ các boundary trước đó.

Checks: 296/296 tests, lint, check-types và structure (460 source files) đạt.
Sáu regression mới kiểm scan vượt 65 giây, concurrency tối đa hai, pipeline
không chờ nén cả batch, đợi upload đang chạy khi lỗi, WAITING_SCAN/recheck và
503 không tự replay. Web export đạt 1977 modules.

Browser fixture `.expo/evidence-background-browser.cjs` đạt 5 kịch bản: tạo hai
ảnh, partial failure trên skill VERIFIED rồi retry, nén ảnh, giữ ảnh gốc và scan
lâu. Thời gian từ thao tác tới điều hướng lần lượt 91/71/151/66/151 ms trong
fixture; đây không phải đo hiệu năng API/native thật. Không page error. Case scan
lâu rút ngắn timer trong browser để kiểm exhaustion, không submit trước READY,
không hiện lỗi upload; Kiểm tra lại chỉ đọc IDs và submit một lần. Tổng vẫn hai
upload, không phát sinh upload thứ ba. Xem lại ảnh waiting-scan 320 và sending
375; kiểm không tràn ngang ở 320/375/430. Evidence ignored dưới
`.expo/skills-validation/evidence-card-waiting-scan-{320,375,430}.png` và
`evidence-background-result.json`.

API thật trước thay đổi: ảnh PNG mẫu 68 bytes trả 503 ở evidence-files sau
673 ms (2026-10-15T09:32:54.333Z), correlation
`580ed123-aed3-457b-a7bf-ab33381fe1b1`. Bản Sharing Skill ẩn dùng chẩn đoán đã
archive; không submit xác minh. Health/ready trả 200 cho PostgreSQL/MongoDB/Redis,
không chứng minh S3/scanner sẵn sàng. Chưa có log runtime để kết luận nguyên nhân.
Amendment mobile này không khắc phục lỗi server 503. Native và full API/scanner
acceptance vẫn Pending; không thực hiện thêm mutation trên server để kiểm bản mới.

Các mục bên dưới là bằng chứng của các revision trước.

Cập nhật: 2026-10-14. Amendment hiện tại trên `fix/mobile-skill` từ `dev`
`2f73c3c`. Nền implementation trước đó trên `feat/mobile-skills` từ `dev`
`0790c3b`. Phạm vi theo [spec](spec.md), nghiệm thu theo [checklist](checklist.md).
Implementation có ở mobile; full API/scanner và Android/iOS còn pending.

## Gửi trong phiên, card trạng thái và nén ảnh — 2026-10-14

Theo quyết định của người dùng, skill save xác nhận là về My Skills ngay. Job
thuộc SkillsProvider tiếp tục nén/upload/scan/submit qua đổi màn; card owner hiện
spinner Đang gửi bằng chứng…, Chờ duyệt sau response PENDING, hoặc Gửi chưa hoàn
tất + Thử lại. Retry là sibling của vùng mở detail, tránh nested Pressable.
Badge VERIFIED giữ độc lập. Chỉ Send bị khóa khi job cùng skill đang chạy;
edit/visibility vẫn mở. Toast ghi skill đã lưu và kết quả submit riêng.

Job giữ draft/fileIds/intent theo phiên. Pause abort và giữ retry; resume chỉ
mở lại khả năng gửi, không tự POST. Create vừa trả về trong lúc app background
cũng chỉ giữ draft, không bắt đầu upload. Archive/log out chặn callback cũ và
queue lại ID đã xóa. Decision đúng batch gỡ marker PENDING. Đây là tác vụ trong
phiên khi app đang hoạt động, không phải OS background/durable queue; app closure
không phục hồi file draft. Đã bỏ pipeline/poll gắn với focus màn hình.

Nén dùng ImageManipulator ~57.0.21 và FileSystem ~57.0.7 cài qua Expo CLI;
npm lock và root pnpm lock đồng bộ. Root diff chỉ importer mobile/package mới,
không đổi API/shared/consumer khác. Shared mobile Checkbox thêm disabled tùy chọn
cho Keep original; Auth/account/profile consumers nằm trong suite đầy đủ.
Ảnh >2 MB thử JPEG quality 0,9, không gọi crop/resize; chỉ dùng output nhỏ hơn
và hợp lệ với name/MIME/size/URI nhất quán. File nhỏ, PDF/Word, ID đã upload và
Keep original giữ bytes; nén lỗi/bản lớn hơn dùng original và không nén lại liên tục.

Checks source cuối: 290/290 tests, typecheck, lint, structure (459 source files),
Prettier/diff check và web export (1976 modules) đạt. Bộ tests mới gồm session
job/duplicate/partial failure/unknown submit key/READY recheck/pause/resume/late
session/archive/decision/replayed approval và policy nén/fallback/original.

Browser `.expo/evidence-background-browser.cjs` đạt 4 scenario, không page error:
create với hai ảnh về list trong 142 ms khi submit chưa xảy ra; mở detail trong
lúc gửi, Send disabled còn edit/visibility enabled; gửi lỗi trên skill VERIFIED
rồi retry không upload lại ảnh đã có ID, chỉ một submit. Card sending ở
320/375/430 không tràn ngang. Pending sau submit giữ badge VERIFIED riêng.
Hai case lớn xác nhận dimensions vẫn 1800×1400: PNG 6.796.900 bytes → JPEG
1.043.731 bytes; Keep original gửi PNG với bytes giống hệt nguồn. Ảnh nhỏ 14.534
bytes gửi nguyên bản. Các case create chỉ một create, retry skill có sẵn không create.

Đã xem card sending 375, failed 375, pending VERIFIED và JPEG fixture sau nén;
chữ/mã mẫu vẫn đọc được. Evidence ignored dưới `.expo/skills-validation/`:
`evidence-card-sending-{320,375,430}.png`, `evidence-card-failed-375.png`,
`evidence-card-pending-*.png`, `evidence-compressed-certificate.jpg`,
`evidence-background-result.json`. Fixture intercept API, không gửi dữ liệu thật.
Native readability/EXIF, app background và API/storage/scan thật còn pending.
Expo Go hỗ trợ module; development client cũ cần binary mới có module nén.

Các validation bên dưới mô tả các revision trước của luồng gửi.

## Lưu kỹ năng kèm ảnh bị chậm — 2026-10-14

Source trước amendment chờ upload → scan tuần tự mỗi file, poll backoff tới
8 giây và chờ mọi query refresh trước khi toast/navigation. Đây là các đoạn chờ
do mobile; không suy ra scanner hay đường truyền thật đã chậm từ source.

Đã upload các file trước rồi đọc scan cùng lúc, poll 0,5/1/2/3 giây (24 reads,
63,5 giây chờ tối đa/file). Scan lỗi hủy sibling waits nhưng giữ fileId để retry.
Vẫn recheck READY khi gửi lại và chỉ submit khi toàn bộ files READY. Save/Send
ghi cache DTO xác nhận rồi refresh nền; completion không chờ query chậm hoặc
bị lỗi. Nút Lưu hiển thị tiến độ upload/check/submit, giữ khóa trong pipeline.
Không giảm chất lượng ảnh hoặc sửa storage/scan policy phía BE.

Checks đạt: 280/280 tests, typecheck, lint, structure (455 source files),
production web export (1941 modules) và diff check. Bốn regression mới kiểm
scan đồng thời, lỗi scan hủy chờ khác/giữ IDs, completion trước refresh chậm
và refresh nền lỗi không biến save thành failure.

`.expo/skill-evidence-speed-browser.cjs` kiểm ảnh PNG qua Chọn ảnh thật của web,
preview/khóa picker/delete, một create và một verification submit, READY-only,
tiến độ và navigation. Fixture upload 250 ms/ảnh, scan sẵn sàng sau 800 ms,
read refresh cố tình chậm 6 giây: lượt 1 ảnh 2266 ms, 2 ảnh 2325 ms; navigation
sau submit xác nhận lần lượt 268/35 ms. Lỗi upload ảnh thứ hai rồi mở lại gửi
thành công, giữ ID ảnh đầu, không create trùng hoặc reupload ảnh đã có ID
(3 upload attempts gồm một lỗi, một verification submit). Ba lượt không page error.

Đã xem `.expo/skills-validation/evidence-save-progress-375.png`; kết quả ở
`evidence-save-speed-result.json`, harness/evidence ignored. Đây là số đo fixture,
không phải thời gian upload/ClamAV/API thật. Thiết bị Android/iOS và mạng/scan
thật chưa được đo; các nghiệm thu đó vẫn pending.

## Skill Level catalog theo từng kỹ năng — 2026-10-14

Đối chiếu read-only controllers/DTO/service/repository và BE 007
`skill-level-catalog.md`. Form tải ACTIVE levels từ endpoint nonpaginated,
gửi levelId cho create/đổi trình độ; đổi skill xóa lựa chọn cũ. Tên/mô tả dùng
catalog, bỏ gợi ý cố định; public allowlist giữ metadata cần hiển thị. Level
INACTIVE đã lưu không bị xóa hoặc gửi lại khi chỉ sửa mô tả/hiển thị. Dữ liệu
legacy null vẫn có nhãn. Learning Request offered skills/options nhận custom
codes và name, còn currentLevel giữ enum learning progress riêng.

Checks source cuối đạt: 276/276 tests (9 regression mới), `npm run check-types`,
`npm run lint`, `npm run check-structure` (454 source files), production web
export (1940 modules) và diff check. `pnpm --filter mobile check-types` ban đầu
bị môi trường pnpm gọi install rồi dừng vì non-TTY; dùng các npm scripts tương
đương theo README với dependencies đã cài, không thay package/lockfile.

Browser `.expo/skill-level-browser.cjs` đạt 4 nhóm checks/47 fixture requests,
không page error: tên/mô tả catalog và first selection validation, đổi skill
không giữ levelId cũ, lỗi 503/retry giữ draft, lookup chậm của skill cũ không
ghi đè lựa chọn hiện tại, POST/PATCH ID đúng, edit no-change, giữ level INACTIVE
khi sửa mô tả, own/public profile/public detail và empty catalog khóa create.
Web radio có aria-checked; first tap cập nhật validation/touched state để Lưu
không bị khóa bởi lỗi chọn cấp độ cũ. Tên dài ở 320/375/430 không tràn ngang.

Đã xem form 320 và public detail 430. Evidence ignored dưới
`.expo/skills-validation/`: `skill-level-form-{320,375,430}.png`,
`skill-level-public-detail-430.png`, `skill-level-result.json`.
Fixture chỉ intercept API; không gọi mutation thật hoặc sửa BE/shared/dependency.
BE rollout/migration và custom/INACTIVE với API thật, Android/iOS và screen reader
trên thiết bị vẫn pending theo checklist. Các mục cũ bên dưới là lịch sử.

## Sonar remediation — 2026-10-13

Đã xử lý các findings user gửi: explicit localeCompare sort và codePointAt cho
evidence draft, Promise-returning fixture methods không async thừa, giảm nesting
polling bằng evidence-polling helper, tách uploadMissingFile/scanFile trong
prepare-evidence, tách success feedback/use-skill-action và headers/HTTP client.
Các UI branches bỏ nested ternary/template; component props Readonly; header
chi tiết là SkillDetailHeader ổn định, nhận waiting state từ VerificationHistory.
Không sửa BE, dependency, auth/retry/scan policy hoặc DTO.

`npm run lint`, `npm run check-types`, `npm run check-structure` qua (386 source
files); `npm test`184/184 qua. Ba regression mới kiểm READY recheck, polling mixed
error giữ file IDs/checking guard và timeout/recheck. Suite đầy đủ bao gồm HTTP
renewal/multipart/idempotency/session boundary, Skills save/cache/profile consumers.
Local AST audit34 source files/34 component props: không còn nested ternary/
template, async-without-await, mutable component props hoặc function nesting>5
trong use-evidence-draft. Audit là kiểm source riêng, không thay SonarCloud analysis
hoặc chứng minh Quality Gate đã pass. Chưa commit/push hay tick native/API acceptance.

## Thời gian bằng chứng theo BE và xử lý 503 — 2026-10-13

Theo clarification, đây là lỗi timezone cấu hình Prisma/BE, không phải timeout
scan. FE không gửi giờ lưu file hoặc giờ hiệu lực policy. History/detail nay
dùng formatter nhận timestamp ISO server và hiển thị rõ giờ Việt Nam, giữ cùng
instant cho Z/+07, không bù 7 giờ để che lỗi backend. Gửi/Xét duyệt giữ đúng
submittedAt/reviewedAt; uploadedAt chưa có trong response, không suy đoán.
503 bị BE mask chỉ báo server chưa sẵn sàng; không chẩn đoán là scan/storage.
Saved skill/draft/key và điều hướng sau evidence failure giữ hành vi đã kiểm tra.

Mobile typecheck/lint/structure đạt (384 source files); tests 181/181 đạt, thêm
4 checks timestamp offsets/qua ngày/missing timezone và masked 503. User đã cho
phép sửa BE: API/seed session UTC và PostgreSQL read-only regression ở
[backend UTC validation](../../../../services/api/specs/006-system-configuration-time/validation.md).
Không thay chính sách scan/verification hoặc tự gửi lại multipart.
Web export đạt 1876 modules. Browser `.expo/skills-evidence-time-browser.cjs`
đạt 6 nhóm/73 fixture requests, không page error; batch ISO
`2026-10-12T16:29:10.915Z` hiện `23:29:10 12/10/2026` (giờ Việt Nam).
Regression 503 về list/draft retry/key reuse/refresh failure vẫn đạt. Ignored
evidence: `.expo/skills-validation/skills-evidence-time-375.png` và
`skills-evidence-time-result.json`. Không upload BE thật; native còn pending.

## Chi tiết kỹ năng từ hồ sơ công khai — 2026-10-13

Theo yêu cầu UI tiếp theo, đã bỏ nút “Làm mới” khỏi màn chi tiết kỹ năng
công khai. Lint/typecheck/structure đạt (384 source files); 5/5 tests
`skills-public-detail.test.ts` đạt. Chưa chạy lại browser/native cho thay đổi này.

PublicSelfSkillList đã có hành động mở chi tiết công khai. Route riêng
`/public-skills/[userId]/[sharingSkillId]` tìm đúng Sharing Skill trong public
pages của target userId và đọc các trang sau khi cần; không dùng catalog/own
detail thay thế. Màn hiển thị tên, level, toàn bộ mô tả, experienceYears tự khai
và badge. Không mount actions/history/evidence hoặc gọi private download.
Read lỗi hiển thị retry, hidden/archive/sai owner/invalid ID không khả dụng.
Confirmed hide/archive clear cache public-detail trong đúng phiên. Profile mẫu
ở cả `/profiles/demo-*` và `/user/demo-*` mở chi tiết mẫu bằng field công khai
có sẵn, không bịa phần mô tả/kinh nghiệm thiếu hoặc nối API hồ sơ người khác.

Typecheck/lint/structure đạt (377 source files); tests 177/177 đạt, thêm 5 checks
public pagination/privacy/không fallback/error/cancel/cache hide, mở rộng archive
cache regression. Web export đạt 1869 modules. Browser fixture
`.expo/skills-public-detail-browser.cjs` đạt 8 nhóm/16 requests, không page error:
public profile → full detail, hidden refresh, trang sau, private direct link,
đúng/sai target owner, lỗi read/retry, invalid IDs và hai bề mặt hồ sơ mẫu.
Fixture điều hướng bằng router thật trong phiên; cold-start authenticated link
và Android/iOS chưa được xác nhận. Không mutation BE thật hoặc private file call.
Ignored evidence `.expo/skills-validation/skills-public-detail-375.png` và
`skills-public-detail-result.json`. Không thay source/config/database BE.

## Evidence lỗi vẫn về danh sách và gợi ý level — 2026-10-13

Theo yêu cầu mới, sau khi create/update được xác nhận, Save trả về My Skills
kể cả upload/scan/submit lỗi. Toast lỗi nói rõ kỹ năng đã lưu, bằng chứng chưa
hoàn tất và hướng dẫn mở kỹ năng để kiểm tra/thử lại. Nếu create/update chưa
xác nhận, vẫn ở form với draft. Draft/fileIds và JSON submit intent được giữ
theo skillId/phiên; mở lại dùng cùng key/body nếu chưa biết kết quả, không
create trùng hay tự upload lại file đã nhận ID. Đổi tài khoản chặn callback.

Form tạo/chỉnh sửa có chú thích cho cả bốn level đang chọn, gồm ví dụ ngôn ngữ
và lập trình. Nội dung là gợi ý tự đánh giá, không phải tiêu chí xác minh hoặc
quy đổi chứng chỉ; API/validation không thay đổi.

Typecheck/lint/structure đạt (372 source files); tests 172/172 đạt, gồm evidence
failure trả saved result, skill create lỗi không bị che và đổi phiên lúc evidence
lỗi. Web export đạt 1864 modules. Browser fixture
`.expo/skills-save-evidence-error-browser.cjs` đạt 6 nhóm/73 requests: bốn mức
level, upload 503 về list/toast, reopen draft/Send không create lại, submit 503
reopen giữ key/body/fileIds, create lỗi ở form và refresh 503 sau success. Không
page error. Regression `.expo/skills-compact-browser.cjs` đạt 7 nhóm/82 requests
cho luồng Gửi riêng, history/decision, private image và refresh lỗi. Ảnh ignored:
`skills-level-guide-375.png` và
`skills-evidence-error-list-375.png`, result `skills-save-evidence-error-result.json`
trong `.expo/skills-validation/`. Android/iOS và API/storage/scanner thật còn
pending; không gọi mutation BE thật hoặc thay source/config/database BE.

## Lưu kỹ năng kèm bằng chứng và vị trí mới nhất — luồng ban đầu, 2026-10-12

Theo yêu cầu người dùng, form tạo dùng một nút Lưu: create nhận Sharing Skill ID
→ upload từng file đã chọn → scan READY → submit batch → tự về My Skills.
Không file thì chỉ create. Form chỉnh sửa bản hiện có vẫn có hành động gửi riêng.
Metadata bằng chứng không hợp lệ chặn tạo; chọn ảnh/file không tự upload.

Đã tách coordinator/save hook và dùng chung pipeline chuẩn bị/submit giữa Lưu
và Gửi yêu cầu. Nếu file/scan/submit lỗi sau create, giữ record/ID và draft trên
form, hiển thị phần chưa hoàn tất. Lưu lại không create hoặc PATCH bản không đổi;
fileIds đã nhận được giữ ngay sau mỗi upload và READY được kiểm tra lại. Lost
submit response retry giữ JSON key/body; nhận success thì xóa draft, giữ batch
trong cache owner/history trước refresh. Không tự retry khi quay lại/foreground.

My Skills ưu tiên các lượt create đã được server xác nhận trong phiên, mới nhất
ở đầu qua refresh và đọc các trang UUID. Giữ bản vừa tạo nếu chưa nằm trong trang
đã tải; merge theo version, filter badge và session tombstone, không sửa metadata
pagination. Edit không đổi thứ tự tạo. Một owner read đầy đủ hoặc detail lookup
không tìm thấy sẽ bỏ snapshot đã bị xóa từ nơi khác.

**GAP-09 còn mở:** owner API hiện order UUID ASC, không trả createdAt hoặc sort
parameter. Mobile không thể xếp đúng thời gian tạo của toàn bộ dữ liệu cũ hoặc
sau restart bằng contract này. Không dùng UUID/catalog/verification time thay
creation time; cần BE bổ sung thời gian và pagination order. Lượt này chỉ sửa
mobile, giữ nguyên source/config BE đang có.

| Check                                  | Kết quả                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck / lint / structure           | Đạt; 371 source files, không tăng giới hạn.                                                                                                                  |
| `npm test`                             | 170/170 đạt, thêm 9 tests cho save partial failure, metadata, no-file, đổi phiên và thứ tự/refresh/delete.                                                   |
| Web export                             | Đạt, 1863 modules.                                                                                                                                           |
| `.expo/skills-create-save-browser.cjs` | 5 nhóm / 68 requests; create với ảnh/không ảnh, detail preview, upload failure retry, lost submit response, refresh 503 và thứ tự mới tạo. Không page error. |
| `.expo/skills-compact-browser.cjs`     | 7 nhóm / 82 requests; regression luồng Gửi riêng, history/decision và private image/expiry. Không page error.                                                |

Ảnh/result local ignored trong `.expo/skills-validation/`:
`skills-create-save-list-375.png`, `skills-create-save-result.json` và
`skills-compact-result.json`. Browser intercept API bằng fixtures, không gọi
mutation BE thật. API/storage/scanner thật và Android/iOS còn pending; không
tick các gate đó bằng fixture. Các mục dưới giữ kết quả lịch sử của luồng cũ.

## Đối chiếu BE và sửa mobile — 2026-10-12

Đã đọc controllers/DTO/services/repositories Skills, Sharing Skills,
Verifications và policy/attachment của storage. Chỉ thay đổi mobile. BE hiện
có restore riêng nhưng UI spec 004 giữ scope xóa; sửa câu xác nhận để mô tả
gỡ khỏi hồ sơ và giữ lịch sử, không khẳng định BE không thể khôi phục.

- Web File.type rỗng/generic trước đây vẫn được append nguyên vào multipart,
  gây MIME không khớp policy BE dù draft hợp lệ. Đã tái hiện test thất bại;
  multipart nay dùng MIME format đã validate, giữ nguyên byte/tên file.
  Chặn basename rỗng, extension nguy hiểm ở giữa và key kế thừa ngoài allowlist.
- Response create/edit/visibility trước đây chỉ được dùng sau refresh, nên
  refresh lỗi có thể để cache thiếu bản mới hoặc giữ version/visibility cũ.
  Nay lưu owner DTO trước refresh, giữ version mới hơn đã biết, cập nhật các
  list/filter đã tải và giữ cursor/pageParams. Public chỉ cập nhật row đã có
  qua allowlist hoặc loại row ẩn/inactive; không tạo public list/counter giả.
- History/detail nay nhận quyết định cùng batch/version mới thì bỏ snapshot
  submit PENDING cũ và đọc lại owner/detail/public/account. Không tự tính badge
  hoặc Sharing Skill version từ batch. Quyết định cũ/khác batch/khác skill
  không xóa snapshot của yêu cầu mới.

| Check                                   | Kết quả                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run check-types`                   | Đạt.                                                                                                |
| `npm run lint`                          | Đạt, không warning.                                                                                 |
| `npm run check-structure`               | Đạt, 367 source files; không tăng giới hạn.                                                         |
| `npm test`                              | 161/161 đạt, gồm 5 tests mới cho MIME, cache lưu và quyết định.                                     |
| Web export                              | Đạt, 1859 modules.                                                                                  |
| `.expo/skills-be-alignment-browser.cjs` | 6 nhóm / 64 requests; CRUD/version/privacy và create/edit/visibility refresh 503, không page error. |
| `.expo/skills-compact-browser.cjs`      | 7 nhóm / 82 requests; upload/scan/submit, history/decision, private image/expiry, không page error. |

Typecheck ban đầu thiếu bốn Expo packages đã khai báo; cài lại từ npm cache
bằng `npm install --offline --ignore-scripts --no-audit --no-fund` rồi đạt.
Không đổi package versions hoặc lockfiles. QA web dùng URL tạm thời trong process
và xóa cache Metro để inlined config đúng; không sửa `.env` của người dùng.
Browser intercept API bằng fixtures; scripts/result/screenshot local ignored
dưới `.expo/skills-validation/`, gồm `skills-be-alignment-result.json`,
`skills-be-alignment-cache-375.png`, `skills-compact-result.json`.

Read-only probes tới `localhost:3001` và API cấu hình trong `.env` mobile đều
bị từ chối kết nối trong lượt này. Chưa xác nhận CRUD/evidence với
server/storage/scanner thật; Android/iOS còn pending. Các gate API/native trong
checklist vẫn giữ chưa tick.

Các mục bên dưới giữ evidence lịch sử; mô tả AGENTS.md chưa có chỉ áp dụng
checkout cũ. Hiện workspace đã có AGENTS.md và constitution mobile.

## Source và checks

- `src/features/skills`: typed API/parsers, scoped queries, forms, evidence draft,
  polling, own/history/detail screens; sáu thin authenticated routes My Skills.
- Profile own/self dùng skills API; target/demo Proposal vẫn giữ fixtures.
- HTTP thêm key/pagination/abort/evidence no-replay trên session pipeline hiện có.
- Bốn dependencies mới: `expo-document-picker`/`expo-crypto` `~57.0.3`,
  `expo-image` `~57.0.5`, `expo-network` `~57.0.2`; npm/pnpm locks đồng bộ.
  Root lockfile chỉ đồng bộ dependencies mobile; không sửa backend/shared.
- Hướng dẫn `apps/mobile/AGENTS.md` vẫn chưa có; dùng root guidance và mobile docs.

Checks chạy từ `apps/mobile` trên Windows, Node 22, ngày 2026-10-09:

| Command                                                               | Kết quả                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run check-types`                                                 | Đạt.                                                         |
| `npm run lint`                                                        | Đạt, không warning.                                          |
| `npm run check-structure`                                             | Đạt, 226 source files; không nâng giới hạn.                  |
| `npm test`                                                            | 109 tests đạt: 25 tests skills mới và 84 regression hiện có. |
| `npx expo export --platform web --output-dir .expo/skills-review-web` | Đạt, bundle web.                                             |
| `git diff --check`                                                    | Đạt.                                                         |

Tests mới: `tests/skills-contract.test.ts`, `skills-validation.test.ts`,
`skills-action.test.ts` và shared fixtures. Bao gồm missing pagination/meta,
cursor loop, owner lookup qua nhiều trang, binding đúng resource, public allowlist,
Unicode/decimal/null, version/key/body, 401 renewal, không replay evidence bytes,
double tap/Android Back handler, partial refresh, blur và account switch.
Tests Back handler dùng hook harness; đây không phải bằng chứng chạy thiết bị.

## Browser fixtures

Web export chạy trên static server local với headless Microsoft Edge/Playwright.
Auth/API/evidence/decision đều được intercept bằng fixtures; không dùng tài khoản
hay mutation thật. Kịch bản local `.expo/skills-browser.cjs` đạt 12 nhóm checks,
62 requests và không có page error. Kịch bản/output trong `.expo` được ignore;
chúng là evidence local, không phải test runner portable của repository.

| AC  | Phần đã kiểm tra                                                                                | Còn thiếu để nghiệm thu toàn AC                                 |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 01  | Own empty; 22 active records, cursor trang 2; lỗi trang sau giữ dữ liệu; includeArchived.       | API thật/loading/offline và thiết bị.                           |
| 02  | Picker catalog, q1 không gửi request, q hợp lệ; query keys/signal tách search.                  | Delayed catalog response race và catalog API có dữ liệu.        |
| 03  | Create/save/reopen trong fixtures, DTO/key đúng.                                                | API thật, duplicate/inactive runtime.                           |
| 04  | Unicode/decimal/null/no-change tests; nhập `2,5` gửi `2.5`; form edit.                          | Hủy draft/keyboard trên thiết bị.                               |
| 05  | 409 giữ draft, tải version và explicit rebase; hook double tap/unknown retry cùng key.          | Network timeout và version conflict với API thật.               |
| 06  | Ẩn/hiện; archive Hủy/xác nhận; archive read-only giữ history.                                   | Pending conflict API và thiết bị.                               |
| 07  | Web PDF picker/multipart; count/size/MIME unit tests; remove/upload UI.                         | Android/iOS picker, cap/413/415/503 runtime.                    |
| 08  | QUARANTINED → SCANNING → READY fixture; READY-only và recheck gating tests.                     | Scanner thật, AppState/background và exhaustion trên thiết bị.  |
| 09  | Submit PENDING; key/body tests, không tự replay multipart sau 401.                              | Duplicate/pending batch và unknown response với API thật.       |
| 10  | Tách badge/batch/file; VERIFIED + PENDING parser; lý do từ chối UI.                             | Approve/revoke/aggregate từ server thật.                        |
| 11  | History/detail; download error feedback; binding và allowlist.                                  | Signed link thật/expiry/quyền owner; history nhiều trang.       |
| 12  | Hook commit + refresh thất bại vẫn success, không thêm write; callback một lần.                 | Đã đạt trong hook fixture; không tính counter cục bộ.           |
| 13  | Generation guards, late response/account switch, blur lúc refresh giữ intent.                   | Logout/account switch trong native journey.                     |
| 14  | Lookup all pages/includeArchived, invalid/null source guards, archive view.                     | Deep link/cold start và Back native.                            |
| 15  | Own empty/manage; self public API >20 records; hidden/archive không hiển thị; public allowlist. | Profile với API thật/account counter cập nhật sau decision.     |
| 16  | Web 320/375/430 px không tràn ngang; labels/disabled; screenshot QA.                            | Android/iOS, chữ lớn, keyboard, hardware Back và screen reader. |

Ảnh local tại `.expo/skills-validation`: `skill-edit-375.png`,
`skills-evidence-375.png`, `archived-skill-{320,375,430}.png` và
`public-self-skills-430.png`; kết quả tổng hợp `result.json`. Đã xem ảnh edit,
evidence và archived 320 px. Không có raw text/native host-tree lỗi trong các
regression đã chạy; screenshot browser không chứng minh native layout.

## API thật và gates còn mở

Read-only GET `http://localhost:3001/api/v1/skills?limit=20` ngày 2026-10-09 trả
success, `data: []`, limit20/hasMorefalse/nextCursornull. Chưa có catalog ACTIVE
trong môi trường này để thực hiện add bằng tài khoản test. Không seed catalog,
đổi backend hoặc upload bằng chứng thật trong lượt này.

Pending: API CRUD/pagination, scanner/storage, upload → READY → submit → Staff
approve/reject/revoke → counter refresh/download và Android/iOS riêng. Khi có
catalog/tài khoản test/thiết bị, ghi lại môi trường và bằng chứng mới trước khi
tick các AC tương ứng. Không dùng tests/fixtures hay kết quả spec 003 để tuyên bố
hoàn tất toàn bộ spec 004.

## UI revision và inline evidence — 2026-10-09

Theo yêu cầu sau implementation: Quản lý về dạng liên kết nhỏ cạnh tiêu đề,
bỏ dòng chú thích, danh sách có nút thêm nhỏ ở bên trái. Profile skills dùng
các dòng tên/trình độ gọn. Form dùng hai nhóm thông tin/bằng chứng, catalog row,
radio trình độ/hiển thị và evidence picker ngay trước khi lưu.

Local `.expo/skills-inline-browser.cjs` đạt 7 nhóm checks, 20 requests, không
page error: link Quản lý/nút thêm nhỏ, form 320/375/430 không tràn ngang, chọn PDF
trước create không gọi upload, file/tiêu đề còn sau save, upload → READY → submit
inline và edit sau submit gửi expectedVersion mới. Xung đột field vẫn giữ draft
và yêu cầu so sánh/rebase. Kịch bản regression 12 nhóm/62 requests vẫn đạt;
kịch bản chờ screen thoát inert trong chuyển cảnh trước khi nhấn pagination.

109 tests, typecheck, lint, structure (226 files) và web export đạt sau revision.
Không thêm dependencies hoặc sửa backend. Gates API/scanner/Android/iOS vẫn như
trên; kết quả mới dùng fixtures.

Ảnh đã xem: `.expo/skills-validation/new-skill-form-320.png`,
`profile-manage-link-375.png`, `skills-list-compact-375.png` và
`inline-evidence-submitted-375.png`. Thêm ảnh form 375/430 và `inline-result.json`
cùng thư mục; toàn bộ là evidence local được ignore.

## Danh mục, bộ lọc và profile badges — 2026-10-10

Source hiện tại thay danh mục button bằng các dòng tên/mô tả/icon/dấu chọn;
nhóm lại nút chi tiết; lưu create/edit thành công dismiss về My Skills với toast.
Draft evidence chọn trước create được chuyển theo skillId trong provider phiên,
tiếp tục từ màn verify và xóa khi submit thành công/logout/đổi tài khoản.
Profile own/public self dùng badge có chữ và icon cho cả bốn trạng thái.

My Skills có radio chips Tất cả/Đã xác minh/Chưa xác minh. API owner không có
tham số lọc badge, nên đọc tiếp trang chưa có kết quả khớp; cursor lặp/lỗi trang
không được biến thành empty. Chưa xác minh gồm UNVERIFIED/PENDING/REJECTED.

114 tests, typecheck, lint, structure (231 files), web export và diff check đạt.
5 tests mới phủ filter qua trang rỗng, pending/rejected, cursor tiếp theo/lặp và
lỗi trang sau. Browser fixture `.expo/skills-modern-browser.cjs` đạt 8 nhóm checks,
41 requests, không page error: danh mục 320/375/430, create/edit tự về list,
stale version giữ draft, file/tiêu đề còn sau điều hướng → READY → explicit submit,
verified ở trang sau, filter kết hợp archive, own/public self badges và privacy.

Ảnh local `.expo/skills-validation/catalog-modern-{320,375,430}.png`,
`detail-modern-375.png`, `skills-filter-{320,375,430}.png`,
`profile-skill-badges-375.png`, `public-skill-badges-375.png` và `modern-result.json`.
Đã rà soát ảnh; harness chờ modal hoàn tất chuyển cảnh trước khi chụp.
Những kết quả browser cũ ở mục trên là lịch sử, luồng lưu hiện tại theo mục này.

Catalog local đã được seed theo yêu cầu riêng của người dùng: bảng `skills` có
15 ACTIVE thuộc lập trình/ngoại ngữ và 10 mẫu cũ INACTIVE, kiểm tra DB/API trực tiếp.
Script seed thử nghiệm đã được bỏ khỏi diff theo yêu cầu giữ thay đổi ở mobile;
dữ liệu đã seed trong database được giữ nguyên, không thay contract API.
Lượt UI này chỉ sửa mobile; CRUD/evidence/scanner trên API thật và Android/iOS
vẫn pending, chưa dùng dữ liệu mock để xác nhận các gates đó.

## Khối kỹ năng hồ sơ gọn — 2026-10-10

Theo ảnh người dùng: thay ba thẻ nền lớn bằng một nhóm dòng có divider; icon
32px, tên/badge compact cùng hàng và trình độ/riêng tư ở dòng dưới. Chỉ own
profile dùng badge compact; list/detail/public self giữ badge hiện tại.
Không render khoảng trống feedback khi đã có dữ liệu thành công.

Typecheck, lint, structure (231 files), web export và diff check đạt. Harness
`.expo/skills-compact-profile-browser.cjs` đạt 4 nhóm checks/9 requests, không
page error: 320/375/430 px, badge/riêng tư, mở chi tiết và tên dài xuống dòng.
Khối 3 kỹ năng cao 270px ở 375/430, 295px ở 320 trong fixture. Đã xem ảnh
`profile-skills-compact-{320,375,430}.png` và ảnh tên dài 320 trong
`.expo/skills-validation`; `compact-profile-result.json` cùng thư mục.
Đây là QA browser fixture, native gates vẫn pending.

## Khối kỹ năng theo ảnh mẫu mới — 2026-10-10

Own profile dùng card trắng bo góc, mỗi kỹ năng một dòng với divider nhẹ.
Bỏ icon sách/mũi tên và khung viền bên trong; tên và nhãn xác minh ở bên trái,
trình độ trong nhãn nhỏ bên phải. VERIFIED hiện “Xác minh”, UNVERIFIED không
hiện badge tại đây; PENDING/REJECTED giữ trạng thái và kỹ năng riêng tư vẫn
có nhãn riêng. Screen reader vẫn đọc trình độ/trạng thái/riêng tư đầy đủ.
Nhấn dòng mở chi tiết, “Quản lý” mở danh sách như trước.

Typecheck, lint, structure (236 files), web export và diff check đạt. Harness
`.expo/skills-reference-profile-browser.cjs` đạt 4 nhóm/9 fixture requests, không
page error: 320/375/430, nhãn/trình độ, điều hướng và tên dài/riêng tư/chờ duyệt.
Khối ba kỹ năng cao 214px ở 375/430 và 234px ở 320. Đã xem ảnh
`.expo/skills-validation/profile-skills-reference-375.png` và
`profile-skills-reference-long-name-320.png`; kết quả lưu trong
`reference-profile-result.json`. Không thay logic API và không thêm unit test
cho thay đổi trình bày; nghiệm thu native vẫn pending.

## Chuông thông báo trên header — 2026-10-10

Header dùng chung bỏ chuông/count khi màn có `onBack`. Áp dụng cho các màn kỹ
năng và màn phụ trong ProfileLayout/AppScreenLayout; màn chính giữ thông báo.
Typecheck, lint, structure (236 files), web export và diff check đạt.
`.expo/secondary-header-browser.cjs` kiểm tra bằng thao tác UI tại 375/768 px:
8 màn phụ (list/new/detail/edit/verify skill, public profile, settings/account)
không có chuông, nút Back hoạt động; home/profile vẫn có chuông. 20 checks,
5 fixture API requests, không page error. Kết quả và ảnh local:
`.expo/skills-validation/secondary-header-result.json`,
`secondary-header-skills-375.png`. Không gửi business mutation.

## Đồng bộ hồ sơ và gửi bằng chứng một bước — 2026-10-10

Own/public self và profile fixtures dùng chung ProfileSkillSection/ProfileSkillRow,
nhưng public self vẫn chỉ đọc projection công khai. Public preview giữ cùng
maxWidth/spacing với own profile. My Skills/detail/catalog bỏ icon sách lặp;
card mới ưu tiên tên, trình độ, badge, mô tả và visibility. Detail có CTA màu
primary của app, nút Làm mới nhỏ cạnh thông tin và pull-to-refresh đồng bộ
kỹ năng/lịch sử. Màn gửi không có link lịch sử hoặc nút upload riêng.

Nhấn gửi khóa ngay thao tác, upload các file chưa có ID, kiểm tra đến READY rồi
submit JSON. Scan tối đa 10 checks/file, backoff tới 8 giây; blur/background/đổi
phiên dừng bước chuẩn bị. Lỗi giữ file và metadata; retry dùng lại fileId đã có
và cùng idempotency key nếu payload chưa đổi. Thành công refresh, toast, xóa
draft và dismiss về chi tiết. Evidence chọn trước create vẫn được giữ qua
điều hướng về list để gửi sau khi skill có ID.

129 tests đạt, gồm 8 tests mới về upload/scan, file đã READY, lỗi một phần,
terminal/unknown states, bounded scan, cancellation/session change và batch/ID
validation. Typecheck, lint, structure (238 files), web export và diff check đạt.
Không thay dependency/backend/shared package trong revision này.

`.expo/skills-auto-send-browser.cjs` đạt 7 nhóm checks, 40 fixture API requests,
không page error: own/public privacy, UI 320/375/430 không tràn, màu CTA/refresh,
double tap và lỗi upload, server đã nhận nhưng response lỗi → retry cùng key,
tự quay về detail, review refresh và draft evidence chọn trước khi lưu.
Fixture có 4 upload attempts (1 fail), 3 submit attempts nhưng 2 batch thực sự;
retry không tải lại file đã có ID. Không gửi mutation tới API thật.

Evidence local được ignore: `.expo/skills-validation/skills-auto-send-result.json`,
`skills-sync-{own,public}-{320,375,430}.png`,
`skills-clean-{list,detail}-{320,375,430}.png`,
`skills-auto-send-form-{320,375,430}.png` và
`skills-auto-send-return-detail-375.png`. Đã xem own/public 375, list/detail/form
375, detail 320 và detail sau gửi. Các harness upload thủ công cũ là lịch sử;
luồng hiện tại theo mục này. API/scanner và Android/iOS acceptance vẫn pending.

## Icon hành động và đối chiếu archive — 2026-10-10

Khôi phục icon trong nút sửa, ẩn/hiện, gửi bằng chứng, lưu trữ và Làm mới;
không khôi phục icon sách mặc định cho từng kỹ năng. Giữ màu primary của CTA.
Đọc trực tiếp SRS 1.6: FR-SK-02 cho archive theo rule lịch sử; SK-004 yêu cầu
giữ lịch sử Session/Review và dùng archive/soft delete khi có tham chiếu.

Typecheck, lint, structure (238 files), web export, formatting và diff check đạt.
`.expo/skill-detail-action-icons-browser.cjs` đạt 3 nhóm/10 fixture requests,
không page error: 5 icon hành động, 320/375/430 không tràn, mở edit và đổi
visibility đúng. Ảnh `.expo/skills-validation/skill-detail-action-icons-320.png`
đã xem; ảnh 375/430 và `skill-detail-action-icons-result.json` cùng thư mục.
Không thay business logic hoặc gọi mutation API thật.

## Toast, dung lượng và xem trước ảnh — 2026-10-11

Thông báo kết quả/lỗi thao tác kỹ năng và chọn/gửi bằng chứng dùng ToastProvider;
không còn banner feedback trong form/detail. Validation field và trạng thái đọc
dữ liệu vẫn nằm trong vùng liên quan. Save/submit dùng toast riêng để tránh trùng
toast mặc định; callback sau blur/đổi phiên không được thông báo. Nút archive giữ
xác nhận, dùng nền errorLight và chữ/icon error. Dung lượng draft/history dùng
KB/MB thập phân; lỗi vượt cap báo 10 MB thay vì số byte.

Thêm expo-image ~57.0.5 bằng expo install cho SDK 57; đồng bộ npm/pnpm lockfiles
và config plugin. JPEG/PNG/WEBP xem trước từ URI local, contentFit contain,
cachePolicy none; PDF/Word không có preview ảnh. Lỗi đọc ảnh có fallback và không
xóa draft hoặc tự upload. Upload/scan READY/submit vẫn theo luồng một bước.

131 tests đạt, gồm kiểm tra toast thành công sau partial refresh, tránh trùng
success toast và không báo lỗi khi response về sau blur. Typecheck, lint,
structure (240 files), web export và formatting đạt.
`.expo/skills-toast-preview-browser.cjs` đạt 7 nhóm checks / 28 fixture requests,
không page error: nền đỏ/icon archive, visibility toast, ảnh PNG được decode,
PDF giữ file card, KB/MB, chưa upload khi chọn, 320/375/430 không tràn, chọn file
quá cap không mất draft, bỏ ảnh và fallback ảnh hỏng, upload lỗi → toast → retry
giữ metadata → một toast thành công và về detail, xác nhận archive hoạt động.
Không gửi mutation tới API thật. Native Android/iOS vẫn cần nghiệm thu.

Ảnh/result local được ignore trong `.expo/skills-validation/`:
`skills-toast-detail-{320,375,430}.png`,
`skills-image-preview-{320,375,430}.png`, `skills-toast-preview-result.json`.
Đã xem detail 320 và preview 375.

## Rút gọn chú thích và xóa file bằng icon — 2026-10-11

Gộp định dạng/số file/10 MB vào vùng chọn bằng chứng; bỏ dòng giải thích auto
upload và các hint lặp dưới field. Metadata tùy chọn thể hiện trong label,
placeholder ngắn hơn; validation giữ nguyên. Chọn file trước khi lưu vẫn có
nhắc ngắn “Lưu kỹ năng trước khi gửi bằng chứng.” Trạng thái SELECTED chỉ hiện
dung lượng; upload/scan vẫn có nhãn trạng thái. Thông báo preview lỗi rút gọn.

Ảnh có nút × góc phải trên preview, tài liệu có × cạnh tên file; không còn nút
text “Bỏ khỏi lần gửi này”. Vùng chạm 44 px, tên truy cập gồm tên file, khóa
trong lúc gửi và vẫn kiểm tra lock đồng bộ trước khi xóa. Tên file dài dùng
ellipsis, screen reader đọc tên đầy đủ.

Typecheck, lint, structure (240 files), formatting, web export và diff check đạt.
`.expo/skills-compact-evidence-browser.cjs` đạt 9 nhóm / 31 fixture requests,
không page error: không còn chú thích thừa, × nằm trên ảnh và đủ vùng chạm,
xóa ảnh/file đúng, xóa hết thì nút gửi disabled, không xóa được khi đang upload,
preview lỗi vẫn xóa được, lỗi upload giữ metadata và retry thành công, toast và
archive hoạt động. 320/375/430 không tràn; ảnh
`.expo/skills-validation/skills-compact-evidence-{320,375,430}.png`;
result `skills-compact-evidence-result.json`. Đã xem ảnh 320/375.
Không thêm unit test cho thay đổi trình bày; không gọi business API thật.
Android/iOS acceptance vẫn pending.

## Xóa kỹ năng khỏi hồ sơ — 2026-10-11

Theo lựa chọn của người dùng, bỏ Gồm/Ẩn bản lưu trữ; giữ hành động Ẩn/Hiện
hồ sơ công khai cho kỹ năng đang dùng. Nút Xóa kỹ năng dùng API archive hiện
có, xác nhận ngắn và nền đỏ. Chỉ sau response xác nhận archivedAt mới xóa draft,
gỡ kỹ năng khỏi cache own/public, chặn dữ liệu đọc cũ đưa kỹ năng trở lại và về
danh sách. Lịch sử vẫn được backend giữ. List và lookup detail chỉ đọc kỹ năng
đang dùng; detail/edit/verify/history không mở kỹ năng đã xóa.

134 tests đạt, gồm lọc archived ở lookup, kiểm tra response archive và dọn cache
đúng phạm vi phiên/người dùng. Typecheck, lint, structure (241 files), formatting,
web export và diff check đạt. `.expo/skills-delete-browser.cjs` đạt 7 nhóm / 26
fixture requests, không page error: bỏ bộ lọc lưu trữ, giữ bộ lọc xác minh,
nút xóa/confirm/Hủy, khóa xóa khi pending, lỗi xóa giữ kỹ năng, retry thành công
dù refresh lỗi vẫn về list và không hiện lại kỹ năng, profile bỏ kỹ năng đã xóa,
xóa hết về danh sách trống và toast thành công. Lịch sử fixture vẫn được giữ.

Đã xem list 375 và detail 320; ảnh/result nằm trong `.expo/skills-validation/`:
`skills-delete-list-{320,375,430}.png`, `skills-delete-detail-{320,375,430}.png`,
`skills-delete-refresh-failed-430.png`, `skills-delete-result.json`.
Không gọi mutation API thật. Kiểm tra cold/deep link qua browser bị giới hạn bởi
phiên đăng nhập chỉ lưu trong bộ nhớ; native Android/iOS acceptance vẫn pending.

## Màu nút nhẹ và tách chọn ảnh/file — 2026-10-11

Profile/public profile dùng chung row không có đường phân cách. Variant
`craft-soft` dùng token primaryMuted/primaryDark cho CTA xác minh detail/form;
nút sửa/ẩn dùng surfaceLow/body, xóa giữ errorLight/error và các icon hành động.
Các variant nút cũ giữ nguyên. Bằng chứng có Chọn ảnh mở thư viện hệ thống và
Chọn file cho PDF/Word. Dùng expo-image-picker đã cài, không thêm dependency;
cập nhật mô tả quyền ảnh để bao gồm bằng chứng. Cả hai dùng chung draft/cap,
preview và luồng tự upload/scan READY/submit. Metadata ảnh được chuẩn hóa khi
tên gốc thiếu hoặc khác extension sau chuyển đổi; không đổi byte file.

138 tests đạt, thêm 4 trường hợp metadata thư viện: thiếu filename, JPEG trả về
với tên HEIC gốc, MIME thiếu nhưng URI hợp lệ, định dạng/dung lượng không hợp lệ.
Typecheck, lint, structure (244 files) và web export đạt.
`.expo/skills-library-browser.cjs` đạt 7 nhóm / 18 fixture requests, không page
error: own/public không separator, màu/icon nút, hủy chọn, picker ảnh chỉ nhận ảnh
và không capture camera, picker file nhận PDF/Word, chọn nhiều ảnh/file có preview,
không upload khi chọn, cap dùng chung và hủy/xóa không mất draft, ảnh quá 10 MB
báo toast, khóa hai picker khi gửi, upload lỗi giữ metadata và retry thành công
rồi về detail. Kiểm tra bố cục 320/375/430 không tràn.

Ảnh/result ignored dưới `.expo/skills-validation/`:
`skills-soft-profile-{320,375,430}.png`, `skills-soft-public-profile-430.png`,
`skills-soft-detail-{320,375,430}.png`, `skills-library-evidence-{320,375,430}.png`,
`skills-library-result.json`. Đã xem profile/detail 375 và form 320.
Không gọi mutation API thật. Thư viện hệ thống, limited photo access và metadata
ảnh thực tế trên Android/iOS cần nghiệm thu trên thiết bị; thông báo quyền trong
config plugin cần binary mới để áp dụng ngoài Expo Go.

## Lịch sử, ảnh đã gửi và lọc chờ xác minh — 2026-10-11

Sau response submit, cache giữ yêu cầu server xác nhận trước khi refresh/quay về
chi tiết. History hiển thị batch/files ngay cả khi refresh lỗi; không tạo version
hoặc pagination giả. Snapshot không ghi đè quyết định có version mới hơn.
List/detail/history/request detail/public self đọc lại khi quay về hoặc app
foreground. Không có mutation tự động. PENDING khóa gửi và xóa; form ẩn picker/
nút gửi đến khi quyết định. Bộ lọc Đang chờ xác minh đọc latestVerification hoặc
badge PENDING, giữ badge VERIFIED khi có bằng chứng approved cũ.

Hành động gửi ở chi tiết dùng link có icon; sửa/ẩn nền trắng có viền, xóa nền đỏ
nhạt và nút gửi form dùng primary. History/request detail hiện ảnh bằng download
owner có signal/expiry; URL chỉ trong component state, không cache bền và được
xóa khi blur/background/đổi phiên/hết hạn. Lỗi/quyền/expiry có tải lại ảnh.

144 tests, typecheck, lint, structure (249 files), web export đạt.
`.expo/skills-verification-browser.cjs` đạt 7 nhóm / 82 fixture requests, không
page error: ảnh đã gửi và tài liệu trong history/detail; return sau send; pending
chặn gửi trong cả chi tiết/form sửa; VERIFIED + pending; lọc qua quyết định mới;
request detail không giữ cache pending cũ; reject reason và gửi lại; submit lỗi
giữ draft, retry file READY; confirmed submit không mất trong history/Pending
filter khi refresh 503; quyết định approved thay snapshot; URL hết hạn/403 và
tải lại. Detail ở 320/375/430 không tràn ngang.

Ảnh/result ignored dưới `.expo/skills-validation/`:
`skills-link-detail-{320,375,430}.png`, `skills-pending-detail-{320,375,430}.png`,
`skills-pending-filter-430.png`, `skills-submitted-evidence-430.png`,
`skills-verification-result.json`. Đã xem detail/link 375 và list/filter 430.
Không gọi mutation API thật hoặc sửa backend. API/storage/scanner thật và native
Android/iOS acceptance vẫn pending; fixture không thay thế nghiệm thu thiết bị.

## Link dưới nút xóa và bằng chứng gọn — 2026-10-11

Link gửi bằng chứng đặt dưới Xóa kỹ năng, căn giữa và bỏ icon; trạng thái chờ
duyệt thay link cũng căn giữa. Các nút sửa/hiển thị/xóa giữ icon. Hai lựa chọn
ảnh/file thành nút ngang 44 px, bỏ hint lặp trong giao diện nhưng giữ accessibility
hint. Giảm padding/gap của form và file cards; preview draft tối đa 160 px.
History hiển thị thumbnail 72 px cạnh title/dung lượng; request detail giữ ảnh lớn.

Typecheck, lint, structure (249 files), formatting, web export và diff check đạt.
`.expo/skills-compact-browser.cjs` giữ 7 nhóm luồng / 82 fixture requests, không
page error; thêm kiểm tra link không icon, nằm dưới Xóa, căn giữa ở 320/375/430,
hai picker cùng hàng với vùng chạm 44 px và kích thước preview/thumbnail.
Đã xem `skills-compact-form-320.png`, `skills-compact-history-375.png` và
`skills-compact-detail-375.png`; các widths và `skills-compact-result.json` trong
`.expo/skills-validation/` ignored. Chỉ chỉnh UI mobile, không gọi mutation API
thật hay đổi cấu hình storage; kiểm tra native vẫn cần thiết bị.

## Badge và thanh lọc ngang ổn định — 2026-10-11

Token màu badge/trình độ thêm tại theme hiện có, chỉ được các component kỹ năng
dùng. Badge trạng thái có chữ/icon và viền nhẹ, đồng bộ list/detail/profile.
Thanh lọc ScrollView ngang ở ngoài FlatList, giữ một hàng và offset khi chọn lại
thẻ. Dữ liệu cùng phiên đã tải được lọc thành placeholder, không ghi nó vào cache
server, không báo empty hay cho load-more trước kết quả thật. Spinner nhỏ ở vùng
toolbar đã dành chỗ; pull-to-refresh chỉ do thao tác kéo. Đổi thẻ reset vị trí
list, không dịch toolbar. Placeholder tiếp tục loại archived/deleted và giữ
snapshot submit server xác nhận.

145 tests, typecheck, lint, structure (249 files), web export đạt.
`.expo/skills-horizontal-browser.cjs`: 6 nhóm / 21 fixture requests, không page
error; kiểm tra màu/border, một hàng ở 320/375/430 không tràn trang, offset ngang,
GET chậm 900 ms không đẩy dòng, chọn nhanh, pagination tìm match trang sau, list
dài giữ toolbar và empty sau response thật. Regression
`.expo/skills-compact-browser.cjs`: 7 nhóm / 82 requests, không page error.
Đã xem `skills-horizontal-badges-375.png`; các widths và
`skills-horizontal-result.json` ignored trong `.expo/skills-validation/`.
Không sửa backend hoặc gọi mutation API thật; native acceptance vẫn cần thiết bị.

## Badge card và profile từng nhóm 5 — 2026-10-11

Badge chưa xác minh đổi sang neutral ấm; nhãn cả bốn level dùng cam đất nhạt,
đồng bộ card/detail/profile qua token hiện có. Hook window dùng chung cho own,
public self và profile mẫu: khởi đầu 5 dòng, Xem thêm mở 5, chỉ fetch khi hết
trang đã tải, lỗi giữ dòng đang hiện và quay lại profile thu gọn về 5. Không đổi
limit/cursor API, visibility hoặc boundary profile mẫu.

Typecheck, lint, structure (250 files), formatting, web export và diff check đạt.
`.expo/skills-profile-five-browser.cjs` đạt 4 nhóm / 21 fixture requests, không
page error: own 5→10→15→20→24, không GET khi mở các dòng đã tải; cả bốn level/
badge chưa xác minh trên card/detail; reset 5 khi quay về; public 5→20, lỗi trang
sau giữ 20 rồi retry lên 23; kỹ năng private không hiện public; đúng 5/empty
không có Xem thêm và responsive 320/375/430. Không có mutation skills trong QA.
Đã xem own profile 375 và card 430. Các ảnh
`skills-five-{own,public}-profile-{320,375,430}.png`,
`skills-warm-card-badges-430.png` và `skills-profile-five-result.json` ignored
trong `.expo/skills-validation/`. Native acceptance vẫn cần thiết bị.

## Rà soát trước commit — 2026-10-11

Source cuối giữ toàn bộ thay đổi ở mobile và root lockfile cho dependencies
mobile. BE/shared không có diff; script seed thử nghiệm đã bỏ, không thay dữ liệu
catalog đã seed. Menu profile dùng Hành trình của tôi với hai tab chưa kết nối
và Đánh giá về tôi; nghiệp vụ các mục đó theo spec profile.

Đã tái hiện một race của Xem thêm: tải trang sau rồi rời profile/quay lại có thể
làm danh sách tự mở thành 10 dòng. Hook window nay gắn kết quả với lượt focus,
reset limit/busy khi trở về và bỏ qua callback cũ; callback cũ cũng không được
mở khóa một request mới. Ba regression tests trong
`tests/profile-skill-window.test.ts` phủ stale completion, khóa mới và retry lỗi.
Variant Button `craft-soft` không còn được dùng đã bỏ; form submit dùng `craft`.
Tài liệu cập nhật bốn dependencies và menu mới; giữ kết quả cũ bên dưới là lịch sử.

Checks cuối đạt: 148/148 mobile tests, typecheck, lint không warning, structure
253 source files, 6 commit-scope tests, Prettier, diff check và production web
export (1747 modules). Browser fixtures trên source cuối không page error:

| Harness local                          | Nhóm checks / requests   | Phạm vi                                                                            |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `.expo/skills-commit-crud-browser.cjs` | 3 / 43                   | Catalog/create/edit/stale version, draft evidence và visibility/private projection |
| `.expo/skills-delete-browser.cjs`      | 7 / 31                   | Confirm/cancel, pending, retry, refresh failure và không hiện lại skill đã xóa     |
| `.expo/skills-compact-browser.cjs`     | 7 / 82                   | Auto upload/scan/submit, history, ảnh riêng tư, pending và decision refresh        |
| `.expo/skills-horizontal-browser.cjs`  | 6 / 21                   | Badge, scroll ngang, chọn nhanh không nhảy và pagination                           |
| `.expo/connection-browser.cjs`         | 4 / 7 (+3 health probes) | Mất mạng toàn app, read recovery, không replay mutation                            |
| `.expo/learning-hub-browser.cjs`       | 6 / 22                   | Hành trình, tabs, authenticated route và profile 5 dòng/pagination                 |
| `.expo/profile-race-browser.cjs`       | 1 / 5                    | Callback tải trang cũ sau khi rời/quay lại profile                                 |

Fixtures intercept API; không dùng các lượt này làm bằng chứng API/storage/scan
thật. QA local ignored dưới `.expo/skills-validation/`. Android/iOS, picker thật,
storage và ClamAV vẫn pending theo checklist; không sửa cấu hình BE để giải quyết
503 FILE_STORAGE_UNAVAILABLE trong lượt này.
