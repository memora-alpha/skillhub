# Trạng thái Expo SDK 58

Trạng thái: Ready for review — cài đặt và source SDK58, gồm safe-area web preview và route khởi động, đã hoàn tất trong phạm vi. Người dùng xác nhận mở app từ QR sau Reload trên Expo Go; các luồng native/API khác chưa nghiệm thu.

2026-10-23T20:14:38+07:00: Nhánh chore/mobile-expo-sdk-58. Thay đổi có sẵn ở mobile/package.json và root lockfile chỉ nâng Expo 57.0.26 lên ~57.0.31. Root cài 57.0.31 nhưng mobile vẫn resolve bản 57.0.26 trong node_modules riêng; log --fix nhận SDK 57 và cài expo@~57.0.31.

2026-10-23T20:33:00+07:00: Mobile resolve Expo58.0.17 từ root/node_modules; React19.3.0, React Native0.88.0, Router58.0.25. Đã đồng bộ Expo packages, native dependencies và React types theo CLI58, Metro config0.88.0. Bản cài mobile cũ đã được loại khỏi resolution và dọn sau kiểm chứng. Giữ node-linker=hoisted và pnpm10.24.0 của repo.

2026-10-23T20:52:48+07:00: Hoàn tất SDK58-05. Safe-area của web dùng CSS env với viewport-fit=cover; đã kiểm layout/modal/menu/toast qua Chrome headless và export lại cả3 platform.

2026-10-23T21:10:02+07:00: SDK58-06: nhận lỗi Unmatched Route ngay khi quét QR exp://192.168.88.162:8081. Manifest Metro đúng SDK58 và src/app. Root index trước đây nằm trong guest-only Protected, còn root/tabs chưa khai báo anchor. Đã đưa index ra ngoài guard, index chuyển người authenticated sang /home, root/tabs anchor=index/home. Người dùng đã Reload Expo Go và xác nhận “Đã vào được app”. Không dùng catch-all redirect; không đổi quyền các route riêng tư.

## Thay đổi cần cho SDK58

- Thêm expo-status-bar config plugin trong app.json để --fix không bị chặn bởi app.config.ts động; giữ web preview SPA bằng web.output=single.
- Ghim @expo/dom-webview~58.0.2 trong mobile để LogBox không nhận peer57.0.1 cũ từ lockfile. Cài cuối không còn peer warning.
- Refs dùng instance types; callback viewability lấy type từ FlatListProps public; shared RefreshableFlatList chuẩn hóa null thành undefined cho các slot theo Strict TypeScript API.
- Tab bar dùng emitter/navigateToTab(route.key) của Router58, giữ tabPress có thể ngăn điều hướng; useIsFocused/usePreventRemove dùng public expo-router entry point.
- Callback submit bàn phím gọi form submit không truyền native event vào React Hook Form.
- Đợi File.write hoàn tất trước khi thay outbox đã lưu. Regression kiểm tra write còn pending và write thất bại, cùng regression tabPress/navigation ở SDK58.
- SafeArea/SafeAreaToast/use-safe-area-position có adapter web và native; web không thêm provider đo inset. Layout và modal chuyển sang adapter, giữ edges/padding/margin/maximum. Toast dùng CSS inset với thư viện animation hiện có; menu giữ offset và thêm inset cạnh phải. public/index.html khai báo viewport-fit=cover cho SPA.
- Route / luôn tồn tại, guest thấy Welcome, authenticated được Redirect /home; anchor root và tabs tường minh. Regression kiểm cả guest, restored account, logout và private screen guards; người dùng xác nhận QR startup trên Expo Go.

## Kiểm chứng

Môi trường: Windows, Node22.19.0, pnpm10.24.0. Lệnh script chạy bằng đúng pnpm10.24.0; pnpm fallback của môi trường agent là11 nên không dùng nó cài workspace. Truy cập store hiện có D:/.pnpm-store và thay dependencies cần quyền ghi mở rộng; không đổi store/linker của repo.

