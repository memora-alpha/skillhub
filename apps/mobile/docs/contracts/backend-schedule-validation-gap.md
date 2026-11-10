# BE cần bổ sung chi tiết lỗi thời gian lịch

Trạng thái: **đề xuất bàn giao BE, chưa triển khai/chưa nghiệm thu API**. Phạm vi là lỗi thời gian khi kiểm tra và chốt Learning Path. Tài liệu này không thay wire contract hiện hành và không yêu cầu thay nghiệp vụ hoặc sửa backend trong nhánh mobile.

## Vấn đề đã xác minh

- `POST /api/v1/learning-paths/:pathId/final-validation` và `POST /api/v1/learning-paths/:pathId/finalize` cùng đi qua `validateForFinalizeTx` trong [learning-paths.service.ts](../../../../services/api/src/modules/learning-paths/application/services/learning-paths.service.ts).
- `validateScheduleTimes` dùng giờ DB (`CURRENT_TIMESTAMP`) và configuration `session.durationMinutes`, nhưng chỉ ném `ConflictException("INVALID_SCHEDULE_ITEMS")`. Response409 không cho biết chiều dạy, buổi hoặc điều kiện nào sai.
- Mobile đang đối chiếu lịch đã tải với giờ thiết bị và giới hạn60–180 để hỗ trợ hiển thị. Cách này không xác định chắc kết quả server nếu đồng hồ/config khác hoặc snapshot lịch đã cũ. Mục tiêu cần đạt: chỉ rõ **lịch do ai dạy, ai học; buổi nào; khoảng giờ nào; vì sao không hợp lệ** theo dữ liệu thực sự được BE kiểm tra.
- [http-exception.filter.ts](../../../../services/api/src/shared/http/http-exception.filter.ts) hiện chỉ cho phép public scheduling details cho `SCHEDULE_CONFLICT` và `INSUFFICIENT_AVAILABLE_CREDIT`. Chỉ thêm object vào exception của service sẽ chưa đủ để đưa chi tiết lỗi thời gian tới client.

## Công việc BE cần làm

1. **Thu thập tất cả buổi sai trong snapshot/version đang kiểm tra.** Thay nhánh `.some(...)` bằng kết quả chi tiết có định danh. Giữ liên kết mỗi item với plan, teacher/learner và schedule/version; không chỉ trả sessionNo vì hai chiều đều có thể có Buổi1. Không lấy người gọi API làm chủ lịch bị lỗi.
2. **Giữ HTTP409 và message `INVALID_SCHEDULE_ITEMS`, bổ sung `details` có schema cố định.** Dùng cùng cấu trúc cho final-validation và finalize. Trả giờ DB đã dùng đánh giá và giới hạn thời lượng thực tế đã đọc từ configuration; không dùng thời gian request của thiết bị để kết luận.
3. **Bổ sung bộ lọc public details.** Trong HttpExceptionFilter, validate/allowlist riêng cho mã này: UUID, version/sessionNo nguyên dương, timestamps ISO8601, reason enum và duration policy. Không truyền nguyên object exception/record DB ra response. Bộ lọc phải cho phép endAt<=startAt trong chi tiết lỗi để không làm mất chính lỗi cần báo.
4. **Cập nhật OpenAPI và contract/test.** Mở rộng `finalizeConflictSchema` ở [learning-paths.controller.ts](../../../../services/api/src/modules/learning-paths/presentation/http/learning-paths.controller.ts), cùng contract HTTP backend liên quan, với ví dụ một chiều/hai chiều và nhiều buổi sai.
5. **Giữ kiểm tra lại trong transaction finalize.** Final-validation chỉ là kết quả tại thời điểm đánh giá, không giữ chỗ hoặc bảo đảm lần chốt sau sẽ thành công. Finalize vẫn kiểm tra thời gian/quyền/version và rollback khi không hợp lệ; không tạo Session/Hold hay khóa lịch nếu thất bại. Giữ idempotency/replay hiện hành.

## Response đề xuất để BE chốt contract

Tên field/enum dưới đây là **đề xuất mới**, chưa có trong API hiện tại. `teacherId` là người dạy của plan bị lỗi, `learnerId` là người học; đây không phải quy kết người có lỗi hay người gây thiệt hại. Tên hiển thị có thể lấy từ profile đã được phép đọc, không cần thêm dữ liệu cá nhân vào response.

```json
{
  "success": false,
  "message": "INVALID_SCHEDULE_ITEMS",
  "statusCode": 409,
  "details": {
    "pathId": "00000000-0000-4000-8000-000000000030",
    "pathVersion": 3,
    "evaluatedAt": "2030-01-02T12:00:00.000Z",
    "durationMinutes": { "min": 60, "max": 180 },
    "invalidItems": [
      {
        "planId": "00000000-0000-4000-8000-000000000011",
        "planVersion": 2,
        "scheduleId": "00000000-0000-4000-8000-000000000050",
        "scheduleVersion": 4,
        "teacherId": "00000000-0000-4000-8000-000000000001",
        "learnerId": "00000000-0000-4000-8000-000000000002",
        "sessionNo": 1,
        "startAt": "2030-01-02T10:00:00.000Z",
        "endAt": "2030-01-02T11:00:00.000Z",
        "reasons": ["START_NOT_IN_FUTURE"]
      }
    ]
  }
}
```

