# Session no-show: ghi nhận tham gia, xác định vắng và xử lý kết quả — thiết kế

**Ngày:** 2026-10-29. **Trạng thái:** Đã triển khai backend A+B+D; phần C (Credit) chưa làm. Kiểm chứng cuối: 2026-11-03.
**Phạm vi:** Backend `services/api`, module `learning-sessions`, `reports`,
`reputation`, `scheduling`, `notifications`, `system-configuration`. Không sửa
`apps/*`; mobile chỉ nhận contract mới.

## 1. Mục tiêu và nguồn yêu cầu

BE phải ghi nhận tham gia thực tế của người dạy/người học, tự xác định vắng,
không để Session chờ xác nhận vô thời hạn, chặn xác nhận hoàn thành khi có người
vắng, nối uy tín/report vào luồng Session và trả dữ liệu rõ cho mobile.

Nguồn: yêu cầu BE "xử lý người học/người dạy không tham gia live" (7 mục),
`../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` mục 18.19
(CMP-001..005), 18.20 (CAN-002..004), bảng Reputation (No-show −8), 18.37
(reasonCode `NO_SHOW_LATE`), 18.38; `specs/010-session-livekit/spec.md` §7–8.

### Phân rã

| Phần | Nội dung                                                                       | Trong spec này   |
| ---- | ------------------------------------------------------------------------------ | ---------------- |
| A    | Ghi nhận tham gia chính xác (mục 1)                                            | Có               |
| B    | Xác định vắng, kết quả Session, chặn confirm, timeout, API/thông báo (2,3,4,7) | Có               |
| D    | Báo vắng, vắng có lý do, uy tín, tranh chấp (6)                                | Có               |
| C    | Tỷ lệ giữ/hoàn/trừ Credit theo từng trường hợp vắng (5)                        | Không — spec sau |

Thứ tự triển khai A → B → D; C sau khi PO chốt tỷ lệ phạt/hoàn.

## 2. Hiện trạng đã kiểm tra trong source

| Hạng mục   | Bằng chứng                                                         | Đánh giá                                                                              |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Attendance | `learning-sessions.service.ts` `participantActivityData`, `detail` | Chỉ min firstJoined / max lastLeft; seconds luôn 0; `attendanceStatus: "UNAVAILABLE"` |
| Hết giờ    | `session.policy.ts` `sessionStatusAt`                              | Mọi buổi → `AWAITING_CONFIRMATION`, không hạn                                         |
| Confirm    | `LearningSessionsService.complete`                                 | Không kiểm tra tham gia                                                               |
| Credit     | `HeldCreditAllocation` unique (path,user); `settle()`              | Hold cấp lộ trình, settlement một lần khi mọi Session `COMPLETED`                     |
| Report     | `ReportsService.createSessionReport`, `disputeDeadline`            | Có report theo Session, chặn settlement, window 48h hard-code                         |
| Uy tín     | `ReputationService.applyNoShow`                                    | −8, idempotent `no-show:{session}:{user}`; chưa có caller                             |
| Đổi lịch   | `SchedulingService.proposeReschedule`                              | Chỉ cho `CONFIRMED`/`READY`, cutoff 60' so với startAt cũ                             |
| Worker     | `SessionLifecycleWorker.sweep` 30s                                 | Có `listActiveParticipants` khi trong giờ học                                         |

## 3. Quyết định đã chốt (2026-10-29)

| Quyết định                   | Giá trị                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Mức đi trễ                   | 10 phút sau `startAt` → cờ `late` (bằng chứng, không tự là vắng)                                                                    |
| Tham gia tối thiểu           | 80% thời lượng lịch, tính trong `[startAt, endAt]`; dưới mức = vắng                                                                 |
| Thời gian chờ dữ liệu        | 10 phút sau khi join window đóng                                                                                                    |
| Hạn xác nhận hoàn thành      | 24h kể từ khi kết luận attendance (`determinedAt`)                                                                                  |
| Dispute window               | 48h sau `endAt` (giữ giá trị cũ, chuyển sang config)                                                                                |
| Hạn chốt lịch học bù         | 7 ngày kể từ khi chuyển `MAKEUP_REQUIRED`                                                                                           |
| Timeout                      | Theo attendance (§6.2)                                                                                                              |
| Confirm khi có người vắng    | Chặn cứng; khiếu nại qua Report                                                                                                     |
| Người dạy vắng / cả hai vắng | Học bù trên cùng Session row; bên vắng −8                                                                                           |
| Người học vắng               | Buổi tính đã dùng (`COMPLETED`); người học −8                                                                                       |
| Thời điểm trừ uy tín         | Khi kết luận chốt (hết dispute window, hoặc Staff UPHOLD)                                                                           |
| Vắng có lý do                | Bên vắng gửi lý do; bên có mặt chấp nhận/từ chối trong dispute window; chấp nhận = không −8 + học bù; không áp dụng khi cả hai vắng |
| Học bù quá hạn               | Case hệ thống chặn settlement → Staff                                                                                               |
| Cách ghi attendance          | Interval theo participant SID + heartbeat từ worker                                                                                 |

