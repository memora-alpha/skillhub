# Rà lỗi Auth và phiên đăng nhập mobile

- Đối chiếu: 2026-10-31T21:37:20+07:00, HEAD `d2d30f018a6b38bf999a5c378551c7a7ef788383`; working tree sạch trước lượt review.
- Phạm vi: mobile email/password login, bootstrap/refresh/storage, logout/logout-all, đăng ký/xác minh email và khôi phục mật khẩu. Backend chỉ đọc để đối chiếu contract; không rà toàn bộ backend/web/Flutter.
- Kết quả review ban đầu: ba lỗi lifecycle được tái hiện bằng source thật; thêm một lỗi hướng dẫn đăng nhập được xác nhận qua source/contract. Bản sửa tiếp theo được ghi riêng bên dưới; các mô tả finding giữ trigger trước sửa.
- Không gửi request nghiệp vụ hoặc dùng tài khoản/credential thật; chỉ thử preflight OPTIONS để kiểm CORS. Không chạy Android/iOS hoặc xác minh deployment. Đây là các lỗi tìm thấy trong phạm vi review, không bảo đảm đã tìm hết mọi lỗi.

## Bản sửa từ dev

- Nhánh: `fix/mobile-auth-session`, tạo từ `origin/dev` tại `0825a5d3ca0c1ce10a204a29c74634290244ca43`. Các thay đổi tài liệu chưa commit của lượt review đã được mang sang nhánh này; không đưa các commit riêng của nhánh Proposal cũ vào nhánh Auth.
- F02/AUTH-01: recovery bắt đầu từ signed-in ghi generation sở hữu. AuthSessionProvider đăng ký cleanup trực tiếp với controller, ngoài SessionGate; đổi generation hoặc rời ready sẽ xóa draft/proof, kể cả khi màn recovery unmount. Guest recovery và kiểm tra email/route hiện có được giữ. Khi reset thành công xóa phiên trước khi mutation settle, màn reset chờ kết quả rồi trả về login với email, không chuyển nhầm về forgot.
- AUTH-02: controller ghi nhận cleanup đang pending trong runtime. Bootstrap chỉ retry xóa credential cho đến khi thành công, không đọc/refresh token vừa logout; lỗi cleanup cũ không đổi trạng thái phiên mới. Lỗi đọc storage ở startup vẫn có thể retry restore bình thường. Nếu process bị đóng trước khi storage xóa được và logout server cũng chưa thành công, intent cleanup trong RAM không tồn tại qua restart; không cam kết xử lý mất process khi cả local persistence và remote revoke đều thất bại.
- AUTH-03: refresh flight gắn generation; phiên mới tạo flight riêng. Finally của flight cũ chỉ dọn đúng reference của nó, không xóa flight mới. Không thay strict rotation trong cùng phiên.
- AUTH-04: bỏ CTA xác minh email theo code chung ACCOUNT_NOT_ACTIVE; thông báo hướng người dùng liên hệ hỗ trợ kiểm tra trạng thái, không suy account chưa verified. Luồng đăng ký → xác minh email vẫn giữ nguyên.
- Phạm vi bản sửa lỗi: chỉ `apps/mobile`. Thông báo ACCOUNT_NOT_ACTIVE dùng chung cho các consumer HTTP trong mobile; không đổi backend, API contract, credential storage schema, thư viện hoặc web credential persistence.

### Follow-up UX: email gần nhất và vị trí đăng xuất

