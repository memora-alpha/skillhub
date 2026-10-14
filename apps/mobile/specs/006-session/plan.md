# Implementation Plan: Session và đổi lịch mobile

**Branch**: `feat/mobile-session` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Spec 006 và [checkpoint source](contracts.md). Thiết kế ban đầu ngày 2026-10-14; implementation checkpoint hiện tại ở [tasks](tasks.md) và [validation](validation.md).

## Summary

Nối dữ liệu thật vào Lịch học và các màn Session đang có. Làm danh sách → chi tiết → xác nhận hoàn thành trước. Đổi lịch vẫn trong scope nhưng chỉ mở thao tác thật sau khi đọc được proposal/version từ backend và xác minh conflict ở xác nhận cuối. Không làm LiveKit, tạo lịch, report, notification hoặc settlement.

Dùng HTTP/Auth/Query hiện có, schema kiểm tra projection và form trong memory. Không thêm dependency, đổi SDK hoặc làm lại UI. Quyết định ở [research](research.md); chi tiết ở [data model](data-model.md), [HTTP](contracts/http.md), [UI](contracts/ui.md) và [validation guide](quickstart.md).

## Technical Context

- **Language/Version**: TypeScript `~6.0.3`, React `19.2.3`, React Native `0.86.3`, Expo `~57.0.26`, theo mobile package.json.
- **Primary Dependencies**: Expo Router `~57.0.24`, TanStack Query `^5.104.1`, Zod `^4.6.5`, React Hook Form và HTTP client Axios hiện có; không tạo client riêng.
- **Storage**: Backend sở hữu Session/lịch; cache theo user/generation, draft trong form. Không persistent draft/offline queue hoặc client ledger.
- **Testing**: Node/tsx, transport fixtures; API thật, web, Android/iOS tách riêng.
- **Target Platform / Project Type**: Mobile Android/iOS; web preview là evidence bổ sung.
- **Performance Goals**: Dedupe GET theo query key, khóa gửi lặp; không đặt SLA hoặc thêm polling nền.
- **Constraints**: Routes mỏng, feature public exports, file size theo architecture; backend chỉ đọc để đối chiếu.
- **Scale/Scope**: Bốn luồng, theo tháng/ngày; API cap 100, chưa pagination. Không tuyên bố toàn bộ lịch sử khi chạm giới hạn.

## Constitution Check

Đối chiếu [constitution](../../.specify/memory/constitution.md). Gates thiết kế Pass trước research và sau design; không phải nghiệm thu.

| Gate                | Trước / Sau | Căn cứ                                                                                     |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Scope mobile        | Pass / Pass | Thay đổi dự kiến chỉ trong apps/mobile; backend gaps là dependency.                        |
| Architecture        | Pass / Pass | Giữ routes/feature, tách screens.tsx quá dài theo màn, không restructure app.              |
| HTTP/cache/recovery | Pass / Pass | Auth runtime, QueryProvider, cache user/generation, không replay POST.                     |
| UI/accessibility    | Pass / Pass | MonthCalendar, Panel, Badge, Button, ControlledInput, theme; nghiệm thu Back/native riêng. |
| Server authority    | Pass / Pass | Không local confirmation/settlement; server quyết định version/cutoff/conflict.            |
| Evidence            | Pass / Pass | Checks và journeys ở quickstart, không suy runtime từ fixture.                             |

Không có ngoại lệ constitution hoặc nhu cầu framework/lớp mới.

## Project Structure

### Documentation (this feature)

```text
specs/006-session/
  spec.md, contracts.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/http.md, contracts/ui.md
  checklists/requirements.md
```

### Source Code (dự kiến trong apps/mobile)