| Check | Kết quả |
| --- | --- |
| expo install --fix --pnpm | PASS, Dependencies are up to date; không quay về57 |
| expo install --check --pnpm | PASS |
| expo-doctor | PASS20/20 |
| pnpm run check-types | PASS |
| pnpm run lint | PASS, max-warnings0 |
| check-structure | PASS,756 source files |
| Full test script |744/748 PASS,4 lỗi trùng baseline bên dưới |
| Bốn file regression nâng SDK/safe-area/startup |10/10 PASS, đã nằm trong full test run |
| QR startup trên Expo Go | Người dùng Reload và xác nhận vào app; không suy thành nghiệm thu toàn bộ native flow |
| Startup trên bản web export thực | Chrome headless PASS: / mở Welcome, nút Đăng nhập đi /login và hiện form Email; /does-not-exist vẫn báo Unmatched Route; không pageerror. Evidence .expo/sdk-58-startup-browser.log |
| expo export --platform all --output-dir .expo/sdk-58-export | PASS: Android/iOS Hermes bundles và web SPA, HTML có viewport-fit=cover |
| Chrome headless, CSS safe-area | PASS: portrait390x844, insets44/0/34/0; landscape844x390, insets0/44/21/44; screen/modal/menu/toast đổi computed style không đo lại vào React; maximum và cạnh bottom bị loại đúng; đóng toast hoạt động; không pageerror |
| git diff --check | PASS |
| Lockfile importers ngoài mobile | Root, web, api và shared packages giữ nguyên khai báo/resolution importer so với HEAD |

Logs local ignored: .expo/sdk-58-tests.log, .expo/sdk-58-audit-tests.log, .expo/sdk-58-export.log. Lần rà soát trước commit tiếp tục đạt types/lint/structure/dependency và Doctor20/20; full tests vẫn744/748, đúng4 lỗi baseline. Export chỉ chứng minh bundle; không thay native build hoặc kiểm thử trên thiết bị/API thật.

Safe-area checks mới chạy trực tiếp bằng binaries hiện có (tsc/eslint/tsx và script check-structure) cùng phiên bản trong package scripts. Fixture browser local ignored tại .expo/safe-area-browser; dùng component menu/modal/toast thật và stub icon để cô lập spacing. result.log và ảnh portrait.png/landscape.png lưu kết quả. Đây là kiểm chứng CSS bằng inset giả lập qua CDP, không phải Safari hay thiết bị có notch thật, không chạy account/API flows.

## Test lỗi có sẵn

Source HEAD1a33601e được git archive vào .expo/sdk-58-baseline, chạy lại3 file liên quan với cùng môi trường:10/14 PASS, đúng4 lỗi như working tree. Evidence: .expo/sdk-58-baseline/apps/mobile/baseline-tests.log.

- learning-path-rules.test.ts: thông báo dùng “Learning Path khác” nhưng test đòi “lộ trình khác”.
- proposal-landing-ui.test.ts: harness chỉ duyệt props.children, chưa render ProposalFormSection nên không tìm thấy ApiProposalForm ở assertion dòng131; chưa chứng minh lỗi form trên app thật.
- skills-read-ui.test.ts:2 ca thiếu mock @/components/RefreshableFlatList.

## Giới hạn và bước tiếp

Safe-area web đã chuyển sang CSS env theo [hướng dẫn Expo](https://docs.expo.dev/develop/user-interface/safe-areas/#usage-with-web). Runtime imports SafeAreaView/useSafeAreaInsets từ thư viện chỉ còn trong adapter native; web chỉ import types. Không coi typecheck/export/Doctor hoặc Chrome fixture đạt là đã nghiệm thu Safari/native.

Agent chưa chạy native build hoặc toàn bộ luồng trên thiết bị/API/provider thật. Người dùng đã xác nhận riêng QR startup trên Expo Go; đăng nhập/đăng xuất thực, deep links, chuyển tab, Tin nhắn/outbox, ảnh/tài liệu và Wallet vẫn cần nghiệm thu native. Không có ios/android được commit; không chạy prebuild --clean. Người dùng cho phép commit phần nâng SDK58 sau kiểm tra; không thực hiện push, không đổi source BE/web hoặc root tooling.
