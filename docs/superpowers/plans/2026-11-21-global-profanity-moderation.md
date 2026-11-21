# Kế hoạch triển khai kiểm duyệt từ tục toàn cục

> Thực hiện theo từng đầu việc bằng `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development` khi được yêu cầu triển khai. Dùng các ô kiểm để theo dõi tiến độ.

**Mục tiêu** — Giai đoạn 1 chặn toàn bộ mẫu từ tục đã thống nhất trên các luồng nội dung đi qua backend SkillHub. Giai đoạn 2 cho Admin quản lý và áp dụng bộ quy tắc qua API mà không cần triển khai lại. Phạm vi thay đổi chỉ gồm `services/api` và tài liệu.

**Kiến trúc** — Bộ dò từ khóa ở backend độc lập với chế độ AI hiện có. Mỗi luồng nghiệp vụ dùng cùng một bộ dò và vẫn sở hữu trạng thái phát hành của mình. Giai đoạn 2 lấy bộ quy tắc có phiên bản từ `SystemConfiguration` và dùng cùng bộ dò cho cả bản nháp thử nhanh lẫn chính sách đang áp dụng.

**Công nghệ** — NestJS, TypeScript, PostgreSQL/Prisma, worker lưu trữ, Tesseract và Swagger/OpenAPI.

**Căn cứ** — Yêu cầu trong trao đổi ngày 2026-11-21 và [kế hoạch kiểm duyệt hiện có](2026-11-20-content-moderation.md). Đối chiếu với [danh mục luồng văn bản](../../../services/api/docs/content-moderation-text-surfaces.md) và [hướng dẫn triển khai media](../../../services/api/docs/content-moderation-rollout.md).

## Phạm vi và tiêu chí chấp nhận

- Seed mặc định chặn toàn bộ 18 mẫu đã nêu: `địt mẹ`, `đụ má`, `đù má`, `đéo`, `vãi lồn`, `mày ngu`, `đồ ngu`, `ngu như chó`, `câm mõm`, `ngu`, `đù`, `vãi`, `vcl`, `vl`, `du ma`, `dit me`, `đ.m`, `đ*t mẹ`. Với `ngu`, `đù`, `vãi`, `vcl`, `vl` đứng riêng, kế hoạch áp dụng mức chặn theo yêu cầu mới. `VL` đứng riêng cũng khớp kể cả khi người viết dùng với nghĩa khác.
- Bao phủ nội dung tự nhập khi gửi, cập nhật, phát hành, khôi phục công khai hoặc chia sẻ lại bản nháp: chat thường, Yêu cầu học, hồ sơ, kỹ năng chia sẻ và bằng chứng kỹ năng, yêu cầu tag, đề xuất học, lộ trình, lịch/buổi học, đánh giá, tài liệu, tên tệp và chữ trích xuất từ tệp người dùng tải lên. Phạm vi áp dụng là các trường người dùng nhập để chia sẻ. Chặn ở backend qua mọi client gọi các API tương ứng.
- Chat trong phòng học LiveKit hiện đi qua RTC data trực tiếp giữa các client. Giữ nguyên quyền gửi hiện hành để các client vẫn dùng được chat trong phòng. Việc chặn luồng đó cần thay đổi cách client gửi, nên nằm ngoài tiêu chí nghiệm thu backend-only.
- Tin nhắn trao đổi trong case chịu bộ lọc. Đề xuất giữ quyền gửi report đúng hạn và nộp trích dẫn/bằng chứng nguyên bản qua luồng Intake, lưu trong phạm vi case. Đánh dấu bản có từ cấm cho Staff, giữ chúng ngoài các kênh công khai hoặc bản sao gửi bên ngoài case. Cần xác nhận riêng nếu sản phẩm muốn chặn cả tư liệu nộp để tố cáo.
- Ảnh/PDF dùng chữ OCR tiếng Việt và Anh; TXT dùng nội dung văn bản. Tệp thuộc đường chia sẻ nhưng lỗi trích xuất, vượt giới hạn hoặc có định dạng chưa đọc được thì giữ chờ. Office hiện thuộc diện này; xác nhận tác động tới các tệp đính kèm/tài liệu Office trước khi bật trên production. Bộ lọc kiểm thử 100% danh sách và các biến thể đã định với chữ nhận dạng được. Tiếng nói, video, chữ OCR bỏ sót và dữ liệu đã công bố trước ngày áp dụng không thuộc cam kết này.
- Giai đoạn 1 hoạt động cả khi OpenAI tắt, ở `observe` hoặc mất kết nối. Giữ quy tắc liên hệ trong chat, quy tắc Yêu cầu học hiện có và hợp đồng lỗi hiện hành. Tái sử dụng `CONTENT_MODERATION_BLOCKED`; luồng có bước duyệt dùng trạng thái nghiệp vụ hiện có nếu trạng thái đó ngăn phát hành nội dung vi phạm.
- Giai đoạn 2 dùng một cấu hình toàn cục. Phiên bản mới có hiệu lực cho yêu cầu mới sau khi API cập nhật trả thành công và cho nội dung đang chờ ở lần kiểm tra phát hành tiếp theo. Không quét lại dữ liệu đã phát hành. Giữ hành vi của lần gửi đã hoàn tất khi retry cùng mã, kể cả khi policy vừa đổi.

