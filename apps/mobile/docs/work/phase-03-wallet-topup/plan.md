# Phase03 Wallet và Top-up

## Mục tiêu và phạm vi hiện hành

Tiếp tục trên nhánh `feat/mobile-wallet-payment-history`, baseline `0b973ba64e70393f2212f7ffdf84088f39f9f9fd`. User đã giao review và hoàn thiện Phase03 trên checkout này ngày 2026-10-20. Phần mô tả migration bên dưới giữ làm lịch sử, không còn mô tả source hiện tại.

User đã đăng nhập đi từ Home/Profile đến Wallet, xem Available/Held, lịch sử và chi tiết; trên native nhập VND, xác nhận một ý định nạp, nhận QR, theo dõi kết quả backend rồi về ví/lịch sử. Native recovery giữ đúng identity khi lỗi; web có owner reads nhưng không tạo payment.

Chỉ sửa `apps/mobile`. Backend đọc để xác minh API; không triển khai Hold/settlement, material purchase, admin adjustment, cash-out, production activation hoặc giao dịch thật. Không thay stack, schema storage, theme hay shared runtime toàn app.

## Cập nhật theo BE dev — 2026-10-22

User yêu cầu cập nhật phase và triển khai theo BE. Baseline đối chiếu là Git ref `dev`/`origin/dev` tại `1c8fb8d9398480d62505d361c36bc11584c1e443`, không phải backend cũ trong checkout mobile `0b973ba`. Đọc bằng `git show`, không checkout/merge hoặc sửa BE. Commit `c8954db` thêm cancel; `2dd5772` bổ sung recovery cho checkout lỗi. Source Git này chưa chứng minh API triển khai có cùng revision/migrations.

