# Tasks: Session và đổi lịch mobile

**Branch**: `feat/mobile-session` | **Created**: 2026-10-14

**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [HTTP](contracts/http.md), [UI](contracts/ui.md), [quickstart](quickstart.md).

Mọi đường dẫn task dưới đây tính từ `apps/mobile`. Giữ scope bốn luồng; không sửa backend, thêm dependency, làm LiveKit hoặc settlement. T001–T015 và T018 đã hoàn thành theo evidence trong validation.md; T016/T017/T019/T020 còn mở. Checkbox triển khai không thay nghiệm thu API/native.

`[P]` là khả năng song song khi prerequisite đã đạt, không phải yêu cầu chạy nhiều agent. `CHỜ BE` trong mô tả là gate backend, không task triển khai backend. Tests dùng runner hiện có theo plan/constitution; viết ca hành vi trước phần implement tương ứng, xác nhận fail vì hành vi còn thiếu, rồi chạy lại khi hoàn thành. Không thêm test chỉ kiểm tra cấu trúc giống implementation.

## Phase 1: Setup

- [x] T001 Ghi baseline source/branch, prerequisites môi trường và các GAP-01..04 từ `specs/006-session/contracts.md` vào `specs/006-session/validation.md`; tách trạng thái fixture/API/web/Android/iOS, chưa có evidence thì để Pending. Kiểm tra khả năng smoke GET detail sớm cho rủi ro BigInt, không lấy việc ghi dependency làm chứng minh runtime pass.

## Phase 2: Foundational

- [x] T002 Tạo projection/schema trong `src/features/sessions/types.ts` và GET adapter trong `src/features/sessions/api/sessions-api.ts` bằng shared client: IDs “UUID, user thuộc teacher/learner; detail id khớp route”; timestamps “có offset/Z, parse được, endAt > startAt”; status CONFIRMED/READY/ONGOING/AWAITING_CONFIRMATION/COMPLETED/CANCELLED/DISPUTED; confirmation “string/null”, CONFIRMED là xác nhận, null chưa ghi nhận, unknown không đủ điều kiện mutation. Allowlist fields, role đúng participant, không raw room/attendance data hoặc fallback mock.
- [x] T003 Thêm `src/features/sessions/runtime.tsx`, export qua `src/features/sessions/index.ts`, gắn SessionsProvider dưới Auth/SessionGate trong `src/providers/AppProviders.tsx`; prefix `['sessions', userId, generation]`, dùng runtime.client/QueryProvider, cancel/remove cache khi đổi phiên, loại kết quả cũ. Không sửa HTTP/Auth chung hoặc đổi contract preview providers.
- [x] T004 Tách `src/features/sessions/screens.tsx` thành barrel và các file màn trong `src/features/sessions/screens/`, giữ public exports/routes và RoomScreen mẫu trong `src/features/sessions/screens/preview-room-screen.tsx`; chỉ tách theo trách nhiệm/file-size, không restructure app. Giữ contract preview providers/RoomScreen khi tách; các liên kết gallery Session dùng ID mẫu sẽ được vô hiệu hóa ở T010, không duy trì bộ màn Session preview riêng.

**Checkpoint**: Shared đọc dữ liệu/auth boundary và exports sẵn sàng. Không buộc phải giải quyết backend gaps để bắt đầu mobile implementation.

## Phase 3: US1 — Xem lịch (P1)

**Goal**: Calendar đọc buổi tài khoản thật theo tháng/ngày.

**Independent Test**: Tài khoản có/không có buổi, lỗi tải lịch và hai timezone; không cần completion hoặc đổi lịch.

