# Quy trình phát triển mobile

Quy trình này thay Spec Kit mobile theo quyết định người dùng trong yêu cầu migration. Không khôi phục tooling từ archive để chọn việc. Backend có quy trình riêng.

Đọc theo [bản đồ docs](README.md), tiếp tục [work](work/README.md) được người dùng yêu cầu; [contributing](contributing.md) sở hữu setup/commands.

## 1. Chọn mức tài liệu theo công việc

| Loại việc                                             | Tài liệu cần thiết                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sửa typo, spacing, nhãn, lỗi nhỏ có hành vi rõ        | Làm trực tiếp, chạy kiểm tra phù hợp, cập nhật tài liệu bị ảnh hưởng nếu có  |
| Một màn hoặc luồng nhỏ trong feature đang làm         | Cập nhật plan/status đang có; tạo work chỉ khi cần theo dõi qua nhiều phiên  |
| Luồng nhiều màn, state machine mới, tích hợp API      | Work riêng với plan và status                                                |
| Auth, quyền riêng tư, upload/recovery, Wallet/Payment | Làm rõ contract, ca lỗi, lifecycle và bằng chứng cần có trước khi triển khai |
| Quyết định kiến trúc đáng kể, đổi công nghệ           | ADR ngắn và kế hoạch ảnh hưởng/kiểm chứng                                    |

Không bắt tạo phase, spec, ADR hoặc review gates cho mọi task nhỏ. Không bắt buộc TDD cho chỉnh sửa nội dung/trình bày thuần túy. Với lỗi logic, concurrency, auth và payment/recovery, ưu tiên test tái hiện lỗi hoặc test hành vi trước khi sửa khi thực hiện được.

## 2. Vòng làm việc

1. Đọc yêu cầu người dùng, docs liên quan và source hiện tại.
2. Xác định thiết kế, contract, phạm vi và điều kiện nghiệm thu đủ cho việc đang làm.
3. Với việc lớn, ghi task ngắn và dependency trong plan. Với việc nhỏ, dùng mô tả công việc hiện tại.
4. Triển khai từng lát cắt có thể kiểm chứng; tận dụng component/runtime đang có.
5. Kiểm tra hành vi bị ảnh hưởng và consumer liên quan khi có thay đổi shared code.
6. Cập nhật hiện trạng, kết quả, phần chưa kiểm chứng và bước tiếp theo.

Không bắt làm toàn bộ UI fixture trước rồi mới đọc API. Contract và ca lỗi được xét từ đầu. Preview fixture được dùng khi cần, có nhãn rõ và không âm thầm thay thế API thất bại.

## 3. Trạng thái công việc

Trạng thái work:

- `Todo`: phạm vi đã ghi, chưa bắt đầu.
- `In progress`: đang triển khai.
- `Blocked`: mục tiêu hiện tại không thể tiếp tục vì dependency cụ thể.
- `Ready for review`: phạm vi triển khai và kiểm tra đã khai báo đủ để xem xét.
- `Done`: thỏa tiêu chí của phạm vi đã thống nhất và nêu rõ giới hạn còn lại.

Đồng thời có mục **nghiệm thu người dùng** riêng: không yêu cầu / chưa thực hiện / đã đạt / cần sửa, theo bằng chứng xác nhận thật.

Không dùng `Done` để che việc thiếu native hoặc real-API acceptance vốn nằm trong tiêu chí của work. Nếu chỉ hoàn thành phần source, ghi “source complete; acceptance pending”. Nếu chỉ một phần bị chặn, ghi phần đó và tiếp tục phần độc lập.

`work/README.md` chỉ liệt kê work và link tới status chính; không lặp lại bảng số test hay nhiều cột trạng thái cần cập nhật đồng thời.

## 4. Thiết kế và UI

