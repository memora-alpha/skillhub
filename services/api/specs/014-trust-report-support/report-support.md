# Report support — backend draft

Branch feat/report-support, base dev 30d9221d. Migration mới:
20261108020000_report_support. Chưa áp database.

Routes dưới /api/v1/reports/support:

- GET /queue?severity=...&status=...&handlerId=...&limit=20&cursor=... .
- POST /incidents: caseIds (2–100), severity, reason; Staff xác nhận cùng sự cố.
- GET /incidents/:id; POST /incidents/:id/severity (expectedVersion, severity, reason).
- POST /incidents/:id/decision (expectedVersion, action resolve|reject, note,
  noShowRuling/makeupUserId khi phù hợp). Quyết định nhóm nguyên tử; ruling chỉ
  áp một lần; không có input điều chỉnh Credit/phạt theo từng report.
- POST /cases/:id/severity: expectedVersion/severity/reason.
- GET|POST /cases/:id/parties/:partyId/messages. POST dùng clientMessageId UUID
  và text (1–4000 ký tự); GET có cursor/limit. Luồng riêng từng bên.
- GET|POST /cases/:id/parties/:partyId/evidence; POST fileId từ upload REPORT
  hiện hữu, scan CLEAN/READY; cap 5 evidence mỗi bên. Download qua
  /cases/:id/parties/:partyId/evidence/:evidenceId/download.

Chỉ party tương ứng và Staff đang được giao, có quyền, được đọc thread/evidence.
Không tự xử lý case mình tham gia. Grouping yêu cầu cùng target và cùng Path/
Session; không tự gom chỉ vì reason giống nhau. Case đã nhóm phải quyết định qua
incident API để tránh nhân tác dụng ở endpoint từng case.

PG giữ membership/receipt, Mongo report_case_messages giữ text. Message staged
ngoài PG, chỉ hiện khi PG receipt commit; đọc kiểm tra quyền lại sau Mongo I/O.
Notification qua outbox chỉ metadata, không text; thông báo in-app chung.
Draft bị bỏ dở có thể tồn tại: cleanup/retention còn pending, không bật TTL xóa
cả message đã publish. Chưa có transfer handler, tách/gom lại nhóm đã đóng hoặc
SLA tự động. Severity do người có quyền chọn, không tự phạt.

Quyền mới report:group/classify/communicate chỉ seed cho ADMIN; khi ghép Staff
access, Admin cấp theo người. Giữ report:moderate cho các thao tác vận hành.
Generator giữ report-support.prisma; migration thêm severity/version/incident,
receipt và attribution evidence. Bằng chứng cũ giữ theo reporter nếu có.

Validation: TypeScript/build/ESLint và 22 test gồm quyết định nhóm, quyền thread,
regression phase3 đạt. Evidence đã qua build/typecheck, chưa test file workflow
trên storage thật; chưa có PostgreSQL/Mongo thật,
batch rollback/concurrency integration, notification delivery hoặc UI.
Constitution: PG/Mongo owner, no Mongo calls in PG transaction pass thiết kế;
atomicity/recovery/runtime authorization pending storage integration.