## 4. Cấu hình

Thêm vào `configuration.catalog.ts`, `mutable: true`, có default:

```ts
"session.attendancePolicy": {
  lateGraceMinutes: 10,
  minAttendancePercent: 80,     // 1..100
  dataSettleMinutes: 10,
  confirmWindowHours: 24,
  disputeWindowHours: 48,       // confirmWindowHours < disputeWindowHours
  makeupWindowDays: 7,
}
```

`ReportsService.disputeDeadline` đọc `disputeWindowHours` thay cho hằng 48h.
Mọi outcome lưu snapshot policy đã dùng; đổi config không làm thay đổi kết luận cũ.

`Td` (thời điểm kết luận) = `endAt + livekit.joinWindow.lateMinutes + dataSettleMinutes`.
`livekit.joinWindow.lateMinutes` là cửa sổ vào phòng LiveKit, khác `lateGraceMinutes`.
Nếu LiveKit disabled hoặc thiếu `livekit.joinWindow` thì không ai lấy được token:
`Td = endAt + dataSettleMinutes` và cả hai verdict là `UNVERIFIABLE` (không phạt).
Nếu thiếu `session.attendancePolicy` thì không kết luận (giữ `PENDING_DATA`,
confirm trả `ATTENDANCE_PENDING`).

## 5. Mô hình dữ liệu

Migration chỉ thêm, không sửa lịch sử.

### 5.1 `session_attendance_intervals`

| Cột               | Kiểu                                         | Ghi chú                  |
| ----------------- | -------------------------------------------- | ------------------------ |
| `interval_id`     | uuid PK                                      |                          |
| `session_id`      | uuid FK sessions                             |                          |
| `user_id`         | uuid FK users                                |                          |
| `role`            | `TEACHER \| LEARNER`                         |                          |
| `room_sid`        | text                                         |                          |
| `participant_sid` | text                                         | unique cùng `session_id` |
| `joined_at`       | timestamptz                                  |                          |
| `left_at`         | timestamptz null                             |                          |
| `last_seen_at`    | timestamptz                                  |                          |
| `close_source`    | `WEBHOOK \| HEARTBEAT \| ROOM_FINISHED` null |                          |

Index `(session_id, user_id)`.

### 5.2 `session_attendance_outcomes`

Một row cho mỗi lần diễn ra (occurrence); học bù tạo row mới.

| Cột                                                      | Ghi chú                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `outcome_id` uuid PK                                     |                                                                                                                            |
| `session_id`, `occurrence_start_at`, `occurrence_end_at` | unique `(session_id, occurrence_start_at)`                                                                                 |
| `teacher_verdict`, `learner_verdict`                     | `PRESENT \| ABSENT \| UNVERIFIABLE`                                                                                        |
| `teacher_late`, `learner_late`                           | boolean                                                                                                                    |
| `teacher_seconds`, `learner_seconds`                     | bigint                                                                                                                     |
| `teacher_first_joined_at`, `learner_first_joined_at`     | null được                                                                                                                  |
| `attendance_case`                                        | `BOTH_PRESENT \| TEACHER_ABSENT \| LEARNER_ABSENT \| BOTH_ABSENT \| UNVERIFIABLE`                                          |
| `status`                                                 | `PROVISIONAL \| FINAL \| EXCUSED \| DISPUTED \| OVERTURNED`                                                                |
| `resolution` null                                        | `COMPLETED_MUTUAL \| COMPLETED_TIMEOUT \| COMPLETED_LEARNER_NO_SHOW \| COMPLETED_STAFF \| MAKEUP_REQUIRED \| STAFF_REVIEW` |
| `determined_at`, `finalizes_at`, `finalized_at`          | `finalizes_at = occurrence_end_at + disputeWindowHours`                                                                    |
| `evidence` jsonb                                         | interval snapshot, token issued, observation health, policy snapshot                                                       |

