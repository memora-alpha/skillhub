# Chi tiết lỗi thời gian lịch học

Trạng thái: **BE đã triển khai trong source `ecf5ad79`; mobile đã nối contract, chưa nghiệm thu API triển khai/native**. Phạm vi là lỗi thời gian khi kiểm tra và chốt Learning Path.

## Contract đã đối chiếu

- `POST /api/v1/learning-paths/:pathId/final-validation` và `POST /api/v1/learning-paths/:pathId/finalize` cùng kiểm tra snapshot lịch trong `validateForFinalizeTx`.
- HTTP409 giữ message `INVALID_SCHEDULE_ITEMS`, thêm `details.invalidItems`, `details.evaluatedAt` và `details.durationMinutes`. Hai endpoint dùng cùng schema. Public error filter validate/allowlist trước khi trả chi tiết; OpenAPI đã mô tả cấu trúc này.
- `evaluatedAt` là giờ DB dùng để đánh giá; `durationMinutes.min/max` lấy từ cấu hình thực tế. Các buổi sai được thu thập trước Hold/Session/lock; finalize tiếp tục kiểm tra lại, không dùng kết quả final-validation để bỏ qua validation.
- Mỗi item định danh plan, schedule, version, teacher/learner, số buổi và khoảng giờ. `teacherId` là người dạy, không mặc định là người gọi API hoặc người gây lỗi.

```json
{
  "success": false,
  "message": "INVALID_SCHEDULE_ITEMS",
  "statusCode": 409,
  "details": {
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

| Reason thực tế | Điều kiện BE | Nội dung mobile |
| --- | --- | --- |
| `START_NOT_IN_FUTURE` | startAt <= evaluatedAt | Giờ bắt đầu đã qua |
| `END_NOT_AFTER_START` | endAt <= startAt | Giờ kết thúc phải sau giờ bắt đầu |
| `DURATION_TOO_SHORT` | Thời lượng dưới min | Thời lượng thực tế và số phút tối thiểu |
| `DURATION_TOO_LONG` | Thời lượng trên max | Thời lượng thực tế và số phút tối đa |

Khác bản đề xuất trước: response không có pathId/pathVersion và không dùng `DURATION_OUT_OF_RANGE`; hai reason thời lượng tách riêng. `invalidItems` có1–200 mục; reason mỗi mục có1–4 giá trị không trùng. Version/sessionNo và duration policy là số nguyên dương; min không lớn hơn max. Chi tiết cho phép endAt <= startAt để hiển thị chính lỗi đó.

## Mobile đã tích hợp

- [HTTP adapter](../../src/lib/http/scheduling-error.ts) chỉ giữ chi tiết hợp lệ cho đúng mã lỗi409, bỏ field lạ và từ chối payload thiếu/sai schema. Hai mã trùng lịch/thiếu Credit giữ contract cũ.
- [Đối chiếu snapshot](../../src/features/learning-paths/utils/invalid-schedule-items.ts) kiểm plan/schedule ID, version, teacher/learner, sessionNo và timestamps với Path đang mở. [Màn kiểm tra/chốt](../../src/features/learning-paths/screens/ApiHoldScreen.tsx) giữ dấu nhận diện snapshot đã gửi để phát hiện cả thay đổi currentVersion của Path. Một mục không khớp khiến toàn bộ kết quả chuyển sang thông báo tải lại, không gắn lỗi vào lịch khác.
- [Feedback](../../src/features/learning-paths/components/schedule-validation-feedback.tsx) ưu tiên reason và giới hạn BE; không dùng Date.now hoặc60–180 để thay kết luận server. Mỗi buổi sai có lý do ngắn, tên kỹ năng/người dạy và khoảng giờ. `evaluatedAt` vẫn được validate trong details nhưng không hiển thị thời điểm máy chủ cho người dùng. Ngày giờ theo múi giờ thiết bị, chỉ chú thích một lần ở màn lịch.
- Profile chỉ cung cấp tên hiển thị. Thiếu tên dùng bạn/đối tác theo ID. Lịch mình dạy có link sửa; lịch đối tác mở danh sách đọc. Kết quả khác snapshot không có link sửa dựa trên dữ liệu cũ.
- API cũ/thiếu hoặc sai details giữ đối chiếu sơ bộ theo lịch đã tải và giờ thiết bị; giao diện yêu cầu tải lại để kiểm tra chi tiết mới nhất. Không có bằng chứng local thì không đoán lịch của ai sai.
- Finalize xóa kết quả kiểm tra thành công cũ ngay khi gửi. Lỗi thời gian yêu cầu kiểm tra lại; recovery của kết quả chưa rõ vẫn giữ đúng intent/key.

## Kiểm chứng và giới hạn

- Source BE có regression cho cả endpoint, hai chiều, nhiều buổi, giờ DB, giới hạn cấu hình, đúng version hiện hành và public HTTP filter. Việc đọc source/test không chứng minh deployment đã chạy bản sửa.
- Mobile có regression HTTP boundary, malformed details, reason/giới hạn server, hai chiều cùng Buổi1, nhiều lỗi, stale owner/version/item và chuyển lỗi giữa kiểm tra/chốt. Kết quả checks hiện hành ở [status](../work/phase-05-proposal-learning-agreement/status.md).
- Còn nghiệm thu bằng hai tài khoản trên API đã triển khai và Android/iOS thật: thời gian trôi qua giữa kiểm tra/chốt, chỉnh lịch đồng thời, đồng hồ thiết bị lệch và lỗi không phát sinh Hold/Session/lock. Không thực hiện mutation thật trong lượt tích hợp source.