```text
src/features/sessions/
  api/sessions-api.ts, types.ts, runtime.tsx
  hooks/use-sessions.ts, hooks/use-session-action.ts
  utils/session-time.ts
  screens/                 # list/detail (completion modal)/reschedule/preview-room
  screens.tsx, index.ts     # giữ exports đang được routes sử dụng
  context.tsx, state.ts     # preview còn dùng, không làm nguồn dữ liệu thật
src/features/calendar/screens/CalendarScreen.tsx
src/providers/AppProviders.tsx
src/features/profile/index.ts # public export API đối tác hiện có
src/app/session/[id].tsx       # legacy UUID về detail thật, ID mẫu không fallback
src/features/ui-preview/screens.tsx # vô hiệu hóa liên kết Session dùng ID mẫu
tests/sessions-*.test.ts
```

**Structure Decision**: Giữ routes `/learning-sessions/[id]` và children, layout/calendar/theme. Chỉ tách file để đạt file-size rule. SessionsProvider thật dưới Auth/SessionGate; không lấy dữ liệu từ PathsPreviewProvider. Profile mở public export API đã có, không import private từ feature khác. Giữ contract preview providers/RoomScreen khi tách; các liên kết gallery Session dùng ID mẫu bị vô hiệu hóa với nhãn “Chưa khả dụng” khi chuyển màn sang dữ liệu thật. Không tạo bộ màn Session preview riêng.

## Trình tự triển khai gọn

1. **Dữ liệu**: schema, adapter, SessionsProvider/query keys và fixture kiểm tra participant/projection sai. Smoke HTTP detail sớm cho GAP-03.
2. **Danh sách/chi tiết (US1/US2, MVP tới T010)**: thay preview ở Calendar/detail, query tháng UTC rõ và lọc ngày theo timezone thiết bị, báo cap 100. MVP phải mở được chi tiết thật từ Lịch học, không chỉ có danh sách. Tên đối tác lấy public profile chỉ ở detail; lỗi profile không chặn Session. Không bịa tên plan.
3. **Hoàn thành (US3)**: nối POST vào màn hiện có. Buổi đã endAt và server cho phép thì không bắt buộc đợi status AWAITING_CONFIRMATION. Khóa gửi đồng bộ, retry false, replayAfterRenewal false; giữ receipt, đọc lại detail/list, không optimistic COMPLETED.
4. **Đổi lịch (US4)**: tái sử dụng form ngày giờ + thời lượng; bỏ reason bắt buộc và tự confirm người gửi. Khi thiếu read contract, báo chưa khả dụng và không gửi version giả. Có contract mới nối propose/confirm đúng phiên bản, reload được ở cả hai account và hiển thị giờ có hiệu lực từ server.
5. **Nghiệm thu**: focused behavior tests, lint/types/structure/full mobile tests, fixture web, API hai account và Android/iOS theo quickstart. Không sửa backend để làm test pass.

## Dependency backend và điều kiện mở khóa

| Gap                           | Ảnh hưởng                                             | Điều kiện                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01: thiếu đọc proposal    | Chặn gửi/xác nhận thật và nghiệm thu US4              | Contract participant-only đọc scheduleProposalId/currentVersion/lịch cũ/đề xuất/xác nhận hai bên sau reload; không đặt endpoint giả.            |
| GAP-02: conflict confirm cuối | Chưa chứng minh reschedule không trùng khi concurrent | Backend owner xác minh validation atomic và có evidence; mobile không kiểm thay server.                                                         |
| GAP-03: detail/projection     | US2/US3 cần detail JSON đọc được                      | Smoke serialization: raw Session có BigInt, chưa thấy serializer; chưa kết luận runtime fail. Partner qua public profile; plan title còn thiếu. |
| GAP-04: cap 100               | Có thể thiếu lịch trong khoảng đông                   | Cảnh báo khi trả 100 và cho thu hẹp khoảng ngày; không pagination/total giả.                                                                    |

US1 có thể triển khai; US2/US3 nghiệm thu thật sau gate detail; US4 chuẩn bị UI nhưng chỉ nối/nghiệm thu sau dependency. Không có business clarification mới. Plan không tuyên bố feature đã hoàn thành.
