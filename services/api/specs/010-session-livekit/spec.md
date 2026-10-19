# Session và LiveKit — thiết kế đề xuất

**Ngày:** 2026-10-19. **Trạng thái:** Đã triển khai backend; xem [validation](validation.md) về kiểm chứng và giới hạn Cloud/UI.
**Phạm vi:** Backend `services/api`; SH-070/071/072/073/075 và contract phục vụ SH-074.

## 1. Mục tiêu và nguồn yêu cầu

Hoàn thiện Session đang có để hai participant hợp lệ nhận token, vào đúng phòng
LiveKit, xem trạng thái/tiến độ và xác nhận hoàn thành mà không thay đổi quy tắc
Hold/settlement hiện hữu. Người dùng đã thêm env, duyệt plan và yêu cầu triển khai
với Ponytail. Ngày 2026-10-19, người dùng chọn **giữ join window là quyết định
còn mở, chưa đặt mặc định production**.

Nguồn đã đối chiếu:

- [Backlog, SH-070..075](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit#gid=733891926), các dòng 55–60; Open Decisions OP-02/03.
- [ERD Drive v3](https://drive.google.com/file/d/1JiIJ1wo_df8xEz5MohOCPp3htqKFvA-A/view), đọc XML bảng `sessions` và `session_schedule_history`.
- `../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`, FR-SES-01..09,
  FR-LIVE-01..05, BR-36, SES-001..005, mục 18.18/18.38.
- `../../../../docs/SkillHub_Logical_Data_Model_v3.md`, mục Lịch và Session.
- Prisma/source/test hiện tại; ERD là tham chiếu cấu trúc, SRS v1.6 là yêu cầu
  nghiệp vụ mới hơn. Không áp toàn bộ khác biệt v3 vào runtime ngoài phạm vi này.
- [LiveKit tokens](https://docs.livekit.io/frontends/reference/tokens-grants/),
  [SDK](https://docs.livekit.io/reference/server-sdk-js/),
  [webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).

Các đường dẫn source phía dưới tính từ `services/api`.

## 2. Hiện trạng đã kiểm tra trong source

| Hạng mục                   | Bằng chứng                                                                       | Đánh giá                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Session và các trạng thái  | `prisma/schema.prisma`, `model Session`, `enum SessionStatus`                    | Có đủ enum, field plan/path/teacher/learner/thời gian                                                              |
| Room và attendance         | `Session.roomName` unique, `providerRoomId`, `roomMetadata`, hai nhóm attendance | Đã gộp vào Session theo ERD; không tạo lại bảng nghiệp vụ                                                          |
| Khởi tạo từ lịch khóa      | `learning-paths.service.ts`, finalize tạo Session + schedule history cùng Hold   | Tái sử dụng; không thêm public create-session API                                                                  |
| Đổi lịch                   | `scheduling.service.ts`, `applyReschedule`                                       | Có kiểm tra CONFIRMED, cutoff, history; cần regression với lifecycle                                               |
| My Sessions / detail       | `learning-sessions.controller.ts` và `.service.ts`                               | Có membership; mine giới hạn 100, chưa có cursor; detail đang spread toàn row                                      |
| Hai bên confirm            | `LearningSessionsService.complete`                                               | Có endAt, membership, khóa Path rồi Session; retry trước confirm thứ hai còn ghi đè timestamp/note                 |
| Tiến độ / final settlement | `refreshPathStatus`, `settlePath`, `ReportsService.assertPathSettlementAllowed`  | Có settlement riêng và dispute guard; chưa có projection N/M theo plan/agreement và trigger tự động sau đủ confirm |
| LiveKit                    | Chỉ có permission catalog, README và field schema                                | Chưa có SDK dependency, provider, token endpoint, webhook hoặc lifecycle worker                                    |
| Foundation tái sử dụng     | Clock, configuration current/history/audit, OutboxConsumer, outbox dispatcher    | Có, không tạo hạ tầng sự kiện/cấu hình riêng                                                                       |

Đánh giá này là kiểm tra source, không chứng nhận runtime hoặc migration đã áp
dụng trên database của người dùng. Không đọc/in credential trong `.env`.

## 3. Phương án và ranh giới sở hữu

**Đề xuất:** mở rộng `LearningSessionsModule`, đặt một `LiveKitService` bọc SDK
chính thức ngay trong module. `LearningSessionsService` sở hữu membership,
mapping và transition; provider chỉ ký token, xác minh webhook, đọc room state.
Webhook controller gọi application contract của Session, không tự ghi bảng.

Hai phương án khác: tách `LiveKitModule` ngay từ đầu sẽ cần thêm contract/DI mà
chưa có consumer khác; tách service độc lập sẽ làm phức tạp transaction và vận
hành. Chỉ tách khi có nhu cầu tái sử dụng thực tế. Không tự viết JWT/WebRTC.

PostgreSQL là nguồn chính của Session. LiveKit là nguồn sự kiện kết nối, không
phải nguồn xác nhận hoàn thành. MongoDB, Credit arithmetic, Payment và UI nằm
ngoài thay đổi chính. Việc nối settlement chỉ sử dụng contract hiện hữu.

## 4. Data model và provider configuration

- Giữ `Session` hiện hữu. Room name mới: `skillhub-session-${sessionId}`; identity:
  `${sessionId}:${userId}`, dùng UUID, không chứa email/tên hoặc role label.
- Mapping chỉ được tạo sau membership/state/window checks; giữ mapping đã có.
  Nếu hai request đầu chạy đồng thời, cả hai nhận cùng một mapping. Không ghi
  token/API secret vào DB, metadata, audit, response khác hoặc log.
- Room có thể được LiveKit tạo khi participant đầu tiên vào. `providerRoomId`
  là SID một lần tồn tại của room; room name là mapping ổn định kể cả room được
  tạo lại. Không coi một SID cũ là định danh vĩnh viễn của Session.
- Ba env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Cả ba vắng:
  integration disabled; có một phần hoặc sai định dạng: startup fail với tên
  field, không in giá trị. Đủ ba: enabled. Không bắt người dùng thêm enable flag.
- Production yêu cầu URL `wss://`, không credentials/query/fragment; local dev
  có thể dùng `ws://localhost` hoặc loopback. SDK RoomService dùng HTTPS URL
  được chuyển từ WSS; không dùng endpoint tùy ý từ request client.
- Thêm một dependency `livekit-server-sdk` vào package `api` khi implement;
  phiên bản kiểm tra tương thích Node/TypeScript tại thời điểm cài và khóa bằng
  pnpm lockfile. Không cần client SDK trong backend.
- Chưa dự kiến schema migration: các field business và receipt đã có. Chỉ thêm
  migration nếu kiểm tra DB/query plan chứng minh thiếu constraint/index cần thiết;
  không sửa migration đã áp dụng hoặc tạo lại field từ ERD.

## 5. Join policy và lifecycle

Thêm config versioned `livekit.joinWindow = { earlyMinutes, lateMinutes }`, hai
số nguyên không âm an toàn và kết quả tính thời gian phải hữu hạn. **Không có
defaultValue, không seed giá trị khi thiếu.** Config do luồng update có audit
hiện hữu quản lý; bổ sung seed hỗ trợ key không có mặc định mà không đổi các
default đã chốt. Thiếu/invalid/future-effective policy: canJoin=false và token
endpoint trả 503 `LIVEKIT_POLICY_NOT_READY`; Session list/detail vẫn dùng được.

Quy tắc tính đề xuất: `opensAt = startAt - earlyMinutes`,
`closesAt = endAt + lateMinutes`, cửa sổ `[opensAt, closesAt)`. Mọi quyết định
dùng DB UTC ở transaction ghi; projection dùng Clock phía server, không dùng
clientNow. Các số 10/10 phút trong test chỉ là fixture.

| Transition đề xuất                              | Trigger và giới hạn                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| CONFIRMED → READY                               | Policy đã sẵn sàng, vào window, chưa endAt                                        |
| CONFIRMED/READY → ONGOING                       | Đã startAt, chưa endAt và có kết nối media của participant được provider xác minh |
| CONFIRMED/READY/ONGOING → AWAITING_CONFIRMATION | Đã endAt, kể cả không có webhook; không tự kết luận no-show                       |
| AWAITING_CONFIRMATION → COMPLETED               | Cả hai confirm hợp lệ sau endAt; actor chỉ ghi nhóm của mình                      |
| CANCELLED/DISPUTED                              | Chỉ flow nghiệp vụ hiện hữu; worker/webhook không tự tạo hay đảo ngược            |

Worker quét theo batch/cursor, technical interval đề xuất 30 giây, không chạy
chồng lấn và dừng sạch khi shutdown. Sweep khởi động khôi phục sau restart.
Read projection tính trạng thái theo thời gian để CTA không phụ thuộc độ trễ
worker; GET không ghi dữ liệu. Command luôn load lại và tính policy dưới lock.
Không đặt timer cố định cho từng Session vì reschedule có thể làm timer cũ sai.

Token validity đề xuất 120 giây, chặn bởi `closesAt` và không làm tròn vượt biên.
Grant chỉ đúng room, publish audio/video + subscribe; không roomAdmin/list/create.
User/identity/room không được lấy từ body. Ký token là thao tác local, nên token
thành công không chứng minh media server đang sẵn sàng.

**Các lựa chọn cần review trước thực thi:**

1. Giá trị early/late: người dùng yêu cầu giữ mở; khi deploy phải cấu hình rõ.
2. SES-002 viết CONFIRMED/READY nhưng reconnect cần ONGOING. Đề xuất cho ONGOING
   nhận token lại trong window; sau endAt, cho AWAITING_CONFIRMATION trong late
   grace nếu chưa COMPLETED/CANCELLED/DISPUTED. Chưa coi đây là rule đã được PO duyệt.
3. ONGOING đề xuất bắt đầu khi ít nhất một participant có media connection trong
   giờ học; xác nhận lại nếu nghiệp vụ yêu cầu phải có đủ hai người.
4. Cửa sổ đóng quyền **cấp token mới**; JWT expiry không tự ngắt kết nối và
   reconnect đang tồn tại. Việc cưỡng chế đóng phòng/ngắt participant khi hết
   giờ hoặc khi cancel/dispute cần policy riêng. Không tuyên bố TTL đã xử lý nó.
5. OP-02 completion timeout và OP-03 dispute window còn mở; không auto-confirm,
   không no-show penalty hoặc tự seed thời hạn. Nối settlement phải giữ nguyên
   guard đang có, không nâng giá trị hardcoded hiện tại thành chính sách được duyệt.

## 6. HTTP contract đề xuất

Giữ envelope `success(...)`, IdentityGuard, URI version `v1` và HTTP error
envelope hiện tại. Cấp quyền bằng permission tương ứng và membership; STAFF/ADMIN
không tự nhận token khi không thuộc Session.

| Endpoint                                              | Contract                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/sessions/mine`                           | Giữ array cho consumer hiện hữu; từ chối timestamp không có offset; giới hạn 100 được tài liệu hóa                                              |
| `GET /api/v1/sessions/:sessionId`                     | Explicit allowlist, UUID, membership; thêm role, join metadata, confirmation và progress                                                        |
| `POST /api/v1/sessions/:sessionId/livekit-token`      | Body rỗng; data `{serverUrl, participantToken, roomName, participantIdentity, expiresAt, joinOpensAt, joinClosesAt}`; `Cache-Control: no-store` |
| `POST /api/v1/sessions/:sessionId/confirm-completion` | Giữ note ≤1000; retry của cùng actor giữ nguyên note/timestamp lần đầu                                                                          |
| `POST /api/v1/livekit/webhook`                        | Provider auth bằng chữ ký, không IdentityGuard; raw payload, 204 sau xử lý thành công hoặc sự kiện không liên quan                              |

Join metadata: `{ canJoin, opensAt, closesAt, reason }`, reason có thể là
`LIVEKIT_DISABLED`, `LIVEKIT_POLICY_NOT_READY`, `SESSION_NOT_JOINABLE`,
`JOIN_WINDOW_NOT_OPEN`, `JOIN_WINDOW_CLOSED`, hoặc null khi được vào.
Missing policy dùng opensAt/closesAt=null. Không tự thêm token vào GET detail.

Token errors: 401 chưa đăng nhập, 403 thiếu permission/không phải participant,
404 Session không tồn tại, 409 state/window không hợp lệ, 503 disabled/config
chưa sẵn sàng. Error code của provider phải được chuẩn hóa, không trả raw error.

Progress tính từ Session của đúng locked Path/Plan: `{ completed, total }` cho
plan hiện tại và agreement. Hai plan TWO_WAY có số buổi khác nhau phải cộng
đúng toàn bộ agreement; không nhân đôi số buổi hoặc cộng draft/version cũ.
Giữ tên field hiện hữu `pathId`/`planId`; không rename thành learningPathId trong
JSON chỉ để giống tài liệu. Attendance BigInt trả string.

Pagination đầy đủ là follow-up riêng nếu cần; không âm thầm đổi array mine thành
object. SH-074 UI và việc cập nhật client không được đánh dấu hoàn thành bởi plan BE.

## 7. Webhook, recovery và attendance

`rawBody: true` đã có trong `src/main.ts`, nhưng vẫn cần parser nhận đúng
`application/webhook+json` và integration test chứng minh giữ nguyên bytes.
`WebhookReceiver.receive(rawBody, authorization)` phải xác minh trước mọi ghi.
Signature lỗi trả 401; body lỗi 400; lỗi persistence trả 5xx để provider retry.

Tái dùng `OutboxConsumer.processOnce('livekit.session-lifecycle', receiptId,
work)`: receipt id là UUID; Cloud thực tế gửi provider event id dạng `EV_…`.
Sau xác minh chữ ký, giữ UUID cũ và ánh xạ ID opaque có giới hạn thành UUIDv8
ổn định bằng SHA-256 có namespace. Receipt hiện có không FK tới OutboxEvent và receipt
commit cùng transaction Session. Không tạo inbox table mới chỉ để dedupe.
Tên service là lịch sử của foundation; không đổi tên toàn repo trong feature.
Event đã ký nhưng sai room/identity/time hoặc event type không dùng được ack
không đổi Session. Receipt không chứa raw token hoặc toàn payload.

Cloud clock có thể đi trước DB: sai lệch tối đa 5 giây được clamp về DB time cho
observation/window/state, không cho ONGOING trước startAt. Schedule fence vẫn dùng
provider timestamp gốc. Sai lệch lớn hơn khi observation còn eligible trả 503 và
rollback receipt để retry; đây là giới hạn kỹ thuật, không phải early/late policy.

Webhook chỉ cung cấp observation cho application contract của Session. Update
có điều kiện, giữ thứ tự khóa Path → Session như completion/reschedule. So sánh
schedule mới nhất, event.createdAt và room identity; delayed event không lùi
state, revive terminal state hoặc pin SID cũ đè lần room mới. Với SID mâu thuẫn,
reconcile bằng room API ngoài transaction rồi revalidate trước ghi.

Webhook không bảo đảm delivery. Worker có thể đọc active participants từ
RoomService ngoài transaction để phục hồi ONGOING cho người đã vào sớm hoặc
khi webhook bị mất; load lại state/schedule/time khi áp snapshot. Snapshot rỗng
không chứng minh user chưa từng học. Provider lỗi không đổi business state thành
CANCELLED/DISPUTED/COMPLETED.

**Attendance tổng giây không nằm trong bản triển khai đầu.** Có thể cập nhật
firstJoined/lastLeft bằng min/max từ event hợp lệ, nhưng không suy ra total bằng
lastLeft−firstJoined hoặc tăng thêm khi retry. Giữ hai counter hiện hữu và thêm
projection `attendanceStatus: 'UNAVAILABLE'` trong contract mới cho tới khi có
thiết kế reconciliation đầy đủ; 0 chưa phải bằng chứng không tham gia. Chưa đặt
retention/recording hay thu thập media. Nếu cần tổng giây chính xác, làm extension
riêng có interval/dedupe/reconcile và privacy policy; ERD sáu field không đủ tự
khôi phục mọi lần reconnect/chồng kết nối.

## 8. Completion và settlement

Sửa retry trước confirm thứ hai: nếu nhóm của actor đã CONFIRMED thì không ghi
đè timestamp/note. Sau endAt, hai request đồng thời vẫn được serialize bằng khóa
Path → Session; lần cuối chuyển COMPLETED và ghi progress/completion event một
lần. Attendance/room_finished không bao giờ tự confirm hoặc thay đổi Credit.

Khi tất cả Session hoàn thành, ghi outbox signal `learning-path.sessions-completed`
với pathId/version, dedupe key `path.sessions-completed:${pathId}:${lockedVersion}`.
Consumer completion gọi application contract settlement hiện
hữu, recheck toàn bộ Session, blocking dispute và deadline; event không tự sửa
ledger. Nếu guard còn chặn thì giữ chưa settle, worker quét lại điều kiện đủ
để khôi phục sau thời hạn/restart. Không gọi HTTP/provider trong transaction tài
chính. `settlePath` public hiện có được giữ, cùng dùng một application core.

Không set Path COMPLETED trước settlement nếu điều đó bypass guard hiện tại;
`ACTIVE` của runtime là trạng thái chờ settlement. Cần ghi rõ khác biệt với câu
chữ FR-SES-09 và chỉ hoàn thành SH-072 khi completion trigger/recovery được test.
Không đổi rate, dispute policy, reputation hay achievement trong feature này.

## 9. Tiêu chí chấp nhận và rollout

- Outsider và token giả/chưa đăng nhập không nhận được token; cùng Session có
  cùng room, khác participant có khác identity; không lộ secret/token trong log.
- Biên opensAt/closesAt, UTC, reschedule và command race được test bằng DB thật.
- Signed duplicate/out-of-order/missing webhook không làm sai lifecycle/completion.
- Completion retry giữ nguyên dữ liệu lần đầu; N/M đúng ONE_WAY/TWO_WAY;
  completion không release Credit từng buổi hoặc vượt dispute guard.
- App vẫn khởi động khi cả ba env vắng; thiếu policy chỉ chặn tính năng join.
- Cloud smoke dùng hai tài khoản đúng room qua LiveKit Meet; reconnect và lỗi
  media quan sát riêng. Webhook Cloud cần endpoint HTTPS có thể truy cập từ ngoài.
- SH-074 chỉ đủ backend contract, chưa đủ video UI; attendance total và các
  policy mở được ghi rõ trong validation, không đánh dấu đã triển khai.

Đã triển khai theo `plan.md`; evidence nằm trong `validation.md`. Không chạy
migration trên DB người dùng, gọi project LiveKit thật, commit hoặc push.