- Dùng thiết kế SkillHub do người dùng cung cấp. Repo hiện có nguồn từ Complete SkillHub Product Design/Figma Make; xác minh nguồn/frame áp dụng cho công việc.
- Giữ theme, font, shared components và quy ước tương tác hiện tại khi chưa có yêu cầu thay đổi.
- Nếu chưa có thiết kế mới, có thể sửa lỗi hoặc tái sử dụng pattern hiện hữu trong phạm vi đã yêu cầu. Không chặn mọi công việc vì thiếu bản thiết kế mới.
- Nếu phải quyết định bố cục hoặc hành vi sản phẩm mới mà yêu cầu chưa đủ, hỏi đúng phần thiếu; tiếp tục phần không phụ thuộc.
- Ghi nguồn thiết kế/frame/link vào plan; chỉ tạo `references/` khi có file cần lưu.
- Loading/empty/error/success, keyboard, accessibility và Back navigation được xét theo màn/luồng thực tế.
- Animation mới phải có mục đích, hợp với pattern hiện có và tôn trọng reduced motion. Thư viện mới hoặc thay đổi lớn được đánh giá riêng; không dùng ngưỡng thời gian tùy ý làm cổng duyệt cho mọi chuyển động.

## 5. API và nghiệp vụ SkillHub

- Route giữ mỏng; feature xử lý UI/hooks/adapters theo cấu trúc hiện có.
- Dùng HTTP client, session, token storage và query infrastructure hiện tại.
- Validate dữ liệu bên ngoài tại boundary phù hợp, theo schema/contract; không dùng type cast để giả lập dữ liệu đã hợp lệ.
- Giữ private cache theo owner/session và không để kết quả cũ cập nhật phiên mới.
- Backend quyết định quyền, chuyển trạng thái nghiệp vụ, số dư, ledger, settlement và kết quả thanh toán.
- Client không tự cộng Credit, tự coi callback/URL/QR là đã thanh toán hoặc tự suy ra trạng thái thành công.
- Giữ idempotency, recovery, duplicate-submit guard và lifecycle theo contract hiện hành. Không tự replay mutation khi reconnect/background/foreground.
- Contract chưa có hoặc backend chưa sẵn sàng: ghi dependency và trạng thái unavailable rõ ràng; không đoán endpoint hoặc âm thầm dùng fixture ở luồng thật.
- SSE/polling/refetch dùng theo contract và policy của domain, không áp quy tắc của một feature lên toàn app.

Những điểm nghiệp vụ cần đặc biệt bảo toàn, đối chiếu SRS hiện hành khi làm việc liên quan:

- `TWO_WAY` và `ONE_WAY` có cấu trúc LearningPlan và luồng Credit khác nhau.
- Lịch xác nhận cùng version; completion và settlement theo quy tắc backend, không suy ra từ UI.
- Credit/withdrawal, privacy hồ sơ và evidence, verification chuyên môn và malware scan có phạm vi/trạng thái khác nhau.
- Không đưa Google Play billing, subscription hoặc activation code từ Memora vào SkillHub nếu sản phẩm không có yêu cầu tương ứng.

## 6. Kiểm tra và bằng chứng

Commands từ root, xác nhận scripts thực tế trước khi chạy:

```powershell
pnpm --filter mobile lint
pnpm --filter mobile check-types
pnpm --filter mobile check-structure
pnpm --filter mobile test
```

- Chọn checks phù hợp với thay đổi; thay đổi logic/tích hợp đáng kể cần focused tests và các checks workspace liên quan.
- Không tự thêm `test:e2e`, `format:check` hoặc test framework vào package chỉ vì template có nhắc.
- Chạy build/export/native test khi mục tiêu thay đổi cần đến và môi trường có sẵn; ghi rõ không chạy khi thiếu môi trường.
- Web preview có ích để xem UI nhưng không thay Android/iOS acceptance.
- Ghi test suite, số passed/failed/skipped khi có, thời điểm và phạm vi môi trường. Không dùng tổng số test thay cho kết luận về luồng nghiệp vụ.
- Nếu dùng `evidence/`, chỉ giữ bằng chứng cần chia sẻ, đã loại secrets/PII. Log lớn hoặc artifact tạm có thể giữ cục bộ, nhưng status phải ghi nơi lưu và giới hạn truy cập.
- Không tạo link mới tới file không tồn tại. Bằng chứng lịch sử đã mất được ghi là không còn khả dụng; không tái tạo hoặc giả nhận đã xem.
- Không commit dữ liệu test chứa credentials, payment identifiers nhạy cảm hoặc thông tin tài khoản thật.

Definition of Done cho từng phạm vi:

- Hành vi đáp ứng tiêu chí đã ghi và source phù hợp contract.
- Checks liên quan đạt hoặc phần chưa chạy được nêu rõ, không mâu thuẫn tiêu chí nghiệm thu.
- Không có fixture fallback âm thầm ở luồng thật, không lộ dữ liệu riêng tư.
- Loading/error/retry/navigation/lifecycle liên quan được xử lý.
- Docs hiện hành và status đúng với phần vừa thay đổi.
- Phần cần nghiệm thu người dùng được phân biệt, không tự nhận đã được duyệt.

## 7. Cập nhật trạng thái và nhật ký

- Phần “Hiện trạng” trong `status.md` được viết lại để phản ánh đúng tình hình mới nhất. Không giữ nhiều đoạn cùng tự nhận là “Current” nhưng mâu thuẫn nhau.
- Nhật ký cuối file ghi theo phiên làm việc hoặc mốc thay đổi đáng kể; không bắt một entry cho mỗi thao tác/file/task nhỏ.
- Không sửa lịch sử để làm mất giới hạn hoặc biến kết quả cũ thành kết quả mới. Ghi đính chính khi cần.
- Thời điểm dùng múi giờ Việt Nam, ISO 8601 có offset `+07:00`. Lấy từ đồng hồ hệ thống/công cụ, không tự dựng thời gian.
- Trên PowerShell có thể dùng `(Get-Date).ToUniversalTime().AddHours(7).ToString('yyyy-MM-ddTHH:mm:ss') + '+07:00'`.
- Không bắt đăng nhập GitHub để viết docs hoặc làm việc cục bộ. Danh tính `gh` không tự chứng minh người trong chat đã phê duyệt.
- Nếu có quyết định người dùng, ghi nguồn xác nhận thực tế và thời điểm biết được; không suy đoán login hoặc tự tạo lời duyệt.

## 8. ADR và khi nào cần hỏi

ADR chỉ cho quyết định có tác động đáng kể: đổi stack, thư viện quan trọng, boundary, auth/storage/recovery strategy hoặc contract công khai.

- Không tạo sẵn hàng chục ADR cho toàn bộ hiện trạng.
- Quy ước đã có được mô tả trong architecture; không giả lập lịch sử phê duyệt.
- Đề xuất chưa được chấp thuận ghi `Proposed`; chỉ ghi `Accepted` khi có xác nhận thật hoặc nguồn quyết định đã được kiểm chứng.
- Quyết định thay thế phải chỉ rõ ADR nào bị supersede và phạm vi nào. Không dùng quy tắc “ADR mới hơn tự động thắng” để giải quyết mọi mâu thuẫn.
- Không khóa hàng loạt component, route, config bằng yêu cầu ADR cho mọi lần sửa. Đánh giá theo tác động thực tế của thay đổi.

Hỏi khi:

- Nghiệp vụ hoặc tiêu chí nghiệm thu thiếu rõ ràng, không thể suy ra từ nguồn hiện hành.
- Thiết kế mới có quyết định sản phẩm quan trọng chưa được cung cấp.
- SRS, contract và quyết định người dùng mâu thuẫn mà không xác định được cách xử lý.
- Cần mở rộng phạm vi sang backend/shared package chưa được yêu cầu.
- Cần quyết định kiến trúc/công nghệ lớn nằm ngoài phạm vi đã thống nhất.
- Cần thao tác bên ngoài, triển khai, giao dịch thật hoặc thay đổi dữ liệu có tác động mà chưa được cho phép.

Không hỏi lại cho quyết định đã được người dùng cho phép trong phiên. Không dừng toàn bộ vì một chi tiết không ảnh hưởng phần còn lại. Nêu rõ câu hỏi đang chặn việc gì.

## 9. Git và quyền thực hiện

