# Quickstart: Kết nối

Source cho proposal/direct invitation, Conversation, chat text/file/read, in-app notification và SSE đã được thêm. Migration đã deploy trên DB local; luồng file CHAT đã pass với R2/ClamAV thật trên dữ liệu test riêng. Xem [local validation](local-validation.md), [validation](validation.md) và [tasks](tasks.md) để phân biệt kiểm tra đã chạy với release gates.

## Policy và owner boundaries

[Policy đã chốt](policies.md): proposal 7 ngày, sửa giữ expiry; 10/giờ và 50/ngày/User; direct invitation cùng proposer/recipient/skill cách nhau 24 giờ. Chat 30/phút/User và 120/phút/Conversation; 5 file, 15.000.000 bytes/file và 50.000.000 bytes/tin. Quota dùng PostgreSQL rolling counts dưới user/Conversation locks; persisted retry không đếm thêm.

Optional `initialSessionCount` cần `CONNECTION_SESSION_COUNT_MAX`; ONE_WAY Credit hint cần `CONNECTION_ONE_WAY_MIN/MAX` dạng decimal string. Khi chưa cấu hình, chỉ hint được gửi vào bị trả `503 CONNECTION_POLICY_UNAVAILABLE`. Credit HTTP là decimal string, PG lưu hundredths; TWO_WAY tối thiểu 20 Credit. Không có financial write khi accept.

Learning Request đã dùng owner adapters thật cho catalog/eligibility/public owner/Sharing Skill matching. Path/Schedule lock reader vẫn unavailable; cancellation phụ thuộc reader này giữ fail-closed. Chưa có Path/Schedule card producer, message reports, staff chat browser, external notification channels hoặc business retention purge.

## Database và topology

Từ `services/api`, review migration/preflight trước khi chạy trên database dự định triển khai:

```powershell
pnpm db:validate
pnpm db:deploy
pnpm db:migrate:chat
```

`db:deploy` áp dụng toàn bộ lịch sử PostgreSQL. Connections preflight chặn legacy direct proposals hoặc credit suggestions chưa rõ identity/units; không tự xóa/rescale. Constraints cũng chặn duplicate PENDING/ACCEPTED, Conversation trùng Request và dữ liệu không hợp lệ. Sửa dữ liệu cũ có chủ đích trước deployment.

Mongo cần replica set và explicit indexes. Compose local đã khai báo rs0, URI host là `mongodb://127.0.0.1:27018/skillhub_chat?replicaSet=rs0&directConnection=true`; runtime không tự tạo các index. `db:migrate:chat` dùng `MONGODB_URI`, nên kiểm tra database trước khi chạy. Mongo send/read không được thực hiện bên trong PostgreSQL transaction. Production dùng replica-set topology và network/auth theo môi trường của team.

### MongoDB Windows service local, không dùng Docker

Với service `MongoDB` cài sẵn và chỉ bind loopback, preview cấu hình từ API workspace:

```powershell
./scripts/configure-local-mongo-replica-set.ps1
```

Mở PowerShell Administrator để áp dụng `./scripts/configure-local-mongo-replica-set.ps1 -Apply`. Helper phát hiện config từ service, backup config rồi thêm `replication.replSetName: rs0` và restart. Giữ nguyên dbPath, port, bindIp; rollback config nếu restart lỗi. Không xóa/reset dữ liệu. Sau đó từ API workspace:

```powershell
node scripts/initialize-local-mongo.mjs rs0
```

Helper khởi tạo một member trên `localhost:<port>` khi chưa có replica config, đợi PRIMARY và giữ nguyên config nếu đã khởi tạo. Cập nhật `.env` theo port của service, ví dụ `MONGODB_URI=mongodb://127.0.0.1:27017/skillhub_chat?replicaSet=rs0&directConnection=true`, rồi chạy `pnpm db:migrate:chat`. Đây là topology một member cho phát triển local. Quy trình dựa trên [hướng dẫn chuyển standalone của MongoDB](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/).

S3 private storage và scanner hiện có phải được bật/configure trước upload. File CHAT chỉ gửi được khi uploader-owned, READY/CLEAN và manifest/generation khớp. Evidence vẫn giữ cap 10 MB riêng.

Avatar, CHAT và Evidence dùng chung `S3_BUCKET=skillhub`. Avatar giữ prefix `avatars/`; CHAT/Evidence giữ `private/`. `S3_*` và `STORAGE_*` endpoint/region/credentials phải trỏ cùng provider chứa bucket này. Bật file storage bằng `STORAGE_ENABLED=true` sau khi cấu hình provider/scanner. Dữ liệu cũ trong bucket khác cần chuyển object, giữ nguyên key; đổi env không tự di chuyển bytes.

## SSE client flow

1. Dùng fetch SSE client hỗ trợ `Authorization: Bearer`; không đưa token vào URL.
2. Mở `GET /api/v1/events`, nhận `ready` và giữ cursor; buffer events trong lúc load HTTP snapshots/history/inbox.
3. Hydrate resource theo ID tham chiếu rồi áp dụng buffered events; cursor SSE khác message sequence. Event payload không chứa text/file metadata/signed URL.
4. Reconnect bằng `Last-Event-ID` đã xử lý. Cursor signed, gắn user/epoch; sai user/tamper/future trả 400, replay gap trả 409 hoặc `reset-required` rồi đóng khi đang stream. Reset bằng stream mới và snapshots mới.
5. Token expiry/revoke đóng stream; refresh qua HTTP rồi reconnect. Receipt/SSE không tự mark read; gửi `POST /conversations/:id/read` với published messageId.

