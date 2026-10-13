# Checkpoint để làm tiếp — 2026-10-12

## Checkpoint mới — 2026-10-13

Đã nối BE PR #20 đọc từ origin/dev `f4dd314`, không merge/sửa backend. T021..T024,
T036 có mobile source/fixture/web evidence; T037 bổ sung overview/own Sharing
Skills/Credit mỗi giờ theo FR-35. Weekly Save mở, save/reopen/clear và timezone
được bảo toàn. Tag lookup/filter đã có; không còn guard weekly hoặc placeholder Tag.

Tiếp theo: T025..T029 nghiệm thu BE thật với migration
`20261012000000_learning_request_fe_preferences` đã apply bởi API owner, accounts/
grants/config/data phù hợp. Catalog/owner/matching wired trên ref mới; lock reader
NEGOTIATING vẫn unavailable. T030..T032/AC-16 cần device/build native riêng.
Không tick live/native từ fixture. Hướng dẫn backend-pending bên dưới là lịch sử.

Nhánh: `feat/mobile-learning-request`. Tiếp tục spec005 trong `apps/mobile`.
Đọc [tasks](tasks.md), [contracts](contracts.md), [plan](plan.md) và
[validation](validation.md); giữ nguyên ID/trạng thái các task đã hoàn thành.

## Đã lưu

- API adapter/projections, query theo phiên, Mine/feed/search, Profile shortcut.
- Form tạo/sửa, lifecycle actions, Back/pending guard, conflict recovery,
  cache read-denial và expiry preflight.
- Controls thứ/giờ rảnh, chú thích gọn; calendar hạn đăng bài dùng font app nhỏ.
- Fixture server/test-only, 153 automated tests và ảnh web preview.

## Điểm mở lại khi backend sẵn sàng

1. **T036 / B08 / GAP-09 — lịch rảnh theo tuần:** chốt contract thật cho weekday,
   HH:mm, IANA timezone, max/overlap/overnight, clear semantics và dữ liệu cũ.
   `preferredAvailability` là đề xuất, chưa phải field API đã triển khai.
   Nối create/edit/owner/public projections, save/reopen/clear và regression trước
   khi mở Lưu cho weekly choices. Các guard hiện tại nằm ở
   `schemas/request-form.ts` và `screens/request-editor-screen.tsx`.
2. **T021..T024 / B05:** Tag lookup còn thiếu contract. T025..T029 nghiệm thu API
   thật theo readiness Catalog/public owner/matching/lock/moderation/grants/expiry;
   kiểm lại backend mới, cập nhật evidence theo từng case.
3. **T030..T032 / AC-16:** nghiệm thu iOS/Android thật, font scaling, keyboard,
   hardware Back, pending và account switch. Bundle/web chưa thay thế nghiệm thu này.

Weekly choices hiện chỉ nằm trong mounted form; còn choices thì Lưu bị khóa.
Chuyển màn/logout không lưu draft bền vững. `preferredSlots` cũ vẫn là ngày cụ thể,
giữ timestamp gốc khi untouched, cho xóa explicit[]; không tự suy thành lịch tuần.
Notification/Proposal/Chat/Path/Wallet vẫn thuộc feature riêng.

## Kiểm tra tại checkpoint

Tại `apps/mobile`: `npm run lint`, `npm run check-types`,
`npm run check-structure` (338 source files), `npm test` (153/153) đều qua.
API Reputation module lint/typecheck qua; root commit-scope tests6/6 qua.
Git commits chạy đầy đủ lint-staged/commitlint. Export/native/web và fixture evidence
trước checkpoint nằm trong [validation](validation.md).

Có thể giao lượt tiếp theo:

```text
$speckit-implement Tiếp tục spec 005-learning-request trong apps/mobile.
Đọc resume.md, tasks, contracts và source. Xác minh backend đã hoàn thành B08,
chốt contract thật rồi triển khai T036; giữ task chưa đủ dependency ở pending.
Không sửa services/api và không tick nghiệm thu native từ web hoặc bundle.
```
