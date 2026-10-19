# Đóng góp và kiểm tra mobile

## Setup đang dùng

Nguồn: [root package](../../../package.json), [mobile package](../package.json), [env parser](../src/config/env.ts), [env example](../.env.example). Root engines: Node >=22.12.0 <23 hoặc >=24.0.0; README mobile cũ khuyến nghị 22.13+ hoặc24.3+, có thể tiếp tục dùng các bản này. pnpm10.24.0 được pin ở root.

Từ root repository:

    pnpm install
    cd apps/mobile
    if (-not (Test-Path .env)) { Copy-Item .env.example .env }
    pnpm start

Đặt EXPO_PUBLIC_API_URL trong .env cục bộ, ví dụ http://localhost:3001/api/v1. Parser chấp nhận server root hoặc /api/v1; thiết bị thật dùng LAN IP của máy chạy API và mạng có thể truy cập. EXPO_PUBLIC_* là public config, không chứa secrets. Không in .env/credentials vào báo cáo.

Expo Go/client phải tương thích SDK57. pnpm android mở Android; pnpm ios cần macOS/Xcode cho local simulator; pnpm web là mobile web preview, khác apps/web. CORS web cần API cho đúng origin; native không dùng browser CORS. Backend setup thuộc [API README](../../../services/api/README.md), không cấp quyền sửa backend.

## Commands thực tế

| Từ root                                  | Mục đích / giới hạn                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| pnpm --filter mobile start               | Expo dev server                                                              |
| pnpm --filter mobile android / ios / web | Chọn platform qua Expo CLI                                                   |
| pnpm --filter mobile lint                | ESLint recommended, max-warnings0                                            |
| pnpm --filter mobile check-types         | tsc --noEmit                                                                 |
| pnpm --filter mobile check-structure     | Script cấu trúc; hard limits và giới hạn tại [architecture](architecture.md) |
| pnpm --filter mobile test                | tsx/Node với module-mocks flag; tests/**/*.test.ts và test/profile.test.mjs  |
| pnpm --filter mobile test:profile        | Chỉ profile helper tests qua Node                                            |

Không có mobile scripts build, test:e2e hoặc format:check. Root có Prettier và format:check nhưng docs/ bị ignore theo cấu hình hiện hành: kiểm chính xác file cần sửa, không dùng root format toàn repo. Migration tài liệu chỉ cần diff/link/ownership/tooling checks; không chạy app tests/build/export để hợp thức hóa docs.

## Quy chuẩn cho thay đổi mới

Cài dependency từ root, giữ root pnpm-lock.yaml duy nhất. Khi thêm Expo package trong scope đã được yêu cầu: từ apps/mobile dùng pnpm exec expo install <package> --pnpm. Không phục hồi npm lockfile theo plan Spec Kit cũ. SDK upgrade, test framework, styling, persistent storage hoặc auth strategy là việc riêng có đánh giá tác động, không ghép vào chỉnh UI nhỏ.

Native module/config plugin có thể cần development binary mới; JS export hoặc OTA không chứng minh binary cũ chứa module. Không tự đặt EAS channels, runtime policy, branch dev, auto-publish hoặc tăng version cho mọi edit nếu chưa có release strategy. Build/submit/update/merge/deploy cần quyền theo phạm vi; chuẩn bị kết quả review/checks trước quyết định cuối. Không sửa CI/CD trong migration.

## Kiểm tra theo phạm vi và Definition of Done

Chọn focused tests và workspace checks cho hành vi bị ảnh hưởng. Shared mobile UI/HTTP/Auth thay đổi cần kiểm consumer thực tế; shared package thay đổi cần lý do và checks các workspace bị ảnh hưởng. Chạy Next.js typecheck và build tuần tự nếu về sau có task liên quan vì cùng sinh .next.

[Testing guide](guides/testing.md) sở hữu chuẩn bằng chứng/review; [workflow](workflow.md) sở hữu trạng thái, quyền UAT và Git. Đạt trong phạm vi khi hành vi khớp tiêu chí/contract, checks liên quan đủ (hoặc giới hạn không mâu thuẫn acceptance), không fallback fixture âm thầm/lộ private data, xử lý loading/error/retry/navigation/lifecycle liên quan, docs/status được cập nhật. Xác nhận người dùng được ghi riêng theo nguồn thật.

## Git

Áp dụng [root AGENTS](../../../AGENTS.md): branch type/short-kebab-name, không numeric spec prefix; reuse branch đúng scope. Conventional Commits, scope mobile nếu toàn bộ staged paths thuộc mobile; root/nhiều workspace theo rule root. Không nested Git, không tự stage/commit/push/PR/merge/deploy khi chưa được yêu cầu. Giữ hooks; pnpm prepare nếu cần kích hoạt, pnpm test:commitlint kiểm rule scope. Chỉ stage intended changes và review staged diff khi có quyền commit.

## Hướng dẫn local và tài liệu chia sẻ

[.gitignore mobile](../.gitignore) vẫn ignore AGENTS.md, CLAUDE.md, .agents và .specify. Hai instruction files chỉ phục vụ checkout cục bộ; không force-add hoặc đổi tracking policy. README và docs/workflow.md được chia sẻ qua Git là đường đọc chính cho đồng đội. Tooling archive là local ignored, cách khôi phục ở [migration](migration.md).
