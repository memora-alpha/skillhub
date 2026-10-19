# Feature Specification: System Configuration, UTC và secrets SH-006

**Date:** 2026-10-04. **Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
**Owner:** LogKoNger (Long trong backlog). **Workspace:** `services/api`.

## Mục tiêu và nguồn yêu cầu

Cung cấp cấu hình nghiệp vụ có kiểu/version/history, thời gian authoritative
từ backend và provider secrets qua environment; consumer không tự hard-code
policy chưa chốt hoặc tin clock client. Backlog dòng 7: SH-006, Long,
“Chưa bắt đầu”, phụ thuộc SH-001; NFR-TIME-01/SEC-01, BR-18/40.

Nguồn: [Backlog và Open Decisions](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit?gid=733891926#gid=733891926),
[SRS v1.4](../../../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx)
mục 9.1, 10, 11, 13, 18.1, 18.14–16, 18.33/38 và
[constitution](../../.specify/memory/constitution.md).
SRS/sheet là nguồn yêu cầu. Catalog names/technical bounds trong bản này là
đề xuất; chưa có cloud secret manager/deployment provider được chỉ định.

## Hiện trạng và scope

Schema hiện có `SystemConfiguration(key,value,version,effectiveAt,updatedAt)`;
chưa có service, typed catalog, history, seed hoặc config update API.
`validateEnvironment` đã kiểm tra DB/Mongo/Redis; Pino che auth/cookie headers.
Throttler còn hard-code 120 requests/60 s trong một process.

Trong scope: typed non-secret config service + version history, audited internal
update use case, server Clock/absolute timestamp/IANA zone validation, validated
operational env và secret/log handling. Admin config HTTP/UI thuộc SH-105 khi
production auth sẵn sàng. Cloud secret-manager SDK chưa cần; deployment có thể
inject secret vào env qua cơ chế quản lý secret của mình.

Chọn đọc policy snapshot từ PostgreSQL trong use case, không cache Redis ở bản
đầu; caller giữ versions/values để ghi vào business object cần lịch sử.
Chỉ publish immediate config updates; chưa thêm scheduler future-effective.

## Requirements

- **R-01:** Catalog khai báo key, strict value schema, mutability và consumer.
  Unknown/malformed keys không được dùng như policy. Credential không thuộc DB
  catalog; runtime update reject secret-like keys hoặc unknown fields.
- **R-02:** Seed chỉ các giá trị đã chốt và technical defaults đã ghi rõ.
  Rerun seed chỉ insert missing keys/history; không overwrite config đã đổi.
  Giá trị chưa phê duyệt không thành 0/null/default permissive.
- **R-03:** Current table và immutable revision history cập nhật cùng transaction.
  Update có expectedVersion, reason, trusted actor và audit before/after. Hai update
  cùng version chỉ một thành công; stale version trả 409; lỗi audit rollback config/history.
- **R-04:** Foundation chỉ activation immediate với effectiveAt từ DB.
  Future effectiveAt input bị reject, không âm thầm dùng future policy hôm nay.
  Multi-key patch validate toàn bộ và commit atomic; không có partial patch.
- **R-05:** Policy snapshot đọc coherent trong cùng query/tx, gồm values+versions.
  Consumer lưu snapshot tại thời điểm chốt nghiệp vụ; không dùng fee/rate mới để
  tính lại lịch sử đã Hold/confirmed. Fixed v1.4 values chỉ thay khi catalog/spec
  được cập nhật theo quyết định nghiệp vụ; không mở mutable toàn bộ JSON cho Admin.
- **R-06:** Thiếu required policy cho feature đang bật trả configuration-not-ready
  (503 an toàn) hoặc ngăn feature startup/activation. Feature chưa bật không làm
  health nền tảng fail chỉ vì chưa có credentials/policy của feature đó.
- **R-07:** UTC instants dùng timestamptz(3), API ISO-8601 có timezone, output `Z`.
  Local datetime không offset, invalid calendar date hoặc invalid IANA timezone
  bị reject. User timezone phục vụ hiển thị; không thay instant hoặc backend clock.
- **R-08:** Clock do server/DI cung cấp; không nhận clientNow để kiểm tra cutoff.
  Reschedule mặc định v1.4: `startAt - now >= 60 minutes`; đúng boundary được
  phép, thiếu 1 ms không đủ. Scheduling vẫn kiểm tra A+B cùng version trong feature.
- **R-09:** Operational rate limit chuyển sang validated env, default vẫn
  120 requests/60.000 ms/process; không tuyên bố là shared limit multi-instance.
  Login/OTP/upload-specific counters thuộc consumers; storage shared throttle
  trước scale ngang là gate riêng.
- **R-10:** Secrets chỉ ở ignored env hoặc secret-manager injection. `.env.example`
  chỉ names/placeholders. Enabled provider mới bắt buộc credentials; secrets không
  ở SystemConfiguration, audit, response/OpenAPI hay logs. Production public
  endpoints/CORS/provider traffic yêu cầu HTTPS/TLS; PostgreSQL/Mongo/Redis clients
  dùng verified TLS, không tắt certificate validation. Local dev exceptions rõ ràng.
- **R-11:** Log request path không chứa query token; không dump body, config
  values, credential URI hoặc raw provider exception. Lỗi config chỉ trả tên field;
  request/correlation IDs từ SH-005 vẫn được giữ để truy vết.

## Catalog ban đầu

| Key / value                                          | Nguồn và mutability bản đầu                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `learningPath.minCreditPerUser = 20`                 | BR-15/v1.4; fixed policy                                                              |
| `credit.topUpVndPerCredit = 1000`                    | BR-25; fixed policy, VND integer                                                      |
| `credit.pathSettlementBps = {returned:9600,fee:400}` | BR-24; fixed policy, tổng 10.000; rounding integer units vẫn cần consumer credit chốt |
| `session.durationMinutes = {min:60,max:180}`         | BR-17; fixed policy                                                                   |
| `schedule.rescheduleCutoffMinutes = 60`              | BR-18; fixed policy                                                                   |
| `storage.downloadTtlSeconds = 120`                   | Technical proposal, mutable 1–300; không phải số SRS quy định                         |
| `storage.evidenceMaxBytes`                           | Không seed; required khi evidence/report upload được bật, giá trị phải được chốt      |

Các keys completion grace, dispute window, cancellation/no-show penalty,
bonus và LiveKit join window chưa có production value. OP-01/02/03/04/05 còn
“Chờ chốt nghiệp vụ”; không tạo value giả để auth/payment/session chạy được.
Config không tự giải quyết policy làm tròn 96%/4%; integer sub-credit contract
thuộc credit feature, v1.3 Session minimum/withdrawal keys không dùng cho v1.4.

## Data model và acceptance

Giữ current `SystemConfiguration`; thêm `SystemConfigurationRevision` unique
`(key,version)`, value, effectiveAt/createdAt UTC, actor snapshot/reference và
auditId. History insert-only; không xóa version khi key đổi. Existing unknown
rows không tự bị delete; không expose/activate qua catalog.

1. Update TTL 120→60 có before/after history+audit; audit fail giữ nguyên 120.
2. Concurrent expectedVersion=1 chỉ một update thành công; seed rerun không
   phục hồi config cũ. Multi-key patch lỗi không ghi bất cứ key nào.
3. Feature cần evidence cap nhưng key thiếu không cho upload; future policy
   không active sớm. Fixed split sai tổng/unknown key/secret key bị từ chối.
4. Hai timezone process/DB trả cùng UTC instant; `09:30+07:00` tương đương
   `02:30Z`; invalid date/local-only string không được âm thầm normalize.
5. Fake client time không đổi cutoff; đúng 60 phút pass, 59:59.999 fail.
6. Enabled provider thiếu key lỗi tên field; DSN/password/token query không xuất
   hiện ở logs/OpenAPI/audit. Disabled integration không đòi credentials thật.

## Dependencies và trạng thái hoàn tất

SH-005 cung cấp transaction/context, SH-003 audit writer. Clock/time helpers và
env validation có thể làm riêng; audited update chờ hai contracts trên.
SH-010/011/013, SH-004, SH-056/067/072/073/090/105 là consumers.
Foundation hoàn tất khi internal config update/seed/history/UTC/secret checks
được kiểm chứng; endpoint quản trị, NTP/TLS deployment và consumer business
time/financial snapshots giữ Pending tới khi có môi trường/modules thật.
