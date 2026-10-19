# Kết quả rà source mobile

## Hiện trạng

- Cập nhật lúc: 2026-10-19T23:15:21+07:00.
- Trạng thái: Source và web fixture Skills đã kiểm tra trên fix/mobile-skills-read-denial; API/native acceptance còn mở. F02 ngoài phạm vi bản sửa.
- Baseline: docs/mobile-workflow tại ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd, source working tree không có diff trước review.
- Kết luận: F01 đã sửa; lượt rà Skills bổ sung các sửa đổi về public denial, job bằng chứng, navigation, dọn code không dùng và loại Skills demo khỏi runtime ở cuối file. Kết quả không xác nhận toàn app/API/native hoàn chỉnh.
- Nghiệm thu: Lượt rà này chưa kiểm chứng API thật và Android/iOS. Phạm vi bản sửa hiện tại là F01 và luồng mobile Skills; recovery và Wallet/Payment ngoài phạm vi.
- Bước tiếp theo: review thay đổi F01; F02 xử lý ở nhánh riêng. Kết quả follow-up ở cuối file; mô tả source và reproduction ban đầu bên dưới thuộc baseline trước fix.

## F01 — P2 — Dữ liệu Skills riêng tư vẫn hiển thị sau khi server từ chối đọc

**Trigger:** đã tải own skill/history thành công; sau đó tài khoản vẫn ACTIVE nhưng bị restriction ALL, backend trả403 SKILL_PERMISSION_REQUIRED. Đây là ca backend có thật theo [SkillActorService](../../../../../services/api/src/modules/users/application/services/skill-actor.service.ts), không phải giả định đổi account hoặc mất mạng.

**Source:** [useOwnSkill](../../../src/features/skills/hooks/use-skill-queries.ts), dòng169–176, để error từ api.findOwn đi thẳng vào Query; TanStack giữ data cũ sau refetch lỗi. [SkillDetailScreen](../../../src/features/skills/screens/SkillDetailScreen.tsx), dòng25–37, chỉ chặn null/archived/không data nên tiếp tục mount header/history/actions khi data cũ còn. [VerificationDetailScreen](../../../src/features/skills/screens/VerificationDetailScreen.tsx) và history cũng render cached batch/reasons dù có lỗi đọc.

**Tác động:** nội dung own/private và lịch sử xác minh vẫn hiện sau authoritative read denial; nút quản lý không bị khóa theo quyền đọc. Một503 sau denial vẫn giữ snapshot đó. Không khẳng định server cho phép mutation/download trái quyền: server vẫn kiểm quyền, lỗi nằm ở UI/cache giữ dữ liệu đã bị từ chối đọc.

**Bằng chứng:** harness thực thi useOwnSkill thật, createSkillsApi/shared HTTP với Axios fixture và QueryClient/QueryObserver thật:200 →403 →503 vẫn giữ own DTO. Thực thi SkillDetailScreen thật qua JSX tree cho thấy VerificationHistory vẫn mounted với headerProps.skill cũ và pending=false sau403. Không chỉ đọc source string để khẳng định bug.

**Đề xuất sửa:** phân biệt GET403/404 với transient errors; che/loại owner/history/detail snapshot và khóa actions sau read denial, chỉ mở lại khi read thành công đúng resource/session. Không hồi sinh dữ liệu khi retry503. Không áp read-denial policy lên mutation403 hoặc mọi lỗi mạng. Dùng LR RequestReadGuard làm tham khảo về semantics, không thêm private cross-feature import.

**Regression cần:**200→403→503→200 cho owner detail/history/verification; denial không mount private files/actions, lỗi transient đơn thuần vẫn giữ last-read khi policy cho phép, session switch không hồi dữ liệu cũ.

## F02 — P2 — Reset token sống qua thời điểm phiên signed-in kết thúc

**Trigger:** user signed-in đã verify recovery OTP, đang ở /reset-password với proof memory-only; session hết hạn/bị revoke khiến generation đổi và session thành guest trong khi vẫn ở route recovery.

**Source:** [AuthNavigator](../../../src/features/auth/components/AuthNavigator.tsx), dòng12–22, effect chạy lại theo generation nhưng chỉ clear khi rời recovery route hoặc có email mới khác draft. Khi guest, email undefined nên không clear. [Recovery store](../../../src/features/auth/utils/password-recovery-flow.ts) không gắn proof với generation. [ResetPasswordScreen](../../../src/features/auth/screens/ResetPasswordScreen.tsx), dòng46–64, tiếp tục nhận proof còn trong store nếu chưa hết hạn.

