# Session và LiveKit

Backend đã tích hợp room/token, UTC lifecycle, signed webhook, progress và dual
completion trên model Session hiện hữu. Spec 012 bổ sung interval theo participant
SID, outcome theo lần diễn ra, no-show, excuse và học bù. Video UI SH-074 do client
triển khai; xem [contract attendance](../specs/012-session-no-show/contracts.md).

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

**Join window đã chốt ngày 2026-11-03: trước startAt 10 phút, sau endAt 10 phút.**
Configuration seed thêm `livekit.joinWindow = { earlyMinutes: 10, lateMinutes: 10 }`
khi key chưa tồn tại, giữ nguyên giá trị/version operator đã lưu. Chỉ thêm env
chưa đủ để vào học: missing/invalid/future-effective policy vẫn trả
`503 LIVEKIT_POLICY_NOT_READY`; list/detail vẫn hoạt động. Không fallback để bỏ
qua policy DB chưa hợp lệ.

Để cấu hình riêng key này trên API đang deploy, operator đọc version từ DB:

```sql
SELECT config_key, value, version, effective_at, CURRENT_TIMESTAMP
FROM system_configurations
WHERE config_key = 'livekit.joinWindow';
```

Trong terminal container API, thư mục `/app/services/api`, chạy (version 0 nếu
chưa có row; nếu đã có thì thay bằng version vừa đọc):

```sh
node scripts/configure-livekit.mjs --early-minutes 10 --late-minutes 10 --expected-version 0 --reason "Approved 10-minute early and late LiveKit join window on 2026-11-03"
```

Command
dùng UpdateConfigurationUseCase hiện hữu, ghi current/history/audit cùng một
transaction; expected-version=0 khi key chưa có. Các placeholder dưới đây phải
thay bằng giá trị thật, không chạy nguyên mẫu:

```powershell
pnpm --filter api build
pnpm --filter api livekit:configure --early-minutes <approved-early> --late-minutes <approved-late> --expected-version <current-version-or-0> --reason "<approval reference>"
```

CLI chỉ dùng quyền vận hành qua DATABASE_URL, chỉ cập nhật key LiveKit này,
không mở endpoint cấu hình public.
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
- `POST /api/v1/sessions/:id/confirm-completion`: sau khi có outcome cho phép,
  trước confirm deadline; note tối đa 1000 ký tự. Retry giữ timestamp/note lần đầu.
  Hai bên confirm hoàn tất buổi; worker cũng có thể hoàn tất theo timeout policy.
- `POST /api/v1/sessions/:id/absence-excuse`: bên vắng gửi `{reason}`.
- `POST /api/v1/sessions/:id/absence-excuse/decision`: đối phương quyết định
  `{accept,note?}` trong dispute window. Chấp nhận chuyển sang học bù.

Room name ổn định theo Session, identity opaque theo Session + User. Token TTL
tối đa 120 giây và không vượt closesAt. Cửa sổ `[startAt-early, endAt+late)` cho
phép token renewal khi ONGOING hoặc AWAITING_CONFIRMATION trong late grace;
COMPLETED/CANCELLED/DISPUTED/NO_SHOW/MAKEUP_REQUIRED bị chặn. TTL không tự ngắt media đang kết nối.

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
kể cả mất webhook. Heartbeat bổ sung interval và đóng connection mất dấu sau 90s.
Sau join grace + 10 phút chờ dữ liệu, outcome dùng union interval cắt theo lịch:
80% thời lượng là có mặt; vào sau 10 phút đánh dấu trễ. Lỗi quan sát hoặc provider
disabled/thiếu join window không dẫn tới phạt vắng. READY vẫn đổi lịch theo cutoff
60 phút; MAKEUP_REQUIRED dùng hạn học bù. Không ghi âm/ghi hình.

## Completion và các giới hạn còn mở

Mỗi Session COMPLETED chỉ tăng progress, không release Credit theo buổi. Khi
toàn bộ Session hoàn tất, outbox signal và recovery worker thử settlement qua
application core hiện hữu; check dispute/deadline và transaction/idempotency
vẫn được giữ. ONE_WAY/TWO_WAY và 96/4 không thay đổi.

`session.attendancePolicy` có default đã duyệt: trễ 10 phút, tối thiểu 80%, chờ dữ
liệu 10 phút, confirm 24h kể từ kết luận, dispute 48h sau endAt, học bù 7 ngày.
Outcome giữ policy snapshot; sửa config chỉ ảnh hưởng occurrence mới. Uy tín −8
chỉ khi chốt no-show hoặc Staff UPHOLD, đúng một lần cho mỗi outcome/user.
Tỷ lệ Credit penalty/refund theo trường hợp vắng thuộc phần C, chưa triển khai.
Thiếu xác nhận ở buổi UNVERIFIABLE và học bù quá hạn tạo case hệ thống cho Staff.

Rollout: áp migration `20261029000000_session_no_show` cùng code, chạy
`pnpm --filter api db:seed-configuration`, rồi cập nhật client theo contract mới.
Backfill bảo vệ cả buổi đã bắt đầu và buổi tương lai đã có room/token trước rollout.

## Kiểm chứng

```powershell
pnpm --filter api test:learning-sessions
# TEST_DATABASE_URL phải trỏ PostgreSQL dùng cho test; harness tự migrate schema riêng.
pnpm --filter api test:learning-sessions:integration
```

Integration harness tạo schema UUID riêng, áp migrations trong schema đó và xóa
schema khi xong. Không fallback DATABASE_URL. Cloud smoke cần hai participant
thật lấy token qua API rồi join bằng LiveKit Meet/client, thử reconnect và quan
sát webhook. Token tạo bằng CLI LiveKit không kiểm chứng được membership của API.

Evidence: [Session/LiveKit](../specs/010-session-livekit/validation.md),
[attendance/no-show](../specs/012-session-no-show/validation.md).
