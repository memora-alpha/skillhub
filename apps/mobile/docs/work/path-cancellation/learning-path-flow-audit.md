# Các vấn đề cần sửa trên mobile trong luồng lộ trình

- Ghi nhận: 2026-11-06T21:32:47+07:00.
- Nhánh/source đối chiếu: `fix/learning-path-flow`, HEAD `b6ce898f`.
- Trạng thái: source LP-01–04 đã sửa trên mobile sau khi người dùng yêu cầu bắt đầu; kiểm chứng và giới hạn nghiệm thu tại [status](status.md). Các mô tả hiện trạng dưới đây là lỗi ghi nhận trước sửa. LP-05 vẫn là đề xuất chưa triển khai.
- Phạm vi sửa: chỉ mobile Expo trong `apps/mobile`. Source API chỉ dùng đối chiếu contract và ghi giới hạn; không có công việc sửa BE trong kế hoạch này.
- Nguồn yêu cầu: SRS1.6, [contract mobile](../../contracts/path-cancellation.md), [title API](../../../../../services/api/docs/learning-path-list.md). Source/test cục bộ không chứng minh hành vi API đã triển khai hoặc nghiệm thu Android/iOS.

## LP-01 — Chặn tạo yêu cầu hủy sau khi đã hoàn thành tất cả buổi

Ưu tiên: cao. Phạm vi sửa trong kế hoạch này: mobile.

**Hiện trạng:** Path đã khóa, còn ACTIVE và chưa settled; tất cả Session đã COMPLETED. `canRequestTermination` vẫn trả true vì chỉ kiểm trạng thái Path, khóa, settlement, approval và yêu cầu đang mở. Màn chi tiết vẫn có nút hủy. API tạo yêu cầu cũng chưa kiểm toàn bộ buổi đã hoàn thành; tới bước duyệt mới từ chối bằng `TERMINATION_USE_FINAL_SETTLEMENT`. Yêu cầu PENDING còn hiệu lực có thể chặn quyết toán qua `pendingTermination`.

**Hướng sửa và tiêu chí:**

- [x] Mobile không cho tạo yêu cầu hủy mới khi tất cả buổi bắt buộc của cả thỏa thuận đã COMPLETED; dẫn về bước Hoàn tất. Kiểm đủ cả hai chiều với TWO_WAY, không suy hoàn thành từ một plan hoặc danh sách rỗng.
- [x] Áp dụng cùng điều kiện cho entry và màn hủy khi mở trực tiếp/deep link; vẫn xem, xử lý hoặc rút yêu cầu cũ theo quyền server.
- [x] Kiểm thử mobile cho ONE_WAY/TWO_WAY, còn buổi chưa hoàn thành, tất cả đã hoàn thành nhưng chưa settled, deep link và dữ liệu vừa thay đổi khi refresh. Giữ recovery/idempotency hiện có, không tự replay mutation.

Giới hạn API ngoài phạm vi: BE vẫn có thể nhận request mới từ client khác hoặc trong race với completion và chỉ chặn khi duyệt. Guard mobile không thay thế kiểm tra server. Yêu cầu đã tồn tại trước khi buổi cuối hoàn thành tiếp tục theo trạng thái/quyền API; mobile không tự đóng, bỏ blocker hoặc đổi quyết toán. Việc xác định quy tắc xử lý các request này thuộc công việc BE riêng, không phải điều kiện để thực hiện các sửa UI/mobile đã nêu.

Source: [policy mobile](../../../src/features/learning-paths/utils/termination-policy.ts), [entry chi tiết](../../../src/features/learning-paths/screens/ApiPathDetailScreen.tsx), [tạo/rút yêu cầu API](../../../../../services/api/src/modules/learning-paths/application/services/learning-change-state.ts), [duyệt hủy](../../../../../services/api/src/modules/learning-paths/application/services/path-termination.service.ts), [trạng thái quyết toán](../../../../../services/api/src/modules/learning-paths/application/services/path-settlement-status.service.ts).

## LP-02 — Hiển thị title trên danh sách “Lộ trình của tôi”

Ưu tiên: vừa. Phạm vi: mobile.

**Hiện trạng:** API danh sách đã có `title: string | null`, lấy từ Learning Request hoặc kỹ năng của kết nối trực tiếp. `pathSummarySchema` chưa khai báo nên loại trường này khi parse; card chỉ hiển thị tên đối tác, hình thức học, trạng thái và version. Nhiều lộ trình cùng đối tác khó phân biệt.

- [x] Giữ title qua adapter/type và hiển thị làm tiêu đề chính trên card.
- [x] Có fallback rõ ràng khi title null/không có; xử lý tiêu đề dài và màn nhỏ.
- [x] Kiểm response có title, null và khả năng tương thích API cũ nếu cần. Không thêm trường title tự chỉnh sửa khi API chưa hỗ trợ.