**Tác động:** credential khôi phục từ phiên trước còn ở màn reset và bộ nhớ sau khi phiên kết thúc; nếu server grant vẫn hợp lệ, người tiếp tục dùng thiết bị có thể đi tiếp reset mà không verify lại. Đây là thiếu cleanup local, không phải bằng chứng đã thực hiện đổi mật khẩu trái phép hoặc backend grant luôn còn hợp lệ sau mọi loại revoke.

**Bằng chứng:** thực thi effect thật của AuthNavigator với recovery store thật: authenticated generation1/emailA → guest generation2, cùng /reset-password; proof vẫn nguyên sau effect mới. Proof dùng chuỗi giả, không account/OTP/token thật và không gọi API.

**Đề xuất sửa:** gắn lifecycle draft/proof với session/generation khi bắt đầu recovery từ signed-in; clear khi session đó kết thúc/đổi. Giữ guest recovery hợp lệ và không xóa proof nhầm sau OTP verify hoặc guest→signed-in transition đã có policy rõ. Bổ sung regression cho expiry/logout/account switch cùng email/khác email.

## Checks đã thực hiện khi review ban đầu

Từ apps/mobile, dùng binary đã cài tại root node_modules; không install:

| Command thực chạy                                                                        | Kết quả                                | Giới hạn                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| node ../../node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts test/profile.test.mjs | PASS296/296,0 failed/skipped/cancelled | Node/fixture/helper/hook harness, không native UI      |
| node ../../node_modules/typescript/bin/tsc --noEmit                                      | PASS                                   | Static types                                           |
| node scripts/check-structure.mjs                                                         | PASS460 source files                   | Checker không audit đầy đủ graph/semantics             |
| node ../../node_modules/eslint/bin/eslint.js . --max-warnings 0                          | PASS                                   | ESLint hiện có, không chứng minh privacy/lifecycle đủ  |
| Reproduction source/VM/QueryClient                                                       | PASS2 assertions tái hiện bug          | Dependency injection, không React Native device render |

Các lệnh trên tương đương nội dung scripts package đã đọc; không gọi pnpm install hoặc thay dependencies. Tất cả findings vẫn có thể tồn tại khi296 tests hiện tại xanh vì suite chưa bao phủ các trigger này.

### Reproduction lịch sử trên baseline trước fix

Harness dưới đây dành cho source trước fix tại ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Không chạy nó để nghiệm thu F01 trên source mới: imports/runtime đã thay đổi. Nhánh fix dùng regression tests được liệt kê trong follow-up cuối file; giữ nguyên evidence lịch sử.

Từ apps/mobile trong PowerShell:

    Get-Content docs/work/source-audit/evidence/reproduce.cjs.txt -Raw | node --import tsx

[Source reproduction](evidence/reproduce.cjs.txt) dùng source thật được transpile trong VM, mock lifecycle/native shell và existing Axios fixtures. Nó chỉ thay in-process memory, không đọc .env, không persistence hoặc request ra ngoài. Kết quả F01/F02 CONFIRMED nghĩa là bug đã tái hiện, không nghĩa đã sửa.

## Phạm vi và giới hạn

Đã rà Auth controller/storage/HTTP/recovery/gates; network connection store/probe/recovery; LR requests API/query/preflight/recovery/form/navigation/weekly/Tag/offerings; Profile public/own/avatar; Skills parsers/query/cache/save/verification/evidence transfer/scan/compression logic liên quan. Backend chỉ đọc contract/controller/DTO/service phục vụ đối chiếu, không sửa.

Real API/mailbox/storage/scanner/Staff approval, Android/iOS/native keyboard/Back/picker/EXIF/background/process kill, full visual/accessibility review: NOT_RUN. Không dùng kết quả review thay các acceptance T025..T032 hoặc AC của specs003/004. Wallet/Payment và nhánh triển khai nó ngoài phạm vi. Không thêm kết luận Sonar Quality Gate từ local tests.

## Nhật ký 2026-10-19T20:31:39+07:00

