# Acceptance checklist — Spec 004

Cập nhật: 2026-10-15, sau lần rà soát trước commit. Mobile đã qua các kiểm tra
bên dưới; chưa nghiệm thu toàn bộ AC trên API/scanner và thiết bị thật.
Bằng chứng tại [rà soát trước commit](validation.md#rà-soát-trước-commit--2026-10-15).
Các checkbox AC tổng thể vẫn mở nếu còn thiếu bằng chứng trong ma trận;
không dùng kết quả web/export để đánh dấu Android/iOS đã chạy trên thiết bị.

## Kiểm tra mobile để commit — đã hoàn thành

- [x] Lint, check-types và structure: 460 source files.
- [x] 296/296 tests mobile và 6/6 tests commit scope.
- [x] Prettier các file thay đổi; whitespace checks cho staged/unstaged diff.
- [x] Root lockfile qua frozen-lockfile với đúng pnpm 10.24.0 cho 6 workspace.
- [x] Export Web 1977, Android 2422 và iOS 2485 modules, gồm Hermes bundles; chưa phải native binary/device test.
- [x] Browser 5 nhóm/64 requests: level động/description, đổi catalog, lỗi/retry, level inactive, own/public/detail và catalog rỗng.
- [x] Browser ẩn/hiện, Hủy xóa không request, xác nhận archive một request rồi gỡ card.
- [x] Browser 5 kịch bản evidence: tạo hai ảnh, partial failure/retry, nén, giữ ảnh gốc, scan lâu/Kiểm tra lại; không có page error.
- [x] Layout 320/375/430 px; chỉ submit sau READY, không upload lại ID đã có khi retry.
- [x] Rà diff và mẫu credential; không phát hiện secret trong 63 file kiểm tra. Không sửa services/api hoặc packages.

## Nghiệm thu AC tổng thể

- [ ] AC-01: Own list/pagination không có archive toggle, empty và lỗi trang sau đúng.
- [ ] AC-02: Catalog search biên/reset cursor/race đúng.
- [ ] AC-03: Create/reopen thật, duplicate/inactive feedback đúng.
- [ ] AC-04: Form Unicode/decimal/clear/Hủy/no-change gửi đúng hoặc không gửi.
- [ ] AC-05: Stale version/double tap/unknown outcome và key/body đúng.
- [ ] AC-06: Visibility/xóa/confirm/pending conflict; không xem lại bản xóa, giữ lịch sử hệ thống.
- [ ] AC-07: Picker/files/cap/format/count đúng; xử lý lỗi server.
- [ ] AC-08: Scan states và polling, chỉ READY mới submit.
- [ ] AC-09: Submit pending/idempotent retry, không replay multipart.
- [ ] AC-10: Badge/batch/evidence và reject/revoke reasons đúng.
- [ ] AC-11: History/download riêng tư, expired/sai owner đúng.
- [x] AC-12: Saved-but-refresh-failed không gửi mutation lại hoặc đếm cục bộ (hook fixture).
- [ ] AC-13: Session generation/account switch không lộ data/callback.
- [ ] AC-14: Deep link/cold start/invalid/archive và Back đúng.
- [ ] AC-15: Own/self profile thật, pagination/public privacy, demo boundary rõ.
- [ ] AC-16: Native/web accessibility/keyboard/Back/chữ lớn có bằng chứng riêng.

### Phần đã kiểm tra và phần còn thiếu

| AC  | Bằng chứng mobile đã có                                                                                | Còn thiếu để đóng AC tổng thể                                            |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 01  | Unit/fixture list, cursor, filter, empty và lỗi trang sau.                                             | Pagination >20 và trạng thái lỗi trên API thật.                          |
| 02  | Validation query/cursor/race; catalog và lookup level qua browser.                                     | Search/pagination trên catalog API thật với dữ liệu đủ lớn.              |
| 03  | Create/reopen trong fixture, levelId/payload/key và draft khi lỗi.                                     | CRUD bằng tài khoản User trên API thật, duplicate/inactive runtime.      |
| 04  | Unicode/decimal/null/no-change tests và form web.                                                      | Hủy draft, keyboard và nhập liệu trên thiết bị.                          |
| 05  | Unit key/body/duplicate/unknown outcome, stale-version recovery trong fixture.                         | Timeout sau commit và concurrent edits trên API thật.                    |
| 06  | Web hide/show có version, Hủy xóa không mutation, archive một request; tombstone/private cache tests.  | Quyền/pending conflict và lưu history trong server thật.                 |
| 07  | Web picker, nén/fallback/original; unit cap/MIME/count; partial failure và 503.                        | Camera/library native, độ rõ/EXIF và cap/format runtime.                 |
| 08  | Unit scan states, cancellation, READY-only, retry sau 65 giây; browser WAITING_SCAN không tải lại.     | Scanner/storage thật và lifecycle trên thiết bị.                         |
| 09  | Tests idempotency/unknown result; web submit một lần, giữ fileIds và chặn gửi trùng.                   | Full submit/replay/pending conflict trên server thật.                    |
| 10  | Parser/badge aggregation và fixtures VERIFIED cùng batch PENDING, reject/decision.                     | Staff approve/reject/revoke và aggregate thật.                           |
| 11  | Tests ID/binding/allowlist, history/detail và URL expiry/403 trong fixture trước đó.                   | Signed URL/expiry/quyền owner thật và history nhiều trang.               |
| 12  | Hook tests xác nhận mutation thành công không bị refresh lỗi biến thành ghi thất bại; không tự replay. | Không còn thiếu trong phạm vi hook fixture đã ghi ở AC-12.               |
| 13  | Unit session/logout/archive/pause, bỏ callback cũ và không auto replay sau resume.                     | Đổi tài khoản/app background trong runtime thiết bị.                     |
| 14  | Tests lookup nhiều trang/invalid/archive; web điều hướng và gỡ card sau archive.                       | Authenticated cold start/deep link và hardware Back native.              |
| 15  | Tests public allowlist/cache, own/public profile và level metadata trong browser.                      | Public pagination/privacy trên API thật.                                 |
| 16  | Web widths 320/375/430, labels/disabled; native JS/Hermes export thành công.                           | Thiết bị Android/iOS, chữ lớn, keyboard, screen reader và hardware Back. |

## Delivery gates

- [x] Mobile-only 2026-10-15: pipeline hai file, tiến độ từng bước, scan sau 65 giây,
      WAITING_SCAN và kiểm tra lại không upload trùng đã có regression.
- [ ] Native và full API/scanner acceptance cho amendment 2026-10-15.

- [x] Typecheck, lint, structure và tests mobile đạt.
- [x] Transport consumers Auth/account/avatar và profile regression đạt.
- [x] Web và Android/iOS JS/Hermes export đạt; root pnpm lockfile và commit tooling đã kiểm tra.
- [ ] API thật cho CRUD và full evidence journey đạt; scanner/storage hoạt động.
- [ ] Android và iOS được kiểm chứng riêng, phần chưa chạy ghi rõ pending.
- [x] Không sửa backend/shared/root ignore; dependencies mới chỉ thuộc mobile. Tooling pnpm-only dùng mobile ignore, README và bỏ npm lockfile đã rà soát.

## Gửi bằng chứng trong phiên và nén ảnh — 2026-10-14

- [x] Skill lưu xác nhận thì về list; job tiếp tục qua navigation, toast kết quả riêng và card gửi/chờ duyệt/lỗi + retry.
- [x] Mở chi tiết khi đang gửi, chặn gửi trùng, giữ badge VERIFIED và allowlist public.
- [x] Retry giữ IDs/intent; session/logout/archive/pause không phát sinh callback/mutation mới sai phạm vi.
- [x] Nén có điều kiện quality 0,9, giữ dimensions, chỉ dùng bản nhỏ hơn; Keep original, documents/small/READY bytes giữ nguyên.
- [ ] Native quality/readability/EXIF, app background và actual API/scanner acceptance.

## Skill Level catalog — 2026-10-14

- [x] ACTIVE cấp độ theo skill; chỉ gửi levelId và render tên catalog cho custom codes.
- [x] Query/parser giữ scope/parent ID, rejects wrong-skill metadata và giữ privacy allowlist.
- [x] Level lịch sử INACTIVE giữ được qua PATCH các field khác; legacy null vẫn hiển thị được.
- [x] Consumer Learning Request không dùng fixed enum cho offered Sharing Skills.
- [x] Catalog server đã có level động: tạo 10 skill, thêm A1–C2/N5–N1; đọc lại 43 level ACTIVE có description và tắt 8 level chung của ngoại ngữ qua Admin API ngày 2026-10-15.
- [ ] Form User thật: custom/INACTIVE create/edit và own/public projections từ mobile, tách khỏi thao tác quản trị catalog.
- [ ] Android/iOS: chọn cấp độ, chữ dài, loading/retry, accessibility và Back.
