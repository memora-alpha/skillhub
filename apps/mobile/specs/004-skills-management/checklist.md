# Acceptance checklist — Spec 004

Cập nhật: 2026-10-11. Implementation/checks/browser fixtures đã có; chưa nghiệm
thu toàn bộ AC. Phần đã kiểm tra và phần còn thiếu của mỗi AC nằm trong
[validation](validation.md). Giữ AC chưa tick nếu còn thiếu API/platform evidence.

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

## Delivery gates

- [x] Typecheck, lint, structure và tests mobile đạt.
- [x] Transport consumers Auth/account/avatar và profile regression đạt.
- [ ] API thật cho CRUD và full evidence journey đạt; scanner/storage hoạt động.
- [ ] Android và iOS được kiểm chứng riêng, phần chưa chạy ghi rõ pending.
- [x] Không sửa backend/shared; docs phản ánh implementation và gap còn mở. Root lockfile chỉ đồng bộ bốn dependencies mobile: crypto, document picker, image và network.
