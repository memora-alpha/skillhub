# Đồng nhất giao diện Uy tín

## Phạm vi và nguồn

Mobile Expo: `/reputation`, `/reputation/history`, phục hồi uy tín và nội dung hạn chế dùng chung với Request. Giữ Crafted Exchange, Nunito, Button/Badge/FormNotice/FeaturePage và runtime owner/session hiện tại. Không sửa backend, dependencies, shared theme hoặc tự đổi điểm/quyền.

Nguồn: [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), [contract](../../contracts/reputation.md), [ReviewsService.history](../../../../../services/api/src/modules/reviews/application/services/reviews.service.ts), [ReputationService](../../../../../services/api/src/modules/reputation/application/services/reputation.service.ts), [RecoveryService](../../../../../services/api/src/modules/reputation/application/services/recovery.service.ts). Đã fetch origin/dev; modules reputation/reviews không khác baseline hiện tại.

## Công việc

- [x] Ưu tiên điểm/level trước, tiếp theo hạn chế, quy tắc cần xác nhận, phục hồi nếu đủ điều kiện và3 thay đổi gần nhất; link mở lịch sử đầy đủ.
- [x] Bỏ subtitle/nhãn số dòng đã tải, recovery rỗng, nút xác nhận chính sách trùng và lời giải thích lặp. Lịch sử không có mutation/xác nhận.
- [x] Thêm nhãn hoàn điểm phạt, thu hồi điểm phục hồi, điều chỉnh quản trị; ghép kết quả xem xét với đúng scope/thời hạn để không lặp, hiện ngày xem xét và thời hạn.
- [x] Tone theo level server, WARNING không bị tô là bình thường khi chưa có restriction. Không suy quyền từ mức điểm hoặc tự hết hạn theo đồng hồ.
- [x] Tách/validate recovery API; hiển thị policy của quiz, tiến độ ngày/buổi học, remainingBudget từ server; disable khi hết budget, pending/uncertain/read lỗi và reset câu trả lời theo phiên/version quiz.
- [x] Giữ một luồng acknowledge có preflight/receipt/reconcile; phục hồi không còn POST acknowledge trực tiếp. Retry phục hồi chỉ theo hành động người dùng và intent cũ, không replay renewal.
- [x] Focused regression, audit/test backend và browser fixtures normal/restricted/review/recovery/quiz/unknown/budget; chi tiết tại [status](status.md).

Không bổ sung thao tác Staff/Admin xét duyệt hoặc đảo điểm vào app User. Các endpoint đã có quyền riêng; chỉ hiển thị kết quả trả về history/summary. Không thêm lại Thành tích/Báo cáo trên màn lịch sử.
