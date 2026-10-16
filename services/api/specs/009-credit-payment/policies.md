# Credit & Payment — quyết định và activation gates

Date: 2026-10-15. User đã xác nhận **payOS** và **floor phí 4%, net = gross − fee** trong trả lời clarifications ngày này. Các policy khác vẫn giữ activation gates, không được coi đã duyệt theo lựa chọn provider.

## Đã có căn cứ

| Policy                       | Căn cứ / cách áp dụng                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1.000 VND = 1 Credit         | SRS 18.16; `credit.topUpVndPerCredit` cố định; snapshot theo Payment                                            |
| 100 integer units = 1 Credit | Header runtime schema, parser LearningPath và source ledger; không dùng float                                   |
| TWO_WAY >=20 Credit mỗi User | SRS CR-004..007; giữ 96% về chính holder, phí 4%                                                                |
| ONE_WAY >0, chỉ learner Hold | SRS 18.40; teacher nhận phần ròng, không yêu cầu teacher >=20 Credit                                            |
| Không settlement theo buổi   | SRS 18.19; owner kiểm tra toàn bộ Session + dispute trước final settlement                                      |
| Fee floor, net = gross − fee | User xác nhận 2026-10-15: floor phí 4% ở 0,01 Credit, người nhận lấy phần còn lại; giữ compatibility với source |
| Không cash-out               | SRS 18.17; không mở Withdrawal dù enum/model cũ tồn tại                                                         |
| SSE cho cập nhật committed   | Contract `008-connections`; HTTP cho commands/history, không thêm socket                                        |

Fee example: gross `10.01` → units `1001`, fee `floor(1001×400/10000)=40` → `0.40`, net `9.61`. Không tính/làm tròn riêng cả hai chân. Gross `0.01` có fee `0.00`, net `0.01` với policy hiện tại.

## Gates cần chốt trước nhánh implementation tương ứng

| ID  | Chưa chốt / cần bằng chứng                                                                               | Hành vi khi chưa có                                                                                 | Owner / tiêu chí đóng                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| G01 | **Provider decision CLOSED: payOS**; merchant activation/runtime còn Pending                             | Design REST payment-link + signed webhook ở contracts/gateway.md; disabled tới đủ cấu hình/evidence | Docs REST create/lookup và webhook HMAC đã đọc; còn channel create/lookup/retry/partial/late/sample proof |
| G02 | **Amount/TTL decision CLOSED**: 1.000–2.000.000 VND, bước 1.000 VND, TTL 60 phút                         | Persist snapshot/expiry theo server clock; late paid vào REVIEW                                     | Rate limit/retry/retention và provider-side expiry semantics còn cần runtime proof                        |
| G03 | **Provenance decision CLOSED**: số dư theo nguồn, thưởng trước rồi các nguồn còn lại theo thời điểm nhận | Lot tracking và hold/spend/refund allocations; không dùng lifetime counters                         | Cần migration, integration và reconciliation để activation; không giả vờ code cũ đã theo dõi nguồn        |
| G04 | Daily/Feedback reward amounts/abuse/eligibility                                                          | Không cấp bonus, không grant từ enum hoặc review                                                    | PO chốt từng chương trình, unique claim identity, budget và rule version                                  |
| G05 | Cancel/no-show/dispute refund/penalty, partial completion                                                | Không kích hoạt release công khai hoặc tự trả 96% khi hủy                                           | PO + path/report owners phê duyệt instruction + snapshot + invariants                                     |
| G06 | Gateway refund/chargeback và tiền đã tiêu/Held                                                           | Không API cash refund, không PAID→REFUNDED tự động                                                  | PO chốt workflow, provider support, authorization, spent-fund handling/provenance; không âm ví để bù      |
| G07 | Staff xem Credit và quyền vận hành retry/đối soát                                                        | Chỉ self và Admin có permission rõ; không grant Staff đại trà                                       | PO/RBAC owner duyệt permissions; seed/test denial                                                         |
| G08 | Release rồi relock phiên bản mới                                                                         | Không phá unique(path,user), không tái sử dụng allocation đã settled                                | Path owner chốt lifecycle; migration/add uniqueness version nếu thực sự cần, giữ toàn bộ allocation cũ    |
| G09 | Cửa sổ dispute trước settlement                                                                          | Source reports dùng 48h; không coi con số đó là policy mới được duyệt                               | PO/report owner xác nhận hoặc đổi config có version; race test cùng path lock                             |
| G10 | Preflight existing balances/ledger và opening entries                                                    | Chặn migrate/enable nếu không đối soát được; không đoán/sửa số dư                                   | Operator duyệt reconciliation/opening-balance manifest có reference + audit                               |

Provider payOS và rounding đã chốt theo trả lời trực tiếp của User. Payment link được tạo server-side nhưng chỉ hiển thị QR trong SkillHub (amendment 2026-10-16), cùng signed webhook theo contract payOS; cần channel proof trước activation. Lựa chọn SePay trước đó đã được User thay thế. G01 không còn câu hỏi chọn nhà cung cấp; phần merchant setup/runtime verification cùng G02–G10 vẫn mở. Không coi tài liệu hoặc provider selection là bằng chứng production ready.

## Ngoài phạm vi

PAID materials, phí tài liệu, chuyển Credit tùy ý, tự động xử lý tranh chấp, chính sách penalty/cancel, cash-out, UI/web/mobile và deployment. Material owner có thể dùng financial contract sau, nhưng không dùng mặc định phí học 4%.
