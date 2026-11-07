# Kế hoạch triển khai Reputation Recovery

> Khi thực thi, dùng superpowers:executing-plans hoặc superpowers:subagent-driven-development theo phương thức đã thống nhất. Các mục dưới đây là phạm vi công việc có thể kiểm chứng.

**Mục tiêu** — Hoàn thiện vòng đời hạn chế quyền, bổ sung phục hồi Reputation có kiểm soát và hiển thị điều kiện mở quyền.

**Kiến trúc** — Module `reputation` sở hữu policy, ledger điểm và trạng thái phục hồi. Dùng transaction PostgreSQL hiện có để ghi thay đổi điểm, bằng chứng, trạng thái hạn chế và AuditLog. API tiêu thụ kết quả từ `reviews`, `learning-sessions` và `reports` qua contract của module tương ứng.

**Công nghệ** — NestJS, TypeScript, Prisma/PostgreSQL, Node test runner. Client dùng API hiện có và phần mở rộng tương thích.

**Đặc tả** — [SRS 1.7, mục 18.34](../../SRS_SkillHub_V1.7_Reputation_Recovery.docx). Baseline khảo sát là `fix/reputation-review` tại `b6ce898f`. Khi thực thi, lập hoặc cập nhật bộ spec/plan/tasks theo Spec Kit trong `services/api/specs`, theo số thư mục tại thời điểm đó.

## Ràng buộc chung

- Tách sự kiện biến động điểm, quyết định hạn chế và quyết định mở quyền. Chỉ penalty hợp lệ hoặc quyết định moderation mới có thể áp khóa mới. Thưởng và sự kiện delta 0 không đổi hạn chế đang có.
- Giữ thang điểm 0–100 và các mức khóa 1/3/7/30 ngày. Điểm hoàn thành Path tiếp tục có giới hạn +10/tháng UTC.
- MVP gồm Policy Awareness (+2, quiz ≥80%), Good Behavior Streak (+2, 14 ngày kèm điều kiện chủ động) và Commitment Recovery (+3, hai Session đủ chuẩn). Tổng thưởng tối đa +5/30 ngày, mỗi nhiệm vụ một thưởng/chu kỳ. Hoàn điểm do xử lý sai nằm ngoài ngân sách thưởng.
- Giữ lịch sử, phân quyền rõ và truy vết tới sự kiện gốc. Dùng giờ backend. Migration theo hướng bổ sung, giữ dữ liệu đang hiệu lực và thử trên dữ liệu cũ trước khi rollout.
- Tập trung backend trước. Kiểm tra consumer hiện có. Phạm vi giao diện learner và moderation được xác nhận theo app mục tiêu trước khi sửa client.

## Thứ tự và tiêu chí triển khai

### 1. P0 — Tách cập nhật điểm và kích hoạt khóa (REP-005, REP-007, REC-005)

**Điểm sửa** — `services/api/src/modules/reputation/application/services/reputation.service.ts` và các caller trong `reviews`, `reports`, `learning-sessions`.

- [ ] Thêm ca hồi quy trong `services/api/test/learning-platform/phase3.test.mjs`. Điểm 35 sau khi khóa hết hạn cộng 1 hoặc delta 0 thì không có khóa mới. Điểm 39 tăng lên 40 giữ nguyên khóa đang hiệu lực. Một penalty mới hợp lệ vẫn tạo hạn chế theo mức điểm. Quyết định moderation độc lập giữ nguyên thời hạn khi có sự kiện thưởng.
- [ ] Tách xử lý điểm trong `apply` khỏi bước quyết định khóa. Chỉ nhánh penalty được xác định rõ và moderation được gọi bước áp hạn chế. Chốt cách phân loại review 1–2 sao trước khi thay hành vi cho caller review.
- [ ] Xác định cách lưu điều kiện đọc policy và duyệt Staff/Admin sau khi Product Owner chốt. Kiểm tra quyền mở khi đủ cả thời gian và điều kiện, kể cả hạn chế cũ chưa có dữ liệu duyệt. Khóa dài hơn còn hiệu lực phải được giữ theo policy đã chốt.
- [ ] Chạy `pnpm --filter api test:learning-platform` và các ca attendance/report có dùng penalty.

### 2. P0 — Áp dụng gate tại điểm tạo mới (REP-006)

**Điểm sửa** — `services/api/src/modules/proposals/application/services/proposals.service.ts`, `services/api/src/modules/users/application/services/skill-actor.service.ts` và các use case tạo/đăng Learning Request.

- [ ] Viết ca gọi API tạo Proposal với người gửi bị hạn chế, kỳ vọng 403 `NEW_ACTIVITY_RESTRICTED`. Bao phủ mọi loại nguồn Proposal, hạn chế hết hiệu lực, hạn chế chưa được mở vì còn điều kiện, và giao dịch đồng thời với thay đổi restriction. Thêm hồi quy cho tạo/đăng Request và xem lịch/tham gia Session đã chốt.
- [ ] Dùng chung kết quả kiểm tra hạn chế trong transaction tạo mới, sau khi khóa người dùng. Giữ RBAC, điều kiện participant, quyền theo từng tài nguyên và tính idempotent hiện có. Bao phủ gửi yêu cầu tạo tag bằng kiểm thử hồi quy.
- [ ] Chạy `pnpm --filter api test:learning-request` và các ca Proposal trong `test:learning-platform`. Phần Path/chat/Session chỉ mở rộng khi có danh mục hành động cụ thể.

