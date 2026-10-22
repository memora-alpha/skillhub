# Kế hoạch Phase 05–06: Proposal → Chat → Plan → Schedule

## Mục tiêu

Tạo hành trình liên tục từ gửi đề xuất đến chốt lịch học. Mỗi bước cho biết ai cần thao tác, đang chờ điều gì và bước tiếp theo; người dùng có thể trở lại Chat khi thương lượng.

Phạm vi Phase 05–06 nằm trong một work với hai mốc bên dưới. Giữ số các phase khác và lịch sử cũ.

## Phạm vi và nguồn đối chiếu

- Triển khai trong `apps/mobile`; backend chỉ đọc để đối chiếu. Không dùng Spec Kit hoặc tự mở rộng API/shared packages.
- Tái sử dụng theme, font, components và HTTP/session/query runtime của app. UI bằng React Native; giữ các thay đổi sản phẩm đã thống nhất.
- [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), [domain rules](../../domain-rules.md), [contract của luồng](../../contracts/proposal-learning-agreement.md) và [workflow mobile](../../workflow.md).
- Đối chiếu source thay vì suy implementation từ tài liệu cũ. Phân biệt dữ liệu API, fixture kiểm thử và nghiệm thu API/native.
- Dạy thử là tính năng tùy chọn dự kiến, chưa có API: chỉ ghi backlog/dependency, không triển khai UI/mock và không chặn luồng hiện tại. Session media, settlement, review/dispute và Wallet top-up ngoài phạm vi.

## Mốc 1 — Proposal & Chat

Luồng: Learning Request hoặc Sharing Skill → gửi proposal → Đã gửi → người nhận accept → Chat.

- [x] Kiểm tra nguồn, trạng thái bài/kỹ năng, kỹ năng dạy phù hợp và proposal trùng trước khi cho gửi; đọc lỗi không được coi là đủ điều kiện.
- [x] Quản lý Nhận được/Đã gửi; hiển thị proposal đã gửi trên Request; accept/reject/edit/withdraw theo quyền và version.
- [x] Accept mở đúng conversation. Inbox/chat dùng API, avatar thật, tải tin mới nhất trước, phân trang tin cũ và đồng bộ read/delivery/SSE.
- [x] Chat có một entry mở thỏa thuận, giữ ngữ cảnh bài/kỹ năng để phân biệt các cuộc trò chuyện cùng người. Thẻ lộ trình/form xác nhận mở đúng resource và version.

## Mốc 2 — Plan & Schedule

Luồng: Chat → Cách học → Lộ trình → Lịch học → server validation/finalize.

- [x] Hai bên chọn và xác nhận ONE_WAY/TWO_WAY; hiển thị bước hiện tại và người cần thao tác, không tạo màn trung gian lặp.
- [x] Teacher tạo/sửa lộ trình của mình; learner đọc chi tiết và xác nhận version. Mỗi buổi có tiêu đề và mô tả tùy chọn.
- [x] Chỉ mở đề xuất lịch khi thỏa thuận và các plan đủ xác nhận. Lịch gắn với plan; hai chiều có lịch riêng và trạng thái chờ riêng.
- [x] Hai bên xác nhận cùng version lịch; backend validation và finalize quyết định Hold/lock/tạo Session. Giữ recovery đúng intent khi mất phản hồi.
- [x] Sau xác nhận nghiệp vụ thành công, gửi lại form vào Chat. Gửi chat lỗi chỉ retry form, không thực hiện lại xác nhận nghiệp vụ.
- [x] Chuẩn hóa Back/footer, polling nền kết hợp kéo tải lại; bỏ fixture khỏi các route đã có API. Preview còn lại chỉ phục vụ các consumer chưa tích hợp ngoài luồng này.
- [x] Chi tiết lộ trình dùng chung timeline với chi tiết lịch học: chấm cam có viền nhạt, đường nối nét đứt cam và nội dung buổi bên phải; giữ tiêu đề, mô tả và trạng thái, bỏ khung bao/số tròn lặp. Component dùng chung cũng đồng bộ phần lịch từng buổi trong editor.

## Tiêu chí nghiệm thu

### Đồng bộ sửa đổi trước chốt theo BE `187beab`