Review xác nhận hai findings tại baseline; checks và reproduction được ghi nhận ở trên. Source ứng dụng tại mốc review chưa có bản sửa.

## Follow-up F01 — 2026-10-19T21:35:54+07:00

Bản sửa F01 thuộc nhánh fix/mobile-skills-read-denial, dựa trên dev tại db550cc. Phạm vi gồm feature Skills, tests liên quan và tài liệu kỹ thuật. F02, Wallet/Payment, backend, shared packages và dependencies ngoài phạm vi.

### Kết quả source

- [Read access](../../../src/features/skills/utils/skill-read-access.ts) giữ denial theo phiên và tài nguyên qua refetch lỗi, query GC/remount; xóa dữ liệu private trong các cache bị ảnh hưởng. Own/detail đọc qua GET /me/skills nên denial áp cho các private projections của owner; history denial áp history và batches cùng skill; verification denial riêng áp đúng batch. SKILL_PERMISSION_REQUIRED chặn private projections của owner. Public projections và phiên khác được giữ.
- [Private queries](../../../src/features/skills/hooks/use-skill-queries.ts) cùng [projection guard](../../../src/features/skills/hooks/use-private-skill-query.ts) không trả data đã bị từ chối; chỉ read mới của đúng query/session được mở lại. Response bắt đầu trước denial hoặc kết thúc sau đổi phiên không được khôi phục quyền đọc. Transient error đơn thuần vẫn giữ snapshot hợp lệ; mutation403 không bị coi là GET denial.
- Provider loại các bản tạm confirmed-create/submitted-verification tương ứng; kết quả mutation đến sau denial không cấp lại quyền đọc. List/history không fallback sang các bản tạm khi đang denied. Detail/form/verify/evidence UI không mount dữ liệu bị chặn; callbacks quản lý/tải file kiểm quyền đọc hiện hành. Manual check trong editor dùng refetch có guard.
- Public/catalog hooks chuyển nguyên logic sang use-public-skill-queries.ts và được re-export tại entry cũ để giữ file private queries dưới limit250 dòng; không đổi API/public behavior hoặc consumer imports.

### Kiểm chứng

- Trước wiring fix: 8/8 regression cases thất bại đúng tại assertion dữ liệu cũ còn hiện sau403/404.
- Sau fix: full suite317/317 PASS,0 failed/skipped/cancelled, chạy bằng node ../../node_modules/tsx/dist/cli.mjs --test --test-reporter=dot tests/**/*.test.ts test/profile.test.mjs từ apps/mobile. Có21 tests mới so với baseline296.
- Typecheck PASS; ESLint --max-warnings0 PASS; structure PASS463 source files. Dùng binary sẵn có, không install.
- Regression: [query transitions và manual refetch](../../../tests/skills-read-denial.test.ts), [cache/resource/session/race](../../../tests/skills-read-access.test.ts), [JSX tree và overlays](../../../tests/skills-read-ui.test.ts), [stale actions/pending cleanup](../../../tests/skills-action.test.ts). Harness thực thi source thật với QueryClient/QueryObserver/HTTP fixtures; mock React/native shell, không xác nhận render trên thiết bị.

Real API restriction/storage/scanner và Android/iOS acceptance chưa chạy. Kết quả kiểm tra local không đóng các AC sản phẩm còn mở của spec004.

## Skills — source và web fixture, 2026-10-19T22:18:56+07:00

| Vấn đề đã xác minh                                                                                                  | Bản sửa và bằng chứng                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2: Public Skills giữ các trang cũ sau GET403/404 ở trang kế tiếp; self list và detail cũng thiếu denial bền qua503 | Guard theo profile cho public list/detail, evict các projections liên quan và chỉ mở lại từng query sau read thành công. Regression gồm self/other,403/404,trang sau,503 và cache write; giữ owner/phiên/profile khác. |
| P2: Job upload/scan chưa kiểm read denial, stale retry có thể tiếp tục sau khi dữ liệu owner bị chặn                | Runtime chặn start/submit, abort work đang bị denied, giữ draft/fileIds để retry rõ ràng sau read hợp lệ; callbacks save/picker/retry cũng kiểm guard. Test xác nhận không submit và không upload trùng khi phục hồi.  |
| P2: Header Back bị khóa khi transfer nền đang chạy, trong khi hardware Back cho rời màn                             | Header và hardware Back cùng chỉ khóa picker hoặc parent save; job vẫn thuộc session. Regression kiểm cả trạng thái gửi nền và picker/save.                                                                            |
| P3: Skills đăng ký Android BackHandler trên web gây cảnh báo che UI                                                 | Chỉ đăng ký hardware Back trên Android. Regression Android/iOS/web; bundle web mới không còn cảnh báo BackHandler khi mở detail/form/verify.                                                                           |