- Áp dụng quy tắc root: `<type>/<short-kebab-name>`, không thêm numeric spec prefix. Ví dụ `feat/mobile-wallet`, `fix/mobile-back-navigation`, `docs/mobile-workflow`.
- Reuse branch nếu cùng phạm vi; không tự tạo mỗi work một branch khi không cần.
- Conventional Commits, scope `mobile` cho thay đổi chỉ thuộc mobile. Root hoặc nhiều workspace theo quy tắc root.
- Không khởi tạo nested Git, không tạo Spec Kit numbered branches.
- Chỉ stage/commit/push/PR/merge/deploy khi có yêu cầu hoặc quyền đã được xác lập cho thao tác đó. Quy tắc đặt tên không tự cấp quyền.
- Giữ hooks; không bypass để che lỗi. Khi được yêu cầu tạo PR, mô tả hành vi thay đổi, bằng chứng và giới hạn nghiệm thu.

---

## Tổ chức phase theo kết quả

- Một phase thường là một luồng người dùng qua nhiều màn hoặc một hạng mục hạ tầng thật sự độc lập. Không mặc định một module backend bằng một phase.
- Phase có thể hoàn thiện phần source đã có hoặc nối API cho UI đang có; không mặc định xây từ đầu.
- Một feature có thể qua nhiều phase nhỏ; một phase có thể đi qua nhiều feature khi cần hoàn thành một luồng có ý nghĩa.
- Bug nhỏ/đổi copy/spacing không bắt buộc thành phase. Dùng work ngắn hoặc task trong phase đang liên quan.
- Phase numbering chỉ để tổ chức tài liệu, không quyết định dependency, không đổi spec IDs cũ hoặc branch naming.
- Sau migration, không dùng `.specify/feature.json` để tự chọn việc. `work/README.md` ghi work đang tiếp tục và resume link theo chỉ đạo người dùng.

Tên thư mục: `docs/work/phase-<NN>-<flow-slug>/`, ví dụ `phase-03-wallet-topup`. Số và tên ban đầu là đề xuất roadmap, có thể điều chỉnh trước khi triển khai; tránh renumber khi đã có lịch sử.

## Nội dung bắt buộc của phase lớn

Trong `plan.md`:

1. Kết quả mong muốn, vai trò người dùng và điểm vào/điểm kết thúc luồng.
2. Yêu cầu, thiết kế, contract và quyết định liên quan có link nguồn.
3. Baseline: source/UI/API đã có, những gì cần giữ, các vấn đề còn thiếu.
4. Phạm vi sửa và ngoài phạm vi; phần cần backend hoặc quyết định chưa có.
5. Bảng sub-phase/task, dependency và tiêu chí hoàn thành.
6. Ma trận trạng thái/ca lỗi cần kiểm tra, kể cả session/lifecycle/privacy khi liên quan.
7. Kế hoạch checks và môi trường nghiệm thu: source/fixture/web/real API/native.
8. Nợ kỹ thuật có chủ đích, phương án rollback khi có thay đổi đáng kể, phần người dùng cần nghiệm thu.

Trong `status.md`: trạng thái hiện hành, bằng chứng đã có, mốc review, blocker và đúng bước tiếp theo. Không copy lại toàn bộ checklist task từ plan.

## Sub-phase chuẩn để lựa chọn theo công việc

Không bắt mọi phase có đủ các sub-phase sau. Gộp/bỏ mục không áp dụng với một dòng lý do trong plan. Contract audit phải diễn ra trước khi chọn giải pháp phụ thuộc API; không để đến cuối mới phát hiện không có endpoint.

| Mốc                            | Mục tiêu và output                                           | Điều kiện xem là hoàn tất                                                                       |
| ------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| S01 — Baseline & Contract      | Đọc source, yêu cầu, API, thiết kế; lập gap và scope         | Nguồn đúng phiên bản, giới hạn rõ, ca lỗi chính được nhận diện                                  |
| S02 — UI Foundation            | Xác định reusable controls/token/layout/assets cần cho luồng | Reuse được chỉ rõ; thay đổi shared có consumer impact; không tự đổi design system               |
| S03 — Screen Slices            | Triển khai từng màn/lát cắt cùng state và adapter cần thiết  | Mỗi phần có hành vi kiểm chứng, fixture/real được phân biệt                                     |
| S04 — Navigation & Lifecycle   | Nối luồng, Back/deep link, focus/background/session handling | Không duplicate navigation/dispatch, không cập nhật phiên sai                                   |
| S05 — Integration & Edge Cases | Hoàn thiện API, errors, concurrency, retry/recovery          | Contract đúng, negative cases đạt trong môi trường được khai báo                                |
| S06 — Verification & Cleanup   | Chạy checks phù hợp, UI evidence, dọn phần do phase tạo      | Không còn blocker trong phạm vi đã cam kết; bằng chứng và giới hạn rõ                           |
| S99 — Review & Acceptance      | Review kết quả, thực hiện UAT theo phạm vi                   | Tiêu chí đạt; phần native/API/UAT còn thiếu được xử lý hoặc phạm vi được điều chỉnh có xác nhận |

