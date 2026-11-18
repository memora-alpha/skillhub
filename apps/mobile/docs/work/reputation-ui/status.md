# Uy tín — hiện trạng

Cập nhật: 2026-11-13T20:21:17+07:00. Phạm vi theo [plan](plan.md).

## Source và đối chiếu API

- GET `/reputation/me` trả điểm, level, activeRestrictions, policyNotice, restrictionReviews và history cursor. Backend đã có ngày xem xét/thời hạn; trước sửa mobile parse nhưng không hiển thị hai field ngày của review. Màu level cũ dựa vào có restriction nên WARNING không lock lại hiện màu bình thường.
- Đã hiển thị ngày xem xét/thời hạn, ghép review vào đúng restriction theo scope+endsAt, không xóa hạn chế chỉ vì decision APPROVED. Review không thuộc restriction hiện tại nằm trong mục Xem xét hạn chế. Màu score theo level server, không dùng để mở quyền.
- History đã dịch `PENALTY_REVERSED`, `RECOVERY_REWARD_REVOKED`, `QA_ADMIN_ADJUSTMENT`; mã tương lai dùng nhãn Điều chỉnh uy tín. `GET /reputation/me` vẫn trả toàn bộ history, màn chính chỉ xem3 dòng mới nhất, không tự cộng lại điểm từ trang đã tải.
- GET `/reputation/recovery`, POST `/reputation/recovery/quiz` và `/claim` đã có trên BE; mobile trước sửa có nối nhưng luôn render panel, policy quiz bị bỏ qua và có acknowledge riêng trùng luồng an toàn. Adapter mới validate đúng code/progress/policy/receipt, chỉ render phục hồi khi eligible=true.
- Quiz hiện policy server, đủ câu mới được gửi. Tiến độ hiển thị ngày cho GOOD_BEHAVIOR_STREAK, buổi học cho COMMITMENT_RECOVERY; điểm nhận có thể nhỏ hơn reward do remainingBudget. Budget hiện hành ở BE là5 điểm/30 ngày; không tự cộng client hoặc tự rút ngắn hạn chế. Câu trả lời giữ khi lỗi, reset theo session và version quiz; pending/uncertain khóa đổi/gửi lặp. Kiểm tra kết quả chỉ retry intent cũ theo nhấn rõ ràng.
- Acknowledge chỉ còn `useReputationPolicy` qua nội dung chính sách server, giữ preflight/receipt/re-read. Request modal/creation gate dùng score/summary compact; context Request và màn tổng quan tách lời giải thích để không hiện nhắc đăng bài ở màn Uy tín.
- POST restriction review/reverse và GET pending reviews là Staff/Admin; không đưa thao tác đặc quyền vào app User. Kết quả và ngày đã có trong GET cá nhân. API Achievements giữ màn riêng.
- Backend source không thay đổi; fetch origin/dev không có bổ sung khác trong modules reputation/reviews so với baseline. Source endpoint không chứng minh deployment.

## Kiểm chứng

- Focused **27/27 PASS**, log ignored `.expo/reputation-ui-focused.log`; thêm4 test recovery adapter và labels/ghép restriction; giữ các ca policy lifecycle/receipt và history.
- Backend build và **22/22 PASS** qua `learning-platform-audit.test.mjs`, `learning-platform/phase3.test.mjs`, gồm policy/review/reversal/recovery với fake transaction DB. Log ignored `.expo/reputation-ui-api-tests.log`; không chạy migration, seed hoặc giao dịch thật.
- Full mobile suite **1.148/1.148 PASS**, 0 fail/skipped/cancelled; log ignored `.expo/reputation-ui-full-tests.log`. TypeScript, full ESLint, structure **979 source files**, Prettier và whitespace đạt; sau chỉnh định dạng ngày giờ đã chạy lại TypeScript và lint các file ảnh hưởng.
- Browser fixture dùng source UI thật với hooks/session/transport cục bộ: normal/warning/restricted/review/streak tại320/390/430px không tràn ngang; chữ130% ở320px; chỉ1 acknowledge, nhận điểm, quiz đủ câu, unknown POST khóa thao tác và kiểm tra lại intent, hết budget khóa nhận, history có nhãn mới. Không có pageerror. Đã xem screenshot normal/restricted/review.
- Script/log/screenshot local ignored: `.expo/reputation-ui-preview.cjs`, `.expo/reputation-ui-browser.log`, `.expo/reputation-ui-preview/`. Fixture gọi adapter quiz/claim thật qua transport thay thế, không gửi vào tài khoản thật.
- Expo web export PASS tại `.expo/reputation-ui-web`, log `.expo/reputation-ui-export.log`; dotenv/telemetry tắt. Source **Ready for review**.

## Giới hạn

Nghiệm thu người dùng chưa thực hiện; Android/iOS, VoiceOver/TalkBack, keyboard phần mềm và API triển khai chưa kiểm. UI dùng phạm vi restriction và receipt từ server; không cam kết tăng điểm hoặc xác nhận sẽ mở quyền ngay.
