# Admin Dashboard API Implementation Plan

> Khi triển khai, dùng `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development` theo từng mục. Các checkbox theo dõi việc sẽ làm.

**Mục tiêu** — Cấp dữ liệu thật cho ba tab Tổng quan, Học tập và Credit & thanh toán của Admin Dashboard web.

**Kiến trúc** — Một module `admin-dashboard` điều phối ba GET tổng hợp. Các module nghiệp vụ cung cấp hàm đọc theo `TransactionContext` để mỗi response có một snapshot PostgreSQL. Các danh sách và drawer dùng các API quản trị hiện có khi bộ lọc và quyền đáp ứng đúng nhu cầu màn hình.

**Công nghệ** — NestJS, Prisma, PostgreSQL, Swagger và Node test runner. Phần web gọi qua Next.js gateway trong đợt tích hợp FE.

**Căn cứ** — Phần handoff FE trong ảnh ngày 2026-11-14, [FR-ADM-09 trong SRS V1.6](../../SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), [Backend Constitution](../../../services/api/.specify/memory/constitution.md), [Admin Transactions](../../../services/api/specs/014-trust-report-support/admin-transactions.md) và [hợp đồng fee revenue](../../../services/api/specs/015-backend-completion-gaps/contracts.md).

## Baseline sau khi pull dev

Rà source tại `dev` commit `5a70621d`. Ba route tổng hợp dashboard vẫn cần triển khai.