## Trọng tâm kiểm tra

1. Dấu tiếng Việt, biên từ và chữ viết tắt có nghĩa hợp lệ được kiểm ở đầu việc 1.
2. AI tắt hoặc mất kết nối và report trích dẫn từ cấm được kiểm ở đầu việc 2.
3. Tệp cũ chờ chia sẻ, OCR lỗi và thay generation/checksum giữa các job được kiểm ở đầu việc 3.
4. Phiên bản cũ trong job đang chạy, áp dụng qua nhiều instance và hai Admin cập nhật đồng thời được kiểm ở đầu việc 4.

## Giai đoạn 1 — Bộ quy tắc mặc định và chặn phát hành

### 1. Bộ dò và bộ mẫu chuẩn

**Tệp dự kiến** — Tạo `services/api/src/modules/content-moderation/domain/profanity-policy.ts`, `services/api/test/content-moderation/profanity.test.mjs` và `services/api/test/content-moderation/fixtures/profanity-vi.json`.

- [ ] Trong fixture, đặt toàn bộ 18 mẫu ở mục phạm vi thành `BLOCK`. Đặt `ĐÙ MÁ!`, dạng Unicode phân rã của `đù má`, `đù...má`, chữ ngăn bởi ký tự vô hình và cụm nằm giữa một câu thành `BLOCK`. Đặt `ngủ`, `ngũ`, `đụng`, `vải`, `đậu` và `AVLT` thành `ALLOW`. Đặt `VL` đứng riêng thành `BLOCK`. Kiểm thử các field khác nhau không bị ghép thành một cụm.
- [ ] Chạy từ `services/api` sau khi build: `node --test test/content-moderation/profanity.test.mjs`. Xác nhận test đỏ trước khi thêm bộ dò.
- [ ] Định nghĩa `ProfanityRule = { id: string; term: string; aliases: string[]; enabled: boolean }` và `matchProfanity(text: string, rules: readonly ProfanityRule[]): { ruleId: string } | null`. Chuẩn hóa Unicode NFC, chữ thường, bỏ ký tự vô hình; dò theo biên từ Unicode và cho phép dấu phân cách được hỗ trợ giữa các từ. Giữ dấu tiếng Việt, khai báo từng alias không dấu hoặc che ký tự như `du ma`, `dit me`, `đ.m`, `đ*t mẹ`. Coi ký tự trong `term` và `aliases` là chữ/ký hiệu literal. Mỗi rule enabled đều chặn. Giữ bản gốc để lưu hoặc trả về cho người gửi theo hợp đồng hiện hành.
- [ ] Chạy lại test bộ dò; yêu cầu tất cả mẫu và phản ví dụ đạt.

### 2. Gắn vào mọi đường ghi văn bản và xử lý riêng luồng báo cáo

**Tệp bắt đầu** — Trong `services/api/src/modules`, xem `content-moderation/application/content-moderation.service.ts`, `content-moderation/application/text-moderation.ts`, `conversations/application/services/conversations.service.ts` và các owner trong danh mục luồng đã dẫn. Với Report, xem `reports/application/services/case-messages.service.ts`, `reports.service.ts` và `report-content-moderation.ts` cùng thư mục. Test trong `services/api/test/content-moderation/surfaces.test.mjs` và các suite nghiệp vụ tương ứng.

