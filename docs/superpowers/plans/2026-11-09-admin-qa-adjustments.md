# Admin QA Adjustments Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement the reviewed plan task by task.

**Goal** — Cho phép Admin dựng trạng thái ví và reputation cho tài khoản test qua hai API backend để Admin Dashboard có thể tích hợp và QA có thể gọi trực tiếp.

**Architecture** — Module Credit sở hữu ví, lô credit và ledger. Module Reputation sở hữu điểm, lịch sử và chính sách hạn chế. Cả hai dùng chung hạ tầng idempotency và audit PostgreSQL.

**Tech Stack** — NestJS, Prisma, PostgreSQL, Node test runner.

**Spec** — [SRS SkillHub v1.6](../../SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), [backend constitution](../../../services/api/.specify/memory/constitution.md) và hợp đồng đề xuất dưới đây.

## Hợp đồng và phạm vi

| | Cộng credit QA | Chỉnh reputation QA |
|---|---|---|
| Method và route | `POST /api/v1/admin/users/:userId/credit-adjustments` | `POST /api/v1/admin/users/:userId/reputation-adjustments` |
| Permission đề xuất | `credit:adjust:qa` | `reputation:adjust:qa` |
| Body ví dụ | `{"amount":"100","reason":"QA mua tài liệu"}` | `{"targetScore":39,"reason":"QA hạn chế tạo hoạt động"}` |
| Response data | `operationId`, `availableBefore`, `availableAfter` | `historyId`, `scoreBefore`, `scoreAfter`, `level` |
| Validation | Chuỗi số nguyên dương theo credit hiển thị, dùng `parseCredit` sau khi kiểm tra dạng số nguyên và áp `MAX_CREDIT_UNITS` lên đơn vị lưu trữ | Số nguyên JSON từ 0 đến 100. Với yêu cầu mới đặt lại đúng điểm hiện tại, trả `409 REPUTATION_SCORE_UNCHANGED` trừ khi có thao tác gỡ hạn chế QA thực sự |

- Dùng response envelope hiện có, trả HTTP 200 cho cả lần đầu và replay. Số dư credit serialize bằng `formatCredit` thành chuỗi hai chữ số thập phân như `"100.00"`. Validate UUID tài khoản đích và lý do sau khi trim, dài 1–1000 ký tự. Trả 404 khi tài khoản không tồn tại.
- Cả hai route yêu cầu vai trò `ADMIN` cùng permission tương ứng. Dùng `IdentityGuard` và mẫu kiểm quyền ở API Admin hiện có. Seed hai quyền vào bộ quyền Admin và giữ chúng ngoài catalog có thể cấp cho Staff. Thiếu xác thực trả 401, thiếu role hoặc quyền trả 403.
- Đề xuất gate `APP_DEPLOYMENT_TIER=local|staging|production` (mặc định `production`) và `QA_ADMIN_ADJUSTMENTS_ENABLED=true|false` (mặc định `false`). Chỉ mở route khi tier là `local` hoặc `staging` và flag bật. Từ chối cấu hình bật ở production khi khởi động, trả 404 khi route bị tắt. Tier do cấu hình triển khai kiểm soát, cho phép staging dùng `NODE_ENV=production`. Bật ngay trên backend đang phục vụ web/app test và dùng DB hiện tại nếu đó là DB test. Không cần dựng thêm môi trường. Chỉ gán tier local/staging khi deployment thực sự dùng dữ liệu test.
- Bắt buộc header `Idempotency-Key` theo validation của `IdempotencyService`. Scope theo Admin thực hiện, operation khác nhau cho hai route, fingerprint gồm user đích, giá trị yêu cầu và reason đã trim. Cùng key và payload trả snapshot kết quả ban đầu. Đổi payload hoặc user đích với cùng key và operation trả 409. Gate và phân quyền áp dụng cả khi replay.
- Ghi mutation, lịch sử/ledger, audit và kết quả idempotency trong một transaction. Audit dùng `CREDIT_ADJUST` hoặc `REPUTATION_ADJUST` cùng actor, user đích, lý do và giá trị trước/sau. Không ghi token hoặc raw idempotency key vào audit.
- Phạm vi triển khai gồm backend, Swagger và hướng dẫn gọi API để QA tự thao tác. Tích hợp Admin Dashboard và mọi thay đổi trong apps/web, apps/mobile hoặc các frontend khác nằm ngoài phạm vi. Các thao tác tranh chấp, nạp tiền, hoàn tiền và hoàn tác sự kiện reputation tiếp tục dùng hợp đồng hiện có.

## Điểm cần soi khi review