Defaults vận hành trong `.env.example`: heartbeat 15 giây, retry 3 giây, replay 10.000 rows/User, buffer 256 KiB, drain 5 giây; shared Redis leases giới hạn 3/User, 2/session, 20/IP, 1.000 toàn hệ thống. Lease unavailable trả 503; vượt quota trả 429. Redis wakeup chỉ là hint, heartbeat đọc durable PG feed để bù mất wakeup. Dùng signing key riêng `EVENT_CURSOR_KEY` ít nhất 32 ký tự; đổi key làm cursor cũ không hợp lệ.

Proxy phải flush `text/event-stream`, không buffer và idle timeout lớn hơn heartbeat; kiểm chứng proxy thật trước release. Shutdown/abort/slow client giải phóng slot/subscriber/timer, không giữ PG transaction khi ghi frame.

## Checks

Chạy tuần tự các lệnh có build vì Nest build xóa `dist`:

```powershell
pnpm db:validate
pnpm check-types
pnpm lint
pnpm test:connections
pnpm test:connections:regression
```

Focused suite có policy/service/DI/SSE/mock fault tests, cộng hai test thật chỉ chạy khi có explicit isolated URLs. Không tự lấy URL database ứng dụng.

### Kiểm tra với database cài local, không dùng Docker

Các script đọc `.env` từ API workspace. Build xong trước khi chạy; không build đồng thời vì test import `dist`.

```powershell
pnpm build
node scripts/check-local-connections.mjs
node scripts/check-local-providers.mjs
node scripts/check-local-providers.mjs --scan-sample
node scripts/check-local-connections-stores.mjs
node scripts/check-local-connections-http.mjs '<path-to-installed-mongod.exe>'
node scripts/check-local-connections-http.mjs --configured-mongo
node scripts/check-local-connections-http.mjs --configured-mongo --live-storage
```

Probe đầu chỉ đọc trạng thái cấu hình/kết nối. PG suite và HTTP harness yêu cầu URL PostgreSQL local, quyền tạo/xóa schema riêng; HTTP harness còn yêu cầu Mongo local và Redis. Lựa chọn replica set tạm yêu cầu binary `mongod` cài sẵn. Harness chạy migration trong schema dùng một lần, dùng queue/throttle keys riêng; replica set tạm dùng port/dbpath riêng rồi cleanup. Không deploy migration vào schema ứng dụng, không đổi `.env` hoặc cấu hình service Mongo đang chạy. Harness mặc định tắt storage; `--live-storage` yêu cầu `--configured-mongo` và `STORAGE_ENABLED=true`, upload một PNG nhỏ vào bucket thật, chờ READY/CLEAN, gửi/tải file rồi xóa và xác minh object test đã mất. Cleanup chỉ lấy keys từ schema test riêng, không liệt kê bucket.

Provider probe mặc định chỉ HEAD bucket `S3_BUCKET` và PING ClamAV; `--scan-sample` scan văn bản vô hại trong RAM qua adapter đã build. Không upload/xóa bytes hoặc gửi email. HEAD thành công chưa chứng minh upload/scan/download E2E; dùng HTTP harness với `--live-storage` để kiểm tra luồng đó. Xem latest recheck trong local validation để biết cấu hình còn thiếu.

Hai lệnh HTTP là hai lựa chọn: truyền binary để dùng replica set tạm, hoặc `--configured-mongo` để kiểm tra trực tiếp service replica set trong `.env` mà không khởi động/dừng một `mongod` khác. Cả hai dùng schema PostgreSQL/database Mongo ngẫu nhiên riêng và cleanup sau test; không thêm tin nhắn vào database chat ứng dụng.

Kết quả runtime ngày 2026-10-11 và những cấu hình còn thiếu ở [local validation](local-validation.md).

### Môi trường disposable bằng Compose

Ví dụ môi trường disposable riêng, từ API workspace:

```powershell
docker compose -f test/connections/compose.yaml up -d --wait
$env:TEST_DATABASE_URL='postgresql://connections_test:local_test_only@127.0.0.1:55433/connections_test'
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true'
pnpm test:connections
docker compose -f test/connections/compose.yaml down
```

Fixtures tạo schema/database riêng và cleanup; test Compose dùng tmpfs, chỉ dành cho test. Missing URLs khiến hai test bị skip; skip không tính là release pass. Suite này chưa chứng minh Redis shared quotas nhiều instance, proxy streaming, S3/scanner E2E hoặc performance.

## API journeys và remaining proof

Swagger ở `/api/docs` khi development/test. Proposal commands dùng Idempotency-Key và expectedVersion; tạo trả 201/replay 200. Message send dùng UUID `clientMessageId`, trả 201 DELIVERED khi verified published hoặc 202 PREPARING/PENDING. Retry cùng body giữ identity; body khác trả 409. Sender query delivery status; chỉ PUBLISHED message xuất hiện trong history. Sequence/Long được serialize string.

Upload `/conversations/:id/attachments` trả 202; uploader query status trước gửi fileId. Download cần live participant, published message/attachment và current safe binding. Mark-read watermark chỉ tăng. Người thứ ba nhận 404; STAFF/ADMIN không có participant bypass.

Trước release cần migrated PG acceptance/revocation/source races, real Mongo transaction/crash recovery, hai API instance với Redis wakeup loss/reconnect, proxy/backpressure/lease proof, S3/scanner/cleanup races và load P95. Retention/deletion/report/case access còn product gates; không purge messages/files/receipts hay wakeup dedupe receipts. Không có commit/push/deployment được thực hiện bởi implementation này.
