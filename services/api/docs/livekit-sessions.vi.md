# Session và LiveKit

Backend đã tích hợp room/token, UTC lifecycle, signed webhook, progress và dual
completion trên model Session hiện hữu. Không cần thêm bảng LiveKitRoom hoặc
SessionAttendance. Video UI SH-074 và tính tổng giây attendance là bước riêng.

## Cấu hình và quyền

Đặt ba biến trong `services/api/.env` hoặc runtime secrets, rồi restart API:

```dotenv
LIVEKIT_URL=wss://YOUR_PROJECT.livekit.cloud
LIVEKIT_API_KEY=YOUR_API_KEY
LIVEKIT_API_SECRET=YOUR_API_SECRET
```

Cả ba vắng thì integration disabled; cấu hình một phần/sai URL thì startup báo
lỗi tên field. Production cần WSS. Local dev chỉ cho WS ở loopback. Không đưa
secret vào frontend, Git, room metadata, audit hoặc log.

Trước rollout chạy identity seed hiện hữu để cấp `session:read:participant` và
`livekit-token:issue:participant` cho USER; permission vẫn cần membership Session.
Không tự cấp token cho STAFF/ADMIN ngoài Session.

```powershell
pnpm --filter api identity:seed
pnpm --filter api db:seed-configuration
```

**Join window chưa có mặc định theo lựa chọn của người dùng.** Chỉ thêm env chưa
đủ để vào học: missing policy trả `503 LIVEKIT_POLICY_NOT_READY`, list/detail
vẫn hoạt động. Không seed 10/10 phút hoặc policy production khác.

Sau khi PO chốt giá trị, operator chạy CLI này với số phút đã được duyệt. Command
dùng UpdateConfigurationUseCase hiện hữu, ghi current/history/audit cùng một
transaction; expected-version=0 khi key chưa có. Các placeholder dưới đây phải
thay bằng giá trị thật, không chạy nguyên mẫu:

```powershell
pnpm --filter api build
pnpm --filter api livekit:configure --early-minutes <approved-early> --late-minutes <approved-late> --expected-version <current-version-or-0> --reason "<approval reference>"
```

CLI chỉ dùng quyền vận hành qua DATABASE_URL, không mở endpoint cấu hình public.
Chạy từ workspace API/pnpm filter để đọc đúng `.env`. Để thay policy lần sau cần
version hiện tại; version mismatch rollback, không tự overwrite. Không yêu cầu
restart sau khi đổi policy DB.

## Contract tích hợp client

- `GET /api/v1/sessions/mine?from=<RFC3339>&to=<RFC3339>`: array tối đa 100;
  giữ thứ tự theo giờ, timestamp phải có Z hoặc offset.
- `GET /api/v1/sessions/:id`: role, lifecycle, hai confirmation, join metadata,
  progress `{agreement:{completed,total}, plan:{completed,total}}`.
- `POST /api/v1/sessions/:id/livekit-token`: Bearer access token SkillHub; body
  rỗng hoặc `{}`. Response envelope `data` có `serverUrl`, `participantToken`,
  `roomName`, `participantIdentity`, `expiresAt`, `joinOpensAt`, `joinClosesAt`.
  Header `Cache-Control: no-store`. Frontend dùng serverUrl + participantToken
  với LiveKit client SDK; không tự chọn userId/roomName.
- `POST /api/v1/sessions/:id/confirm-completion`: sau endAt, note tối đa 1000 ký
  tự; retry giữ nguyên timestamp/note lần đầu. Chỉ cả hai confirm mới COMPLETED.

Room name ổn định theo Session, identity opaque theo Session + User. Token TTL
tối đa 120 giây và không vượt closesAt. Cửa sổ `[startAt-early, endAt+late)` cho
phép token renewal khi ONGOING hoặc AWAITING_CONFIRMATION trong late grace;
COMPLETED/CANCELLED/DISPUTED bị chặn. TTL không tự ngắt media đang kết nối.