- [x] Nhận `unchanged: true` và version cũ khi lưu y nguyên; chỉ chấp nhận version tăng đúng một khi có thay đổi, vẫn kiểm resource identity.
- [x] Sửa plan giữ thỏa thuận/xác nhận cách học và plan đối ứng; chỉ learner xác nhận lại plan sửa. Không gửi thêm form Chat khi lưu y nguyên phần đã xác nhận.
- [x] Teacher sửa lịch chưa chốt qua PATCH cùng `expectedVersion`, điền sẵn lịch hiện có; giữ draft và chặn gửi mới khi kết quả chưa rõ.
- [x] Đọc được lịch thiếu buổi ở `NEEDS_REVISION` sau đổi số buổi; chặn confirm/finalize đến khi đủ lịch hợp lệ. Lịch sửa đủ buổi cần hai bên confirm lại.
- [x] Regression cho no-op, version/role, plan revision, lịch giữ/xóa xác nhận đúng phần và schedule editor; cập nhật contract/status theo kết quả thật.

Các quy tắc chi tiết đối chiếu [BE amendments](../../../../../services/api/specs/008-connections/agreement-amendments.md). Backend chỉ đọc; không thay đổi nguồn BE hoặc tạo fixture thay API.

### Điều kiện giữ xuyên suốt

1. Accept proposal chỉ mở Chat, chưa Hold và chưa tạo Session.
2. ONE_WAY có một plan; TWO_WAY có hai plan đối ứng. Người dùng không tạo/sửa thay teacher của chiều còn lại.
3. Learner xác nhận đúng version plan đã đọc; thay đổi phải được xử lý theo snapshot và quy tắc reset xác nhận của backend.
4. Tạo lịch chỉ mở khi thỏa thuận và toàn bộ plan đủ xác nhận. Mỗi lịch thuộc đúng plan, có đủ buổi và hai xác nhận cùng version trước khi chốt.
5. Validation không tự finalize. Chỉ kết quả backend mới xác nhận Hold/Session; retry mất phản hồi dùng đúng intent/key cũ, không tự replay khi reconnect/focus.
6. Loading/error/empty/unknown có hành vi rõ; lỗi refresh chặn mutation phụ thuộc snapshot, không xóa draft tùy tiện. Dữ liệu bị denied hoặc của session cũ không được hồi sinh.
7. Chat/form và Back giữ đúng conversation/resource; API lỗi hoặc route sai không rơi sang fixture. UI dùng theme/font và avatar thống nhất với app.
8. Checks source đạt và giới hạn bằng chứng được ghi trong status. Chỉ đóng phase sản phẩm sau nghiệm thu API/native; không suy từ fixture hoặc web export.

## Kiểm chứng và việc còn lại

- [x] Audit source, route, API contract và SRS; ghi dependency thay vì tự sửa backend.
- [x] Regression cho quyền/version, ONE_WAY/TWO_WAY, proposal preflight, chat/form, pagination, read receipts, recovery và navigation; chạy lint, typecheck, structure, tests và web export.
- [ ] **P05-S99-T02 — Nghiệm thu API/native:** hai tài khoản test, cả nguồn Request/direct và ONE_WAY/TWO_WAY; kiểm accept → Chat → plan → lịch → finalize, concurrent edits/version conflict, thiếu Credit/trùng lịch, mất phản hồi, logout/focus, keyboard/picker/Back trên Android và iOS. Chỉ thao tác tài khoản/ví test được cho phép.

## Dependency và ranh giới xử lý

| Hạng mục | Hướng xử lý |
| --- | --- |
| **P05-API-DEP-T78:** phát hiện trùng lịch giữa hai chiều trước confirm | BE đã có PATCH sửa lịch chưa khóa. Conflict sớm giữa hai chiều vẫn cần contract riêng; giữ final-validation/finalize authoritative. |
| Tạo path/plan/lịch chưa có server idempotency; tìm path theo conversation bị giới hạn danh sách | Giữ draft/intent và đọc đối chiếu; chặn tạo mới khi kết quả chưa rõ hoặc danh sách đầy, không tự replay. |
| Dạy thử tùy chọn | Backlog tương lai cùng dependency backend, không là blocker phase này. |
| Hủy/quyết toán chưa có API mobile xác minh | Hiện unavailable, không đổi status/Credit bằng fixture; triển khai ở phạm vi riêng. |

Kết quả kiểm tra và bước bàn giao ở [status](status.md). Các task ID, thiết kế trung gian và bằng chứng cũ được giữ trong [history](history.md); không tiếp tục thêm nhật ký lượt sửa vào plan này.