- Login ghi nhớ email hợp lệ vừa nhập, tự điền khi quay lại/mở app. Preference có key riêng `skillhub.auth.last-email.v1`: SecureStore trên native, localStorage trên web; chỉ có email, không chứa password/token và không đổi checkbox rememberMe hoặc web session memory-only.
- Route email từ xác minh/reset được ưu tiên. Khi preference đọc chậm, không ghi đè email đang nhập, input đã được xóa hoặc màn đã unmount. Invalid email không thay email hợp lệ đã nhớ. Writes tuần tự và bộ đếm thay đổi ngăn read cũ thay email mới; lỗi lưu preference không chặn login.
- Đưa nút Đăng xuất xuống cuối Hồ sơ với Button/theme hiện có và LogoutDialog. AccountMenu không còn logout; dọn state/dialog không còn consumer trong ProfileLayout và AppScreenLayout. Theo follow-up của người dùng, bỏ nút logout riêng và state/dialog/styles tương ứng trong Cài đặt; vẫn giữ Đăng xuất tất cả thiết bị và thông tin phiên bản. SessionGate vẫn có cách về đăng nhập khi phiên lỗi.
- Consumer ảnh hưởng: các màn dùng chung hai layout trên nhận menu mới; không thay navigation/actions còn lại của menu. Các thay đổi tiếp tục trên `fix/mobile-auth-session`, không đổi backend/shared packages/dependencies.
- [Regression preference](../../../tests/login-email-preference.test.ts) kiểm normalization, persistence qua instance mới, write ordering, storage failure và hydration/form/route/unmount races. Kiểm chứng cuối ghi tại status; chưa nghiệm thu native persistence hoặc visual trên thiết bị.
- Kiểm lúc 2026-10-31T22:06:34+07:00: **909/909 tests PASS**,0 failed/skipped/cancelled, thêm6 cases preference/hydration so với mốc903. TypeScript, ESLint --max-warnings0 và structure815 source files PASS; log `.expo/auth-login-preferences-tests.log`. Format, whitespace và doc links đã kiểm. Không chạy lại API/native/browser visual ở lượt UX.

### Follow-up: bỏ màn Bộ giao diện mobile

- Xóa `src/app/ui.tsx`, UiCatalogScreen và danh sách shortcut riêng của catalog; gỡ export, Stack.Screen ui, mục menu tài khoản và nút ở Hồ sơ.
- FeaturePage mặc định Back về /profile; SystemStateScreen cũng về /profile, không còn điều hướng tới route đã xóa. SystemStateScreen và UiPreviewProvider vẫn có consumer nên giữ; không xóa các provider tính năng khi chỉ bỏ catalog.
- 34 tests hiện có thuộc startup/native text/wallet navigation và skills/plan/tab navigation PASS; focused lint và structure814 source files PASS. Không còn UiCatalogScreen, nhãn Bộ giao diện mobile hoặc đường dẫn /ui trong source runtime. TypeScript và trạng thái cuối ghi ở status; không thêm test hoặc chạy lại full suite cho việc gỡ màn.

## Bản sửa AUTH-05 và AUTH-06 — 2026-11-01