`join.canJoin=false` kèm reason cho disabled/policy/state/window; backend vẫn
recheck khi cấp token, client không tự quyết định theo đồng hồ thiết bị. Error
codes: 401 auth, 403 permission/membership, 404 Session, 409 state/window, 503
integration/policy unavailable. Ký token local không chứng minh media server sẵn
sàng: client vẫn phải hiển thị lỗi join/reconnect từ SDK.

## Webhook và recovery

Trong LiveKit Cloud → Settings → Webhooks, thêm URL public HTTPS:

```text
https://YOUR_API_HOST/api/v1/livekit/webhook
```

Signing API key phải khớp LIVEKIT_API_KEY/API_SECRET của API. Localhost không
nhận trực tiếp webhook Cloud; dùng môi trường dev public HTTPS hoặc tunnel do
developer cấu hình. Không cần token đăng nhập SkillHub ở endpoint provider này.

API nhận `application/webhook+json`, xác minh chữ ký/hash trên raw bytes, dedupe
event id bằng receipt trong cùng transaction Session. Chữ ký sai không ghi DB.
Cloud có ID dạng `EV_…`: backend ánh xạ ổn định sang UUIDv8 receipt, giữ nguyên
UUID cũ, không cần migration. Clock provider đi trước tối đa 5 giây được clamp về
DB time; không bắt đầu ONGOING sớm hoặc nới join window. Sai lệch lớn hơn trả 503
và rollback receipt để retry.
Retry DB failure trả 5xx; duplicate hoặc event không liên quan được ack 204.
Room SID được reconcile khi room tái tạo; observation cũ bị chặn theo schedule
và SID hiện tại. Timestamp webhook chỉ chính xác tới giây; fence lịch so sánh
cùng độ chính xác đó, worker phục hồi trạng thái từ current provider snapshot.

Worker mỗi 30 giây và lúc startup quét theo batch, không chạy chồng lấn. ONGOING
cần media participant do provider xác minh; endAt chuyển AWAITING_CONFIRMATION
kể cả mất webhook. Không tự suy ra no-show, completion, penalty từ attendance.
READY vẫn reschedule được nếu hai bên xác nhận trước cutoff 60 phút.

Hai counter attendance vẫn trả string và `attendanceStatus=UNAVAILABLE`: 0 chưa
phải bằng chứng không tham gia. firstJoined/lastLeft chỉ là observation; không
lấy hiệu để tính duration. Không ghi âm/ghi hình trong feature này.

## Completion và các giới hạn còn mở

Mỗi Session COMPLETED chỉ tăng progress, không release Credit theo buổi. Khi
toàn bộ Session hoàn tất, outbox signal và recovery worker thử settlement qua
application core hiện hữu; check dispute/deadline và transaction/idempotency
vẫn được giữ. ONE_WAY/TWO_WAY và 96/4 không thay đổi.

Reports hiện có guard dispute 48 giờ trong source. Feature này giữ nguyên guard,
không coi con số đó là policy production mới đã được PO duyệt. Completion timeout,
dispute policy, no-show/cancellation và cưỡng chế ngắt media khi đóng window vẫn
cần chốt riêng; không auto-confirm hoặc tự seed các policy đó.

## Kiểm chứng

```powershell
pnpm --filter api test:learning-sessions
# TEST_DATABASE_URL phải là PostgreSQL test riêng, đã migrate.
pnpm --filter api test:learning-sessions:integration
```

Integration harness tạo schema UUID riêng, áp migrations trong schema đó và xóa
schema khi xong. Không fallback DATABASE_URL. Cloud smoke cần hai participant
thật lấy token qua API rồi join bằng LiveKit Meet/client, thử reconnect và quan
sát webhook. Token tạo bằng CLI LiveKit không kiểm chứng được membership của API.

Evidence của lần triển khai: [validation](../specs/010-session-livekit/validation.md).
