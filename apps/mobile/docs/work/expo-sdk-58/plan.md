# Nâng Expo SDK 58

Phạm vi: sửa cài đặt mobile bị đọc Expo 57 từ node_modules cũ, nâng SDK 58 và các thay đổi source bắt buộc để tương thích. Giữ nguyên nghiệp vụ, không sửa backend/web hay cấu hình linker toàn monorepo. Root lockfile thay đổi do mobile dùng chung pnpm workspace.

- [x] SDK58-01: Loại bản cài mobile cũ khỏi module resolution, cài Expo 58 và xác minh đường dẫn/version thực tế.
- [x] SDK58-02: Đồng bộ package theo SDK 58 bằng Expo CLI 58; kiểm tra peer dependencies và Expo Doctor.
- [x] SDK58-03: Sửa các API/type không tương thích SDK 58 ở source mobile và cập nhật hướng dẫn setup.
- [x] SDK58-04: Chạy types, lint, structure, tests và export; ghi rõ giới hạn native/API. Bốn test lỗi có sẵn được đối chiếu source baseline, không thuộc nâng SDK.
- [x] SDK58-05: Web preview: chuyển safe-area spacing sang CSS env(safe-area-inset-*) theo Router58; dùng adapter cho layout/modal, toast và menu; thêm viewport-fit=cover. Đã kiểm computed CSS dọc/ngang bằng Chrome/CDP với inset giả lập và nút đóng toast; native/device thật vẫn chưa nghiệm thu.
- [x] SDK58-06: QR startup: luôn đăng ký route index, chuyển phiên đã đăng nhập từ / sang /home; khai báo anchor index/home. Regression kiểm guest/restored-session/logout và bảo toàn protected routes. Browser trên bản export thực kiểm / → Welcome, vào /login và URL không tồn tại vẫn báo Unmatched. Người dùng xác nhận vào được app sau Reload trên Expo Go; native flows khác chưa nghiệm thu.

Nguồn: [Expo upgrade](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [SDK 58](https://expo.dev/changelog/sdk-58), [Router migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/).

Nghiệm thu source: mobile resolve Expo 58, --check không đề nghị quay về 57, không lỗi mới ở checks so với baseline. Native/device acceptance cần development build/Expo Go tương thích SDK 58; không suy từ JS export.