Index `(status, finalizes_at)`.

### 5.3 `session_absence_excuses`

`excuse_id`, `outcome_id` (unique — tối đa một excuse/outcome), `absent_user_id`,
`reason` varchar(1000), `status` `PENDING | ACCEPTED | REJECTED | EXPIRED`,
`decided_by_user_id`, `decided_at`, `decision_note` varchar(1000), `created_at`.

### 5.4 Thêm vào `sessions`

`teacher_token_issued_at`, `learner_token_issued_at` (lần cấp đầu của occurrence
hiện tại), `last_observed_at`, `observation_failed_at`, `confirm_deadline_at`,
`makeup_deadline_at`. Index `(status, confirm_deadline_at)`,
`(status, makeup_deadline_at)`.

`enum SessionStatus` thêm `NO_SHOW`, `MAKEUP_REQUIRED`.

Hai counter `*AttendanceSeconds` và `first/lastJoined/Left` giữ nguyên, được
cập nhật làm projection.

## 6. Luồng trạng thái

```
endAt ──► AWAITING_CONFIRMATION (attendance PENDING_DATA; confirm bị chặn)
Td    ──► tạo outcome:
          BOTH_PRESENT / UNVERIFIABLE → AWAITING_CONFIRMATION, confirm_deadline_at = determinedAt + 24h
          có ABSENT                   → NO_SHOW (PROVISIONAL), excuse/report mở tới finalizes_at
A+B confirm (trước hạn)               → COMPLETED (COMPLETED_MUTUAL)
confirm_deadline_at:
          BOTH_PRESENT                → COMPLETED (COMPLETED_TIMEOUT)
          UNVERIFIABLE, ≥1 bên confirm → COMPLETED (COMPLETED_TIMEOUT)
          UNVERIFIABLE, 0 bên confirm  → DISPUTED + case ATTENDANCE_UNVERIFIABLE (STAFF_REVIEW)
NO_SHOW, excuse ACCEPTED              → MAKEUP_REQUIRED, outcome EXCUSED, không −8
NO_SHOW, report mở                    → outcome DISPUTED, dừng chốt, chờ Staff
NO_SHOW, finalizes_at, không report mở:
          LEARNER_ABSENT              → COMPLETED (COMPLETED_LEARNER_NO_SHOW), learner −8
          TEACHER_ABSENT / BOTH_ABSENT → MAKEUP_REQUIRED, bên vắng −8, makeup_deadline_at = now + 7d
MAKEUP_REQUIRED ── reschedule A+B ──► CONFIRMED (occurrence mới)
                └─ makeup_deadline_at ─► DISPUTED + case MAKEUP_EXPIRED (STAFF_REVIEW)
```

Settlement không đổi: `settle()` yêu cầu mọi Session `COMPLETED`, nên
`NO_SHOW`/`MAKEUP_REQUIRED`/`DISPUTED` tự chặn lộ trình; không có Credit theo
buổi nên không thể hoàn/trừ hai lần. `refreshPathStatus` được gọi ở mọi nhánh
chuyển sang `COMPLETED`.

`sessionStatusAt`/`sessionJoinAccess`: `NO_SHOW`, `MAKEUP_REQUIRED` không joinable
và không bị chuyển tự động theo giờ. Webhook/heartbeat bỏ qua hai trạng thái này.

## 7. Phần A — ghi nhận tham gia

### 7.1 Webhook

Trong `processOnce` hiện có, giữ khóa Path → Session, schedule fence, room SID,
identity, clamp ±5s:

- `participant_joined`: upsert interval theo `(session_id, participant.sid)`;
  `joined_at = min(cũ, occurredAt)`, `last_seen_at = max(...)`.
- `participant_left`: đóng interval, `left_at = max(joined_at, occurredAt)`,
  `close_source = WEBHOOK`. Nếu chưa có interval (left tới trước joined), tạo
  interval `joined_at = left_at = occurredAt`; không tăng giờ.
- `room_finished`: đóng mọi interval mở của room tại `occurredAt`.
- Trùng/retry: receipt dedupe + unique key; mọi update là min/max nên áp lại vô hại.

### 7.2 Heartbeat

