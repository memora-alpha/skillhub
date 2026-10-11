# Checklist nghiệm thu — Spec 003

Cập nhật: 2026-10-09. Tham chiếu [spec](spec.md) và [validation](validation.md).
Chỉ tick khi có bằng chứng; có source hoặc helper test chưa đủ nghiệm thu UI/API.

## Tài liệu và checks

- [x] Phạm vi, dữ liệu thật/mẫu và các contract gaps đã ghi rõ theo SRS 1.6.
- [x] Typecheck, lint, structure và 75 tests pass; gồm 4 test reset giữ đúng phiên và chống gửi trùng.
- [x] Helper tests bao phủ validation Unicode, clear/no-change, privacy và target/retry.

## Nghiệm thu web sau rebase

- [x] AC-01..03: own API values, `null`/0/counters và validation Unicode qua helper/browser tests.
- [x] AC-04..05: save/clear/reopen/cancel với API local; pending/lưu trùng/400/503/network qua browser fixtures.
- [x] AC-06: logout/đổi account khi đang lưu không ảnh hưởng phiên mới (browser fixtures).
- [x] AC-07..08: allowlist không lộ private fields; public UI/menu/badge đúng (helper và browser fixtures).
- [x] AC-09..10: signed-out deep link, target/retry/empty, back history/fallback và skill chưa kết nối.
- [x] AC-11: screenshot own editor/self-preview web ở 320/375/430 không tràn ngang.
- [x] Android 14 / Pixel 7 emulator: login qua LAN, keyboard headline/bio, Back bỏ draft, save/reopen qua API thật.
- [x] AC-11 Android: editor/self-preview ở font scale 130%; đã xem screenshots, không tràn ngang và các nút vẫn dùng được.
- [ ] Hardware Back trong khi pending trên Android: browser fixtures pass; chưa có bằng chứng native với request được giữ chậm.
- [ ] AC-11: iOS/thiết bị thật và đối chiếu Public Profile Figma riêng.
- [x] Preview dùng API LAN trực tiếp, preflight/CORS đúng origin; real-API acceptance pass không proxy.

- [x] AC-13: chọn/preview/Hủy không upload; file sai định dạng/quá lớn bị chặn (web).
- [x] AC-14..15 qua fixtures: CLEAN/rejected, scan chậm/refresh lỗi/retry, upload/delete lỗi, giữ draft/partial save và đổi account.
- [x] API thật: multipart `image` trả 202 QUARANTINED; status owner trả 200; cleanup DELETE 204 và avatar gốc đã khôi phục.
- [ ] Real scan → CLEAN và avatar mới: ClamAV local đã bật và quét ảnh trực tiếp thành công; chưa xác nhận toàn luồng API.
- [ ] Chọn ảnh/gallery và upload trên native với integration avatar mới.

- [x] AC-16..17 web: bố cục profile/settings/account 320/430/900, private info ở Tài khoản; Trợ giúp/Giới thiệu/version và xác nhận đăng xuất.
- [x] Web: Múi giờ/Ngôn ngữ/Thông báo ghi “Sắp có”, disabled; chạm không mở dialog/gửi request. Chưa triển khai lựa chọn.
- [x] Web own/self-preview: ô Lộ trình hoàn thành “—”/“Sắp có”, không dùng số buổi; Danh hiệu chờ triển khai chỉ ở own hero, không gán danh hiệu public.
- [x] Sau audit SRS: own/public không hiển thị số buổi; Profile và notice không có huy hiệu/số dư mẫu; các shortcut và Cài đặt vẫn hoạt động (web fixtures).
- [x] AC-18 fixtures + session tests: signed-in OTP/reset; lỗi/pending/retry, reset thành công về login; callback cũ không xóa phiên mới; guest reset giữ nguyên behavior.
- [ ] Kiểm tra lại bố cục settings/profile và recovery trên native; OTP gửi email thật từ Cài đặt chưa được nghiệm thu.

Public API/skill list và title vẫn ngoài phạm vi hiện tại; xem GAP-01..07
trong spec. Các mục đó không được tick hoàn thành bằng fixture.