UI giữ Nunito, appColors, AppHeader, Button/Input/InfoModal và layout hiện có; nút lưu dùng variant craft cùng màn verification và các luồng signed-in. Public detail giữ nội dung đã được phép đọc khi refresh transient lỗi, đồng thời hiển thị feedback; denial vẫn ẩn nội dung. Không đổi design system hoặc framework.

### Đối chiếu AC và phần còn mở

| Nhóm                                                  | Bằng chứng local                                                                                                                           | Còn thiếu                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| AC01..06: list/catalog/create/edit/visibility/archive | Source, unit/fixture version/key/filter và web edit/save, visibility, hủy xóa                                                              | User API thật, dữ liệu nhiều trang và concurrent/pending conflict                  |
| AC07..11: evidence/scan/submit/history/download       | Unit pipeline/READY/ID/expiry; web chọn PDF fixture → upload/status READY giả lập → submit → Chờ duyệt, khóa xóa                           | Scanner/storage/Staff thật, signed URL và quyền download runtime                   |
| AC12..15: saved outcome/session/navigation/profile    | Regression denial/race/callbacks; web profile → Skills, read200→403→503→200; các trang private/actions bị ẩn sau403/503 và hiện lại sau200 | Native background/account switch/cold start, public pagination thực tế             |
| AC16: UI/accessibility                                | Detail320/375px và form375/430px được xem trực quan; DOM không overflow ngang ở các viewport đã đo; controls có labels/disabled states     | Android/iOS keyboard/Back/picker/screen reader/font scale, Figma frame/pixel match |

Không phát hiện nhu cầu tạo lại CRUD/catalog/evidence đã có. Đã bỏ cách nuốt public denial thành trang rỗng và việc đăng ký hardware Back thừa trên web/iOS. Task còn mở trong specs chủ yếu là acceptance; giữ nguyên specs lịch sử. GAP-09 newest-first toàn bộ dữ liệu thiếu createdAt/sort pagination; SK-002 material-change policy chưa đủ contract để mobile tự reset VERIFIED. Cap server nhỏ hơn hard ceiling vẫn là boundary cần xử lý theo response.

### Checks và UI evidence

- Full suite327/327 PASS,0 failed/skipped/cancelled;10 tests mới so với lượt F01 trước. Typecheck, ESLint --max-warnings0 và structure463 source files PASS. Format và diff whitespace được kiểm riêng.
- Web localhost:8088 dùng [HTTP fixture cục bộ](evidence/skills-web-fixture.mjs.txt), chỉ bind127.0.0.1:49152, dữ liệu/token giả và không forward API. Fixture upload/READY không thực hiện malware scan; không có giao dịch hoặc dữ liệu production.
- Ảnh: [detail375px](evidence/skills-detail-375.png), [denied375px](evidence/skills-denied-375.png), [form430px](evidence/skills-form-430.png). Đây là web screenshots, không phải native acceptance.
- API thật, scanner/Staff và Android/iOS: NOT_RUN. Các cảnh báo deprecated shadow/pointerEvents còn ở shared runtime, ngoài phạm vi thay đổi Skills; không có bằng chứng lỗi chức năng từ chúng.

## Dọn code Skills — 2026-10-19T22:33:17+07:00

- Bỏ helper evidence-polling và 3 tests chỉ gọi helper đó; source ứng dụng không có consumer. Pipeline hiện hành vẫn dùng prepareEvidence → scanEvidence, với regression upload/scan/READY/retry/session trong evidence-send và evidence-transfers.
- Bỏ nhánh model.action.pending trong VerificationFields: form gửi qua transfer nền, không gọi action.run. Không trả action qua model nữa; giữ action.current nội bộ để kiểm focus/session/quyền đọc khi picker hoàn tất và queue bằng chứng.
- Bỏ component SkillText và type FileStatus không có consumer. Các guards cache/resource/session và callbacks vẫn được giữ.
- Routes demo /skills vẫn có consumer từ UI preview, trợ giúp và shortcut; không xóa chúng như code chết. Luồng quản lý API là /my-skills; việc hợp nhất entry points còn là phần cần rà riêng.
- Full suite324/324 PASS,0 failed/skipped/cancelled. Giảm3 tests so với mốc327 do bỏ tests của helper không dùng; không bỏ regression pipeline hiện hành. Typecheck, ESLint --max-warnings0, structure462 source files, format và diff whitespace PASS.