Worker (30s) khi `listActiveParticipants` thành công, trong một transaction có khóa:
`last_observed_at = now`; identity đang có interval mở → `last_seen_at = now`;
identity active nhưng chưa có interval mở → tạo interval (`participant_sid` lấy từ
API, `joined_at = now`). Interval mở không thấy quá 90s → đóng tại `last_seen_at`,
`HEARTBEAT`. Gọi lỗi → `observation_failed_at = now`.

`listActiveParticipants` cần trả thêm participant SID (sửa `LiveKitService`).

### 7.3 Token

`issueLiveKitToken` ghi `*_token_issued_at` lần đầu cho occurrence hiện tại.
Reschedule/học bù reset hai cột này.

### 7.4 Tính giây (hàm thuần `domain/attendance.policy.ts`)

Interval mở tính tới `min(last_seen_at, occurrence_end)`. Union các interval của
từng người, cắt trong `[startAt, endAt]`, cộng giây. Kết quả ghi vào counter
`*AttendanceSeconds`.

## 8. Phần B — kết luận, confirm, timeout

### 8.1 Kết luận từng bên tại Td

Observation "không ổn" khi: LiveKit disabled trong window, hoặc
`observation_failed_at ∈ [startAt, endAt]`, hoặc không có `last_observed_at ≥ startAt`
trong khi room đã có token.

| Điều kiện                                     | Verdict                                         |
| --------------------------------------------- | ----------------------------------------------- |
| Chưa từng được cấp token cho occurrence       | `ABSENT` (chắc chắn)                            |
| seconds ≥ 80% thời lượng                      | `PRESENT`, `late` nếu firstJoin > startAt + 10' |
| 0 < seconds < 80%, observation ổn             | `ABSENT`                                        |
| seconds = 0, có token, observation ổn         | `ABSENT`                                        |
| seconds < 80%, có token, observation không ổn | `UNVERIFIABLE`                                  |

`case`: cả hai `PRESENT` → `BOTH_PRESENT`; có `ABSENT` → theo bên vắng (`UNVERIFIABLE`
bên kia không cứu bên vắng chắc chắn); còn lại → `UNVERIFIABLE`.

Kết luận chạy ở hai nơi bằng cùng một hàm `ensureDetermined(tx, session, now)`:
lazy trong `complete()`/`detail()` khi `Td ≤ now`, và worker bước
`determineDueSessions` cho Session `AWAITING_CONFIRMATION` có `Td ≤ now`
chưa có outcome cho occurrence hiện tại. Mỗi Session một transaction, khóa
Path → Session, revalidate trạng thái/lịch; insert outcome idempotent.

### 8.2 `complete()`

- Chưa có outcome → `409 ATTENDANCE_PENDING`.
- `NO_SHOW` hoặc outcome có `ABSENT` → `409 SESSION_ATTENDANCE_NOT_MET`.
- `now ≥ confirm_deadline_at` → `409 CONFIRM_WINDOW_CLOSED`.
- Còn lại như hiện tại; hoàn tất ghi `resolution = COMPLETED_MUTUAL`.

### 8.3 Worker `finalizeDueSessions`

Theo index deadline; mỗi Session một transaction có khóa và revalidate:
timeout (§6), chốt `NO_SHOW` (bỏ qua nếu có report đang mở hoặc excuse
`ACCEPTED`; excuse `PENDING` → `EXPIRED`), học bù quá hạn. Case hệ thống tạo
qua method mới `ReportsService.openSystemSessionCase` (bỏ qua dispute window,
`blocksSettlement = path.settledAt === null`, `targetType = SESSION`).
Không có user hệ thống trong DB, nên `report_cases.reporter_id` được nới thành
nullable: `null` = case hệ thống (audit actor `{ kind: "SYSTEM" }`).
`listMine`/notification bỏ qua reporter null; unique chống trùng bằng
`reasonCode` + `relatedSessionId` + case đang mở.

## 9. Phần D — vắng có lý do, report, uy tín, học bù

### 9.1 Vắng có lý do

- `POST /v1/sessions/:id/absence-excuse` `{ reason }`: actor là bên `ABSENT`,
  Session `NO_SHOW`, `now < finalizes_at`, case khác `BOTH_ABSENT`, chưa có excuse.