- Tiếp tục trên `fix/mobile-auth-session`; chỉ sửa controller, email preference, regression và docs trong apps/mobile.
- AUTH-05: cleanup có intent riêng, không bị hủy khi một login attempt mới tăng generation rồi thất bại. Chỉ write credential mới thành công cho generation hiện tại mới thay thế intent cũ; việc thay thế diễn ra ngay trong hàng đợi storage, trước khi một cleanup retry xếp sau được chạy. Cleanup bị skip không publish guest lên phiên mới. Các write/rollback của refresh cũng kiểm generation để completion cũ không ghi đè phiên khác.
- AUTH-06: tách email trong RAM, email đã lưu thành công và request ghi đang pending. Cùng email chỉ được bỏ qua nếu đã persist hoặc đang pending; sau write failure có thể retry khi nhập/submit lại. Completion của request cũ không xóa reference request mới. Vẫn serialize writes, không chặn login vì preference lỗi và không đổi storage key/schema.
- [Controller regression](../../../tests/auth-session-lifecycle.test.ts) thêm login401 trong khi logout chờ rotated write, login B thành công cùng trigger và cleanup retry xếp sau durable write B; kiểm restart guest hoặc giữ đúng B tùy outcome.
- [Preference regression](../../../tests/login-email-preference.test.ts) thêm hai lần write fail rồi cùng email retry thành công, và older failure không tạo duplicate latest write. Tổng5 tests mới; trước sửa3 cases fail đúng tại credential A còn trong store, guest đè ready B hoặc chỉ1 write attempt. Sau sửa, focused42/42 PASS; checks cuối ghi tại status.
- Evidence reproduction ngày31/10 bên dưới chỉ giữ lịch sử trước sửa, không chạy để nghiệm thu source mới. Chưa nghiệm thu SecureStore/native process kill hoặc API thật; không thay giới hạn không thể lưu intent qua restart khi cả storage deletion và remote revoke đều chưa hoàn tất.
- Kiểm lúc 2026-11-01T01:35:57+07:00: full **914/914 PASS**,0 failed/skipped/cancelled; TypeScript, full ESLint --max-warnings0 và structure814 files PASS. Lệnh `node ../../node_modules/tsx/dist/cli.mjs --experimental-test-module-mocks --test --test-concurrency=4 --test-reporter=tap tests/**/*.test.ts test/profile.test.mjs`; log `.expo/auth-cleanup-preference-fixes-tests.log`. Format/whitespace/local doc links đã kiểm; không cộng focused suite hoặc reproduction lịch sử vào số full tests.

## Rà lại sau các follow-up — AUTH-05 và AUTH-06 trước sửa

Đối chiếu lúc 2026-10-31T22:20:35+07:00, working tree nhánh `fix/mobile-auth-session`, base `0825a5d3`. Lượt này chỉ review và ghi evidence; chưa sửa runtime cho hai finding mới.

### AUTH-05 — P2 — Login thất bại làm bỏ qua cleanup logout đang xếp hàng