| Phần đã có trên dev | Điều chỉnh plan |
| --- | --- |
| [Trang Tài chính `/admin/credits`](../../../apps/web/src/app/admin/credits/page.tsx) và [FinanceScreen](../../../apps/web/src/components/staff/finance.tsx) có ledger, payment, tra cứu ví, báo cáo phí và detail/đối soát. [Gateway allowlist](../../../apps/web/src/lib/staff/policy.ts) và [staffQuery](../../../apps/web/src/lib/staff/query.ts) đã hỗ trợ các route finance và bộ lọc hiện hành. | Tái sử dụng màn danh sách và detail. Chỉ bổ sung mapping BFF cho dashboard và những filter mới từ drill-down. Tab/filter/item được chọn của FinanceScreen hiện nằm trong state của component, nên cần nối với điều hướng dashboard khi tích hợp FE. |
| [Tổng quan hiện tại](../../../apps/web/src/components/staff/overview.tsx#L44) và [trang `/admin/disputes`](../../../apps/web/src/app/admin/disputes/page.tsx) dùng `GET /reports/support/queue`. Tổng quan vẫn hiển thị số mục đã tải, kèm `hasMore`. | Dùng predicate của support queue cho số đếm và priority list. Case detail hiện mở được tại `/admin/disputes/:id`. |
| [LearningPath có `lastActivityAt`](../../../services/api/docs/learning-path-list.md) từ migration `20261111000000_learning_path_activity`. `GET /learning-paths/mine` sắp xếp theo field này và vẫn giới hạn theo participant. | Chỉ dùng `lastActivityAt` cho danh sách hoạt động gần nhất hoặc metric đếm lộ trình theo lần hoạt động cuối nếu FE định nghĩa như vậy. Chuỗi sự kiện học vẫn cần timestamp của từng sự kiện. |

## Phạm vi và dữ liệu FE

Ảnh handoff mô tả ba tab trong `App.tsx`, drawer giao dịch và quy ước thời gian, phân trang. Dùng các định nghĩa FE đã gửi cho KPI, chart, sắp xếp và deep link. Các nhóm field dưới đây mô tả dữ liệu API cần cung cấp. Tên JSON là đề xuất kỹ thuật cho tới khi đối chiếu với type và dữ liệu mock của FE.

Ảnh dẫn tới `.tmp/dashboard-admin-reference-2026-11-14/`. Thư mục này và ZIP chưa có trong checkout đã rà. Khi có source, lập ma trận `component → field FE → timestamp/status/đơn vị → nguồn BE → đích drill-down`. Kiểm tra đủ sáu KPI ở Tổng quan và bốn KPI ở Học tập, công thức chỉ số, trạng thái được tính và nhãn đơn vị. Các task hạ tầng dùng contract chung có thể bắt đầu ngay. Công thức từng metric, route drawer và tên JSON lấy theo ma trận khi triển khai phần tương ứng.

Đợt này tập trung vào API đọc. `Workload` và `RecentAudit` là phần tùy chọn theo handoff. FE phụ trách điều hướng và fixture cho các action điều hướng. Đợt tích hợp Next.js có checklist riêng ở cuối plan.

## Contract chung

| Hạng mục | Contract |
| --- | --- |
| Query thời gian | `from`, `to` là ISO 8601 có timezone, chuẩn hóa về UTC khi phản hồi. Filter `[from, to)`. Giới hạn khoảng và mặc định lấy theo selector FE. Dùng giới hạn hiện có của báo cáo phí làm mốc kiểm tra khi tái sử dụng logic. |
| Bucket | `granularity=day\|month` và `timezone=Asia/Ho_Chi_Minh` khi FE chọn kỳ Việt Nam. Bucket tháng bắt đầu ngày 1 theo timezone báo cáo. Chỉ thêm `week` nếu FE có selector tuần và đã quy định ngày bắt đầu tuần. Trả `bucketStart`, `bucketEnd` dạng UTC và khóa ngày địa phương cho chart. Trả bucket rỗng với giá trị `0` theo đúng đơn vị. |
| Chọn dữ liệu | Hỗ trợ `sections` hoặc `series` nếu FE sử dụng để lazy-load. Allowlist theo từng route và từ chối mã sai bằng `400`. Phần bị bỏ qua không chạy query. |
| Response | `200` với `{ success, message, data }`. Trả `data.period` gồm `from`, `to`, `timezone`, `granularity` theo query hiệu lực và `data.asOf` từ đồng hồ DB trong transaction. Phân biệt metric theo kỳ với số đếm trạng thái hiện tại theo `asOf`. Lần gọi riêng giữa các tab có `asOf` riêng. |
| Phân trang | Dùng `meta.pagination.{limit,hasMore,nextCursor,total?}` cho danh sách. Nếu bảng FE cần `total`, đếm toàn bộ theo cùng filter và quyền, trước khi áp cursor/limit, trong cùng snapshot. Danh sách xem trước trả số đếm riêng và tập con có giới hạn. |
| Số tiền | Credit dùng `formatCredit` và VND dùng chuỗi số nguyên thập phân. Tổng hợp exact numeric/BigInt trong DB hoặc server. Tên field thể hiện đơn vị, ví dụ `paidAmountVnd` và `feeCredit`. |
| Quyền | `IdentityGuard` và kiểm tra live principal trong transaction. Đề xuất `dashboard:read` chỉ cấp ADMIN cho các số liệu toàn hệ thống. Khối phí yêu cầu thêm `credit:read:any`, khối payment yêu cầu thêm `payment:read:any`, drill-down đối soát giữ `payment:reconcile`. Kiểm tra quyền theo section trước khi đọc. Khi một section được yêu cầu nhưng thiếu quyền, trả `403`. |

### Danh sách route dự kiến

Mọi đường dẫn dùng tiền tố `/api/v1`.

| Route | Nhóm dữ liệu cần trả | Nguồn và API dùng lại |
| --- | --- | --- |
| `GET /admin/dashboard/overview` | `kpis`, `userGrowth`, `learningActivity`, `pathStages`, `feeSeries`, `topSkills`, `attentionSummary`, `priorityItems` | Dùng nguồn tổng hợp của Học tập và Finance cho metric trùng. `attentionSummary` dùng số đếm backend. Mỗi item ưu tiên có `type`, `id`, `status`, `createdAt` và label an toàn đủ để FE render. Dùng lại queues xác minh, yêu cầu học, tài liệu, tag và tranh chấp cho drill-down tương ứng. |
| `GET /admin/dashboard/learning` | `kpis`, chuỗi học tập, phân bố trạng thái, `topSkills`, breakdown theo bộ lọc FE | `LearningPath`, `LearningPlanVersion`, `Session` và bảng liên quan do module sở hữu. Nếu FE drill-down đến danh sách lộ trình hoặc session toàn hệ thống, bổ sung filter/list ADMIN tương ứng với màn đích. `learning-paths/mine` và `sessions/mine` giới hạn theo participant. |
| `GET /admin/dashboard/finance` | `kpis`, `feeSeries`, `paymentSeries`, `attentionSummary` và thông tin cần để mở danh sách payment/giao dịch | Tái sử dụng cách tính phí đã ghi nhận của Credit và đối soát đọc từ PostgreSQL của Payments. Danh sách dùng `GET /admin/payments` và `GET /admin/credit/transactions`. Drawer dùng `GET /admin/payments/:id`, `GET /admin/payments/:id/reconciliation`, `GET /admin/credit/transactions/:id` và `GET /admin/credit/operations/:id` theo loại item. |

## 1. Nền chung và hợp đồng dữ liệu

**File dự kiến** — `services/api/src/modules/admin-dashboard/admin-dashboard.module.ts`, `presentation/http/admin-dashboard.controller.ts`, `presentation/http/admin-dashboard-query.dto.ts`, `application/admin-dashboard.service.ts`, `application/dashboard-period.ts` trong module mới. Đăng ký ở `services/api/src/app.module.ts`. Nếu dùng permission mới, cập nhật `services/api/src/shared/authorization/permission.catalog.ts`, Admin grants trong `services/api/src/modules/users/infrastructure/persistence/prisma-users-repository.ts` và cơ chế cấp quyền cho DB đã chạy theo migration hiện có.

- [ ] Đối chiếu handoff FE khi có source và thêm ví dụ request/response của từng tab vào hợp đồng triển khai. Ghi lại điều kiện lấy số, timestamp, đơn vị và cặp `type/id` cho từng mục có drawer hoặc drill-down. KPI, chart và danh sách cùng định nghĩa chỉ tiêu phải dùng cùng predicate.
- [ ] Viết ca HTTP cho role USER/STAFF, Admin thiếu quyền, session hết hiệu lực, sai timezone, thiếu offset, `from >= to`, khoảng quá giới hạn và mã section sai. Viết ca kỳ qua nửa đêm Việt Nam, cuối tháng, mốc đúng `from` hoặc `to` và bucket rỗng.
- [ ] Chuẩn hóa query một lần thành `DashboardPeriod`. Dùng `TransactionRunner` và `SET TRANSACTION READ ONLY` trước câu đọc đầu tiên. Dùng một `TransactionContext` và một `asOf` cho snapshot của mỗi response. Dùng allowlist và tham số SQL bind cho timezone/granularity đã xác thực.
- [ ] Công bố Swagger cho params, metadata và lỗi. Xác minh `Cache-Control: no-store` với response quản trị. Kiểm tra quyền trực tiếp trên NestJS và ca Admin có quyền dashboard nhưng thiếu quyền đọc tài chính. Xác nhận section không được yêu cầu không gọi read model hoặc quyền riêng của section đó.

## 2. Màn Học tập

**File dự kiến** — `services/api/src/modules/learning-paths/application/services/dashboard-learning-path.reader.ts`, `services/api/src/modules/learning-sessions/application/services/dashboard-session.reader.ts` và các module sở hữu tương ứng. `AdminDashboardService` gọi reader qua module export và ghép `GET /learning`.

- [ ] Viết fixture gồm lộ trình chưa khóa, đang học, hoàn tất, hủy và tranh chấp. Thêm lịch dời sang kỳ khác, buổi học bù giữ cùng `sessionId` và lộ trình hai chiều có hai plan. Assert expected theo quy tắc FE và kiểm tra cùng bộ lọc trên KPI và breakdown.
- [ ] Triển khai readers với aggregate theo nhóm tại DB. Dùng status hiện tại khi chart mô tả snapshot. Với metric theo sự kiện, dùng đúng timestamp từ ma trận. Riêng `Session` cần kiểm tra nguồn mốc hoàn tất trước khi dùng cho chuỗi hoàn tất. `completeSession` đổi trạng thái và có thể cập nhật outcome, còn `finalizedAt` có thể đã được ghi trước lúc hoàn tất. Nếu FE yêu cầu mốc chuyển `COMPLETED`, xác minh event/lịch sử ghi nhận được mốc đó hoặc ghi nhận thiếu dữ liệu lịch sử. [Code chuyển trạng thái](../../../services/api/src/modules/learning-sessions/application/services/session-transitions.ts#L130)
- [ ] Nếu dùng `LearningPath.lastActivityAt`, kiểm tra migration `20261111000000_learning_path_activity` trong môi trường chạy và thêm fixture có một lộ trình phát sinh hoạt động ở hai kỳ. Chuỗi sự kiện phải đếm được hai mốc khi metric yêu cầu, còn danh sách hoạt động gần nhất chỉ có một item. Hai index migration hiện có bắt đầu bằng ID participant. Đo truy vấn toàn hệ thống theo quy trình ở task 5 nếu dashboard dùng field này. [Activity contract và rollout](../../../services/api/docs/learning-path-list.md)
- [ ] Ghi rõ top skills xếp theo chỉ tiêu FE, bảng nguồn, đơn vị đếm, cửa sổ thời gian và thứ tự đồng hạng. Nếu lấy từ lộ trình, dùng version của plan gắn với đối tượng được đếm và kiểm thử bản sửa plan cùng hướng học hai chiều.
- [ ] Nối `GET /learning`, xác nhận breakdown và danh sách drill-down có phạm vi tương ứng. Kiểm thử thêm bộ lọc có tổng vượt một trang và snapshot thay đổi giữa hai lần refresh.

## 3. Màn Credit & thanh toán

**File dự kiến** — `services/api/src/modules/credit/application/services/fee-policy-admin.service.ts`, `services/api/src/modules/credit/application/services/dashboard-credit.reader.ts`, `services/api/src/modules/payments/application/services/dashboard-payment.reader.ts` và các module sở hữu. Mở rộng DTO/reader danh sách finance hiện có khi cần bộ lọc FE hoặc `total` theo ma trận.

- [ ] Viết fixture với fee learning, fee tài liệu, refund ghi nhận ở bucket khác, operation thất bại, payment tạo kỳ trước và thanh toán kỳ sau, payment `REVIEW`, giá trị VND lớn và nhiều ledger entry thuộc cùng operation.
- [ ] Trích logic đọc fee hiện có để dùng lại trong snapshot dashboard, cho phép gom bucket theo timezone đã xác thực. Giữ response, timezone UTC và `day`/`month` của `GET /admin/fee-revenue`. Dùng cùng biểu thức fee/refund cho Overview và Finance. Phí vẫn dựa trên ledger và phép tính của báo cáo hiện có. [Fee reader](../../../services/api/src/modules/credit/application/services/fee-policy-admin.service.ts#L199)
- [ ] Tính payment theo timestamp từ FE. Nếu metric là tiền thực nạp trong kỳ, dùng mốc ghi nhận thanh toán thành công như `PayosCheckout.paidAt` và ghi rõ cách xử lý bản ghi cũ thiếu mốc. Đếm theo payment hoặc operation đúng nghĩa metric để tránh nhân tiền khi join ledger. So khớp tổng VND với payment và Credit được cộng với operation đã ghi nhận.
- [ ] Tái sử dụng `Payment.status=REVIEW` và trạng thái quyết toán của module Learning Paths để ánh xạ bucket cần xử lý theo FE. Nếu FE cần danh sách quyết toán và truy vấn hiện có chưa đáp ứng, bổ sung `GET /admin/dashboard/settlement-review` với cursor, permission tương ứng và projection tối thiểu. Các trường hợp chờ bình thường, retry và cần Admin xử lý có fixture riêng theo mapping FE. Dùng logic nghiệp vụ hiện hữu cho điều kiện quyết toán, tránh gọi API participant cho từng item.
- [ ] So khớp bộ lọc khi mở drill-down. Hai danh sách finance hiện lọc `createdAt` và dùng `to` bao gồm cận cuối. Nếu cần mở từ bucket `[from,to)` hoặc từ metric payment đã thanh toán theo `paidAt`, thêm filter/biến thể tương thích cho thao tác đó và kiểm thử cùng bộ dữ liệu. Bổ sung `meta.pagination.total` cho bảng yêu cầu tổng, tính từ predicate trước cursor. [Bộ lọc thời gian hiện tại](../../../services/api/src/shared/http/admin-finance-page.ts#L61)
- [ ] Nối `GET /finance`. Tái sử dụng danh sách, vùng chi tiết và báo cáo phí tại `/admin/credits` trong đợt tích hợp. Dùng `payment:reconcile` cho màn đối soát. Kiểm thử khi mở payment từ hàng chờ `REVIEW` và khi mở giao dịch từ bucket có filter thời gian. Dùng snapshot DB cho GET và giữ nguyên quy trình quyết toán, webhook và đối soát hiện có.

## 4. Màn Tổng quan và hàng đợi ưu tiên

**File dự kiến** — `services/api/src/modules/admin-dashboard/application/admin-dashboard.service.ts`, `services/api/src/modules/users/application/services/dashboard-user.reader.ts` và các reader trong module sở hữu hàng đợi tương ứng. Dùng các reader của task 2 và 3 cho chart và KPI trùng.

- [ ] Viết fixture có người dùng ở cả hai cận kỳ, hàng đợi lớn hơn `limit`, nhiều loại mục trùng thời điểm và item đã được xử lý. Kiểm thử `attentionSummary` và `priorityItems` phản ánh cùng snapshot.
- [ ] Tổng hợp user growth theo timestamp và phạm vi role/status do FE quy định. Khi có so sánh kỳ trước, dùng cửa sổ so sánh mà FE quy định và kiểm thử kỳ trước bằng 0. Dùng chung learning, fee và top skills reader cho các khối có cùng định nghĩa.
- [ ] Lấy predicate từ hàng đợi hiện hữu cho xác minh, yêu cầu học `PENDING_MODERATION`, tài liệu `PENDING_REVIEW` và tag `PENDING` khi các nhóm này xuất hiện trong handoff. Với nhóm báo cáo đang mở, dùng `GET /reports/support/queue` làm căn cứ. Mặc định gồm `OPEN`, `UNDER_REVIEW`, `NEED_MORE_INFO`, yêu cầu `report:moderate`. Dùng `caseId` cho `/admin/disputes/:id` và `incidentId` cho ngữ cảnh nhóm nếu FE cần. Kiểm thử hai case cùng incident để bảo đảm số đếm đúng đơn vị FE. Áp mapping priority do FE gửi trên tập mục đủ điều kiện, trước khi cắt danh sách xem trước. Support queue hiện sắp theo ID. Kiểm thử với case ưu tiên cao nằm ngoài trang đầu. [Support queue reader](../../../services/api/src/modules/reports/application/services/report-support.service.ts#L173)
- [ ] Nối `GET /overview`. So khớp query dashboard với `/admin` BFF đang trỏ tới các queue hiện hành. Xác minh status hiện tại không được trình bày như lịch sử tại ngày `to`.

## 5. Kiểm thử và bàn giao cho web

**File dự kiến** — `services/api/test/admin-dashboard.test.mjs`, `services/api/test/admin-dashboard.integration.test.mjs` và contract Swagger của module.

- [ ] Chạy theo thứ tự `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api build`, rồi `pnpm --filter api exec node --test test/admin-dashboard.test.mjs test/admin-finance.test.mjs test/backend-completion-gaps.test.mjs`. Chạy `test/admin-dashboard.integration.test.mjs` với PostgreSQL cô lập và `TEST_DATABASE_URL` theo harness repo. Ghi số case pass/fail/skip sau khi triển khai.
- [ ] Chạy `test/report-support.test.mjs` và `test/session-report-contracts.test.mjs` nếu dùng chung predicate report. Chạy `test/learning-platform/path-activity.integration.test.mjs` trên PostgreSQL cô lập nếu dùng `lastActivityAt`.
- [ ] Kiểm tra `EXPLAIN (ANALYZE, BUFFERS)` trên PostgreSQL test với dữ liệu đại diện cho kỳ dài nhất của selector. Đo query budget cho tab và section. Chỉ lên migration index nếu query plan cho thấy cần, kèm truy vấn bị ảnh hưởng và chỉ số trước/sau. Thay đổi quyền, nếu có, được triển khai cùng migration/grant ở task 1.
- [ ] Bàn giao route, Swagger và sample responses để FE gọi qua `/api/admin/...`. Trong đợt tích hợp web, thêm mapping GET cho dashboard ở `apps/web/src/lib/staff/policy.ts` và mở allowlist params cho từng route trong `apps/web/src/lib/staff/query.ts`. Kiểm tra query dashboard có đủ range, timezone, bucket và section. Kiểm tra regression cho bộ lọc ledger, payment, fee revenue và support queue đã được forward. Kích thử drill-down từ KPI/biểu đồ, paging và drawer, gồm việc mở đúng tab và filter tại `/admin/credits`. Chạy lần lượt `pnpm --filter web check-types` rồi `pnpm --filter web build` khi có thay đổi web.

## Constitution Check

| Nguyên tắc | Trạng thái |
| --- | --- |
| 1, 7 — Ownership | Pass ở mức thiết kế. `admin-dashboard` điều phối. Module sở hữu cung cấp read model và giữ logic nghiệp vụ. |
| 2, 3 — Storage và nhất quán | Pass ở mức thiết kế. PostgreSQL là nguồn dữ liệu, giao dịch đọc chung cho KPI, chart và counts. Xác minh runtime cùng fixture đồng thời trong task 5. |
| 4, 5 — Auth, privacy và contract | Pending runtime. Kiểm quyền live ở backend, projection tối thiểu, query validation, Swagger và chuỗi tiền exact theo task 1 và 3. |
| 6 — Kiểm thử | Pending triển khai. Cần bằng chứng API, PostgreSQL, query plan và kiểm tra proxy khi tích hợp web. |
| 8 — Jobs và webhooks | Không áp dụng cho các GET tổng hợp. Chúng đọc dữ liệu giao dịch đã ghi nhận. |

Không dự kiến ngoại lệ kiến trúc.
