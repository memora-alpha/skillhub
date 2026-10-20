# Rà source mobile sau migration tài liệu

## Mục tiêu và phạm vi

Rà code Auth/session/network, Learning Request và Profile/Skills; đối chiếu source/contract và kiểm chứng findings. Wallet/Payment ngoài phạm vi review. Các bản sửa được theo dõi riêng trong status.

Baseline review: HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Quy trình theo [workflow](../../workflow.md); contract [auth](../../contracts/auth-account.md), [profile](../../contracts/profile.md), [skills](../../contracts/skills-evidence.md), [Learning Request](../../contracts/learning-requests.md), [network](../../network-state.md).

## Phần review đã thực hiện

- [x] Đọc runtime/HTTP/storage/session/provider và cleanup, flow recovery, private/public boundaries.
- [x] Đọc LR adapters/query/form/preflight/conflict/expiry/weekly/Tag/offering và đối chiếu backend source cần thiết.
- [x] Đọc Profile/Skills query/UI/save/upload/scan/job lifecycle và projection/cache behavior.
- [x] Chạy mobile suite, lint/typecheck/structure và tái hiện findings bằng source thật trong harness cô lập.
- [x] Ghi findings có trigger/impact/file/line, bằng chứng và giới hạn tại [status](status.md).

## Điều kiện hoàn thành review

Findings có bằng chứng tái hiện hoặc chuỗi source rõ; không gán lỗi cho khác biệt nhánh Wallet, không lấy suite xanh thay acceptance API/native. Review không tác động dữ liệu thật. Các đề xuất sửa và kết quả follow-up nằm ở findings.

## Kiểm chứng

Checks sử dụng scripts mobile và dependencies hiện có. Reproduction dùng TypeScript transpilation/VM dependency injection, TanStack Query thật và Axios fixture trong tests; không gửi API thật. [Bằng chứng](evidence/reproduce.cjs.txt) là text để không thêm một script vào app lint/runtime.

## Rà luồng Skills

- [x] Đối chiếu FR-SK-01..04, SK-001..004 và AC-01..16 với source cùng bằng chứng hiện có.
- [x] Kiểm owner/public cache, denial ở trang sau, race/session và callbacks quản lý/upload.
- [x] Kiểm validation, catalog/level, version/idempotency, upload/scan/submit, history và archive bằng source/regression.
- [x] Dọn helper polling cũ chỉ còn test gọi, nhánh UI không thể chạy và component/type không có consumer; giữ guards và routes còn sử dụng.
- [x] Bỏ catalog/context/screens/routes Skills demo, chuyển entry points sang API và loại public Skills mẫu khỏi màn hồ sơ.
- [x] Rà profile → list → edit/detail → verification và trạng thái lỗi trên web fixture; đối chiếu theme/shared components ở320/375/430px.
- [x] Cập nhật findings, bằng chứng và acceptance còn mở trong [status](status.md).

API/scanner/Staff và native acceptance tiếp tục theo checklist004. GAP-09 cần timestamp/sort pagination từ backend; material-change policy SK-002 cần contract cụ thể trước khi thay đổi badge. Restore UI, learned-skills/search/contact không được suy thành task còn thiếu của phạm vi quản lý Skills004.