| Reason đề xuất | Điều kiện dựa trên snapshot BE | Nội dung mobile cần hiển thị |
| --- | --- | --- |
| `START_NOT_IN_FUTURE` | startAt<=evaluatedAt (giờ DB) | Giờ bắt đầu đã qua hoặc không sau thời điểm kiểm tra |
| `END_NOT_AFTER_START` | endAt<=startAt | Giờ kết thúc phải sau giờ bắt đầu |
| `DURATION_OUT_OF_RANGE` | endAt>startAt và số phút nằm ngoài min/max configuration | Thời lượng thực tế và khoảng phút được phép |

Mỗi item có thể có nhiều reason độc lập, ví dụ giờ bắt đầu đã qua và thời lượng quá ngắn. Với endAt<=startAt, dùng reason về thứ tự thời gian, tránh thông báo thời lượng âm gây khó hiểu. Không thêm reason cho quy tắc sản phẩm chưa tồn tại.

Trả đủ các buổi sai trong phạm vi số plan/buổi tối đa được hệ thống cho phép, sắp ổn định theo planId/sessionNo. Nếu BE cần giới hạn số item trả về, contract phải có tổng số lỗi và cờ còn mục chưa hiển thị; không cắt âm thầm. Các ID/version phải thuộc Path và snapshot đã được actor cấp quyền đọc; không lấy dữ liệu Path khác.

## Tiêu chí kiểm thử BE

- ONE_WAY: đúng teacher/learner, plan/schedule/version và sessionNo của buổi sai; không nhầm actor đang bấm kiểm tra với teacher.
- TWO_WAY: chỉ lịchA sai, chỉ lịchB sai, cả hai sai; cả hai cùng sessionNo1 vẫn phân biệt được. Nhiều buổi sai phải trả đủ với reason đúng từng buổi.
- Biên giờ: startAt bằng giờ DB phải thất bại; startAt sau giờ DB và thời lượng hợp lệ phải qua bước kiểm thời gian. Giờ thiết bị nhanh/chậm không thay kết quả/reason BE.
- Biên thời lượng: đúng min/max configuration được chấp nhận; dưới min/trên max và endAt<=startAt trả reason tương ứng. Test policy khác60–180 để chứng minh response lấy configuration thật.
- Final-validation thành công, sau đó thời gian trôi qua khiến lịch không hợp lệ: finalize trả lỗi409 với đánh giá mới, không tạo Hold/Session/lock; không tái sử dụng kết quả kiểm tra cũ để bỏ qua validation.
- Test tích hợp đi qua **service → HttpExceptionFilter → HTTP JSON**, xác nhận details còn đủ trên cả hai endpoint, đồng thời giữ fallback message/status cho client cũ. Unit test service riêng không đủ.
- Người ngoài Path không nhận details. Payload details sai schema không bị phản chiếu nguyên trạng. OpenAPI và response thực tế phải khớp.

## Phần mobile phải nối sau khi BE chốt và triển khai

- Thêm schema của `INVALID_SCHEDULE_ITEMS` trong [scheduling-error.ts](../../src/lib/http/scheduling-error.ts) và `SchedulingErrorDetails`. Hiện `readSchedulingError` chỉ nhận hai mã lỗi scheduling khác nên sẽ bỏ details mới nếu chưa sửa adapter.
- Đọc các ID/version/reason server; đối chiếu đúng Path và phiên đang mở. Ưu tiên lý do BE, không tính lại bằng Date.now để thay kết luận server. Nếu snapshot màn đã thay đổi, thông báo cần tải lại/xem lịch mới, không gắn lỗi cũ vào phiên bản khác.
- Tên từ profile chỉ dùng trình bày; thiếu tên thì dùng bạn/đối tác theo teacherId/learnerId. Link sửa chỉ dành cho lịch mình dạy; lịch đối tác mở màn đọc.
- Giữ fallback rõ ràng cho API cũ/thiếu details và test malformed details. Kiểm thử API thật bằng hai tài khoản sau khi BE triển khai.
- **Lỗi mobile độc lập đã sửa source:** [ApiHoldScreen.tsx](../../src/features/learning-paths/screens/ApiHoldScreen.tsx) xóa `checked` ngay khi bắt đầu finalize; sau khi bị từ chối không còn thông báo xanh/nút chốt dựa trên kết quả cũ, cần kiểm tra lại. Recovery riêng cho kết quả chưa rõ được giữ. Đây là sửa frontend, không phải phần BE phải sửa; xem kiểm chứng mới nhất trong [status](../work/phase-05-proposal-learning-agreement/status.md).