1. Admin đã mất quyền hoặc đã tắt flag không đọc lại được kết quả qua replay.
2. Hai yêu cầu đồng thời cùng key chỉ ghi một ledger/event và một audit. Hai key khác nhau thao tác trên số dư/điểm đã khóa.
3. Retry sau khi phát sinh biến động khác vẫn trả số dư hoặc điểm tại thời điểm adjustment ban đầu.
4. Lỗi audit rollback cả mutation lẫn idempotency record. Retry sau khi sửa lỗi chạy đúng một lần.
5. Hạ điểm qua mốc hạn chế kích hoạt policy. Nâng điểm mặc định giữ hạn chế. Tùy chọn gỡ QA chỉ tác động hạn chế do điểm thấp và giữ quyết định xử lý vụ việc.

## 1. Cộng credit QA và dựng lớp bảo vệ chung

**File liên quan**

- Sửa `services/api/src/configs/environment.ts`, `services/api/.env.example`, permission catalog và cơ chế seed quyền Admin hiện có.
- Sửa `services/api/src/modules/credit/credit.module.ts` và `services/api/src/modules/credit/application/services/credit-operations.service.ts`.
- Thêm `services/api/src/modules/credit/presentation/http/admin-credit-adjustments.controller.ts` và `services/api/src/modules/credit/application/services/admin-credit-adjustments.service.ts`.
- Thêm `services/api/test/credit/admin-qa-adjustments.integration.test.mjs`.

- [ ] Viết ca HTTP cho gate tắt, staging bật, production bật sai cấu hình, User/Staff, Admin thiếu quyền, UUID sai, body sai, thiếu key và tài khoản không tồn tại. Viết ca PostgreSQL thật cho replay, key trùng khác payload, hai request đồng thời, audit lỗi và số dư gần giới hạn lưu trữ. Chạy suite và xác nhận thất bại vì route chưa có.
- [ ] Thêm cấu hình, permission và kiểm tra quyền theo hợp đồng. Gắn controller vào CreditModule cùng các module audit/idempotency theo mẫu repo.
- [ ] Thêm `AdminCreditAdjustmentsService.grant(actor, userId, input, key)`. Dùng `IdempotencyService.execute` và `CreditOperationsService.adjustAvailable`. Cho phép caller QA chọn `referenceType: "SYSTEM"` với mã tham chiếu UUID sinh cho lệnh. Giữ mặc định `DISPUTE` cho caller hiện có và giữ fingerprint cũ của dispute khi bổ sung tham số. Sinh key nội bộ cho ledger riêng với key HTTP. Dùng loại `ADMIN_ADJUSTMENT` và lô `EARNED` như adjustment dương hiện tại. Kiểm tra tràn miền BigInt của DB sau khi khóa ví.
- [ ] Audit lấy số dư trước/sau từ bút toán adjustment. Lưu `operationId` làm tham chiếu idempotency, rồi dựng response từ bút toán của operation đó. Không đọc số dư hiện tại để dựng replay. Xác nhận ví có available tăng đúng `100.00` credit (10.000 đơn vị lưu trữ), held và credit mua/nạp giữ nguyên, có một credit lot, một ledger entry, một audit và không có Payment mới.
- [ ] Chạy lại suite và regression Credit, Admin Finance, Report Support. Kiểm tra thêm một lệnh chỉnh credit qua vụ việc vẫn có tham chiếu `DISPUTE` và giữ hành vi replay cũ.

## 2. Chỉnh reputation QA

**File liên quan**

- Sửa `services/api/src/modules/reputation/reputation.module.ts`.
- Thêm `services/api/src/modules/reputation/presentation/http/admin-reputation-adjustments.controller.ts` và `services/api/src/modules/reputation/application/services/admin-reputation-adjustments.service.ts`.
- Thêm `services/api/test/learning-platform/admin-qa-reputation.integration.test.mjs`. Chỉ sửa `reputation.service.ts` nếu cần để tái sử dụng logic khóa và trả kết quả event.

