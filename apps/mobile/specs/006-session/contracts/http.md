# HTTP integration Session

API base `/api/v1`; shared client unwrap success/data, không unwrap lần hai. Authenticated, kiểm tra user/generation trước và sau. Baseline: [checkpoint](../contracts.md).

| Operation          | Request                                                                              | Response chọn lọc                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list               | GET `/sessions/mine?from={iso}&to={iso}`                                             | Mảng SessionSummary; không requestPage/cursor/total.                                                                                                     |
| detail             | GET `/sessions/{sessionId}`                                                          | Detail id/participant đúng; allowlist fields. Attendance seconds trả decimal string; smoke JSON đã pass hai account sau fix BE được người dùng cho phép. |
| complete           | POST `/sessions/{sessionId}/confirm-completion`, `{}` hoặc note ≤1000                | `{id,status}`, không phải full detail.                                                                                                                   |
| propose reschedule | POST `/sessions/{sessionId}/reschedule-proposals`, `{expectedVersion,startAt,endAt}` | `{id: scheduleProposalId,version,status}`, chỉ sau read gate.                                                                                            |
| confirm reschedule | POST `/schedule-proposals/{scheduleId}/confirm`, `{expectedVersion}`                 | `{id,version,bothConfirmed,status}`, chỉ phiên bản đang xem.                                                                                             |

## Read contract đổi lịch còn thiếu

Không đặt GET giả hoặc mở backend task. Owner backend cung cấp route/DTO participant-only đọc proposal/version/items/confirmations và lịch có hiệu lực từ sessionId sau reload. Khi có, cập nhật checkpoint/schema. Fields ở [data model](../data-model.md) là nhu cầu, chưa là DTO server được chốt.

## Gửi và phục hồi

- Mutation retry false, POST replayAfterRenewal false; không Idempotency-Key với guarantee chưa chứng minh.
- Trước complete đọc lại detail/participant/confirmation. Sau endAt ở state hợp lệ có thể gửi; không đợi client tự chuyển AWAITING_CONFIRMATION. Server clock quyết định cuối.
- Success: giữ receipt, khóa command và refetch detail/list cùng generation. Refetch lỗi báo đã ghi nhận nhưng chưa cập nhật; không gửi lại.
- Timeout/5xx sau POST: outcome uncertain, giữ form và GET reconcile trước retry. Với complete, confirmation đã ghi thì không resend. Với đổi lịch chỉ retry khi read contract đủ xác định outcome; chưa phân biệt được thì giữ khóa.
- GAP-02 cần kiểm chứng conflict ở final confirmation; local validation không thay server.

## Lỗi và bảo vệ dữ liệu

- 403/404 ẩn/xóa detail cache; UUID sai không request hoặc lookup preview.
- 409 state/version/cutoff/conflict: thông báo nghiệp vụ, đọc lại, yêu cầu xem state mới, không tự retry.
- 401 dùng auth renewal sẵn có, POST không replay; đọc lại và người dùng thử nếu hợp lệ. Kết quả cũ không ảnh hưởng account mới.
- Protocol/status/participant sai không báo success hoặc fallback mock.
- Network failure dùng ConnectionGate; reconnect chỉ GET, không mutation.

Không gọi endpoint settlement, không log token/room metadata hoặc fields private không dùng.