## Loại Skills demo khỏi runtime — 2026-10-19T22:45:49+07:00

- Bỏ catalog.ts, context.tsx, screens.tsx và 6 routes /skills cũ; gỡ provider, public exports và Stack registrations tương ứng. Shortcut Skills, onboarding, trợ giúp và UI catalog mở /my-skills hoặc /my-skills/new. Danh mục API và level catalog vẫn được giữ.
- Loại SamplePublicSkillRow, ProfileSkills và fixture public-profiles khỏi màn hồ sơ; bỏ loading/retry giả và helper toPublicProfile chỉ còn phục vụ fixture. /user/:id dùng chung màn hồ sơ: self lấy saved account và public Skills API, UUID khác lấy API đúng target, ID demo/không hợp lệ không fallback mẫu hoặc viewer.
- Giữ mocks của các module khác chưa chuyển API, gồm discovery/search/proposal; liên kết chứa ID demo từ các màn đó nay trả hồ sơ không khả dụng. Không tự đổi ID mẫu thành UUID của tài khoản thật. Giữ fixtures regression trong tests/evidence, không thêm fixture fallback vào runtime.
- Bỏ3 tests dành riêng cho profile fixture/helper đã xóa, giữ validation và privacy của API boundary trong public-profile-api.test.ts; bổ sung4 regressions entry point/other UUID/invalid target/self API list. Full suite325/325 PASS,0 failed/skipped/cancelled; typecheck, ESLint --max-warnings0 và structure451 source files PASS.
- Web export PASS: node ../../node_modules/expo/bin/cli export --platform web --output-dir "$env:TEMP/skillhub-skills-api-export", chạy từ apps/mobile với EXPO_NO_DOTENV=1 và CI=true;1969 modules, artifact ở thư mục tạm ngoài repo. Không đọc .env hoặc gọi API khi export. Format,243 local doc links và diff whitespace PASS.
- Không thực hiện lại API/native acceptance trong lượt dọn runtime; không dùng việc loại mocks làm bằng chứng API/storage/scanner đã nghiệm thu.

## Sonar follow-up PR41 — 2026-10-19T23:15:21+07:00

- Thay3 nested ternaries trong read-access và fixture payload bằng if/return; bỏ async không có await ở fetch helper. Giữ nguyên policy resource/session/denial và Promise trả về từ QueryClient.
- Harness chỉ đọc11 module source được liệt kê cố định trong repo; từ chối path khác trước read/transpile. Thay createRequire/fallback host loader bằng static dependency imports và explicit mocks. Thêm timeout cho bước nạp module và tắt string/Wasm code generation trong VM context.
- Giữ runInNewContext để thực thi hooks/JSX source với dependency giả lập. Input thực thi chỉ là source repo đã liệt kê, không phải API/route/form/file-picker data. Mocks do tests định nghĩa. VM dùng cô lập globals của test, không được coi là sandbox cho code không tin cậy, theo [Node22.19 VM](https://nodejs.org/download/release/v22.19.0/docs/api/vm.html).
- [Loader regression](../../../tests/skills-source-loader.test.ts) kiểm path ngoài danh sách, URL/prototype names và import không được mock; các regression thực thi source thật vẫn giữ. Full suite327/327 PASS,0 failed/skipped/cancelled; typecheck, ESLint --max-warnings0, structure451 source files, format và diff whitespace PASS.
- Dynamic execution vẫn là điểm cần review trên SonarCloud; không suppress rule, không exclude tests hoặc đổi Quality Gate. [Security hotspot review](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/issues/reviewing-security-hotspots) là bước riêng trên server. Chưa chạy analysis mới hoặc cập nhật trạng thái finding trên SonarCloud, không xác nhận Quality Gate đã pass từ local checks.
