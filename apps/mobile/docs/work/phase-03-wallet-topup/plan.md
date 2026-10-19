# Phase03 Wallet và Top-up — ranh giới công việc liên nhánh

## Phạm vi hiện tại

Wallet/Payment được phát triển ở nhánh riêng. Checkout migration chỉ có Wallet preview; spec006 và source tích hợp không có ở đây là khác biệt phạm vi nhánh, không phải lỗi hoặc yêu cầu xây lại luồng.

File này chỉ là điểm tham chiếu của [roadmap](../../roadmap.md), không là plan triển khai thay thế cho nhánh đang làm. Revision tích hợp chưa được đối chiếu; không tạo task triển khai trùng. Các task P03 giả định được tạo lúc migration trước khi có thông tin liên nhánh đã được rút khỏi plan này; không phải task006 lịch sử và chưa có implementation nào được thực hiện từ chúng.

## Nguồn và nơi sở hữu

- [Status](status.md) ghi phạm vi phối hợp và giới hạn đối chiếu liên nhánh.
- [Contract Wallet/Payment](../../contracts/wallet-payments.md) mô tả backend và source có trong checkout migration, kèm quy chuẩn cho thay đổi mới; chưa xác minh source/decisions/acceptance của nhánh phát triển đó.
- Task, quyết định storage/recovery/native/web, thiết kế và bằng chứng nghiệm thu triển khai do hồ sơ ở nhánh đang làm sở hữu. Không suy tiến độ nhánh đó từ fixtures tại đây.
- [Migration](../../migration.md) giữ baseline và đính chính, không cấp quyền bắt đầu phase sản phẩm.

## Khi được giao review hoặc tích hợp

Đọc source, hồ sơ006/contracts/tasks/validation và revision thật của nhánh phát triển; giữ ID và bằng chứng gốc. Đối chiếu thay đổi API, HTTP/Auth/session/Query/shared mobile UI với checkout đích và kiểm affected consumers. Đồng bộ tài liệu theo source đã tích hợp; không áp kết luận thiếu source của baseline migration lên revision mới.

Bằng chứng payment phải tách source/fixture/web/real API/provider/native/persistence/process termination theo [matrix contract](../../contracts/wallet-payments.md). Chỉ thực hiện giao dịch thật hoặc tác động dữ liệu khi có quyền cụ thể. Chưa có yêu cầu review/tích hợp, các bước trên chưa được thực hiện.

## Phạm vi rà code trên checkout hiện tại

Tập trung Auth/session/network, Learning Request và Profile/Skills. Wallet/Payment được review cùng nhánh đang làm khi có yêu cầu riêng hoặc ở bước tích hợp; không nằm trong lượt rà hiện tại.