### 3. P1 — Hoàn tác penalty và thu hồi thưởng (REP-008, REC-006)

**Điểm sửa** — `services/api/prisma/schema.prisma`, migration mới, module `reputation`, `reports` và catalog audit.

- [ ] Đặc tả lệnh moderation có quyền, ID sự kiện gốc, lý do bắt buộc và ID yêu cầu chống lặp. Lưu liên kết duy nhất từ giao dịch đối ứng tới sự kiện gốc. Xác định cách xử lý lịch sử cũ nếu thiếu căn cứ liên kết restriction.
- [ ] Thử penalty danh nghĩa −8 nhưng thực tế −3 do sàn 0. Hoàn theo 3 điểm trước khi áp trần hiện tại. Thử thu hồi thưởng đã bị giới hạn bởi trần 100, retry đồng thời, sự kiện gốc sai loại, lý do rỗng, quyền sai và audit lỗi giữa giao dịch.
- [ ] Ghi đối ứng, cập nhật điểm, đánh giá lại hạn chế bị tác động và ghi AuditLog trong một transaction. Không khởi động lại đồng hồ khóa của quyết định còn căn cứ. Giữ khóa độc lập do moderation khác và lưu cả giao dịch gốc lẫn giao dịch đối ứng.
- [ ] Chạy ca PostgreSQL thực cho migration, unique constraint, rollback và cạnh tranh ghi. Chạy regression report/credit để kiểm tra luồng reversal Credit tiếp tục hoạt động.

### 4. P1 — Ledger thưởng, chu kỳ và chống farm (REP-009–011, REC-001–004)

**Điểm sửa** — Module `reputation` và Prisma. Điểm tích hợp là `ReputationService.applyPathCompletion` và `ReviewsService.create`.

- [ ] Sau khi chốt các tham số trong mục Quyết định cần chốt, định nghĩa chu kỳ, bản ghi nhiệm vụ, định danh bằng chứng và khóa duy nhất người dùng/chu kỳ/nhiệm vụ. Định nghĩa cửa sổ thưởng, số điểm cấp so với biến động thực tế và cách thu hồi ảnh hưởng tới ngân sách.
- [ ] Viết ca hai yêu cầu cùng tranh phần ngân sách còn lại, retry cùng bằng chứng, hai nhiệm vụ dùng cùng Session, và hoàn điểm sai nằm ngoài +5. Thử hai người đổi vai qua nhiều Path để bảo đảm policy theo cặp vẫn nhận ra cùng cặp. Thử cả completion và review ở biên cửa sổ.
- [ ] Đọc ngân sách, kiểm tra quyền/eligibility/bằng chứng, đặt khóa chống trùng và ghi thưởng cùng transaction dưới khóa người dùng. Chuẩn hóa thứ tự ID cho kiểm tra cặp và bảo toàn thứ tự khóa hiện có khi xử lý hai participant. Giữ dữ liệu review và quyết toán hợp lệ khi điểm thưởng bị giới hạn.
- [ ] Chạy test cạnh tranh trên PostgreSQL và regression cho giới hạn +10/tháng. Chưa mở cờ Recovery cho tới khi các guard áp dụng cho toàn bộ luồng thưởng được bật.

### 5. P1 — Ba nhiệm vụ MVP và API learner (REP-009–010, REC-001–005)

**Điểm sửa** — Module `reputation` xử lý chu kỳ, chấm quiz và xác minh nhiệm vụ. Dùng dữ liệu kết quả Session từ `learning-sessions` và quyết định vi phạm từ `reports`.

- [ ] Policy Awareness. API trả nội dung policy và bộ câu hỏi theo phiên bản, giữ đáp án phía server. Test 79% không thưởng, 80% đủ điều kiện +2, nộp lại không nhận lần hai và người đang bị khóa tạo mới vẫn dùng được nếu đủ điều kiện.
- [ ] Good Behavior Streak. Backend dùng thời gian và dữ liệu vi phạm đã xác minh. Test 13 ngày chưa đạt, đủ 14 ngày có hành vi được duyệt thì +2, đủ 14 ngày chỉ không có report vẫn chưa đạt, và vi phạm xác nhận muộn được xử lý theo policy đã chốt.
- [ ] Commitment Recovery. Backend đếm hai Session phân biệt đã chốt, người dùng thực sự là participant, đã hoàn thành và có outcome đủ chuẩn. Test Session lặp, no-show, chưa chốt outcome và dữ liệu của người khác đều không được tính.
- [ ] Thêm API danh sách nhiệm vụ, tiến độ và kết quả nộp quiz. Phản hồi phân biệt chưa đủ điều kiện, đang xác minh, đủ điều kiện nhưng bị giới hạn thưởng, và đã nhận. Chứng minh người không có Session còn một nhiệm vụ phù hợp theo ma trận đã chốt. Hoàn thành nhiệm vụ không làm giảm thời hạn hạn chế hoặc tự duyệt.
- [ ] Để Punctuality Challenge và Rehabilitation Review ở giai đoạn sau MVP. Mỗi nhiệm vụ cần tiêu chí xác minh riêng trước khi triển khai.