- [ ] Rà các API create/edit, publish/restore, ingress của outbox và trường text thật ở từng surface. Ghi route, field, hành vi từ chối và test tương ứng vào danh mục luồng. Kiểm tra trường tiêu đề/mô tả trên tài liệu, đính kèm cũ chuẩn bị chia sẻ lại, và bằng chứng kỹ năng. Kiểm tra đường nào đang bỏ qua cả moderation khi AI `off` hoặc `observe`.
- [ ] Viết ca kiểm thử gọi đường ghi từ app/API với bộ từ mặc định. Mỗi surface có ít nhất một ca bị chặn và một ca được phép; chat có đủ 18 mẫu. Với AI `off`, `observe` và provider timeout, yêu cầu nội dung trùng từ cấm vẫn dừng. Kiểm tra không tạo bản công khai, không phát sự kiện cho người nhận, không trao uy tín ngoài quy trình và replay của thao tác hoàn tất vẫn nhất quán.
- [ ] Gọi bộ dò từng field trước khi áp chế độ AI. Với luồng ở chế độ `observe`, chỉ kết quả AI được quan sát, còn từ khóa vẫn chặn. Tận dụng receipt/version check hiện có ở chat, profile, nội dung publish và các thao tác transactional. Log dùng mã lý do, ID quy tắc và phiên bản.
- [ ] Gắn bộ dò cho tin nhắn trao đổi trong case. Báo cáo và evidence Intake xác nhận hợp lệ trước, ghi nhận kết quả vào metadata giới hạn quyền, giữ nguyên thời điểm nộp, bằng chứng và quy tắc tranh chấp. Test report trích nguyên câu chửi vẫn tạo case đúng hạn và bên không có quyền không đọc được bản gốc.
- [ ] Xây dựng API rồi chạy `node --test test/content-moderation/*.test.mjs` từ `services/api` cùng `test:connections`, `test:learning-request`, `test:learning-platform`, `test:learning-sessions`, `test:skills`, `test:materials` và `test:report-support`. Yêu cầu tất cả ca kiểm tra liên quan đạt.

### 3. Tệp và ảnh

**Tệp bắt đầu** — `services/api/src/modules/content-moderation/application/media-moderation.service.ts`, `services/api/src/infrastructure/storage/file-content-moderation.ts`, `file-attachment.service.ts` và `users/application/use-cases/process-avatar.use-case.ts`. Test `test/content-moderation/media.test.mjs`, `media-extractor.test.mjs` và suite tệp.

- [ ] Viết ca cho ảnh/PDF OCR có đúng từ seed, tên tệp tục, TXT có từ tục, ảnh sạch, ảnh có chữ nhưng OCR lỗi, Office, tệp đã `READY` nhưng kiểm duyệt ở phiên bản cũ trước lần chia sẻ mới và tệp thay generation/checksum giữa các job. Kiểm thử OCR thật ít nhất một ảnh tiếng Việt và một PDF trên image worker staging.
- [ ] Chạy bộ dò với tên tệp và chữ trích xuất độc lập với AI, kể cả khi bước phân loại hình bị lỗi hoặc được tắt. Dò phần văn bản đã kiểm tra độ dài **trước khi** chia thành đoạn gửi provider. Giữ kết quả hợp lệ theo generation, checksum và phiên bản policy. Khi dùng một tệp chưa đủ kết quả hoặc tệp có phiên bản cũ để chia sẻ mới, lên lịch kiểm tra lại có chống trùng và giữ thao tác ở trạng thái chưa gửi tới khi đạt. Để các reader dữ liệu đã phát hành giữ hợp đồng hiện có.
- [ ] Mở lại upload rồi thử gửi/đăng bằng đường bình thường. Tệp sạch đủ điều kiện thành `READY`, tệp cấm thành `REJECTED`, tệp không thể đọc/kiểm tra nằm ở trạng thái giữ chờ. Chạy `test:files` và bộ `test/content-moderation`; kiểm tra đường nhận tệp và ảnh đại diện.

## Giai đoạn 2 — Admin quản lý và áp dụng cấu hình

### 4. Cấu hình có phiên bản và áp dụng trên mọi instance

**Tệp bắt đầu** — `services/api/src/modules/system-configuration/domain/configuration.catalog.ts`, `configuration.repository.ts`, pattern từ `learning-request-moderation-rules.use-case.ts`, `services/api/src/shared/authorization/permission.catalog.ts`, và module `content-moderation`. Tách phần đọc cấu hình khỏi module phụ thuộc Identity nếu cần để tránh vòng phụ thuộc.

