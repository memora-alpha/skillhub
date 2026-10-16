# Brief review — API Tag

Ngày lập 2026-10-15; được duyệt và triển khai trong phiên này.
[Plan](plan.md) · [Spec](spec.md) · [Cách dùng](quickstart.md) · [Validation](validation.md).

## Điều đã chốt

- Chỉ ADMIN tạo tag chính thức và approve/reject đề xuất.
- USER gửi đề xuất; được duyệt không trở thành Admin.
- Tiếp tục dùng public GET `/api/v1/tags` và tagIds hiện tại của Learning Request.

## Luồng đề xuất

USER gửi tên → request PENDING → ADMIN duyệt → tạo/liên kết Tag ACTIVE và request
APPROVED. Nếu từ chối, request REJECTED có lý do; không tạo tag.
USER xem lịch sử của mình; ADMIN có hàng đợi và chi tiết để duyệt.

ADMIN cũng tạo trực tiếp, sửa tên và bật/ẩn tag theo SRS. Không xóa cứng tag đang
được dùng; bài cũ vẫn đọc được. Hệ thống lưu riêng người đề xuất và Admin tạo/duyệt.

## Các lựa chọn đã thống nhất khi triển khai

1. **Tag trùng:** không tạo thêm tag chỉ khác hoa/thường/khoảng trắng. Nếu trong
   lúc chờ duyệt đã có tag ACTIVE cùng tên, approve liên kết tag đó. Tag đang ẩn
   không tự bật lại khi duyệt.
2. **Đề xuất bị từ chối:** đề xuất giữ nguyên lịch sử và cho gửi request mới;
   mỗi người chỉ có một request PENDING cho cùng tên tại một thời điểm.
3. **Phạm vi V1:** chưa sửa/rút đề xuất, chưa batch review hoặc gửi thông báo
   in-app/SSE; người gửi xem kết quả qua API lịch sử. STAFF chưa có quyền duyệt.

## Thứ tự triển khai và tiêu chí hoàn thành

Schema/migration → API Admin → USER đề xuất/lịch sử → approve/reject → kiểm thử
phân quyền, trùng tên, duyệt đồng thời, rollback và Learning Request.

Hoàn thành khi USER không vượt quyền, request chưa duyệt không dùng được, approve
tạo tối đa một tag chuẩn, quyết định có audit, không thay role và không làm mất
tag/liên kết cũ. Kết quả kiểm thử local và giới hạn rollout nằm trong validation.
