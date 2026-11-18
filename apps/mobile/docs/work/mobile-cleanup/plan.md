# Dọn source mobile và rà soát logic

## Phạm vi

Theo yêu cầu dọn mock/code thừa, kiểm tra lỗi logic và gom UI lặp. Chỉ sửa apps/mobile, giữ route tree, API/session và thay đổi đang có. Không thay backend, chính sách nghiệp vụ hoặc xóa fixture kiểm thử.

## Task

- [x] Sửa các cảnh báo Sonar trong27 file mobile: giảm cognitive complexity, bỏ điều kiện/template lồng nhau và callback quá sâu, đưa validator không dùng closure ra module, dùng codePointAt/replaceAll và giữ Promise contract của web download. Chạy SonarJS cục bộ cùng regression/type/lint/structure; không đổi nghiệp vụ hoặc dependency runtime.

- [x] Chạy baseline lint/full tests, rà import graph và đối chiếu source/API contract.
- [x] Gỡ sample file không có consumer và provider/path fixture không còn dùng.
- [x] Bỏ hồ sơ/yêu cầu/statistics/testimonial/giao dịch mẫu khỏi UI chạy thật; giữ guest routes với hướng dẫn đăng nhập do API yêu cầu xác thực.
- [x] Bỏ sở thích onboarding không có API lưu; sửa link trỏ ID mẫu, nối link màn chào thật và sửa header320px tràn ngang.
- [x] Gom header sheet dùng chung, giữ riêng lifecycle/presentation của consumer; gom hướng dẫn đăng nhập guest qua GuestAccess.
- [x] Giữ bản nháp editor và expectedListingVersion gốc khi refetch nền; server conflict không xóa input, trạng thái readonly mới vẫn khóa lưu.
- [x] Chạy regression, full workspace checks và preview các màn bị ảnh hưởng; ghi giới hạn và phần còn mở.

## Nguồn và giới hạn

README/workflow/architecture mobile, contracts profile và Learning Request, source thật. Thiết kế giữ theme và component hiện hữu; không có thiết kế mới. Static nội dung giải thích tính năng khác với dữ liệu giả làm kết quả API. Native variants và fixture tests được giữ. Import graph mặc định chưa xét đủ platform variants nên không dùng riêng kết quả đó để xóa native code.
