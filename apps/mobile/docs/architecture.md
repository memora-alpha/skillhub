# Kiến trúc mobile

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

[AppProviders](../src/providers/AppProviders.tsx) tải Nunito/Fraunces trước, rồi SafeAreaProvider → KeyboardProvider → ToastProvider → QueryProvider → AuthSessionProvider → ConnectionGate. AvatarUploadToasts nằm trong connection boundary, ngoài SessionGate; SessionGate → SkillsProvider → ProfilePreviewProvider → MockMessagesProvider → MockProposalsProvider → UiPreviewProvider → router children. Sự có mặt của mock providers không chứng minh Proposal/Chat API đã nối.

## Imports và trách nhiệm

Feature dùng public index.ts; public subpaths được checker khai báo đúng bốn mục: product-shell/state, learning-paths/state, learning-paths/policy, sessions/state. Không deep import private feature khác; không tạo barrel gây vòng import để đạt hình thức. Route → screen/view → hook/runtime (khi cần logic) → API adapter → HTTP chung. Không bắt thêm controller rỗng.

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

Wallet/Payment đang phát triển ở nhánh riêng; fixtures/spec006 không có trong checkout này là khác biệt phạm vi nhánh, không phải nợ kỹ thuật cần sửa tại đây. [Điểm tham chiếu Wallet](work/phase-03-wallet-topup/status.md) giữ ranh giới và điều kiện đồng bộ khi tích hợp.

Không thực hiện các khoản nợ này trong Phase 00. Đề xuất logger/UI test framework/automation mới chưa được chấp thuận hoặc cài đặt. Hiện trạng feature chi tiết tra [matrix](feature-matrix.md), status và source; architecture không lưu từng checkpoint/số tests.