- `POST /v1/sessions/:id/absence-excuse/decision` `{ accept, note? }`: actor là
  bên có mặt, excuse `PENDING`, `now < finalizes_at`.
  Chấp nhận → excuse `ACCEPTED`, outcome `EXCUSED` + `resolution = MAKEUP_REQUIRED`,
  Session `MAKEUP_REQUIRED`, `makeup_deadline_at = now + 7d`, không gọi `applyNoShow`.
  Từ chối → `REJECTED`; bên vắng vẫn có thể report trong window.

### 9.2 Report

- `createSessionReport` validate `reasonCode` theo danh mục SRS 18.37.
- Session `NO_SHOW`: report mở → outcome `DISPUTED`; case lưu
  `relatedSessionId` và evidence snapshot outcome (Staff đọc từ outcome, không cần upload).
- Chuyển trạng thái dùng chung được viết thành hàm thuần trong
  `learning-sessions/application/services/session-transitions.ts` (nhận `tx`
  và `ReputationService`), để `ReportsService` gọi trực tiếp mà không tạo vòng
  DI giữa module.
- `ReportCaseActionDto` thêm `noShowRuling?: UPHOLD | COMPLETE | EXCUSE` khi
  resolve case gắn Session có outcome `DISPUTED`:
  - `UPHOLD` (chỉ outcome có vắng): chốt như §6 (kể cả `applyNoShow`).
  - `COMPLETE`: outcome có vắng → `OVERTURNED`; Session → `COMPLETED`
    (`resolution = COMPLETED_STAFF`). Dùng được cho case hệ thống.
  - `EXCUSE`: như excuse được chấp nhận (học bù, không −8; với `MAKEUP_EXPIRED`
    là gia hạn học bù thêm `makeupWindowDays`).
  - Case đang giữ Session ở `DISPUTED` (case hệ thống) bắt buộc resolve có ruling;
    reject trả `409 NO_SHOW_RULING_REQUIRED`.
  - Case NO_SHOW bị reject/resolve không ruling → outcome về `PROVISIONAL` (nếu
    không còn case mở khác trên Session); quá `finalizes_at` thì worker chốt.
- Report đang mở vẫn giữ Credit theo cơ chế `blocksSettlement` hiện có.

### 9.3 Uy tín

`applyNoShow` chỉ được gọi ở worker chốt `NO_SHOW` và Staff `UPHOLD`.
`eventKey` đổi thành `no-show:{outcomeId}:{userId}` để học bù vắng lần nữa vẫn
bị trừ, mỗi occurrence đúng một lần.

### 9.4 Học bù

`proposeReschedule`/`confirmProposal` chấp nhận nguồn `MAKEUP_REQUIRED`: bỏ cutoff
so với `startAt` cũ; lịch mới vẫn phải hợp lệ thời lượng, ở tương lai, không trùng.
Áp lịch: Session → `CONFIRMED`, reset confirmation, token-issued, observation,
deadline; `makeup_deadline_at = null`.

## 10. Contract cho mobile

`GET /v1/sessions/:id` thay `attendanceStatus: "UNAVAILABLE"` bằng:

```jsonc
"attendance": {
  "state": "PENDING_DATA | DETERMINED | UNVERIFIABLE",
  "case": "... | null",
  "teacher": { "verdict": "PRESENT | ABSENT | UNVERIFIABLE | null", "late": false, "seconds": "3420", "firstJoinedAt": "..." },
  "learner": { "verdict": "...", "late": false, "seconds": "0", "firstJoinedAt": null },
  "absentUserIds": [],
  "outcomeStatus": "PROVISIONAL | FINAL | EXCUSED | DISPUTED | OVERTURNED | null",
  "resolution": "... | null",
  "determinedAt": "... | null"
},
"deadlines": { "confirmBy": null, "excuseOrReportBy": null, "makeupBy": null },
"excuse": { "status": "PENDING", "reason": "...", "absentUserId": "..." } /* hoặc null */,
"allowedActions": ["JOIN", "CONFIRM_COMPLETION", "SUBMIT_EXCUSE", "DECIDE_EXCUSE", "REPORT_NO_SHOW", "PROPOSE_MAKEUP"]
```

`GET /v1/sessions/mine` thêm `attendance.state`, `allowedActions`. BigInt trả string.
`allowedActions` tính ở BE từ role, trạng thái, deadline; mobile không tự suy rule.
Bỏ `attendanceStatus` là breaking change nhỏ của contract SH-074 — ghi trong PR.

## 11. Thông báo