| Task | Phạm vi và tiêu chí | Trạng thái |
| --- | --- | --- |
| P03-BE-T01 | Đồng bộ contract `POST /payments/:paymentId/cancel`, `CANCELLED`, `PAYMENT_RECOVERY_PENDING`, ghi baseline riêng | Đã xong source/docs |
| P03-BE-T02 | CANCELLED là terminal: UI, filter, dừng polling, QR off, resolve correlation khi đúng identity và không recovery warning | Đã xong source/tests |
| P03-BE-T03 | Hủy explicit có xác nhận trên native Payment của intent đang giữ; Bearer/idempotency/no body, cùng key theo payment ID khi retry/restart, không POST lifecycle | Đã xong source/tests |
| P03-BE-T04 | Xử lý busy/timeout/PAID/REVIEW/denial/session; không coi lỗi là đã hủy, không tạo key nạp mới; recovery pending tiếp tục đọc, không suy local expiry | Đã xong source/tests |
| P03-BE-T05 | Regression hành vi/transport/UI, full mobile checks khi dependencies cho phép; ghi evidence và giới hạn | Đã xong source verification: 535/535 tests, types/lint/structure và Android/iOS/web JS export đạt; API/native UAT giữ mở |
| P03-BE-T06 | Sửa bẫy trợ giúp: không cho báo mất identity ở draft/review; recovery yêu cầu xác nhận riêng trước supportStop, mở/đóng help không khóa coordinator | Đã xong source; focused 35/35, type/lint theo status |
| P03-UI-T01 | Dựng lại màn checkout theo ảnh HTML người dùng gửi bằng React Native; giữ theme form hiện tại; hiển thị QR, thời hạn, tiền/Credit và mã payment lấy từ Payment BE; giữ check trạng thái, hướng dẫn, cancel và kết quả hiện hữu | Đã xong source/UI preview; Android/iOS/web JS export và checks đạt |
| P03-UI-T02 | Chỉ dùng thông tin thanh toán do BE trả; kiểm tra trạng thái terminal/recovery, QR suppression, deadline presentation và bố cục màn hẹp | Đã xong source/tests và preview viewport 320/375/430; API/native UAT giữ mở |
| P03-UI-T03 | Dựng lại form Nạp Credit theo HTML reference: số dư ví, tỷ lệ BE policy, nhập/chọn nhanh, phương thức payOS, CTA cố định; giữ review → confirm → tạo QR | Đã xong source và export Android/iOS/web; palette kem/cam đất dùng chung trong nhóm màn Wallet payment, thẻ shadow nhẹ, header căn giữa, hậu tố VND và CTA gradient; app chặn mức nạp mới dưới 2.000 VND, vẫn cho khôi phục/retry cùng key bản ghi cũ theo BE; preview tổng hợp, nghiệm thu native còn mở |
| P03-UI-T04 | Rà soát và làm nhất quán luồng thanh toán: top-up, QR checkout, trạng thái, lịch sử và chi tiết giao dịch; làm rõ tổng tiền, trạng thái/action tiếp theo và giữ dữ liệu đúng contract | Đã xong source: tổng tiền và Credit theo yêu cầu lên trước QR, deadline/hướng dẫn/thông tin yêu cầu phân cấp rõ, history/detail thành thẻ gọn, success/error dùng màu ngữ nghĩa; full suite 544/544, type/lint/structure, preview bundle và Expo export Android/iOS/web đạt. UI/device UAT còn mở |
| P03-UI-T05 | Rút gọn thông tin lặp và bỏ mục trợ giúp chưa triển khai theo yêu cầu người dùng | Đã xong source: bỏ summary footer/rate lặp, heading/note thừa, hướng dẫn mở rộng và liên hệ hỗ trợ; list chỉ giữ số tiền/type/time và trạng thái cần chú ý, biến động đầy đủ ở detail. Giữ check/restore/cancel và guard recovery. Full suite 542/542, type/lint/structure và preview bundle đạt; không thêm giao dịch/API thật |
| P03-UI-T06 | Giữ note ở Ví Credit; làm lại lịch sử thành từng dòng theo tham khảo VCB Digibank và rà nội dung chi tiết cần cho người dùng | Source complete: lịch sử phẳng, ngày/giờ tách cấp, amount căn phải; chi tiết dạng biên nhận với status/time/id, biến động chính xác và số dư sau giao dịch. Ẩn operationId/UUID tham chiếu nội bộ, không bịa người nhận/phí/VND. Giữ filters, backend order, cursor/session và refresh. Full suite 548/548, type/lint/structure và JS export Android/iOS/web đạt; pixel/native UAT còn mở |
| P03-UI-T07 | Giảm phần chờ ở FE sau khi người dùng báo thanh toán cập nhật chậm 5–10 giây | Source complete: CREATED/PENDING đọc mỗi 2 giây sau request thay 5 giây; tối đa 300 lượt để giữ 10 phút thời gian chờ. REVIEW/UNKNOWN giữ 30 giây/120 lượt; errors giữ backoff; check/resume vẫn GET ngay, không mutation. Focused 41/41, full suite 552/552, type/lint/structure đạt. Provider/API/native timing chưa đo |
| P03-UI-T08 | Thu gọn Thanh toán QR theo yêu cầu: bỏ check/hướng dẫn quét, bỏ card quanh hủy, đổi màu và rà copy/bố cục | Source complete: quote/QR trước, deadline/status inline, mã thanh toán nhỏ ở cuối, hủy đỏ nhạt ngoài card và xác nhận đỏ đặc. QR kể cả blocked không có check thủ công; màn khác vẫn giữ check/restore mặc định. Polling 2 giây và cancel/recovery guards giữ nguyên. Full suite 552/552, type/lint/structure và export Android/iOS/web đạt; native/pixel UAT còn mở |
| P03-UI-T09 | Sửa nút hủy biến mất mỗi GET và thao tác hủy phải chờ request kiểm tra chậm | Source complete: phân biệt checking với command busy, giữ cancel/QR khi GET; xác nhận hủy ưu tiên ngắt GET bằng abort/ticket, không nhận late response hoặc mở khóa command mới. Poll không ngắt mutation; pending cancel giữ nút disabled có nhãn xử lý. 4 regressions RED trước fix; full suite 556/556, type/lint/structure và export Android/iOS/web đạt. Thời gian BE/provider chưa đo bằng giao dịch thực tế |
| P03-UI-T10 | Sửa nhánh còn nhấp nháy trên điện thoại khi GET lỗi/stale rồi phục hồi | Source complete: visibility theo Payment CREATED/PENDING, quyền bấm vẫn theo canCancel; lỗi đọc chỉ khóa nút/confirmation tại chỗ, không thu gọn layout hoặc gửi cancel. Terminal/REVIEW/denial vẫn ẩn. Preview stale dùng cùng dữ liệu/disabled semantics. Regression UI RED trước fix; focused 19/19, full suite 558/558, type/lint/structure đạt; chưa nghiệm thu trên điện thoại thật |
| P03-UI-T11 | Giữ màu nút hủy qua reload và chuyển xác nhận sang modal theo yêu cầu | Source complete: nút giữ màu/khả năng mở modal qua GET và stale; modal cùng pattern app, Back/backdrop/tiếp tục chỉ đóng, terminal/blur tự đóng. Xác nhận stale GET mới trước cancel, dừng nếu PAID/REVIEW/denial/lỗi hoặc đã rời màn; cùng key và command priority giữ nguyên. 3 regressions preflight RED trước fix; focused 23/23, full suite 562/562, type/lint/structure và export Android/iOS/web đạt. Native/pixel/provider UAT còn mở |

