# Quickstart — Credit & QR payment

Updated: 2026-10-17. Backend wallet/payment API, webhook posting, transport/recovery và nguồn Credit đã có implementation. Merchant/production vẫn cần kiểm chứng riêng. Hướng dẫn đầy đủ: [env, deploy, FE/SSE và đối soát](../../docs/payos-qr-payments.vi.md).

## Review

Đọc [spec](spec.md) → [policies/gates](policies.md) → [plan](plan.md) → [contracts](contracts/http.md). User đã chốt payOS và floor phí 4%, phần còn lại cho bên nhận. [payOS contract](contracts/gateway.md) dùng server-side REST create, verified QR projection và signed webhook; G01 còn channel proof. G02/G03 đã chốt policy và có source lots cho ví tracked. Legacy backfill/refund-origin và G05/G08/G09 vẫn cần phần việc riêng.

Git/pnpm chạy từ root; Spec Kit chạy từ `services/api`. Pointer `.specify/feature.json` trỏ `specs/009-credit-payment`. Branch thực `feat/credit-payment`; API-local script `HAS_GIT=false` không có nghĩa monorepo thiếu Git. Không init nested repo.

## Bước tiếp theo với Spec Kit

Backlog hiện có ở [tasks](tasks.md). Không tự đặt policy chưa duyệt hoặc coi merchant setup đã hoàn tất từ kết quả mock/local. Backend payment là phạm vi hiện tại; admin adjustment/release/refund và frontend chưa nằm trong lần hoàn thiện này.

## Checks khi implementation có source

Có wallet/history HTTP, exact money/cursor, Payment create/list/detail/webhook trên Swagger, durable TOP_UP/audit/events và signed lookup recovery. Config PAYMENTS_ENABLED mặc định false; không tự bật provider thật. User đã chốt amount1k..2tr/step1k/TTL60m và BONUS-first/FIFO; policy decisions khác với runtime readiness.

payOS config dùng PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, PAYOS_RETURN_URL và PAYOS_CANCEL_URL theo .env.example. Return/cancel phải HTTPS vì payOS create/signature vẫn bắt buộc hai fields này; QR-only flow không điều hướng qua chúng và không cần trang return/cancel. Không còn SEPAY_* hoặc sandbox host; không sửa env thật trong lần chuyển provider. prepareCheckout là request gửi từ server, chỉ verified QR payload được trả owner, không mở hosted checkout; không đưa signed request/credential xuống client.

Focused scripts: `pnpm --filter api test:credit`, `pnpm --filter api test:payments`; `pnpm --filter api test:credit:integration` và `pnpm --filter api test:payments:integration` dùng fresh UUID-named schema qua harness hiện có (TEST_DATABASE_URL hoặc DATABASE_URL trong ignored .env). Chỉ schema test bị tạo/xóa, không migrate application schema. Không chạy đồng thời build với các suites import dist.

Từ monorepo root:

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api db:validate:runtime
```

Financial tests dùng Node test runner sau build và disposable PostgreSQL schema. payOS HTTP được giả lập; không lấy mock result làm bằng chứng merchant hoặc callback production.

Regressions hiện có chọn theo affected paths: `test:consistency`, `test:audit`, `test:configuration`, `test:identity`, `test:connections:regression`, và `node --test services/api/test/sonar-remediation.test.mjs` sau build. Real integration scripts phải đọc đúng required env/isolation harness, không chạy chúng mù trên DB đang dùng. Rebuild trước suites import dist. Không chạy migrate/deploy/seed nhờ mỗi tài liệu này.

## Journeys bắt buộc trong môi trường test

1. User mới/ví 0, own history; User khác/Staff không quyền bị từ chối; decimal string qua HTTP thật.
2. 100.000 VND→100,00 Credit; browser success không cộng; authenticated callback trùng/đồng thời chỉ một posting, mismatch không cộng.
3. Crash sau REST create/webhook commit trước ACK: recovery dùng cùng orderCode/receipt; lookup stored orderCode/paymentLinkId, không cấp mã mới hoặc TOP_UP lần hai.
4. TWO_WAY 20/20→19,20 mỗi holder +0,80 fee mỗi người; ONE_WAY100→teacher96, fee4. Test gross10,01→net9,61, fee0,40.
5. Một ví thiếu tiền rollback hold/lịch/Session; concurrent Hold/adjust/posting không âm số dư; incomplete session/dispute chặn final settlement; retry trả snapshot cũ.
6. Admin adjustment có reason/ref/audit; fail audit/outbox rollback; reconciliation phát hiện injected mismatches mà không tự sửa.

## Activation sau implementation

Apply migration mới sau preflight/backup/operator review; seed grants/config có chủ đích; provider secrets chỉ env, không docs/log. Confirm approved gates, channel proof, migration/DB invariant tests và live SHA/readiness/logs sau deployment riêng. Health200 hoặc local mock test không chứng minh webhook production/money correctness. Kết quả từng lớp cập nhật [validation](validation.md).