- [ ] Viết ca HTTP cho gate và quyền riêng của route, `targetScore` là `0` và `100`, ngoài khoảng, số thập phân, lý do rỗng và đặt bằng điểm hiện tại. Viết ca PostgreSQL thật cho `50 → 39 → 50`, `50 → 40`, replay sau lần chỉnh khác, hai request đồng thời, key trùng khác payload, lỗi audit và race giữa hai target khác nhau. Chạy suite và xác nhận thất bại vì route chưa có.
- [ ] Thêm `AdminReputationAdjustmentsService.setScore(actor, userId, input, key)`. Trong callback idempotency, khóa user bằng cơ chế row lock của module, đọc điểm hiện tại rồi tính delta. Dùng thời gian DB và `ReputationService.apply` với `sourceType: "QA_ADMIN_ADJUSTMENT"`, mã nguồn sự kiện riêng và `evaluateRestriction` khi delta âm. Dùng `reputationLevel` để tính hạng. Ghi audit `REPUTATION_ADJUST` với `before: { score }` và `after: { score }`.
- [ ] Lưu `historyId` làm tham chiếu idempotency và dựng response từ event đã lưu. Kiểm tra `50 → 39` ghi restriction theo policy và chặn thao tác tạo hoạt động phù hợp. Với tài khoản sạch, `50 → 40` không tạo restriction mới. Tăng `39 → 50` giữ restriction đang hiệu lực. Replay lệnh giảm vẫn trả `39` và không tạo restriction/audit mới.
- [ ] Chạy lại suite và regression Learning Platform, xác minh các event phục hồi, phạt và hoàn tác tiếp tục theo policy hiện có.

## 3. Gỡ hạn chế do điểm thấp qua API reputation

- [ ] Thêm trường boolean tùy chọn `releaseLowReputationRestrictions` vào DTO và Swagger của API reputation. Mặc định `false`. Khi truyền `true`, yêu cầu `targetScore >= 40` và đưa cờ vào fingerprint. Thao tác dùng cùng gate, quyền Admin, lý do và idempotency của API chỉnh điểm.
- [ ] Trong transaction chỉnh điểm, tìm hạn chế còn hiệu lực của user đích qua `effectiveRestriction(now)` với `reasonCode = LOW_REPUTATION`, ghi `revokedAt` và audit `USER_RESTRICTION_REVOKE`. Giữ hạn chế do tranh chấp, trạng thái khóa tài khoản và lịch sử cũ. Nếu điểm đã đúng nhưng có hạn chế đủ điều kiện để gỡ, ghi event chênh lệch 0 để truy vết và replay. Nếu cả điểm và hạn chế đều giữ nguyên, trả 409.
- [ ] Kiểm thử nâng điểm mặc định giữ hạn chế, nâng lên 50 kèm tùy chọn gỡ để mở lại hành động bị chặn do điểm thấp, trường hợp còn hạn chế do chưa xác nhận chính sách, hạn chế REPORT_CASE giữ nguyên, replay không ghi audit trùng và lỗi audit rollback toàn bộ.
## 4. Nghiệm thu và vận hành

- [ ] Bổ sung Swagger cho hai route gồm permission, request, header, response và mã lỗi. Ghi cách bật/tắt, seed quyền và ví dụ gọi trực tiếp hai API bằng Admin token, gồm body chỉnh điểm với tùy chọn gỡ hạn chế, trong `services/api/README.md`. Với DB test, chạy `pnpm --filter api identity:seed` sau build. Rà soát Prisma schema trước rollout. Thiết kế dự kiến dùng enum `SYSTEM` và cột lịch sử hiện có.
- [ ] Chạy tuần tự từ root `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api build`. Từ `services/api`, chạy `node test/require-integration-env.mjs` rồi `node --test --test-concurrency=1 test/credit/admin-qa-adjustments.integration.test.mjs test/learning-platform/admin-qa-reputation.integration.test.mjs`. Ghi kết quả regression của hai task vào PR.
- [ ] Trên deployment đang phục vụ web/app test, thử giao dịch mua tài liệu hoặc hold lộ trình trước/sau khi cộng credit, kiểm tra ví và ledger. Hạ điểm xuống `39`, kiểm tra hạng hồ sơ, điều kiện recovery và một route chịu restriction. Gọi API bằng Admin token để nâng điểm lên `50` và kiểm tra hạn chế vẫn hiệu lực theo mặc định. Gọi lại với key mới và `releaseLowReputationRestrictions: true`, rồi kiểm tra luồng từng bị chặn bằng hai tài khoản test trên web/app hiện có. Tắt flag và kiểm tra hai route cùng replay đều bị chặn. Dọn fixture bằng quy trình reset DB test hiện có để các ca có thể chạy lại.

## Quyết định đề xuất để review

- Đặt điểm đích thay vì nhận delta. Giảm điểm chạy policy thật. Tăng điểm mặc định giữ hạn chế, với tùy chọn gỡ riêng cho LOW_REPUTATION để phục vụ hai tài khoản test.
- Credit QA dùng được như credit khả dụng trong DB test. Giới hạn v1 theo miền credit hiện có, với quyền riêng và DB test riêng. Mức trần QA thấp hơn hoặc hạn mức theo ngày chưa được quy định trong SRS.
- Cách nhận diện production dựa vào biến tier do deploy quản lý. Xác nhận cấu hình staging và production trước khi bật feature.