- [x] T005 [P] [US1] Viết `tests/sessions-list.test.ts` với transport fixtures: participant/role sai bị loại, loading khác empty, lỗi không fallback, tháng/ngày qua nửa đêm ở UTC và Asia/Ho_Chi_Minh, mảng 100 buổi không suy total. Xác nhận ca thời gian/query thất bại trước T006.
- [x] T006 [US1] Tạo `src/features/sessions/utils/session-time.ts` và list query trong `src/features/sessions/hooks/use-sessions.ts`: khoảng từ đầu tháng/ngày địa phương tới đầu khoảng sau trừ 1ms, gửi ISO UTC; key thêm from/to/timezone, lọc theo ngày startAt. Sắp tới/lịch sử là nhóm trình bày theo endAt/status, không tự đổi state; focus/resume refetch reads, cleanup listeners, không polling.
- [x] T007 [US1] Nối `src/features/calendar/screens/CalendarScreen.tsx` và `src/features/sessions/screens/session-list-screen.tsx` vào list query, giữ MonthCalendar/theme/card. Có loading/empty/error/retry, stale warning, role/status/thời gian; nhận 100 rows cảnh báo có thể thiếu và cho thu hẹp tới ngày. List theo Path chỉ lọc records đọc được, không công bố toàn bộ lịch sử hoặc enrich profile theo từng card. Chạy lại T005.

**Checkpoint**: US1 hoàn thành phần danh sách; MVP Lịch học → Chi tiết chỉ đạt sau T007 và T010. Giới hạn GAP-04 phải nhìn thấy khi cap 100, không phải đã sửa backend pagination.

## Phase 4: US2 — Xem chi tiết (P1)

**Goal**: Participant đọc detail thật, không lộ dữ liệu hoặc mở nhầm preview.

**Independent Test**: Direct link Session hợp lệ, UUID sai, 403/404 sau cache success, profile phụ lỗi; không phụ thuộc US1 UI.

- [x] T008 [P] [US2] Viết `tests/sessions-detail.test.ts` cho id/participant mismatch, bỏ fields ngoài scope, unknown confirmation, 403/404 ẩn cache, đổi generation loại kết quả cũ và lỗi profile không chặn Session. Ghi kết quả HTTP smoke detail trong `specs/006-session/validation.md`; nếu chưa có môi trường hoặc detail JSON lỗi thì GAP-03 còn mở, không chặn viết mobile/fixture.
- [x] T009 [US2] Bổ sung detail query vào `src/features/sessions/hooks/use-sessions.ts`, public export `createPublicProfileApi` trong `src/features/profile/index.ts` và hook `src/features/sessions/hooks/use-session-partner.ts`; detail id/participant phải hợp lệ trước lấy partner profile. Cache theo account/generation, 403/404 xóa/ẩn dữ liệu, refresh lỗi giữ cache cùng account với cảnh báo và khóa mutation tới read thành công; profile lỗi hiển thị thiếu thông tin.
- [x] T010 [US2] Nối `src/features/sessions/screens/session-detail-screen.tsx` và legacy `src/app/session/[id].tsx`: giờ/timezone/duration/role/status/xác nhận hai bên, tên partner nếu có, thiếu tên plan ghi rõ. Back theo history, direct link về calendar; UUID thật không đi Room/Report/Path preview, ID mẫu không fallback. Vô hiệu hóa các liên kết Session dùng ID mẫu trong `src/features/ui-preview/screens.tsx`, kèm nhãn “Chưa khả dụng”; không tạo bộ màn preview riêng hoặc thay RoomScreen. Chạy lại T008 và giữ routes `/learning-sessions/[id]` mỏng.

**Checkpoint**: T001–T010 tạo MVP Lịch học → Chi tiết thật. Mobile/fixture có thể hoàn thành; nghiệm thu API US2 cần smoke detail JSON pass, không tự sửa serializer backend.

## Phase 5: US3 — Xác nhận hoàn thành (P2)

**Goal**: Ghi nhận phần của mình, chờ/đủ hai xác nhận theo server.

**Independent Test**: Hai participant của buổi đã endAt, thử trước endAt/dispute/cancel và gửi lặp; không cần US4.

