# Hiệu năng animation logging và cleanup

Đọc khi xử lý performance, effects, animation hoặc instrumentation.

## Đang có và nguồn đối chiếu

[QueryProvider](../../src/providers/QueryProvider.tsx), [AppProviders](../../src/providers/AppProviders.tsx), [ConnectionGate](../../src/providers/ConnectionGate.tsx), [theme](../../src/constants/theme.ts). Có Reanimated/worklets trong [package](../../package.json); không đo FPS/device trong migration.

## Quy chuẩn cho thay đổi mới

- Đo hoặc tái hiện vấn đề trước khi tối ưu đáng kể. Không thêm memo/useCallback vào mọi chỗ chỉ vì quy chuẩn.
- Dùng list virtualization phù hợp dữ liệu lớn, stable key, pagination đúng; không render vô hạn toàn bộ lịch sử trong ScrollView.
- Tránh effect loop, duplicate request, polling nền ngoài scope và listener không dispose. Kiểm tra React Strict Mode/lifecycle nếu logic có side effect nhạy cảm.
- Ảnh có kích thước hiển thị và mức tải hợp lý; không decode ảnh gốc khổng lồ nhiều lần khi không cần.
- Animation dùng thư viện/cơ chế đang có, tránh tác vụ JS nặng và tôn trọng reduced motion. Animation/gesture phức tạp cần thiết kế và kiểm chứng thiết bị phù hợp.
- Không đặt ngưỡng FPS/thời gian cố định như cam kết chất lượng nếu chưa có baseline, thiết bị và phương pháp đo.
- Tách raw log/debug instrumentation khỏi UI sản phẩm. Chỉ dọn code/log/fixture do phạm vi hiện tại tạo hoặc có liên quan trực tiếp; không sửa toàn bộ nợ kỹ thuật trong cùng phase.
- Không xóa fixture đang dùng cho preview/test chỉ vì gọi nó là “legacy”. Xác định consumer trước khi dọn.

## Giới hạn và đề xuất

Chưa xác minh production logger hoặc baseline hiệu năng thiết bị. Log phải tuân [security](security-and-privacy.md); logger mới là đề xuất công việc riêng. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
