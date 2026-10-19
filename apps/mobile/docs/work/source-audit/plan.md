# Rà source mobile sau migration tài liệu

## Mục tiêu và phạm vi

Theo yêu cầu người dùng “rà lại đi”, rà code Auth/session/network, Learning Request và Profile/Skills trên working tree hiện tại; đối chiếu source/contract và kiểm chứng findings. Wallet/Payment đang làm ở nhánh khác, ngoài phạm vi. Đây là review, chưa sửa source hoặc tự mở rộng backend/shared/packages/dependencies.

Baseline: branch docs/mobile-workflow, HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd; các docs migration đang sửa/chưa commit được giữ nguyên. Quy trình theo [workflow](../../workflow.md); contract [auth](../../contracts/auth-account.md), [profile](../../contracts/profile.md), [skills](../../contracts/skills-evidence.md), [Learning Request](../../contracts/learning-requests.md), [network](../../network-state.md).

## Phần review đã thực hiện

- [x] Đọc runtime/HTTP/storage/session/provider và cleanup, flow recovery, private/public boundaries.
- [x] Đọc LR adapters/query/form/preflight/conflict/expiry/weekly/Tag/offering và đối chiếu backend source cần thiết.
- [x] Đọc Profile/Skills query/UI/save/upload/scan/job lifecycle và projection/cache behavior.
- [x] Chạy mobile suite, lint/typecheck/structure và tái hiện findings bằng source thật trong harness cô lập.
- [x] Ghi findings có trigger/impact/file/line, bằng chứng và giới hạn tại [status](status.md).

## Điều kiện hoàn thành review

Findings có bằng chứng tái hiện hoặc chuỗi source rõ; không gán lỗi cho khác biệt nhánh Wallet, không lấy suite xanh thay acceptance API/native. Không sửa runtime/tests/config, stage/commit hoặc thao tác dữ liệu thật trong review. Các đề xuất sửa nằm ở findings, không có checkbox implementation tự động.

## Kiểm chứng

Dùng các binary đã cài để thực hiện đúng nội dung scripts mobile, tránh pnpm exec tự chạy cài dependencies như lượt migration trước. Không thêm framework hoặc dependency. Reproduction dùng TypeScript transpilation/VM dependency injection như harness có sẵn, TanStack Query thật và Axios fixture trong tests; không gửi API thật. [Bằng chứng](evidence/reproduce.cjs.txt) là text để không thêm một script vào app lint/runtime.