Source: [schema](../../../src/features/learning-paths/api/learning-paths-contract.ts), [card danh sách](../../../src/features/learning-paths/components/ApiPathsContent.tsx).

## LP-03 — Làm rõ trạng thái và thời gian sau khi rút yêu cầu hủy

Ưu tiên: vừa. Phạm vi: mobile; dữ liệu thời gian đã có trong API.

**Hiện trạng:** title đã có “Đã rút yêu cầu”, nhưng nội dung vẫn là “Bạn đã gửi yêu cầu” hoặc “Đối tác đã gửi yêu cầu”. Card không hiển thị `createdAt`/`closedAt`; chỉ PENDING có hạn phản hồi. Backend ghi `closedAt` khi chuyển WITHDRAWN và mobile đã parse trường này.

- [x] Hiển thị rõ “Bạn/Đối tác đã rút yêu cầu hủy”, thời gian gửi và thời gian rút từ server.
- [x] Nói rõ yêu cầu này không còn hiệu lực. Chỉ khẳng định lộ trình vẫn tiếp tục nếu trạng thái Path hiện tại phù hợp; không dùng copy đó cho lịch sử cũ của Path đã hủy/hoàn thành.
- [x] Không tự dựng thời gian rút từ giờ thiết bị; thiếu timestamp phải có fallback trung thực.
- [x] Các trạng thái lịch sử khác có nhãn/thời gian tương ứng: hết hạn, bị từ chối, đã áp dụng. Phân biệt thời điểm duyệt hủy và thời điểm xử lý Credit.
- [x] Kiểm cả hai vai trò, phản hồi rút thành công và refresh chậm/lỗi; không còn CTA phản hồi trên yêu cầu đã rút.

Source: [request card](../../../src/features/learning-paths/components/termination-request-card.tsx), [response schema](../../../src/features/learning-paths/api/path-changes-contract.ts), [labels/quyền](../../../src/features/learning-paths/utils/termination-policy.ts).

## LP-04 — Tách yêu cầu đang xử lý khỏi lịch sử hủy

Ưu tiên: vừa. Phạm vi: mobile.

**Hiện trạng:** màn hủy render form mới và tất cả request cùng một danh sách card đầy đủ, chưa có nhóm lịch sử. Sau khi rút, form mới xuất hiện phía trên request cũ. Mở từ thông báo cũ đưa request đó lên đầu, kể cả khi đã có request mới đang xử lý.

- [x] Phân nhóm yêu cầu đang xử lý và “Lịch sử yêu cầu hủy”; đề xuất lịch sử thu gọn với trạng thái/thời gian rõ.
- [x] Ưu tiên nhận biết yêu cầu hiện tại; deep link vẫn làm nổi bật đúng request đích nhưng không khiến request cũ trông như đang hiệu lực.
- [x] Kiểm chuỗi gửi → rút → gửi lại, nhiều lịch sử và mở thông báo cũ.
- [x] Giữ giới hạn 100 request của API, thông báo giới hạn hiện có và hành vi loading/error/denied.

Source: [màn hủy](../../../src/features/learning-paths/screens/cancellation-screen.tsx).

## LP-05 — Đề xuất bộ lọc danh sách, chưa chốt yêu cầu

Đây là đề xuất UX, không phải lỗi nghiệp vụ đã xác nhận. Bộ lọc hiện có Tất cả / Đã xác nhận / Đang trao đổi. Có thể bổ sung Đang học / Hoàn thành / Đã hủy; cần chốt mapping status và cách lọc qua các trang dữ liệu trước khi triển khai.

Source: [bộ lọc](../../../src/features/learning-paths/utils/path-list-filter.ts).

## Bằng chứng kiểm tra và giới hạn

- 26 test hiện có trong `path-changes-ui`, `path-changes-api`, `learning-paths-list-ui`, `path-list-filter` chạy pass bằng Node/tsx. Các test này chưa bao phủ đầy đủ những lỗi nêu trên.
- Chạy trực tiếp với fixture: toàn bộ session COMPLETED nhưng `canRequestTermination(path, []) === true`; parse summary có title nhưng output không còn title.
- Đã đối chiếu source tạo, duyệt, rút và blocker quyết toán API; chưa chạy tái hiện trên API đích/database thật.
- Bằng chứng trên thuộc lượt rà soát trước sửa. Kết quả triển khai và test mới nằm ở [status](status.md); chưa nghiệm thu API thật/Android/iOS, chưa commit/push. LP-05 chỉ thực hiện khi được chốt.
