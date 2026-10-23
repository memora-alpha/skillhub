# Kiến trúc mobile

Hiện tại: Expo SDK58, React Native0.88.0, React19.3.0 và Router58; web preview giữ SPA (`web.output: single`). [Hồ sơ nâng SDK58](work/expo-sdk-58/status.md) sở hữu kiểm chứng. Các phiên bản trong baseline migration bên dưới mô tả lịch sử.

## Đang có tại baseline migration

Đọc [package.json](../package.json), [tsconfig](../tsconfig.json), [checker](../scripts/check-structure.mjs) và source working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Expo ~57.0.26, React Native 0.86.3, React 19.2.3, Router ~57.0.24, TypeScript ~6.0.3; TanStack Query, Axios, Zod, React Hook Form, Zustand đã có. Không nâng phiên bản trong migration.

| Vùng source                                            | Trách nhiệm hiện tại / boundary cho thay đổi mới                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [app](../src/app)                                      | Route/layout, params, session/navigation guard, render feature; giữ mỏng, không Axios/ledger/workflow dài      |
| [features](../src/features)                            | UI, hooks, schemas, API adapters và runtime theo feature; giữ screens/context/services/utils theo nhu cầu thật |
| [components](../src/components)                        | UI tái sử dụng, không phụ thuộc private state feature hoặc gọi business API                                    |
| [providers](../src/providers)                          | Runtime toàn app; thứ tự bên dưới có ý nghĩa lifecycle                                                         |
| [lib](../src/lib)                                      | HTTP/storage/network; không import feature screen hoặc quyết định text UI                                      |
| [config](../src/config), [constants](../src/constants) | Public config, theme, tokens; theme thật ở constants/theme.ts, không tạo src/theme theo cây dự kiến cũ         |

Server state thuộc Query; client-only recovery/cooldown dùng Zustand hoặc context hiện hữu. Không mirror entity server sang một global store khác. Không tạo thư mục rỗng từ template.

[AppProviders](../src/providers/AppProviders.tsx) tải Nunito/Fraunces trước, rồi SafeAreaProvider → KeyboardProvider → ToastProvider → QueryProvider → AppRefreshProvider → AuthSessionProvider → WalletProvider → ConnectionGate. AvatarUploadToasts nằm trong connection boundary, ngoài SessionGate; SessionGate → SessionsProvider → SkillsProvider → ProfilePreviewProvider → ConnectionsProvider → ChatEventsProvider → UiPreviewProvider → router children. Chat/Proposal dùng API và SSE; các provider preview còn lại phục vụ các màn chưa tích hợp API.

## Imports và trách nhiệm

Feature dùng public index.ts; public subpaths được checker khai báo cụ thể: product-shell/state, learning-paths/state, learning-paths/policy, messages/state, proposals/state. Không deep import private feature khác; không tạo barrel gây vòng import để đạt hình thức. Route → screen/view → hook/runtime (khi cần logic) → API adapter → HTTP chung. Không bắt thêm controller rỗng.

`learning-paths` giữ `index.ts`, `state.ts`, `policy.ts` ở root làm public entry. `api/` chứa contract/adapters và submission recovery; `components/`, `screens/`, `hooks/` giữ UI/runtime; `schemas/` chứa validation input; `utils/` chứa xử lý dữ liệu, policy/progression từ snapshot API và định dạng form chat; `preview/` gom context, fixtures, types và rules chỉ còn phục vụ các consumer chưa tích hợp API. Di chuyển nội bộ không mở thêm public subpath hoặc đổi route/API.

| Nhóm                                              | Mục tiêu thiết kế | Hard limit checker    |
| ------------------------------------------------- | ----------------- | --------------------- |
| Route/layout src/app                              | Khoảng 80 dòng    | 100                   |
| Đường dẫn chứa /hooks/, /utils/, /api/, /schemas/ | Khoảng 180        | 250                   |
| Feature view/component                            | Khoảng 220        | 400 theo nhóm còn lại |
| Source nói chung                                  | Khoảng 250        | 400 theo nhóm còn lại |

Checker duyệt .ts/.tsx trong src, dùng số dòng split LF/CRLF; ưu tiên app trước regex nhóm. File hook nằm ngoài thư mục hooks không tự vào nhóm 250. Nó kiểm một số alias imports và index.ts của feature, không chứng minh không có cycle/private relative import. ESLint recommended và TypeScript không thực thi các mục tiêu thiết kế. Vượt mục tiêu: xem xét tách theo trách nhiệm; vượt hard limit: xử lý trong task được phép, không nâng limit che lỗi. Không tách abstraction vụn.