- [x] T011 [P] [US3] Viết `tests/sessions-completion.test.ts` với HTTP/query fixtures: một confirm không làm COMPLETED, đủ hai lấy trạng thái server, double tap chỉ một POST, 401 không replay, timeout phải reconcile, success receipt + refetch lỗi không resend, đổi account không nhận kết quả cũ. Không gọi settlement hoặc local Path save.
- [x] T012 [US3] Nối complete trong `src/features/sessions/api/sessions-api.ts` và `src/features/sessions/hooks/use-session-action.ts`: body `{}` hoặc note “≤1000”, participant/detail preflight, endAt và trạng thái hợp lệ theo server; không chỉ chờ AWAITING_CONFIRMATION. Ref khóa gửi + pending, retry false/replayAfterRenewal false; giữ receipt id/status, refetch detail/list, timeout/5xx read reconcile trước retry, 409 hiển thị nghiệp vụ, không optimistic COMPLETED hoặc Idempotency-Key chưa được hỗ trợ.
- [x] T013 [US3] Sau T010 và T012, nối action/modal ngay tại `src/features/sessions/screens/session-detail-screen.tsx` (trang xác nhận riêng đã bỏ theo yêu cầu UI): đã xác nhận/chờ đối tác/kết quả server, pending/disabled/error/retry đúng, không settlement hoặc tự coi Path hoàn thành. Chạy lại T011.

**Checkpoint**: US3 fixture riêng nghiệm thu được; API hai account cần GAP-03 detail pass và buổi backend hợp lệ.

## Phase 6: US4 — Đổi lịch (P2)

**Goal**: Chuẩn bị UI ngay; chỉ nối propose/confirm khi có read contract và version thật.

**Independent Test**: Trước gate, màn unavailable không gửi POST. Sau gate, hai account reload thấy cùng proposal/version, xác nhận đúng cutoff và chỉ áp dụng lịch server chấp nhận.

- [x] T014 [P] [US4] Viết `tests/sessions-reschedule-availability.test.ts`: thiếu read contract/version thì không POST; form giữ input, durationMinutes “60–180”, start tương lai/giờ địa phương hợp lệ, không tự tăng version/confirm người gửi. Dùng fixtures tường minh, không invent DTO/endpoint đọc backend.
- [x] T015 [US4] Sau T010 và T014, chuẩn bị `src/features/sessions/screens/reschedule-screen.tsx` và entry ở `src/features/sessions/screens/session-detail-screen.tsx` bằng ControlledInput/RHF + `src/utils/local-date-time.ts`: bỏ reason bắt buộc, giữ UI lịch cũ/ngày giờ/duration, chuyển UTC với endAt = startAt + duration. Khi GAP-01 mở, thông báo chưa khả dụng, khóa gửi/xác nhận; không sửa DataForm chung hoặc nâng package. Chạy lại T014.
- [ ] T016 [US4] CHỜ BE — Chỉ cập nhật `specs/006-session/contracts.md` và `specs/006-session/contracts/http.md` khi owner backend cung cấp read contract participant-only cho scheduleProposalId/currentVersion/appliedVersion/items/xác nhận/lịch hiệu lực sau reload và evidence kiểm tra conflict tại confirm cuối. Thiếu một điều kiện thì task giữ mở; không tạo/sửa endpoint backend hoặc mặc định version = 1.
- [ ] T017 [US4] CHỜ T016, sau T013 và T015 — Dùng DTO/endpoint đọc đã xác minh để viết ca dual-confirm/reload/stale/cutoff/uncertain trong `tests/sessions-reschedule.test.ts` trước khi nối read/propose/confirm ở `src/features/sessions/types.ts`, `src/features/sessions/api/sessions-api.ts`, `src/features/sessions/hooks/use-sessions.ts`, `src/features/sessions/hooks/use-session-action.ts` và hai màn detail/reschedule. Hiển thị lịch cũ/đề xuất riêng, confirm đúng version, tác giả không tự confirm; đủ hai bên trước startAt cũ ít nhất 60 phút và server apply mới đổi giờ hiển thị; stale/conflict/error đọc lại, không replay. Chạy lại tests sau implement; không quyết định conflict bằng list local.