Outbox event, dedupe theo occurrence/outcome; đăng ký trong handler mới
`notifications/infrastructure/events/session-notification.handler.ts`:

| Event                              | dedupeKey                                     | Người nhận                  |
| ---------------------------------- | --------------------------------------------- | --------------------------- |
| `session.attendance.determined`    | `attendance-determined:{outcomeId}`           | Hai bên (nội dung theo vai) |
| `session.absence-excuse.submitted` | `excuse-submitted:{excuseId}`                 | Bên có mặt                  |
| `session.absence-excuse.decided`   | `excuse-decided:{excuseId}`                   | Bên vắng                    |
| `session.no-show.finalized`        | `no-show-finalized:{outcomeId}`               | Hai bên                     |
| `session.completed.timeout`        | `completed-timeout:{outcomeId}`               | Hai bên                     |
| `session.makeup.expired`           | `makeup-expired:{sessionId}:{makeupDeadline}` | Hai bên                     |

`BOTH_PRESENT` chỉ gửi `determined` khi cần nhắc confirm; không gửi trùng khi
worker chạy lại vì dedupe key cố định.

## 12. Lỗi và bền vững

- LiveKit lỗi chỉ dẫn tới `UNVERIFIABLE`, không bao giờ `ABSENT`.
- Worker: mỗi Session một transaction; insert outcome và reputation event đều
  idempotent; khóa Path → Session + revalidate chống hai worker/ webhook đồng thời.
- Thiếu `session.attendancePolicy` → không kết luận, giữ `PENDING_DATA`; thiếu `livekit.joinWindow` → `UNVERIFIABLE` theo §4.
- Session đã bắt đầu trước migration (`CONFIRMED/READY/ONGOING/AWAITING_CONFIRMATION`,
  `start_at <= now()` hoặc đã có `room_name` do cấp token sớm): migration backfill `observation_failed_at = start_at` và
  hai `*_token_issued_at = start_at`, nên kết luận ra `UNVERIFIABLE` (không phạt);
  hạn xác nhận tính từ lúc kết luận nên người dùng vẫn có đủ 24h.

## 13. Kiểm thử

- Unit `attendance.policy.ts`: union/clip, reconnect, hai thiết bị chồng, interval
  mở, biên 80% và 10', ma trận verdict/case.
- Integration (DB thật như suite hiện có):
  webhook trùng/sai thứ tự/reconnect; mất `left` → heartbeat đóng; token chưa cấp
  → `ABSENT`; observation lỗi → `UNVERIFIABLE`; chặn confirm 3 mã lỗi; timeout →
  `COMPLETED`; learner vắng → `COMPLETED_LEARNER_NO_SHOW` + −8 một lần; teacher
  vắng → `MAKEUP_REQUIRED`; excuse chấp nhận → không −8; report → dừng chốt,
  UPHOLD/COMPLETE/EXCUSE; học bù → occurrence mới → vắng lần 2 bị −8 lần nữa;
  học bù quá hạn → case hệ thống; settlement vẫn đúng một lần sau học bù.
- Notification dedupe khi worker chạy hai lần.

## 14. Ngoài phạm vi và câu hỏi mở

- **Phần C:** tỷ lệ giữ/hoàn/trừ Credit theo trường hợp vắng
  (`NO_SHOW_PENALTY_RATE`), tự động huỷ/hoàn khi học bù quá hạn. Trong lúc chờ,
  Staff dùng `creditAdjustments` khi resolve case.
- `FREE_CANCEL_BEFORE_HOURS`, `LATE_CANCEL_PENALTY_RATE` (huỷ chủ động) không thuộc spec này.
- Không recording/egress, không thu media; interval chỉ chứa thời điểm kết nối.
- Retention của interval/evidence theo chính sách dữ liệu chung (SRS 18.38 còn mở).

## Amendment 2026-11-05

The accepted [Session policy amendment](../013-learning-cancellation/session-policy-amendment.md)
adds a personal makeup quota shared across both directions in one agreement and
one grant per original Session. Charge the requester/absent user, not the partner.
A second missed makeup still receives the existing no-show reputation decision,
but cannot automatically grant another makeup: it opens a blocking Staff case.
Extending the booking deadline of the same granted occurrence remains possible.
Explicit bilateral financial consent can bypass the final settlement wait without
bypassing a blocking report. The historical baseline above must be read with this amendment.