S03 và S05 có thể làm theo từng lát cắt liên tiếp: một màn + API + lỗi + kiểm chứng rồi sang màn tiếp. Không bắt S03 chỉ có fixture và không cho API code.

Task ID mới có thể dùng `P03-S04-T02`. Task chuyển từ Spec Kit giữ tham chiếu như `spec005/T025`; không đổi ID lịch sử hoặc tạo checkbox trùng cho cùng kết quả ở nhiều file.

Không bắt task hoàn toàn tuần tự khi chúng độc lập. Parallel work chỉ dùng khi môi trường và quyền điều phối cho phép, không tự tạo agent/chat hoặc nhánh ngoài nhu cầu đã được cho phép.

## Các mốc review và quyền nghiệm thu

Ba loại kết quả phải phân biệt:

- **Technical review:** source/contract/logic và checks phù hợp đã được xem xét.
- **UI review:** các màn/trạng thái/navigation đã được đối chiếu thiết kế/pattern.
- **Product/native acceptance:** luồng đã được người dùng hoặc người kiểm thử xác nhận trên môi trường cần thiết.

Không bắt chủ dự án duyệt riêng mỗi màn, mỗi task hoặc từng lần đổi token. Với phase lớn, mặc định chuẩn bị kết quả review và một kịch bản UAT rõ ở cuối; thêm mốc duyệt giữa chừng nếu có quyết định quan trọng hoặc người dùng yêu cầu.

- Agent tự kiểm tra và ghi kết quả kỹ thuật với bằng chứng; không tự viết lời phê duyệt thay người dùng.
- “Ready for review” không có nghĩa đã được owner chấp thuận, đã deploy hoặc đã chuyển tiền thành công.
- Nếu UAT thuộc tiêu chí phase, không đóng phase trước khi đạt hoặc có quyết định điều chỉnh phạm vi được ghi nhận.
- Nếu yêu cầu chỉ là implementation/source, có thể kết thúc đúng phạm vi đó và ghi rõ acceptance ngoài phạm vi; không tự biến nó thành cam kết end-to-end.
- Review cần cụ thể theo tiêu chí, không bắt sinh một bộ tài liệu mới cho mỗi lần sửa lỗi review.
- Nếu có reviewer riêng theo yêu cầu hoặc cơ chế được phép, reviewer nhận scope/design/contract/diff/evidence cần thiết và không coi lời tác giả “đã pass” là bằng chứng độc lập.

## Tiếp tục một phase

Khi người dùng yêu cầu triển khai về sau:

1. Đọc `docs/README.md`, `workflow.md`, work/phase được yêu cầu và contract/guide liên quan. Không đọc toàn bộ repo mỗi lần sửa một file.
2. Kiểm tra Git status/source mới nhất để tránh dùng baseline đã cũ. Tiếp tục trên công việc đang có, không regenerate plan hoặc xóa history.
3. Đọc “bước tiếp theo” và blocker trong status; xác minh dependency đã đổi hay chưa bằng nguồn thích hợp.
4. Chọn sub-phase/task cần làm, xác định checks cho chính thay đổi đó.
5. Triển khai, kiểm chứng, cập nhật task trong plan và hiện trạng trong status, ghi nhật ký theo mốc.
6. Kết thúc mỗi phiên bằng kết quả, giới hạn và hành động tiếp theo có thể thực hiện. Không coi việc viết plan hoặc mở PR là chứng minh feature hoàn thành.

## Mẫu dùng khi cần

[Plan](work/_template/plan.md), [status](work/_template/status.md), [ADR](adr/template.md). [Roadmap](roadmap.md) không cấp quyền bắt đầu coding hoặc thay công nghệ.