- Trigger: A đang refresh; response mới đã về nhưng store.write credential mới còn pending. Người dùng logout A, clear được xếp sau write; trong lúc chờ, login B trả401. Sau đó write A hoàn tất. Các request logout server thất bại do mạng.
- [clearCredential](../../../src/features/auth/context/session-controller.ts#L55) chỉ xóa storage nếu epoch của logout vẫn bằng epoch hiện tại. [login](../../../src/features/auth/context/session-controller.ts#L121) tăng epoch ngay trước request, kể cả khi request sau đó trả INVALID_CREDENTIALS. Vì vậy login B thất bại vẫn khiến clear A bị skip, dù không hề có credential B mới cần bảo vệ.
- Bằng chứng: reproduction dùng controller thật và storage/API in-memory; trì hoãn write pair rotated A → logout → login B401 → release write. store.clear được gọi **0 lần**; store giữ pair A còn hạn, không rotationPending. Controller mới bootstrap cùng store đã ready bằng refresh A. Không có lỗi write/clear trong adapter; chỉ có write bị trì hoãn và logout server lỗi network. Nếu server revoke thành công thì refresh cũ sẽ bị từ chối.
- Tác động: có thể tự vào lại tài khoản A sau khi đã yêu cầu logout và mở lại app. Đây là thiếu sót mới trong guard cleanup; khác giới hạn đã ghi về cả storage deletion lẫn remote revoke cùng thất bại.
- Hướng sửa: lifecycle cleanup phải theo intent/credential đã lưu, không bị hủy chỉ vì một login attempt thất bại tăng generation. Giữ thứ tự storage writes và bảo vệ credential B đã accept thành công; không bỏ guard một cách đơn giản nếu chưa kiểm cleanup retry xếp sau write mới.
- Regression cần: queued rotated write → logout → login401 → clear thực sự chạy → restart guest; login B thành công không bị clear nhầm; cleanup retries và remote logout success/fail.

### AUTH-06 — P3 — Email không được lưu lại sau lỗi ghi tạm thời nếu người dùng nhập lại cùng email

- [remember](../../../src/features/auth/utils/login-email-preference.ts#L33) cập nhật email trong RAM trước khi ghi; lỗi write được catch nhưng không giữ trạng thái chưa persist. Lần sau cùng email dừng ở điều kiện `next === email`, nên không thử ghi lại.
- Bằng chứng: disk ban đầu là old@example.com; remember new@example.com gặp lỗi write duy nhất. Storage phục hồi; gọi remember new@example.com lần nữa vẫn chỉ có **1** write attempt. Load trong cùng runtime trả email mới, nhưng instance mới sau restart vẫn đọc email cũ.
- Tác động: tính năng ghi nhớ email có thể tiếp tục sai sau khi storage đã phục hồi, cho đến khi người dùng nhập một email khác. Không ảnh hưởng credential/token hoặc kết quả login server.
- Hướng sửa: phân biệt email hiện tại và email đã persist thành công; cho retry cùng email đang dirty khi submit/mở lại, vẫn serialize writes và không để completion cũ ghi đè email mới.

### Evidence và giới hạn của lượt rà lại

- [Reproduction hai finding](evidence/auth-followup-review.cjs.txt): copy vào `.expo/auth-followup-review.test.cjs`, chạy từ apps/mobile bằng `node --import tsx --test .expo/auth-followup-review.test.cjs`. **2/2 tái hiện lỗi**; assertions mô tả lỗi, không phải bằng chứng đã sửa.
- Source thật, fake tokens/passwords và memory adapters; không gọi API, SecureStore hoặc localStorage thật. Không coi adapter mô phỏng restart là native process-kill acceptance.
- Checks lúc 2026-10-31T22:22:24+07:00: full suite **909/909 PASS**,0 failed/skipped/cancelled; TypeScript, full ESLint --max-warnings0, structure814 source files PASS. Lệnh `node ../../node_modules/tsx/dist/cli.mjs --experimental-test-module-mocks --test --test-concurrency=4 --test-reporter=tap tests/**/*.test.ts test/profile.test.mjs`, log `.expo/auth-final-review-tests.log`. Không cộng hai reproduction cases vào909; suite hiện có chưa bao phủ chúng.

## Findings ban đầu trước sửa

| ID            | Mức | Hiện tượng và điều kiện                                                                                                                                  | Bằng chứng                                                                                                                                       |
| ------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| F02 / AUTH-01 | P2  | Proof đặt lại mật khẩu vẫn còn sau khi phiên signed-in kết thúc, nếu vẫn ở route recovery                                                                | Tái hiện effect AuthNavigator và recovery store thật; nối tiếp [F02](status.md#f02--p2--reset-token-sống-qua-thời-điểm-phiên-signed-in-kết-thúc) |
| AUTH-02       | P2  | Sau logout, nếu xóa credential local thất bại và logout server cũng thất bại, bootstrap retry có thể khôi phục chính phiên vừa đăng xuất                 | Tái hiện SessionController với store/API in-memory có fault injection                                                                            |
| AUTH-03       | P2  | Refresh của tài khoản A còn pending được dùng làm Promise refresh của tài khoản B sau logout/login; yêu cầu B cần renewal phải đợi rồi nhận lỗi phiên cũ | Tái hiện SessionController, A/B và response A bị trì hoãn                                                                                        |
| AUTH-04       | P3  | Tài khoản LOCKED/SUSPENDED cũng được gợi ý đi xác minh email, dù đã xác minh và endpoint resend đăng ký không gửi mã cho account đã tồn tại              | Chuỗi source mobile → login backend → resend backend; chưa tái hiện UI/API thật                                                                  |

### F02 / AUTH-01 — Không dọn proof recovery khi kết thúc phiên

- Trigger: đang signed-in, verify OTP recovery thành công, ở `/reset-password`; phiên hết hạn/bị revoke chuyển thành guest nhưng route không đổi.
- [AuthNavigator](../../../src/features/auth/components/AuthNavigator.tsx#L12) phụ thuộc generation nhưng chỉ clear nếu rời recovery hoặc có email mới khác draft. Khi guest, email không còn nên điều kiện không clear. [Store](../../../src/features/auth/utils/password-recovery-flow.ts) chưa gắn draft/proof với generation. [Màn reset](../../../src/features/auth/screens/ResetPasswordScreen.tsx) vẫn cho dùng proof chưa hết hạn.
- Tác động: người tiếp tục dùng thiết bị có thể đi tiếp bước reset bằng proof còn trong RAM, nếu grant server vẫn hợp lệ. Không khẳng định backend chấp nhận mọi grant sau revoke; không thực hiện đổi password thật.
- Hướng sửa: xác định owner/generation của recovery bắt đầu từ signed-in và clear khi phiên đó kết thúc/đổi. Giữ recovery từ guest hợp lệ; không xóa proof nhầm khi verify OTP.
- Kiểm lại: expiry/revoke/logout/account switch cùng email và khác email, guest recovery, response verify OTP đến muộn sau đổi phiên.

### AUTH-02 — Bootstrap khôi phục credential sau logout không xóa được local

- Trigger: đã đăng nhập; `store.clear()` lỗi; logout server thất bại, token server chưa bị revoke; sau đó thử lại bootstrap khi storage đọc được.
- [expire/signOut](../../../src/features/auth/context/session-controller.ts#L171) xóa credential trong RAM, nhưng lỗi clear chỉ publish `offline`. [restore](../../../src/features/auth/context/session-controller.ts#L85) đọc lại credential bền vững cũ và renew, không phân biệt lỗi clear sau logout với lỗi đọc ở startup. [Recovery mạng](../../../src/providers/use-app-connection.ts#L39) cũng bootstrap controller ở trạng thái offline.
- Bằng chứng: login A → clear lỗi storage → logout lỗi network → status offline, refresh credential vẫn trong store → bootstrap → một refresh → status ready, trả access token mới của A. Adapter giả lập refresh được backend chấp nhận; không chứng minh SecureStore thật đã gặp lỗi này.
- Tác động: ý định đăng xuất có thể bị đảo ngược khi retry/phục hồi mạng. Nếu server logout thành công thì refresh cũ bị từ chối; lỗi cần đồng thời các điều kiện trên.
- Hướng sửa: tách cleanup chưa hoàn tất sau logout khỏi bootstrap restore; trong runtime không cho đọc lại credential đã bị người dùng yêu cầu xóa. Retry cleanup trước khi mở lại restore; thiết kế xử lý restart/storage failure rõ ràng, không âm thầm báo logout đã hoàn tất.
- Kiểm lại: clear fail một/nhiều lần, logout server success/fail, retry mạng, startup đọc lỗi riêng, login mới trong lúc cleanup cũ đang pending; không xóa credential của phiên mới.

### AUTH-03 — Refresh single-flight chưa tách theo generation

- Trigger: A đang refresh; logout A và login B trong khi response A chưa về; B cần renewal do access token gần hết hạn hoặc protected request trả 401.
- [renew](../../../src/features/auth/context/session-controller.ts#L122) trả bất kỳ `this.rotation` đang có, không kiểm generation sở hữu Promise. Generation guard trong rotate/accept ngăn nhận token A vào B, nhưng không ngăn B chờ tác vụ A.
- Bằng chứng: sau khi B đã ready, `renew(accessB)` trả đúng Promise của A; khi response A về, cả hai caller nhận AppError session; không có request refresh bằng token B. B vẫn ready và giữ token B.
- Tác động: yêu cầu cần renewal của B thất bại vì phiên cũ; có thể chờ đến timeout của tác vụ A. Không có bằng chứng token/dữ liệu A bị gán cho B.
- Hướng sửa: single-flight thuộc generation; tách tác vụ cũ khỏi phiên mới và chỉ dọn reference trong finally nếu vẫn là đúng tác vụ đó. Giữ strict rotation/single-flight trong cùng phiên.
- Kiểm lại: response A success/401/network/timeout sau login B; B cần proactive renewal và protected-401 renewal; finally của A không được xóa flight B; cùng generation vẫn chỉ gửi một refresh.

### AUTH-04 — Gợi ý xác minh email cho mọi ACCOUNT_NOT_ACTIVE

- [LoginScreen](../../../src/features/auth/screens/LoginScreen.tsx#L112) hiện nút “Xác minh email” cho mọi `ACCOUNT_NOT_ACTIVE`.
- [LoginUseCase](../../../../../services/api/src/modules/auth/application/use-cases/login.use-case.ts#L43) trả chung code này khi [isActive](../../../../../services/api/src/modules/users/application/services/users.service.ts#L71) sai, gồm account LOCKED/SUSPENDED đã emailVerified. [ResendOtpUseCase](../../../../../services/api/src/modules/auth/application/use-cases/resend-otp.use-case.ts#L23) chỉ requestRegistration khi chưa có user; account tồn tại nhận neutral acknowledgment, không có email đăng ký mới từ nhánh này.
- Tác động: người bị khóa/đình chỉ đi vào luồng xác minh không thể giải quyết nguyên nhân đăng nhập bị chặn. Đây là lỗi hướng dẫn; không phải server cấp phiên trái quyền.
- Hướng sửa: thông báo chung và đường hỗ trợ cho trạng thái chưa xác định; chỉ hướng bắt buộc sang verification khi contract có căn cứ tương ứng. Không tự đoán trạng thái account từ neutral202 hoặc thêm backend field ngoài phạm vi.

## Các ghi nhận cũ và giới hạn

| Mục                                                      | Kết quả lượt này                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request A nhận 401 rồi replay bằng token B               | Source hiện có generation guards trước/sau token reads, renewal và responses; focused regression đạt. Không tiếp tục ghi là lỗi đang mở. [Lịch sử sửa](../../../specs/002-auth-account-shell/validation.md#session-boundary-and-logout-all-fixes-2026-10-09)                                                                                                                                                                                      |
| Logout-all thiếu pending/error handling                  | Source dùng mutation/toast và controller deduplicate theo epoch; focused tests success/fail/late success đạt. Native UI vẫn chưa nghiệm thu. [Lịch sử](../../../specs/002-auth-account-shell/validation.md#session-boundary-and-logout-all-fixes-2026-10-09)                                                                                                                                                                                      |
| CORS mobile web8081 so với API chỉ cho web3000 ngày09/10 | Chưa xác minh hiện tại. Backend source chỉ nhận một CORS_ORIGIN; `.env.example` vẫn là localhost3000, nhưng đó không chứng minh cấu hình server đang chạy. Đã thử OPTIONS `/api/v1/auth/login` với origin localhost8081 tại API URL cấu hình local; không nhận được HTTP response (HttpRequestException), nên chưa kết luận allowed origin. [Ghi nhận cũ](../../../specs/002-auth-account-shell/validation.md#registration-api-audit--2026-10-09) |
| Web full reload mất đăng nhập                            | Giới hạn memory-only được ghi trong [session guide](../../guides/state-and-session.md), không tính thành lỗi mới hoặc tự thêm persistence                                                                                                                                                                                                                                                                                                         |
| Mất response refresh dẫn đến yêu cầu đăng nhập lại       | Policy strict rotation hiện có nhằm tránh replay refresh có thể đã consume, không tính thành bug chỉ vì cần login lại                                                                                                                                                                                                                                                                                                                             |
| Register/OTP/reset và đăng nhập thật                     | Source/adapters và fixture tests không thay nghiệm thu email/Redis/SecureStore/thiết bị. [Acceptance còn thiếu](../../../specs/002-auth-account-shell/validation.md#acceptance-evidence-still-required) tiếp tục mở                                                                                                                                                                                                                               |

## Bằng chứng review ban đầu

- Node `v22.19.0`; chạy từ `apps/mobile`, dependencies sẵn có, không install.
- Focused existing suite: **38/38 PASS** qua `node ../../node_modules/tsx/dist/cli.mjs --experimental-test-module-mocks --test --test-reporter=dot tests/session-controller.test.ts tests/http-client.test.ts tests/http-client-session-boundary.test.ts tests/auth-otp-contract.test.ts tests/password-recovery-flow.test.ts tests/verification-cooldown.test.ts tests/sdk-58-startup-route.test.ts`.
- [Reproduction trước sửa](evidence/auth-session-review.cjs.txt): **3/3 tái hiện lỗi**,0 failed/skipped/cancelled trên baseline `d2d30f01`. Đây là evidence lịch sử, không chạy làm nghiệm thu source mới: script không bind lifecycle mới và assertions mô tả lỗi trước sửa. Trên baseline cũ, copy vào `.expo/auth-session-review.test.cjs`, chạy `node --import tsx --experimental-test-module-mocks --test .expo/auth-session-review.test.cjs`. AuthNavigator dùng effect/JSX/module mocks; controller/store recovery là source thật; API/storage dùng adapter in-memory, token giả.
- AUTH-04 được xác nhận bằng chuỗi source/contract, chưa chạy UI render hoặc backend HTTP.
- Preflight CORS không nhận được HTTP response; chỉ gửi OPTIONS, không gửi login/password/OTP. Không chạy full suite/build/export/native; không sửa runtime, backend, shared packages hay dependencies. Chưa commit/push.

## Kiểm chứng bản sửa

- [Controller/recovery lifecycle](../../../tests/auth-session-lifecycle.test.ts): cleanup fail nhiều lần + logout network fail, startup read fail/retry, account switch trong cleanup, A/B refresh đồng thời với success/network/401, không dọn nhầm flight B, signed-in proof bị xóa khi expiry/logout/reauth/cùng email/khác email, guest proof không bị xóa nhầm.
- [Screen regression](../../../tests/auth-screen-lifecycle.test.ts): không có verification CTA cho ACCOUNT_NOT_ACTIVE; ForgotPasswordScreen gắn owner đúng signed-in/guest, bỏ response của phiên cũ; reset chờ mutation sau cleanup rồi về login đúng email. JSX/hook shell được mock; thực thi screen source thật, không thay nghiệm thu render thiết bị.
- Mốc trước follow-up UX, kiểm lúc 2026-10-31T21:52:41+07:00: full suite **903/903 PASS**,0 failed/skipped/cancelled, gồm17 regression mới. `node ../../node_modules/tsx/dist/cli.mjs --experimental-test-module-mocks --test --test-reporter=tap tests/**/*.test.ts test/profile.test.mjs`; log ignored `.expo/auth-session-full-tests.log`.
- `node ../../node_modules/typescript/bin/tsc --noEmit`, `node ../../node_modules/eslint/bin/eslint.js . --max-warnings 0`, `node scripts/check-structure.mjs` đều PASS; structure811 source files. Format, whitespace và local doc links đã kiểm. Commands chạy từ apps/mobile, dependencies sẵn có, không install.
- Regression trước sửa:4/6 controller cases mới fail đúng tại restore token sau logout hoặc dùng flight A cho B;2/6 case startup/late cleanup đã pass. Sau sửa,12 controller/store cases và5 screen cases đều pass, nằm trong full suite903 ở trên.
- Chưa kiểm Android/iOS, SecureStore thật, process kill/restart khi cleanup lỗi, SMTP/Redis hoặc API/deployment thật. CORS vẫn chưa xác minh; không sửa backend CORS từ dữ liệu cũ.

Bước tiếp theo: review diff và nghiệm thu thiết bị/API; xem kết quả bản sửa AUTH-05/06 ngày2026-11-01 trong status. Chưa commit/push.
