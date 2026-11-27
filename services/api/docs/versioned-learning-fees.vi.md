# Chính sách phí học tập có phiên bản

Quyết định ngày 2026-11-21: Admin có quyền `fee-policy:manage` được tạo và phê
duyệt chính sách phí cho `ONE_WAY`, `TWO_WAY` và `MATERIAL_PAID`. Mức seed ban
đầu cho hai loại học tập vẫn là 4% (`400` basis points).

## Nguyên tắc

- Mỗi phiên bản bắt đầu ở `DRAFT`, cần re-authentication và lý do vận hành.
- Bản nháp có thể sửa mức phí hoặc xóa; bản đã duyệt là bất biến. Phiên bản
  mới hơn có thể bỏ qua một bản nháp cũ.
- Phiên bản chỉ có hiệu lực sau khi được phê duyệt; có thể đặt thời điểm hiệu
  lực trong tương lai nhưng không được backdate. Một phiên bản mới hơn có thể
  hiệu lực ngay để hotfix dù phiên bản trước đã được lên lịch trong tương lai;
  khi tới lịch, phiên bản có `effectiveAt` mới nhất sẽ được chọn.
- Khi Learning Path được khóa, server ghim `feePolicyId`, tỷ lệ và số phí dự
  kiến vào PathVersion. Hold cũng lưu `feeBps` bất biến trong snapshot Credit.
- Thay đổi chính sách không tính lại Path, Hold, settlement hoặc termination đã
  được ghim trước đó.
- Phí Admin được phép tạo nằm trong biên kinh doanh `100..1000` basis points
  (1%–10%); phần còn lại luôn là
  `10000 - feeBps`. Làm tròn xuống ở precision Credit hiện hành, độc lập theo
  từng người trả để hai khoản Hold bằng nhau chịu phí bằng nhau.
- `fee_policy_versions` là nguồn sự thật duy nhất cho phí lộ trình và tài liệu.
  Khóa cấu hình cũ `credit.pathSettlementBps` không còn thuộc configuration
  catalog và không được trả như một chính sách phí song song.
- Tỷ giá nạp `1.000 VND/Credit`, giới hạn Credit tối thiểu và việc không hỗ trợ
  cash-out vẫn là cấu hình chỉ đọc trong thay đổi này.

## API Admin

- `GET /api/v1/admin/credit-policy`: snapshot tỷ giá nạp, Credit tối thiểu và
  chính sách phí học đang hiệu lực.
- `GET /api/v1/admin/fee-policies`: lịch sử phiên bản có phân trang.
- `GET /api/v1/admin/fee-policies/current`: phiên bản hiện hành của từng loại.
- `GET /api/v1/admin/fee-policies/next-version?policyCode=...`: số phiên bản
  kế tiếp của cả series, không phụ thuộc trang lịch sử Web đang hiển thị.
- `POST /api/v1/admin/fee-policies`: tạo draft với `policyCode`, `versionNo`,
  `feeBps`, `reason`, `reauthToken`.
- `PATCH /api/v1/admin/fee-policies/:id`: sửa `feeBps` của `DRAFT`, kèm lý do
  và re-authentication.
- `DELETE /api/v1/admin/fee-policies/:id`: xóa `DRAFT`, kèm lý do và
  re-authentication.
- `POST /api/v1/admin/fee-policies/:id/approve`: phê duyệt ngay hoặc đặt
  `effectiveAt`.

Endpoint cũ `POST /api/v1/admin/fee-policies/material` được giữ để tương thích.

## Thông báo thay đổi

- Khi phê duyệt, Admin thực hiện thao tác nhận một thông báo in-app xác nhận
  ngay qua outbox `admin.fee-policy.approved`.
- Mọi tài khoản `ACTIVE` nhận thông báo in-app qua outbox
  `credit.fee-policy.effective` đúng lúc phiên bản bắt đầu có hiệu lực. Nội dung
  nêu loại chính sách, mức cũ/mới, thời điểm hiệu lực và phạm vi không hồi tố.
- Thông báo cho người dùng tuân theo tùy chọn nhóm `credit`. Danh sách người
  nhận được chia batch 500; ID của từng batch là xác định để outbox retry không
  tạo bản sao.
- Việc tạo hai event nằm trong cùng transaction phê duyệt. Event hiệu lực dùng
  `availableAt = effectiveAt`, nên không thông báo chính sách chưa có hiệu lực.

## Rollout

1. Dừng writer cũ trong lúc migrate.
2. Áp migration `20261121000000_versioned_learning_fee_policies`.
3. Deploy API rồi Web Admin cùng revision.
4. Kiểm tra `GET /admin/credit-policy` trả đủ `ONE_WAY` và `TWO_WAY` baseline.
5. Tạo draft thử nghiệm và đặt hiệu lực tương lai; xác nhận Path cũ vẫn dùng
   policy đã ghim, Path khóa sau thời điểm hiệu lực dùng phiên bản mới.

Không sửa hoặc backfill snapshot Hold lịch sử.