| P03-UI-T12 | Bỏ card số dư ở màn nạp; đổi dropdown lịch sử thành nút chuyển, đưa ngày giờ vào từng dòng và rút gọn chi tiết theo yêu cầu tham khảo VCB | Source complete: form nạp không render/đọc riêng số dư; switch ba nhóm giữ query/cursor/session semantics. Lịch sử và receipt không icon; receipt chỉ giữ loại, amount, status, time/id và giao dịch gốc khi có. Bỏ helper/controls cũ; thay 6 test presentation cũ bằng 5 ca hành vi hiện hành. Full suite 561/561, type/lint/structure và export Android/iOS/web đạt; native/pixel UAT còn mở |

T12 thay presentation số dư của T03, dropdown và nhóm ngày/biến động/số dư của T06; giữ note tại Ví Credit. Nguồn tham khảo: [hướng dẫn lịch sử VCB Digibank](https://digibankm5.vietcombank.com.vn/get_file/ibomni/html/hdsd-ib/pages/vi/tinh-nang-giao-dich-ngan-hang/tai-khoan/3-lich-su-giao-dich.html), PDF VCB ở contract và yêu cầu bố cục mới; giữ theme SkillHub, không nhận là pixel-match VCB hoặc thêm bộ lọc thời gian chưa có API.

T13 bổ sung event cho màn thanh toán theo phản hồi mới: BE dev đã có `/events`, `payment.updated` và `wallet.updated`, còn mobile chỉ dùng read loop trước lượt này. Tái sử dụng SSE app qua public subscription, không thêm transport/dependency hoặc sửa BE. Event chỉ hydrate GET; đọc mới sau request cũ, dedupe/owner/version/blur guards; polling 30 giây khi connected, 2 giây khi disconnected. Tách `cancelling` khỏi generic busy để không báo đang hủy lúc bootstrap/recovery. Focused 42/42 và full suite 571/571 đạt, không có native/deployed SSE acceptance. Task P03-UI-T13: source complete; checks/giới hạn theo status.

Tận dụng PaymentAction, FormNotice, shared Button và pattern modal xác nhận của app; T11 thay presentation inline trước đó. Independent `/wallet/payment-status` giữ read-only, web giữ read-only; danh sách Payment chưa mở; SSE màn thanh toán bổ sung ở T13. Cancel key tách operation tạo đơn và được suy xác định từ UUID Payment đã biết, nên retry không cần thay schema SecureStore hoặc tự tạo intent. Backend recheck quyền/trạng thái mỗi lần; client không tự kết luận đã hủy hay hoàn Credit.

Nghiệm thu bổ sung: CREATED/PENDING → confirm hủy → CANCELLED/EXPIRED; double tap; 409 CHECKOUT_BUSY; 503/timeout trước/sau provider cancel; PAID/REVIEW chạy đồng thời; background/process restart chỉ đọc, explicit retry cùng key; creation-policy vẫn được kiểm trước tạo intent mới. API/payOS/native UAT giữ mở cùng acceptance cũ, không tick spec006 từ synthetic tests.

## Nguồn và kế thừa

P03-CLEANUP-T16 — rà cấu trúc sau khi bỏ preview: phân tích import graph runtime từ app routes; đưa model/observer/quote/QR và helper chỉ có test consumer sang tests/fixtures, rút gọn production types/policy/outcome; style khớp account-topup-panel. Không đổi folder conventions toàn app hoặc route tree. Source complete: không production import test, không runtime module Wallet mồ côi; full suite giữ 573/573, types/unused/lint/format/structure và export Android/iOS/web đạt.

P03-CLEANUP-T15 — gỡ Wallet preview theo phản hồi cấu trúc: xóa toàn bộ preview UI/route/export/menu/notification mẫu, form mẫu không còn consumer; chuyển host tạo đơn/QR còn dùng sang tests/fixtures. Thay T14 development guard bằng removal thật; các preview của module khác ngoài phạm vi. Source complete: full suite 573/573, focused 21/21, types/unused/lint/structure và export Android/iOS/web đạt; giảm hai test chỉ phục vụ preview đã bị gỡ, không skip behavior coverage.

P03-REVIEW-T14 — audit và cleanup trước commit: đối chiếu source/diff/index, bỏ model mẫu khỏi account provider và chuyển helper cũ sang test fixtures; xóa hai hook/màn không caller, alias màu và subtitle props dư; wallet preview chỉ development. Sửa GET chưa bắt kịp event version không ack/dedupe, catch-up promise và budget SSE ready→bad replay. Source complete: full suite 575/575, unused/typecheck, lint toàn mobile, format/structure và export Android/iOS/web đạt. Không stage/commit hoặc tự đóng native/provider acceptance; index hiện tại chưa chứa đủ source/new files/deletions.

- [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), mục 18.14–18.17; [source of truth](../../../../../docs/SOURCE_OF_TRUTH.md).
- [Workflow](../../workflow.md), [testing](../../guides/testing.md), [state/session](../../guides/state-and-session.md), [API client](../../guides/api-client.md).
- [Wallet contract](../../contracts/wallet-payments.md); backend controller/DTO liên kết tại đó.
- [Spec006 tasks](../../../specs/006-wallet-payment-history/tasks.md), [normal integration](../../../specs/006-wallet-payment-history/contracts/normal-payment-integration.md), [validation](../../../specs/006-wallet-payment-history/validation.md). Giữ nguyên 100 task IDs, 83 checked/17 unchecked và toàn bộ nội dung task cũ. Không chuyển lại thành Spec Kit.
- Wallet/Home/history tiếp tục giữ các pattern của [ui-flows](../../../specs/006-wallet-payment-history/contracts/ui-flows.md). Checkout payment được dựng bằng React Native theo screen HTML người dùng gửi ngày 2026-10-21; form Nạp Credit theo reference ngày 2026-10-22. Nhóm màn payment dùng chung palette kem/cam đất scoped theo Wallet, giữ font Nunito, nút và component app. Checkout làm nổi bật tổng tiền trước QR; chỉ hiển thị QR, thời hạn, tỷ lệ Credit, mã payment và trạng thái từ Payment thật. Form top-up dùng policy hiện tại, không lặp card số dư, giữ bước review trước confirm. Không bịa thông tin ngân hàng; bỏ claim Escrow/SSL, phí hoặc thời gian xử lý trong mẫu khi chưa có nguồn xác nhận. Không thêm tiện ích payment chưa chọn.

## Baseline và đối chiếu

| Yêu cầu | Contract/source đã kiểm | Bằng chứng baseline | Gap và xử lý |
| --- | --- | --- | --- |
| CR-001/002, Wallet/Home | `wallet-api`, `wallet-contracts`, `wallet-query`, `use-wallet`, `home-wallet-balance` | Exact strings, owner/generation keys, zero/error/denial tests | Source có thật; API/native acceptance còn mở |
| Lịch sử/chi tiết | `transaction-api`, `history-query`, `transaction-query`, views | Page20, AND filters, cursor snapshot, detail identity và denial tests | T12 thay dropdown bằng switch và rút gọn receipt; giữ backend order, query/cursor/session |
| CR-003, PAY-001..004 | `payment-api`, schemas, create coordinator, observation | Policy GET, explicit POST, verified claim, same-key replay, backend-only PAID | Account panel che mất restore/check actions có trong coordinator |
| Sau PAID cập nhật ví | `payment-related-reads`, `payment-refresh`, `use-payment-read-refresh` | Independent GETs và PAID retention tests | Query có thể coalesce với request trước PAID; cần bắt đầu read mới |
| Recovery/lifecycle/privacy | create session, native correlation store, observation/read loop | Owner/environment identity, focus lease, abort/tickets, unknown/review tests | Bổ sung test các thao tác account bị thiếu; actual SecureStore/process-kill chưa kiểm |
| WD-001..004 | Native/web capabilities và public routes | Không có withdrawal; web create/recovery off | Giữ phạm vi hiện hành |
| Docs/source | Contract, roadmap, matrix, phase hồ sơ | Source/spec006 có trong nhánh hiện tại | Đính chính các câu chỉ-preview/nhánh-khác bằng nguồn source; giữ lịch sử |

Baseline focused suite: 44/44 PASS, gồm runtime/history/navigation/routes/related refresh. Đây là L/C, không chứng minh deployment hoặc native.

## Task của lượt tiếp tục

Các task dưới chỉ sở hữu phần review/fix mới; acceptance cũ vẫn do spec006/T042, T053..T062, T095..T100 sở hữu, không tạo checkbox UAT trùng.

| Sub-phase | Task và kết quả | Dependency | Hoàn thành khi | Tiến độ |
| --- | --- | --- | --- | --- |
| S01 Baseline & Contract | P03-S01-T01: xác minh branch/source/SRS/contract; đính chính baseline docs | Không | Có mapping trên và nguồn kiểm được | Đã xong |
| S02 UI Foundation | Gộp vào S03: reuse button/surface/theme, không tạo task component library | S01 | Không đổi design system | Đã gộp |
| S03 Screen Slices | P03-S03-T01: đưa restore/check đã có vào account panel | S01 | Đúng callback, disabled khi inactive/busy; không POST/replay ngầm | Đã xong source |
| S04 Navigation & Lifecycle | P03-S04-T01: review focus/session/Back/restart boundaries, thêm negative cases cho actions | S03 | Hành vi source/tests đạt; native acceptance giữ mở | Đã xong source review |
| S05 Integration & Edge Cases | P03-S05-T01: retire request trước PAID rồi đọc mới Wallet/History | S01 | Regression late-response đạt; refresh độc lập, chỉ GET | Đã xong source |
| S06 Verification & Cleanup | P03-S06-T01: checks, docs/links/task preservation và evidence | S03..S05 | Checks phù hợp đạt hoặc ghi giới hạn rõ | Đã xong trong phạm vi source |
| S99 Review & Acceptance | P03-S99-T01: technical/UI review source, kịch bản UAT và handoff | S06 | Findings đã xử lý; chưa tự xác nhận acceptance | Review source xong; UAT chờ task cũ |

## Ma trận hành vi và kiểm chứng

| Luồng/state | Action/side effect | Back/lifecycle/privacy | Bằng chứng cần |
| --- | --- | --- | --- |
| Home/Wallet loading/zero/stale/error/denied | Owner GET, retry/pull refresh | Owner/generation scope; không thay lỗi bằng 0 | Tests; actual API/native theo spec006 |
| History/detail empty/paging/filter/denied | Cursor/filter server; detail identity | Back giữ filter; không fallback từ list sau denial | History tests và native UAT |
| Draft/review/policy block | Estimate riêng quote, explicit Confirm mới POST | Draft giữ khi Back; web unavailable | Coordinator và UI tests |
| Storage lỗi/unknown | Explicit restore hoặc same-key replay đúng capability | Không tự key mới; account switch không lộ data | Account callbacks/coordinator/store tests; native restart NOT_RUN nếu thiếu thiết bị |
| CREATED/PENDING/REVIEW/QR suppressed | GET tự động hữu hạn; không suy outcome từ QR/clock | Blur/background dừng; resume đọc, không POST | Observation/read-loop tests; provider/native acceptance riêng |
| PAID + related error | Read mới sau PAID, retry độc lập | Late old response không overwrite; PAID không hạ xuống failed | Regression Query thật với synthetic transport |

## Kịch bản nghiệm thu còn mở

Prerequisite: đúng API revision/migrations, native binary và hai tài khoản A/B, kênh payOS được cấp quyền, thiết bị quét QR thứ hai, phạm vi hành động/số tiền cho phép và người hỗ trợ recovery. Không thực hiện giao dịch thật chỉ từ quyền sửa source.

1. A mở Home → Wallet → History → detail → Back; đối chiếu balance/ledger với API, kiểm zero/empty/error và filter/paging.
2. Native A nhập số tiền hợp lệ/không hợp lệ → review → đổi số tiền/Back → Confirm; double tap chỉ một ý định/key.
3. Timeout sau dispatch, mất ID/storage read failure: explicit restore/replay đúng identity; không tạo replacement. Thử cả thao tác khi inactive/busy.
4. CREATED/PENDING có QR → background/resume/Back → process termination/reopen; chỉ reads/restoration tự động. QR suppression/REVIEW không tự coi failed.
5. Backend PAID → Wallet/History đọc lại, kể cả request cũ đang chạy hoặc một read lỗi; không cộng Credit local.
6. Logout/account switch A→B trong lúc đọc/dispatch; không lộ QR, balance, ledger hay response A vào B.
7. Web có owner reads, top-up có thông báo native-only; không POST/recovery storage fallback.

Ghi kết quả A/G/Android/iOS và UAT ở [status](status.md), phần chưa chạy NOT_RUN. Web render/JS export không thay các bước native/provider này.

## Dependency và rollback

Không phát hiện thay đổi backend bắt buộc từ hai fixes này. Deployment/provider/native acceptance vẫn chưa xác minh. Total-loss recovery, REVIEW clearance và các giới hạn hỗ trợ giữ theo contract/decisions spec006; không tạo endpoint hoặc SLA mới.

Rollback source chỉ hoàn nguyên hai fixes của lượt này nếu cần; không xóa correlation record, ledger hay đổi key/schema. Nợ còn lại: actual API/provider/SecureStore/process-kill và UAT theo task cũ. Status sở hữu tiến độ/checks, không dùng bảng task trên làm xác nhận hoàn tất.

UI checkout là thay đổi presentation có thể rollback trong `apps/mobile`; phần countdown chỉ trình bày `expiresAt` và khi về 0 tiếp tục chờ trạng thái server, không tự đánh dấu hết hạn hoặc tạo lại QR/payment. Preview dùng fixture tổng hợp cô lập; không chứng minh dữ liệu API, native render hoặc giao dịch provider.

## Lịch sử ranh giới liên nhánh tại migration

### Phạm vi lúc migration

Wallet/Payment được phát triển ở nhánh riêng. Checkout migration chỉ có Wallet preview; spec006 và source tích hợp không có ở đây là khác biệt phạm vi nhánh, không phải lỗi hoặc yêu cầu xây lại luồng.

File này chỉ là điểm tham chiếu của [roadmap](../../roadmap.md), không là plan triển khai thay thế cho nhánh đang làm. Revision tích hợp chưa được đối chiếu; không tạo task triển khai trùng. Các task P03 giả định được tạo lúc migration trước khi có thông tin liên nhánh đã được rút khỏi plan này; không phải task006 lịch sử và chưa có implementation nào được thực hiện từ chúng.

### Nguồn và nơi sở hữu lúc migration

- [Status](status.md) ghi phạm vi phối hợp và giới hạn đối chiếu liên nhánh.
- [Contract Wallet/Payment](../../contracts/wallet-payments.md) mô tả backend và source có trong checkout migration, kèm quy chuẩn cho thay đổi mới; chưa xác minh source/decisions/acceptance của nhánh phát triển đó.
- Task, quyết định storage/recovery/native/web, thiết kế và bằng chứng nghiệm thu triển khai do hồ sơ ở nhánh đang làm sở hữu. Không suy tiến độ nhánh đó từ fixtures tại đây.
- [Migration](../../migration.md) giữ baseline và đính chính, không cấp quyền bắt đầu phase sản phẩm.

### Điều kiện review hoặc tích hợp ghi lúc migration

Đọc source, hồ sơ006/contracts/tasks/validation và revision thật của nhánh phát triển; giữ ID và bằng chứng gốc. Đối chiếu thay đổi API, HTTP/Auth/session/Query/shared mobile UI với checkout đích và kiểm affected consumers. Đồng bộ tài liệu theo source đã tích hợp; không áp kết luận thiếu source của baseline migration lên revision mới.

Bằng chứng payment phải tách source/fixture/web/real API/provider/native/persistence/process termination theo [matrix contract](../../contracts/wallet-payments.md). Chỉ thực hiện giao dịch thật hoặc tác động dữ liệu khi có quyền cụ thể. Chưa có yêu cầu review/tích hợp, các bước trên chưa được thực hiện.

### Phạm vi rà code của checkout migration

Tập trung Auth/session/network, Learning Request và Profile/Skills. Wallet/Payment được review cùng nhánh đang làm khi có yêu cầu riêng hoặc ở bước tích hợp; không nằm trong lượt rà hiện tại.