- [ ] Thêm key `contentModeration.profanityRuleSet` và seed idempotent từ giai đoạn 1, chỉ thêm bản mặc định khi key chưa tồn tại. Đăng ký quyền `content-moderation:configure` cho Admin, dùng role Admin và quyền này cho đọc, thử, áp dụng và hoàn tác. Giữ API cấu hình Learning Request theo contract hiện hành.
- [ ] Thêm `GET/PUT /api/v1/admin/content-moderation/profanity-rules`, `POST …/preview`, `GET …/revisions`, `POST …/rollback`. `PUT` nhận `{ expectedVersion, rules, reason }`. Preview nhận bộ nháp và câu mẫu, trả quyết định, rule khớp và mẫu seed thay đổi kết quả. Rollback nhận `{ expectedVersion, targetVersion, reason }` và ghi thành phiên bản mới. Giới hạn API là 250 quy tắc, 20 biến thể mỗi quy tắc, 120 ký tự mỗi cụm, 4.000 ký tự mỗi câu thử. Phát hiện trùng sau chuẩn hóa, từ chối chuỗi rỗng và khớp mọi cụm theo nghĩa literal.
- [ ] Tái sử dụng cập nhật theo phiên bản, audit và revision trong một transaction. Nếu phiên bản đã đổi, trả `409`; request nháp có thể chỉnh và gửi lại với `expectedVersion` đã cập nhật. Audit lưu người sửa, thời điểm, lý do và thay đổi rule. Loại câu dùng thử khỏi log. Sau commit, trả bộ quy tắc kèm `version` và `effectiveAt`.
- [ ] Mỗi lần kiểm tra mới đọc phiên bản đã commit trên DB chính. Chỉ cache dữ liệu đã biên dịch theo phiên bản, không dùng TTL để trì hoãn đọc phiên bản hoặc tự quay về seed khi lỗi đọc cấu hình. Trong chế độ cấu hình Admin, lỗi đọc trả lỗi tạm thời hoặc giữ job để thử lại. Luồng phát hành sau khi xử lý nền recheck policy version trước khi phát. Deploy seed và quyền trước khi bật reader mới.
- [ ] Dùng hai instance API và một worker trên test/staging. Áp dụng cụm thử “bài tập cá tím”; sau phản hồi thành công, gửi qua instance khác vào chat, hồ sơ, đánh giá và ảnh OCR phải bị chặn. Tắt rule, áp dụng, xác nhận các lần gửi mới không còn bị rule đó chặn. Test thêm rollback, `409`, quyền Staff/User, thiếu cấu hình, audit và retry đã hoàn tất. Chạy `test:configuration`, `test:configuration:integration`, `test:rbac` và bộ moderation.

### 5. Hướng dẫn và nghiệm thu Admin qua API

**Tệp bắt đầu** — Controller, DTO, response schema của API Admin và `services/api/docs/content-moderation-rollout.md`.

- [ ] Đưa ví dụ vào Swagger cho luồng `GET` bản đang áp dụng → `POST preview` tùy chọn → `PUT` áp dụng. Một `PUT` có thể thêm, sửa, bật/tắt nhiều quy tắc trong cùng phiên bản. Preview trả danh sách mẫu khớp, số mục thêm/sửa/tắt và vị trí mục lỗi hoặc trùng để người vận hành sửa payload.
- [ ] Hướng dẫn dùng Swagger hoặc HTTP client với quyền Admin. Có ví dụ lấy danh sách, thêm nhiều cụm, thử câu, đọc `version`/`effectiveAt`, xem lịch sử và hoàn tác. Kiểm tra `GET` ngay sau `PUT` đọc được phiên bản mới; Staff/User nhận `403`; hai Admin gửi cùng `expectedVersion` chỉ một lần thành công.
- [ ] Chạy API lint, type-check và build. Chạy bộ kiểm duyệt và bộ kiểm thử API Admin đã nêu sau khi build.

## Nghiệm thu theo giai đoạn

| Giai đoạn | Đầu ra cần chứng minh |
| --- | --- |
| 1 | 18/18 mẫu seed bị chặn, kể cả khi AI tắt. Có ca trên đường ghi thật cho mọi luồng thuộc phạm vi và OCR tiếng Việt trên worker. Mẫu hợp lệ được gửi. Report đúng hạn vẫn tiếp nhận bằng chứng theo quyền. |
| 2 | Admin có thể thử, cập nhật nhiều rule một lần, xem lịch sử và hoàn tác qua API. Quy tắc mới chặn nội dung ngay ở request kế tiếp trên nhiều instance. Ảnh/TXT chờ chia sẻ được kiểm lại nếu phiên bản đã đổi. Xung đột trả `409` và hoàn tác tạo phiên bản có audit, không cần restart. |