### 6. P2 — Trạng thái hạn chế và giao diện (REP-012)

**Điểm tích hợp** — `services/api/src/modules/reviews/application/services/reviews.service.ts` phục vụ `/reputation/me`. Consumer gồm web, Expo mobile và Flutter. Phần UI Staff/Admin thuộc luồng xác nhận policy xét duyệt hoặc lệnh moderation cần thiết ở các bước trước.

- [ ] Bổ sung trường tương thích cho trạng thái, hành động bị chặn, điều kiện còn thiếu và trạng thái duyệt. Phân biệt hạn chế đang chạy thời gian, đã hết thời gian nhưng còn điều kiện, và đã mở. Đồng bộ projection với chính gate dùng khi thực thi lệnh.
- [ ] Cập nhật các client đã chốt phạm vi để hiển thị trạng thái và tiến độ. Test API không lộ bằng chứng riêng tư, contract cũ vẫn đọc được và UI xử lý được payload từ backend chưa rollout.
- [ ] Kiểm thử xuyên luồng trên app mục tiêu. Từ penalty hợp lệ đến Proposal bị chặn, hoàn thành nhiệm vụ không cần tạo hoạt động mới, điểm tăng qua 40 nhưng hạn chế vẫn giữ, cuối cùng mở quyền sau khi đủ điều kiện.

## Quyết định cần chốt trước các bước phụ thuộc

Product Owner đã chốt các nguyên tắc sau khi duyệt triển khai.

- Review 1–2 sao chỉ trừ điểm. Vi phạm đã xác nhận mới là căn cứ xét khóa mới. Giữ hạn chế hiện có và duyệt thủ công theo mức khóa với nhóm 0–19, có quyết định và AuditLog.
- Người có Reputation dưới 40 được tham gia nếu không bị suspension nghiêm trọng. Phân nhiệm vụ theo loại vi phạm.
- Ngân sách +5 trong cửa sổ 30 ngày trượt. Cấp phần hạn mức còn lại, không chuyển phần dư sang kỳ sau, giữ trần 100.
- Chỉ tính thưởng từ tối đa hai Learning Path cho cùng cặp trong 30 ngày, áp dụng cho sự kiện mới sau rollout 1.7.
- Quiz đạt ít nhất 80%, một lần thưởng mỗi chu kỳ. Streak 14 ngày cần hoạt động hợp lệ. Session cần xác nhận hai bên và bằng chứng tham gia phù hợp.
- Ưu tiên app learner hiển thị điểm, nhiệm vụ, tiến độ và điều kiện mở khóa.
- Quyền tạo Request/Proposal mở khi hết thời hạn khóa. Yêu cầu Staff/Admin review vẫn được ghi nhận và theo dõi sau khi quyền đã mở.
- Một đợt Reputation dưới 40 là một chu kỳ. Streak cần hoàn thành Policy Awareness hoặc một Session hợp lệ trong 14 ngày.
- Policy Awareness áp dụng cho mọi loại vi phạm. No-show/hủy muộn có thêm Commitment Recovery, các nhóm khác có Good Behavior Streak. Tài khoản bị khóa toàn bộ không đủ điều kiện.

Các chi tiết còn mở là cách xử lý bằng chứng dùng lại, vi phạm xác nhận muộn và migration hạn chế cũ.

| Quyết định | Bước phụ thuộc |
|---|---|
| Phân quyền duyệt theo mức khóa, xác nhận đọc policy và chuyển đổi hạn chế cũ. | 1–3, 6 |
| Cách ghi ngân sách khi điểm chạm trần 100, xử lý ngân sách sau thu hồi và chính sách cộng dồn chung bằng chứng. | 4–5 |
| Vi phạm xác nhận muộn, phiên bản và số lần làm quiz, loại bằng chứng tham gia Session đủ chuẩn. | 5 |
| App mục tiêu cho learner và Staff/Admin, dung sai đúng giờ và quy trình xét Rehabilitation Review sau MVP. | 5–6 |

## Kiểm chứng trước khi phát hành

- Chạy `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api test:learning-platform` và các suite API bị ảnh hưởng. Build trước khi chạy test import `dist` nếu script chưa build.
- Thử migration với dữ liệu 1.6 có khóa còn hiệu lực, đã hết hạn và khóa từ moderation. Đối soát điểm, audit và quyền trước/sau. Không tự suy diễn dữ liệu xét duyệt lịch sử.
- Xác nhận server giữ đúng ngân sách và không ghi trùng khi xử lý đồng thời, khi retry sau mất phản hồi và khi audit/write lỗi.
- Triển khai từng giai đoạn theo thứ tự P0, ledger/guard P1, MVP, rồi projection/UI. Kiểm tra các thao tác mở quyền bắt buộc có đường thực hiện trước khi bật enforcement tương ứng.
