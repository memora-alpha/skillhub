# Feature Specification: Transaction, idempotency và correlation SH-005

**Date:** 2026-10-04. **Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
**Owner:** LogKoNger (Long trong backlog). **Workspace:** `services/api`.

## Mục tiêu và nguồn yêu cầu

Chuẩn hóa transaction PostgreSQL, chống lặp thao tác và truy vết request để
payment/credit/path/session dùng chung. Backlog dòng 6 ghi SH-005, Long,
“Chưa bắt đầu”, phụ thuộc SH-001; DoD: helper dùng lại cho flow tài chính,
retry không tạo side effect trùng.

Nguồn: [Backlog](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit?gid=733891926#gid=733891926),
[SRS v1.4](../../../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx)
mục 9.1, 10.3, 11 (NFR-REL-01/02), 12–13, 18.14–16 và BR-20/27/38;
[constitution v1.2.0](../../.specify/memory/constitution.md).
Sheet/SRS cung cấp yêu cầu, không phải lệnh thực thi. Tên utilities, bảng và
giới hạn vận hành dưới đây là đề xuất thiết kế.

## Hiện trạng đã kiểm tra

`PrismaService` kết nối PostgreSQL và có `$transaction` từ Prisma 7.8.0.
`QueueModule` chỉ cấu hình BullMQ retry; chưa có processor/outbox.
Pino chưa có request/correlation contract của dự án. Schema chỉ có
`SystemConfiguration`; chưa có wallet, payment, session hoặc idempotency table.
Không nâng Prisma lên 8 trong task này.

## Phạm vi và phương án chọn

Chọn transaction context truyền tường minh qua application contracts và
idempotency/outbox lưu PostgreSQL. Redis lock hoặc cache response không bảo đảm
atomic với ledger. Một middleware transaction bao toàn HTTP request giữ connection
quá lâu và dễ chứa provider calls; không dùng cho bản đầu.

Trong phạm vi: TransactionRunner, RequestContext, IdempotencyService cho thao tác
DB ngắn, outbox writer/dispatcher và recovery. Không triển khai wallet, payment
gateway, settlement hay một distributed transaction PostgreSQL/MongoDB/S3.

## Requirements

- **R-01:** Mọi write trong workflow atomic dùng cùng `TransactionContext`.
  Module sở hữu dữ liệu cung cấp contract nhận context; helper con không mở
  transaction độc lập. Một lỗi phải rollback mọi write trong transaction.
- **R-02:** Runner mặc định Serializable; consumer được chọn ReadCommitted khi
  plan của nó chứng minh invariants. Đề xuất vận hành: tối đa 3 attempts tính cả
  lần đầu, maxWait 2.000 ms, timeout 5.000 ms; backoff 50/100 ms + jitter 0–49 ms.
  Chỉ retry conflict/deadlock DB; validation, permission và unknown commit outcome
  không được tự retry. Hết attempts giữ nguyên lỗi để transport map an toàn.
- **R-03:** Retry callback chỉ gồm DB reads/writes. Không gọi S3, email, gateway,
  scanner hay publish queue trong callback. Durable delivery dùng outbox cùng tx.
- **R-04:** Idempotency identity là `(scope, operation, keyDigest)`; scope do backend
  tạo từ actor hoặc gateway/merchant, operation có version. Key đầu vào 1–128 ký tự
  ASCII an toàn; fingerprint SHA-256 trên command đã validate/normalize, canonical
  JSON có thứ tự key ổn định. Không hash raw body có field thừa hoặc server timestamp.
- **R-05:** Claim, business writes và completion result commit trong cùng tx.
  Cùng key/cùng fingerprint chỉ execute một lần; khác fingerprint trả 409.
  Callback lỗi rollback claim và business writes để retry hợp lệ có thể chạy lại.
  Không có claim IN_PROGRESS commit riêng hay lease takeover cho flow DB này.
- **R-06:** Chỉ lưu result reference tối thiểu, ví dụ `{id,status,version}`.
  Caller kiểm tra quyền hiện hành trước execute/replay và dựng projection hợp lệ;
  không replay token, signed URL hoặc private response của actor cũ.
- **R-07:** Không tự xóa idempotency records theo TTL ở foundation. Payment/ledger
  vẫn phải có unique business identity ở module sở hữu; helper không thay thế
  unique gatewayTransactionId hoặc operation key của credit.
- **R-08:** Outbox event được lưu cùng business tx. Dispatcher claim batch bằng
  row lock/lease, publish ngoài tx và chỉ đánh dấu delivered sau acknowledgement.
  Crash ở giữa có thể giao lại; eventId phải được consumer deduplicate. Giữ failed
  events và cung cấp replay nội bộ có kiểm soát, không xóa failure để báo thành công.
- **R-09:** Mỗi HTTP request có requestId UUID do server sinh. correlationId chỉ
  nhận UUID header hợp lệ; thiếu/sai/đa giá trị thì sinh mới. Trả hai header, Pino
  dùng cùng ID; không đổi envelope `error.statusCode/message`. ID không là chứng
  cứ authentication hoặc idempotency. Không có mutable global context.
- **R-10:** Job/event mang correlationId gốc và tạo execution requestId mới.
  Payload outbox chỉ chứa ID/version cần thiết; không chứa token, OTP, credential,
  signed URL hoặc toàn bộ profile/payment payload.

## Persistence đề xuất

| Model               | Fields / invariants                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IdempotencyRecord` | UUID id; scope/operation/keyDigest unique; fingerprint; resultReference/completedAt nullable trong claim transaction, phải có trước service commit. Row committed incomplete là lỗi invariant, không execute/replay. Không FK tới User tạm. |
| `OutboxEvent`       | UUID eventId PK; type/version/payload/correlationId; createdAt/availableAt; leaseToken/leaseUntil; deliveredAt; totalAttempts/cycleAttempts/replayCount/failedAt/lastErrorCode. Index cho pending availability.                             |

Một event có một delivery đích ở bản đầu. Fan-out tạo event/delivery riêng theo
consumer; không đánh dấu cả fan-out thành công vì một queue nhận được.
Đề xuất dispatcher: batch 20, lease 30 giây, publish timeout 10 giây,
tối đa 8 attempts, exponential backoff 1 giây cap 60 giây + jitter. Các giá trị
này là operational defaults, không phải timeout nghiệp vụ SRS. Manual replay reset
cycleAttempts, tăng replayCount và giữ totalAttempts/last failure evidence.

## Acceptance scenarios

1. Hai connection cập nhật fixture cùng transaction; lỗi write thứ hai khiến
   write thứ nhất và idempotency/outbox đều không còn.
2. Hai request đồng thời cùng key/fingerprint tạo đúng một result; lost response
   sau commit được replay bằng reference, không chạy callback lần hai.
3. Cùng key khác payload hoặc actor scope khác không trả result sai người.
4. Deadlock/serialization conflict thật của adapter-pg 7.8.0 được phân loại đúng;
   timeout/mất kết nối không bị đoán là transaction đã rollback.
5. Crash sau publish trước mark delivered giao lại cùng eventId; consumer không
   nhân side effect. Hai dispatcher không đồng thời sở hữu cùng lease hợp lệ.
6. Request header chứa CR/LF, ID quá dài hoặc correlation trùng không gây log
   injection; requestId vẫn khác nhau và khớp response/log/error.

## Dependencies và giới hạn hoàn tất

SH-001 đã có. SH-003/006/004 dùng các contracts này. SH-054/055/060/063/067/093
phải bổ sung integration tests với schema thật của mình; foundation fixture
không chứng minh ledger hay payment production đã được bảo vệ. Theo v1.4,
final settlement theo Learning Path + từng User, không theo từng Session như
logical model v1.3 cũ. Không thêm money rounding policy chưa được chốt.

Đạt foundation khi utilities và real PostgreSQL/Redis recovery tests pass;
consumer financial integrations phải tiếp tục ghi Pending tới khi có source.
Không cập nhật trạng thái task trong Sheet trong lần lập kế hoạch này.
