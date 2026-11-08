# Admin transactions — read-only backend draft

Branch feat/admin-transactions, base dev 30d9221d. Đợt này chỉ đọc và đối soát.

Routes /api/v1:

- GET /admin/credit/transactions?limit=20&cursor=...&userId=...&type=...&status=...
  &operationId=...&referenceType=...&referenceId=...&from=...&to=...
- GET /admin/credit/transactions/:id; GET /admin/credit/operations/:id.
- GET /admin/users/:userId/wallet.
- GET /admin/payments?limit=20&cursor=...&userId=...&status=...&orderCode=...
  &gatewayTransactionId=...&from=...&to=...
- GET /admin/payments/:id; GET /admin/payments/:id/reconciliation.

Yêu cầu role ADMIN và quyền credit:read:any, payment:read:any hoặc payment:reconcile
đúng thao tác. Staff có permission cùng mã vẫn không được gọi Admin API.
Payment status REVIEW là filter hàng chờ. Reconciliation tái sử dụng reader hiện
hữu, chỉ snapshot DB/receipt/ledger, chưa chủ động lookup provider từ endpoint.
Không có adjustment/reversal/recovery/hủy đơn hoặc cập nhật status thủ công.

Cursor HMAC ràng buộc actor/filter/kind, thời gian UTC, Credit theo formatCredit
và VND decimal string. Query nghiệp vụ đặt transaction READ ONLY. Không trả
idempotency keys, raw webhook, signature hoặc paymentLinkId trong đối soát.
Áp migration 20261108010000_admin_finance_reads để thêm quyền/index; generator
đã giữ index mới. Không có thay đổi số dư/ledger từ tính năng này.

Validation ban đầu TypeScript/build và 5 test cursor/auth/read-only/serialization/
reconciliation đạt. ESLint sau chỉnh projection đạt. PostgreSQL test
thật, query plan, provider lookup và FE chưa được xác minh.
Constitution: PG authority/read only/module boundaries pass thiết kế; runtime
integration pending. Không ngoại lệ; chưa commit/deploy.
