# Wallet Payment và Credit

## Phạm vi nhánh và nguồn

Đối chiếu ngày 2026-10-22: mobile ở nhánh `feat/mobile-wallet-payment-history`, baseline `0b973ba64e70393f2212f7ffdf84088f39f9f9fd` + working tree; BE được đọc từ Git ref `dev`/`origin/dev` tại `1c8fb8d9398480d62505d361c36bc11584c1e443`. Backend trong checkout mobile cũ hơn ref này, nên chỉ kiểm controller hiện tại sẽ bỏ sót cancel/recovery. Không checkout/merge hoặc sửa BE. [Phase03 plan](../work/phase-03-wallet-topup/plan.md) sở hữu task; [status](../work/phase-03-wallet-topup/status.md) sở hữu checks/acceptance.

Nguồn BE hiện hành: [HTTP009 tại revision dev](https://github.com/memora-alpha/skillhub/blob/1c8fb8d9398480d62505d361c36bc11584c1e443/services/api/specs/009-credit-payment/contracts/http.md), [PaymentsController](https://github.com/memora-alpha/skillhub/blob/1c8fb8d9398480d62505d361c36bc11584c1e443/services/api/src/modules/payments/presentation/http/payments.controller.ts), cancel use case, DTO/read projection và worker qua `git show dev:<path>`. WalletController/DTO không thay contract đọc ví. Source route tồn tại không chứng minh API deployment/provider có cùng revision/migrations.

Mobile có [WalletProvider](../../src/features/wallet/context/WalletProvider.tsx), owner-scoped API/query hooks, history/detail, [native correlation store](../../src/features/wallet/storage/payment-correlation-store.native.ts), create coordinator, QR renderer và status/read loop. [Account capabilities](../../src/features/wallet/context/account-capabilities.ts) bật Wallet/history/detail/status reads trên native/web; create/recovery chỉ iOS/Android. [Normal integration](../../specs/006-wallet-payment-history/contracts/normal-payment-integration.md) giữ quyết định native-first và same-key recovery; [validation006](../../specs/006-wallet-payment-history/validation.md) là bằng chứng lịch sử. Đã xóa toàn bộ Wallet preview UI, route/catalog/notification mẫu và form mẫu cũ; các helper regression nằm trong tests/fixtures. Tồn tại source không chứng minh native/provider đã nghiệm thu.

## Contract backend hiện hành, base /api/v1

Tất cả self routes Bearer/live authorization, owner scope; không gọi webhook từ app.

| Method/path                     | Input                                                    | Output chính                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /me/wallet                  | Owner                                                    | availableCredit,heldCredit exact strings và walletVersion; virtual zero version0 cho absent-wallet hợp lệ                                              |
| GET /me/wallet/transactions     | type?,referenceType?,cursor,limit                        | Own ledger page, stable high-water sequence snapshot                                                                                                   |
| GET /me/wallet/transactions/:id | Own UUID                                                 | id,operationId,type,amount,availableDelta,heldDelta,availableAfter,heldAfter,referenceType,referenceId,status,createdAt,reversesTransactionId nullable |
| GET /payments/creation-policy   | Owner,no-store                                           | canCreate,reasonCode,existingPaymentId; snapshot, POST recheck                                                                                         |
| POST /payments                  | Idempotency-Key; {paymentAmountVnd:string,gateway:PAYOS} | 201 fresh/200 replay, PaymentResponse                                                                                                                  |
| POST /payments/:paymentId/cancel | Idempotency-Key; không body                              | 200 PaymentResponse; CANCELLED hoặc EXPIRED sau server verification                                                                                     |
| GET /payments                   | status?,cursor,limit                                     | Own payment page                                                                                                                                       |
| GET /payments/:id               | Own UUID,no-store                                        | Quote/status/checkout/version/recovery projection                                                                                                      |

Policy source [top-up-policy](../../../../services/api/src/modules/payments/domain/top-up-policy.ts) yêu cầu VND1_000–2_000_000, bước1_000; đây là policy snapshot backend2026-10-15-v1, không min/max SRS cố định. PaymentStatus của BE dev: CREATED/PENDING/PAID/FAILED/EXPIRED/REFUNDED/REVIEW/CANCELLED; Ledger status PENDING/SUCCESS/FAILED/REVERSED. CANCELLED là terminal riêng, không quy thành EXPIRED hoặc PAID.

Payment fields: id,status,paymentAmountVnd,currency:VND,creditAmount,conversionRateVndPerCredit,gateway,createdAt,expiresAt nullable,paidAt nullable,version,recoveryRequired,recoveryReason,checkout nullable. Checkout là paymentLinkId/qrCode/orderCode string/providerStatus; qrCode là payload render trong app, không hosted checkout URL. CREATED/checkout:null là preparation chưa xong, không tự PENDING/terminal. Expiry immutable quote60 phút theo backend contract, không kéo dài bằng retry; không áp thành polling budget UI.

Money decimal strings đúng2 số cho Credit; VND integer string; amount ledger là magnitude không âm, signed movement nằm deltas. Limit1–100/default20; cursor opaque owner/filter, ledger watermark/sequence; payments orderCode high-water giảm dần không hứa snapshot status bất biến. Nonowner404,403 permission,400 format/precision/amount,409 conflict/unresolved/reconciliation,429 rate,503 provider/policy/storage/gate.

Provider/policy errors gồm PAYMENT_PROVIDER_UNAVAILABLE/PAYMENT_POLICY_UNAVAILABLE. Owner có CREATED/PENDING/REVIEW hoặc legacy thiếu identity thì không tạo mới;409 PAYMENT_UNRESOLVED/PAYMENT_RECONCILIATION_REQUIRED có details.existingPaymentId. POST có thể503 PAYMENT_CREATION_PAUSED/PAYMENT_CHANNEL_RECONCILIATION_REQUIRED. Reason recovery: PAYMENT_REVIEW_REQUIRED/PAYMENT_CHANNEL_UNAVAILABLE/PAYMENT_CHECKOUT_MISSING/PAYMENT_RECOVERY_PENDING. RECOVERY_PENDING là CREATED/PENDING đang chờ backend recovery; UI tiếp tục đọc, không tự chuyển REVIEW/terminal hoặc mở nạp mới. QR bị suppress khi disabled/paused/channel mismatch/recovery; không suy terminal từ checkout null hoặc QR mất.

### Cancel và recovery theo dev

Native Payment của intent đang giữ có nút hủy và modal xác nhận, chỉ gửi lệnh khi người dùng xác nhận và route/session còn active. Independent status và web vẫn read-only. `payment-api.cancel` gửi Bearer + Idempotency-Key, no body, `replayAfterRenewal:false`. Key `payment-cancel:<paymentId>` tách operation `payment:cancel` khỏi create, ổn định qua restart; không đổi schema SecureStore. Không tự POST khi focus/reconnect/restart.

- Hủy owner CREATED/PENDING; CANCELLED/EXPIRED replay an toàn. PAID →409 PAYMENT_ALREADY_PAID; REVIEW →409 PAYMENT_REVIEW_REQUIRED; terminal khác →409 PAYMENT_CANNOT_CANCEL.
- 409 PAYMENT_CHECKOUT_BUSY: đọc lại trạng thái rồi cho explicit retry cùng key. 503 PAYMENT_CANCELLATION_UNCONFIRMED/network/protocol không chứng minh đã hủy. Client giữ correlation, ẩn QR của phiên hủy chưa rõ và không tạo intent nạp khác.
- Lệnh lỗi được hydrate bằng GET; PAID/CANCELLED/EXPIRED từ server được áp dụng theo identity/version. 403/404 xóa projection riêng tư, giữ correlation để hỗ trợ; không tạo replacement. Late response sau blur/logout/session change bị bỏ.
- CANCELLED dừng polling, không refresh ví như PAID; chỉ resolve correlation đúng ID/amount/gateway khi không stale/recovery warning. Tạo intent mới vẫn phải qua creation-policy và POST recheck.
- BE dev có recovery cho technical REVIEW theo verified lookup, còn financial REVIEW không tự được mở. Không client repair/mark-paid/approve replacement. Missing QR/local expiry không đủ để kết luận đơn đã đóng.

Kiểm tra nền có `checking` riêng trong snapshot; `busy` vẫn biểu thị lease đang chạy cho các consumer khác. Hiển thị nút dựa trên Payment PAYOS CREATED/PENDING đang giữ. GET đang chạy, lỗi hoặc observation stale không làm nút đổi màu/disabled và không cản mở modal. Modal giữa màn hình theo pattern native hiện có, hiển thị số tiền khi có, “Tiếp tục thanh toán” và “Xác nhận hủy thanh toán”; Back/backdrop/tiếp tục chỉ đóng, mất focus hoặc terminal/denial tự đóng. Nút chỉ disabled khi inactive hoặc đang xử lý command thực sự; QR stale vẫn bị ẩn theo guard riêng. Terminal/REVIEW, denial hoặc không còn Payment hợp lệ mới bỏ action.

Mở modal không cấp quyền POST từ dữ liệu cũ. Khi xác nhận mà canCancel=false do stale, coordinator giữ command lease và GET mới: chỉ gửi cancel nếu projection mới hợp lệ và còn CREATED/PENDING; PAID/REVIEW/denial/conflict/lỗi đọc dừng trước POST. Blur/logout trong GET này invalidates ticket nên response muộn không gửi cancel; không replay khi resume. Retry hủy chưa rõ kết quả vẫn explicit cùng key theo guard hiện hành. Xác nhận hủy có thể ngắt GET nền đang chờ (abort + ticket invalidation); response cũ không được cập nhật dữ liệu hoặc mở khóa command mới. GET không ngắt command đang chạy. Trong quá trình xử lý, nút giữ chỗ, có nhãn tiến trình và disabled. Không tạo polling mutation hoặc POST ngầm.

Backend lưu SHA256(key)/canonical fingerprint owner-unique; mapping HTTP mất riêng có thể replay phục hồi cùng Payment/orderCode. Mapping còn nhưng resource mất => reconciliation409; mất cả hai chưa có automatic recovery,404 không đủ safe replacement. Safe replay vẫn kiểm live quyền/provider policy. Không client mark-paid/confirm-payment/reconcile/repair API. Provider webhook verified/idempotent chỉ backend post Credit; REVIEW không auto refund/downgrade PAID.

SSE backend dùng authenticated `GET /events`, refs `walletUserId/operationId` hoặc `paymentId/status/version`, không raw webhook/QR/số tiền. Màn thanh toán của native coordinator dùng [payment event reader](../../src/features/wallet/utils/payment-events.ts) qua [hook](../../src/features/wallet/hooks/use-payment-events.ts), subscribe public `useChatEvents` để tái sử dụng stream app hiện có; không mở socket hoặc auth transport thứ hai. Chỉ nhận payment đang mở và wallet đúng owner, validate envelope/refs, bỏ event trùng/version cũ; event chỉ kích hoạt GET, không áp payload PAID hay cộng số dư trực tiếp.

Event và `stream.ready` yêu cầu GET mới sau lease đang chạy (`check(true)`), tránh coalesce vào poll bắt đầu trước event. Command hủy vẫn có ưu tiên và không bị SSE/read ngắt; queued read bị bỏ khi pause/logout/ticket thay đổi. Stream cursor chỉ được acknowledge sau callback consumer; checkpoint không kích hoạt GET. Bootstrap subscribe có read bắt kịp event ready đã đi qua; blur/background/unsubscribe chặn các callback muộn. PAID qua GET vẫn dùng related Wallet/History reads hiện hành.

Nếu GET chưa fresh/không có projection hoặc version còn thấp hơn payment hint, consumer không processed/ack event; stream reconnect/replay và polling tiếp tục hydrate. Catch-up được gọi ngoài stream phải catch rejection để coordinator/polling giữ lỗi. Reconnect app có tối đa sáu retry liên tiếp; ready frame không tự reset budget, chỉ kết nối ổn định 30 giây hoặc foreground/explicit retry mới reset. Wallet không còn preview route/UI kể cả development; mock host phục vụ regression chỉ nằm trong tests/fixtures, provider account không attach inert preparation model.

Snapshot có `cancelling` riêng chỉ trong lệnh hủy explicit, gồm GET preflight. Nhãn “Đang xử lý yêu cầu hủy…”/“Đang hủy thanh toán…” dựa vào cờ này, không suy từ busy chung của bootstrap/create/recovery. `checking` vẫn giữ màu/nút qua GET; `busy` vẫn dùng cho command guards. PAID/terminal từ GET ẩn action và đóng modal như trước.

Nhịp đọc dự phòng: CREATED/PENDING khi SSE connected chờ 30 giây, tối đa 20 safety GET; SSE chưa kết nối/gián đoạn dùng 2 giây, tối đa 300 GET. Mỗi cửa sổ focus/foreground hoặc đổi kết nối có khoảng 10 phút scheduled waits cộng request; event kích hoạt GET ngay không đợi timer. REVIEW/UNKNOWN giữ 30 giây/120 lượt; lỗi đọc vẫn backoff 10/20/30 giây. Hết safety-read budget nhưng SSE còn kết nối vẫn báo đang theo dõi event. Resume và nút kiểm tra ở các màn đọc/khôi phục khác gọi GET ngay qua guard/lease hiện có, không tự POST. Màn Thanh toán QR không có check thủ công; vẫn giữ khôi phục hoặc same-key tiếp tục khi cần. Read loop dừng khi terminal, denial, đổi identity/session hoặc rời màn/app vào nền; subscription chỉ tồn tại ở màn active/foreground. Đây là policy UI, không phải hạn thanh toán hoặc cam kết tốc độ ngân hàng. Independent status và web reads chưa thêm subscription trong lượt này.

GET payment chỉ đọc projection đã lưu; không gọi payOS để xác nhận giao dịch theo thao tác bấm nút. Source BE dev xử lý webhook đã xác minh rồi mới ghi PAID/Credit; worker fallback có `nextAttemptAt` sau 60 giây và sweep 15 giây (`infrastructure/jobs/payment-checkout.worker.ts` tại revision nêu trên). Nhịp GET nhanh hơn chỉ giảm độ trễ hiển thị sau khi BE cập nhật, không khắc phục webhook/provider trễ và không thay kiểm chứng deployment thực tế.

## Quy chuẩn và ranh giới implementation mobile

Durable claim/runtime và native-only create đã có source, đối chiếu quyết định trong normal integration/spec006. Các quy chuẩn dưới vẫn cần được kiểm chứng đúng môi trường; source/tests không thay actual SecureStore/process-kill/provider acceptance.

1. Số dư và ledger là projection server. Missing/malformed/error không trở thành số dư zero; absent-wallet hợp lệ chỉ hiển thị virtual zero khi contract xác nhận.
2. Giữ exact decimal strings và đơn vị VND/Credit. Số ước tính được gắn nhãn; không hiển thị như quote đã được backend xác nhận.
3. Một ý định tạo payment có idempotency identity/body ổn định. Timeout/unknown outcome không được coi là chắc chắn chưa tạo.
4. Durable claim/correlation phải được xác minh trước khi dispatch theo runtime được chốt trước triển khai. Storage hỏng/không đọc được không tự mở quyền tạo intent khác.
5. Replay phải rõ ràng, đúng key/body/environment/owner và policy; không tạo payment lúc mount, back, focus, reconnect hoặc background/foreground.
6. Payment ID biết được có thể có read/status flow độc lập theo contract. Không bắt mọi read phải truy cập durable create store nếu thiết kế hiện tại đã tách.
7. Validate owner/resource identity và version. Response cùng version, QR bị suppress hoặc checkout null không được suy ra terminal state ngoài contract.
8. QR chỉ là payload thanh toán để hiển thị. QR render được hoặc decode được không chứng minh merchant nhận tiền, callback đúng hoặc ledger đã posted.
9. `PAID`, `REVIEW`, expired QR, expiry timestamp và gateway status có semantics khác nhau; giữ state machine đang có. Không đổi terminal/precedence rules theo tên trạng thái suy đoán.
10. PAID đã xác nhận không bị hạ xuống failed vì refresh Wallet/History lỗi. Related reads có trạng thái retry/refresh riêng, không cộng tiền phía client.
11. Auto-read/polling là read hữu hạn theo policy giao diện hiện hành, dừng đúng lifecycle/denial/final/budget. Không coi cadence của UI là SLA hoặc thời hạn giao dịch do gateway cam kết.
12. Native/web capability khác nhau phải thể hiện rõ. D2 native-first được kế thừa từ hồ sơ006/normal integration và khớp account capabilities. Không tạo web create bằng RAM/localStorage fallback để vượt hạn chế native-only.
13. Total-loss/recovery support boundary giữ theo quyết định hiện hành; không sinh replacement key khi chưa xác định intent cũ đã giải quyết an toàn.
14. Ledger append-only, Hold, Release và settlement thuộc backend. Mobile chỉ gọi command được contract cho phép; không sửa số dư, ghi ledger hoặc suy luận settle theo số buổi hiển thị.
15. Withdrawal/cash-out ngoài phạm vi SRS hiện hành theo source-of-truth. Không đưa thêm UI rút tiền hoặc subscription từ dự án tham khảo.
16. Cancel là command tài chính riêng: không đổi tên Back thành Hủy, không xác nhận hủy từ timeout/HTTP mapping/QR biến mất, không tự hoàn Credit. Retry do người dùng xác nhận giữ cùng cancel key.
17. Theo yêu cầu mới nhất của người dùng, chưa hiển thị trợ giúp/liên hệ hỗ trợ, nút báo mất identity hoặc hướng dẫn mở rộng trong luồng payment. Màn Thanh toán QR cũng bỏ nút kiểm tra trạng thái và chú thích hướng dẫn quét; giữ tự cập nhật, khôi phục cần thiết và hủy explicit. Không có entry UI gọi `supportStop`; không xóa correlation hoặc bỏ total-loss guard khi gỡ trợ giúp.

Bố cục Thanh toán QR hiện tại: số tiền và Credit theo quote → QR → thời hạn và trạng thái tự cập nhật → mã thanh toán nhỏ ở cuối. Chỉ có một bề mặt chính; thời hạn/mã không bọc card riêng. Nút Hủy thanh toán nằm ngoài card, nền đỏ nhạt/chữ đỏ ổn định qua các lần đọc; bước xác nhận dùng modal với nút đỏ đặc và giữ hai lần bấm, inactive/command/terminal guards. Copy giải thích tạo mã, kết nối hoặc kết quả hủy chưa rõ bằng ngôn ngữ người dùng; không hứa thành công/hủy từ timeout hay error code. Hết budget thì hướng dẫn mở lại thanh toán từ ví thay vì tiếp tục hứa tự cập nhật.

Quy ước hiển thị giao dịch được cập nhật theo yêu cầu tham khảo [VCB Digibank](https://portal.vietcombank.com.vn/content/personal/KhoAnh/20221130_HDSD%20VCB%20DIGIBANK/21.%20Tra%20cu%CC%9B%CC%81u%20li%CC%A3ch%20su%CC%9B%CC%89%20giao%20di%CC%A3ch%20ta%CC%80i%20khoa%CC%89n-the%CC%89.pdf). Đây là tham khảo bố cục; giữ palette/font SkillHub và API hiện có, không thêm bộ lọc ngày hoặc chức năng ngân hàng chưa có.

| Phần | Nội dung cần hiển thị | Ranh giới |
| --- | --- | --- |
| Lịch sử | Tên loại giao dịch, số Credit, ngày và giờ đầy đủ trong từng dòng; trạng thái khi cần chú ý | Từng dòng phẳng với đường phân cách, không card/bo góc, không icon hoặc tiêu đề nhóm ngày; giữ thứ tự cursor từ BE. Số tiền là magnitude `amount`, không suy dấu từ loại giao dịch hoặc tính tổng/số dư từ danh sách |
| Bộ lọc | Nút chuyển luôn hiển thị: Tất cả, Nạp Credit, Học tập | Cùng component React Native cho native/web; chọn lại nhóm hiện tại không reload. Giữ mapping `{}`, `type=TOP_UP`, `referenceType=LEARNING_PATH`; combined filter đang giữ vẫn hiển thị cho tới khi người dùng đổi nhóm |
| Chi tiết | Tên loại/nội dung, Credit, trạng thái, thời gian, `id` của giao dịch; `reversesTransactionId` chỉ khi có | Mã giao dịch đầy đủ có thể chọn để sao chép. Không hiển thị `operationId` hoặc UUID `referenceId`/mã `referenceType` nội bộ trong UI thông thường; vẫn giữ parser/contract |
| Nội dung được lược bỏ | Không hiện biến động ví, số dư khả dụng/tạm giữ/sau giao dịch hoặc icon trong history/receipt | Parser vẫn giữ các field `availableDelta`, `heldDelta`, `availableAfter`, `heldAfter` đúng contract; chỉ thay presentation, không đổi ledger hoặc cách ghi nhận Credit |
| Thông tin chưa có | API chưa trả diễn giải tự do, tên đối tác/người nhận, ngân hàng, phí riêng hay số VND gốc trong Transaction | Dùng tên loại đã dịch làm nội dung; không dựng các dữ liệu đó từ UUID, tiền Credit hoặc app tham khảo |

Note giải thích tỷ lệ Credit và Credit tạm giữ được giữ ở màn Ví Credit theo yêu cầu; không lặp lại trong lịch sử/chi tiết. Màn Nạp Credit bắt đầu bằng form nhập tiền, không render lại card số dư hoặc subscribe Wallet query riêng. Các field cần dùng để đối chiếu được tham khảo thêm từ [Revolut transaction receipt](https://help.revolut.com/en-MX/help/profile-and-plan/managing-my-account/single-transaction-or-top-up-confirmation/), chỉ dùng những gì contract SkillHub thực sự có.

Ma trận kiểm chứng bắt buộc khi work có thay đổi payment/recovery:

| Nhóm                  | Ca cần xét theo phạm vi                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Input/quote           | Giá trị hợp lệ/không hợp lệ, đơn vị, estimate và server quote                                        |
| Duplicate/concurrency | Double tap, request đang chạy, response muộn, cùng intent/key                                        |
| Unknown/recovery      | Timeout sau dispatch, mất ID, restore, storage lỗi, unresolved intent                                |
| Lifecycle             | Back, blur/focus, app background/resume, logout/account switch, process restart nếu có durable state |
| Projection            | CREATED/PENDING/PAID/REVIEW và state khác theo contract, version/order/QR suppression                |
| Privacy               | Wrong owner, 403/404, cache eviction, stale session                                                  |
| Integration           | API thật/deployment, merchant/provider và native persistence, phân biệt từng mức bằng chứng          |

Chỉ thực hiện giao dịch thật, dùng tài khoản thật hoặc thay đổi dữ liệu tài chính khi được cho phép cụ thể. Việc viết tests/fixture và xem source không tự cấp quyền đó.

## Tiếp tục và verification

[Plan Wallet](../work/phase-03-wallet-topup/plan.md) và [status Wallet](../work/phase-03-wallet-topup/status.md) nay tiếp nhận review/fix Phase03 trên nhánh hiện tại; task IDs và acceptance cũ vẫn giữ trong spec006. Account panel cung cấp explicit restore khi canRestore và check khi blocked có readTargetId/canReturnToDraft; các thao tác chỉ gọi coordinator hiện có, disabled khi inactive/busy. Sau PAID, related refresh hủy request Wallet/History đã bắt đầu trước đó rồi đọc snapshot mới; hai read vẫn độc lập và lỗi không hạ PAID. QR decode ảnh render chỉ chứng minh renderer; deployed API/payOS merchant/native SecureStore/process termination chưa được xác minh trong lượt này. Domain rules/settlement tại [domain-rules](../domain-rules.md), lifecycle chung tại [state/session](../guides/state-and-session.md).