## Quy chuẩn cho thay đổi mới

Giữ source/UI/theme/routes/runtime hiện có; [guides](README.md) và [workflow](workflow.md) hướng dẫn theo việc. Private cache/async effects cần owner/session guards; backend quyết định quyền, state và Credit. Shared mobile component thay đổi cần kiểm consumer thật. Shared packages chỉ sửa khi được biện minh trong scope; backend cần yêu cầu riêng. Fixture phải có nhãn, không thay real API lỗi.

## Nợ kỹ thuật và giới hạn

| Vấn đề                                                                                     | Tác động / ưu tiên                                                 | Nơi tiếp tục                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------ |
| Auth queries/profile mutation vẫn trong AuthSession; MockSession legacy còn file           | Khó review boundary; trung bình, không refactor trong migration    | [tasks auth](../specs/002-auth-account-shell/tasks.md) |
| Checker chưa bắt đầy đủ dependency graph/relative import                                   | Review kiến trúc vẫn cần; trung bình, automation mới là đề xuất    | [testing](guides/testing.md)                           |
| Public path-count/title/timezone và policy bio chưa đủ contract/evidence                   | Không bịa field hay label thay thế; xem gap theo domain            | [profile contract](contracts/profile.md)               |
| Skills historical newest-first thiếu timestamp/sort; full scanner/native acceptance còn mở | Server ordering và bằng chứng còn thiếu; cao cho release luồng này | [skills contract](contracts/skills-evidence.md)        |

Wallet/Payment trên nhánh Wallet hiện tại có owner-scoped reads, native durable create/cancel/recovery; không còn Wallet preview UI/route. Checkout subscribe qua public `useChatEvents` để tái sử dụng SSE app; payment/wallet refs chỉ kích hoạt GET, consumer hoàn tất trước stream cursor acknowledgment, không thêm socket hoặc auth transport. Chat query hydration giữ nguyên; payment observation có polling dự phòng và focus/session guards. Spec006 giữ quyết định và bằng chứng lịch sử; [status Wallet](work/phase-03-wallet-topup/status.md) sở hữu review/fix hiện hành và giới hạn actual API/provider/native acceptance. Mô tả chỉ-preview lúc migration không đại diện revision này.

Không thực hiện các khoản nợ này trong Phase 00. Đề xuất logger/UI test framework/automation mới chưa được chấp thuận hoặc cài đặt. Hiện trạng feature chi tiết tra [matrix](feature-matrix.md), status và source; architecture không lưu từng checkpoint/số tests.

Audit Wallet đã bỏ inert preparation model khỏi account WalletProvider; helper cũ chỉ còn trong test fixtures. Đã xóa thư mục Wallet preview, route và entry/catalog/notification mẫu; hai host tạo đơn/QR còn dùng cho regression được chuyển sang tests/fixtures. Không thay account API bằng mock. Public event subscription giữ ack sau hydrate đạt version; reconnect chỉ reset budget sau kết nối ổn định, foreground hoặc explicit retry.

Wallet giữ các lớp route → screens/views → hooks/context/utils → API, cùng components/schemas/types/storage theo trách nhiệm. Model intent/observer/quote/QR và helper không có application consumer đã chuyển sang tests/fixtures; production types/outcome/policy chỉ giữ phần dùng thật. Style riêng đặt cùng tên component. Source không import test; QA tiếp tục là công cụ gọi API nội bộ có binding owner/build/environment, không mock fallback cho account.

Calendar/Session dùng `SessionsProvider` theo account và React Query cho danh sách tháng, chi tiết và xác nhận hoàn tất. Calendar lọc ngày trên dữ liệu của tháng hiện tại; không gửi thêm truy vấn ngày. Session đọc context/outline và danh sách toàn Path qua public `useLearningPath`, lấy progress từ detail server; completion refresh Path và danh sách thỏa thuận đúng owner/generation qua public `useRefreshLearningPath`. Reschedule đọc proposal/version/appliedVersion/xác nhận từ Path, giữ draft cục bộ; gửi/xác nhận thật vẫn khóa bởi gate conflict ở confirm cuối. Xem [contract Session](contracts/sessions.md) và [Phase07](work/phase-07-session-api/status.md). LiveKit tích hợp ở nhánh khác, không thuộc thay đổi này.