**Checkpoint**: T014/T015 làm được ngay; T016/T017 chờ GAP-01 và GAP-02. UI unavailable không được tính là hoàn thành US4.

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T018 Chạy các tests Session liên quan và mobile lint/check-types/check-structure/npm test, kiểm fixture web ở các màn đã nối; kiểm accessibility labels, disabled, Back, lỗi/refetch và preview consumers sau split. Ghi revision/commands/results trong `specs/006-session/validation.md`, cập nhật `specs/006-session/quickstart.md` với suite names thực; không tick nghiệm thu US4 còn gated.
- [ ] T019 Nghiệm thu US1–US3 bằng API thật hai account và Android/iOS theo `specs/006-session/quickstart.md`, ghi riêng trong `specs/006-session/validation.md`: timezone, cache denial/account switch, completion/recovery, keyboard/font scale/hardware Back/resume. Nếu GAP-03 chưa pass hoặc thiếu môi trường/device thì để phần nghiệm thu và task mở, không lấy web/fixture thay thế.
- [ ] T020 CHỜ T016/T017 — Nghiệm thu US4 với hai account reload, đúng/dưới 60 phút, thiếu confirm, stale version và conflict phát sinh trước confirm cuối; chạy regression sau thay đổi rồi ghi API/web/Android/iOS evidence vào `specs/006-session/validation.md`. Không tick khi dependency hoặc runtime/device evidence còn thiếu.

## Dependencies & Execution Order

```text
T001 → T002 → T003 → T004
T004 → T005 → T006 → T007
T004 → T008; T006 + T008 → T009 → T010
T007 + T010 → MVP: Lịch học → Chi tiết
T004 → T011; T010 + T011 → T012 → T013
T004 → T014; T010 + T014 → T015
T001 → T016 [BE gate]; T013 + T015 + T016 → T017
US1–US3 + UI unavailable US4 → T018 → T019
T016 + T017 + checks pass → T020
```

US2 thử bằng direct link nên không bắt buộc US1 UI; T009 chỉ cần hooks nền từ T006 và tests T008, không cần T007. T013/T015 đều cần T010; khi triển khai cả hai, sửa detail screen tuần tự theo US3 rồi US4 để tránh ghi đè. T016 có thể thu nhận contract/evidence sau baseline, không phải đợi UI; T017 luôn cần T013, T015 và T016 để tái sử dụng action hook đã có. T001 kiểm tra smoke sớm nhưng không làm GAP-03 thành global blocker cho US1/fixture.

## Parallel Opportunities

- **US1**: T005 (tests) có thể song song T008 (tests detail) sau foundation; T006 chỉ bắt đầu khi đã có ca fail của T005.
- **US2**: T008 có thể song song T014 (tests availability) vì khác files; T009/T010 tuần tự, không song song sửa hooks/detail screen chung.
- **US3**: T011 có thể chuẩn bị cùng T014 sau foundation; T012/T013 đợi detail contract và test cases, không chạy đồng thời T017 trên shared adapter/action hook.
- **US4**: T014 làm trước backend gate; T016 thu nhận contract/evidence có thể tiến hành khi các task mobile khác đang chạy. T017 cần T013, T015 và T016, không dùng parallel để vượt gate.

## Implementation Strategy

MVP: T001–T010 để có Lịch học → Chi tiết thật; không coi danh sách có liên kết sang màn chưa nối API là MVP hoàn chỉnh. Sau đó US3, hoàn tất phần mobile và ghi riêng fixture/API/native. Chuẩn bị T014/T015 để thể hiện giới hạn đổi lịch; tiếp tục các task không phụ thuộc backend khi T016 chưa mở khóa. Không commit/push, sửa backend hoặc thêm luồng ngoài spec để đóng checkbox.

**Coverage**: FR-001: US1; FR-002/003: US1/US2; FR-004/005: US3; FR-006/007/008: US4; FR-009/010/011: foundation + stories + T018/T019/T020; FR-012: US1/US2 + kiểm native.

**Tổng**: 20 tasks; US1 3, US2 3, US3 3, US4 4; setup/foundation 4, verification chung 3. T016/T017/T020 chờ dependency đổi lịch; T019 có gate runtime/device riêng. Không có task backend implementation.
