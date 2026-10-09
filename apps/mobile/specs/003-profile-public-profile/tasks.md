# Tasks — Spec 003

Cập nhật: 2026-10-09. `[x]` nghĩa là đã thấy implementation hoặc bằng chứng checks;
nghiệm thu sản phẩm theo [checklist](checklist.md), kết quả ở [validation](validation.md).

## Đã có

- [x] Tái sử dụng Auth spec 002 và own-account API cho own/edit profile.
- [x] Validation tên/headline/bio, clear/no-change và pending guards.
- [x] Public projection, self-preview và route có auth gate.
- [x] Target fixtures, loading/error/retry/unavailable và thông báo skill chưa kết nối.
- [x] Profile helper tests và cập nhật spec/plan/tài liệu liên quan.
- [x] Khóa lưu đồng bộ, giữ baseline draft, Android back guard và callback theo focus/phiên.
- [x] FormNotice cho lỗi lưu; phân biệt phản hồi không rõ kết quả với request bị từ chối.
- [x] Chọn/preview ảnh bằng Expo ImagePicker; upload/xóa khi Lưu, Hủy bỏ draft.
- [x] Poll scan theo phiên; CLEAN refresh hồ sơ; ảnh từ chối/chờ lâu/refresh lỗi có feedback và retry.
- [x] Trạng thái ảnh báo bằng toast, không có dòng dưới avatar; chỉ hiện kiểm tra lại khi chờ lâu/lỗi.
- [x] Tests multipart, validation ảnh, partial save, lỗi/retry và đổi account lúc upload.
- [x] Sắp xếp own profile; chuyển private info vào Settings/Tài khoản; thêm privacy/help/version và quản lý đăng xuất.
- [x] Nối signed-in password recovery bằng OTP hiện có; dedup reset và bảo vệ generation; 4 session tests mới.
- [x] Browser fixtures toàn luồng cài đặt/reset/logout và screenshot 320/430/900.
- [x] Audit SRS 1.6: bỏ huy hiệu/số dư mẫu và thống kê số buổi; ghi rõ Xác minh kỹ năng, giữ Cài đặt.

## Còn cần kiểm chứng

- [x] Kiểm tra own-profile save/reopen/clear/cancel với API local; tài khoản test đã khôi phục.
- [x] Browser fixtures cho lỗi/pending/lưu trùng, đổi account/logout, public target và back fallback.
- [x] Responsive web 320/375/430 và cập nhật bằng chứng trong validation/checklist.
- [x] Nghiệm thu LAN/CORS trực tiếp, Android emulator keyboard/Back, save/reopen thật và font scale 130%.
- [ ] Kiểm chứng pending Back trên Android, iOS/thiết bị thật và đối chiếu Public Profile Figma.
- [ ] Native gallery/upload; real CLEAN cần ClamAV hoạt động. Web upload thật đã nhận 202.
- [ ] Kiểm tra lại Profile/Cài đặt/Tài khoản và keyboard recovery trên native; xác nhận OTP email thật từ Cài đặt.

## Trước khi đưa vào dev

- [x] Đồng bộ 5 commit của dev và giải quyết conflict ở profile/index.ts, PublicProfileScreen.tsx và AppProviders.tsx (origin/dev `1b5b423`).
- [x] Giữ cả own/self profile và entry public profile/proposal từ dev; chạy lại checks và regression sau tích hợp.
- [x] Chỉ stage file đúng scope mobile/pnpm lockfile; loại root `.expo/` và `tsconfig.json` local, review staged diff trước commit.

## Phần mở rộng ngoài phạm vi hiện tại

- [ ] Tích hợp public-profile API và skill list; cập nhật scope/plan khi triển khai.
- [ ] Timezone/locale setup.
- [ ] Title/achievement và thống kê Learning Path khi contract được bổ sung.
