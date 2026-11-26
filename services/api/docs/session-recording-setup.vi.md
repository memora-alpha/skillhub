# Bật ghi hình Session

Hướng dẫn vận hành cho [spec 020](../specs/020-session-recording/spec.md). Code đã có sẵn nhưng tính
năng mặc định tắt. Làm đủ các bước dưới đây theo thứ tự.

## 0. Điều kiện trước khi bật trên production

- [ ] SRS đã bổ sung phần ghi hình (hiện SRS 1.7 M08 chưa có).
- [ ] Pháp lý đã duyệt nội dung xin đồng ý theo Nghị định 13/2023. Nội dung phải nêu mục đích chính
      (học lại) và mục đích phụ (bằng chứng khi có report), thời gian lưu 90 ngày và quyền xóa.
- [ ] Đã có báo giá Egress của LiveKit Cloud để đặt `recording.monthlyAlertMinutes`.
- [ ] Đã chạy thử ở môi trường test (mục 5) và ghi lại dung lượng file thật mỗi giờ.

Môi trường dev và staging không cần các điều kiện trên.

## 1. Key upload riêng cho Egress

Egress của LiveKit Cloud tự tải file lên bucket hiện có (`S3_BUCKET`, cùng `STORAGE_ENDPOINT` và
`STORAGE_REGION`). Key của Egress được gửi sang LiveKit trong mỗi lần bắt đầu ghi, nên phải là key
riêng, **chỉ được ghi vào prefix `recordings/`**. API vẫn đọc, ký link và xóa bằng key storage
hiện có.

Ví dụ policy kiểu AWS S3 (đổi tên bucket; nhà cung cấp S3-compatible khác có cú pháp tương tự):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/recordings/*"
    }
  ]
}
```

Key này không được có quyền `GetObject`, `DeleteObject` hay `ListBucket`. Nếu key bị lộ ở phía
provider, kẻ xấu chỉ ghi thêm được file vào `recordings/`, không đọc hay xóa được bản ghi nào.

## 2. Biến môi trường

```dotenv
STORAGE_ENABLED=true
# STORAGE_ENDPOINT, STORAGE_REGION, S3_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY đã có sẵn.
RECORDING_STORAGE_ACCESS_KEY_ID=...
RECORDING_STORAGE_SECRET_ACCESS_KEY=...
```

Phải đặt cả cặp. Đặt một nửa, hoặc đặt khi `STORAGE_ENABLED` không phải `true`, thì API không khởi
động và báo `Invalid recording storage configuration: <tên biến>`, không in giá trị. Khi không đặt cặp
này, mọi yêu cầu ghi trả `503 RECORDING_UNAVAILABLE`. `LIVEKIT_URL`, `LIVEKIT_API_KEY` và
`LIVEKIT_API_SECRET` cũng phải có.

## 3. Webhook

Dùng lại webhook hiện có (`https://YOUR_API_HOST/api/v1/livekit/webhook`). Trong LiveKit Cloud, bật
thêm các sự kiện `egress_started`, `egress_updated` và `egress_ended`. Nếu webhook bị mất, worker đối
soát sẽ tự sửa trong vài phút, nhưng chỉ báo "đang ghi" sẽ trễ hơn.

## 4. Seed và config

Lần deploy Docker đầu tiên chạy request seed `session-recording-20261126` (`identity` và
`configuration`). Seed này cấp quyền `session-recording:manage:participant` cho USER và tạo 5 config
key, với `recording.enabled = false`. Khi chạy tay trong container đã build:

```powershell
corepack pnpm --filter api identity:seed
corepack pnpm --filter api db:seed-configuration:built
```

Admin bật tính năng qua system configuration:

| Key                             | Mặc định               | Ghi chú                                                  |
| ------------------------------- | ---------------------- | -------------------------------------------------------- |
| `recording.enabled`             | `false`                | Công tắc tổng. Tắt thì worker dừng mọi Egress đang ghi.  |
| `recording.kind`                | `ROOM_COMPOSITE_VIDEO` | `AUDIO_ONLY` để chỉ ghi âm, rẻ hơn và nhẹ hơn.           |
| `recording.retentionDays`       | `90`                   | Số ngày sau `endAt`; report đang mở giữ bản ghi lâu hơn. |
| `recording.overrunMinutes`      | `10`                   | Giới hạn = thời lượng Session + số phút này.             |
| `recording.monthlyAlertMinutes` | `0` (tắt)              | Ngưỡng phút/tháng để log cảnh báo.                       |

Cảnh báo `RECORDING_MONTHLY_MINUTES_ALERT` chỉ là một dòng log mức warn, mỗi tháng một lần cho mỗi
process. Muốn nhận cảnh báo thì cấu hình log alert theo chuỗi này.

## 5. Chạy thử thật (task T020)

Cần hai tài khoản tham gia cùng một Session, LiveKit Cloud project test và bucket test.

1. Bật `recording.enabled` ở môi trường test. Cả hai vào phòng bằng token lấy từ API.
2. Người học gọi `POST /api/v1/sessions/:id/recordings`; giáo viên nhận thông báo và gọi `accept`.
   Bản ghi chuyển `STARTING` rồi `RECORDING`; room metadata có `recording`.
3. Ghi khoảng 5 phút có chia sẻ màn hình, rồi gọi `stop`. Chờ `READY`.
4. Gọi `playback`, mở link, kiểm tra tua được (range request) và âm thanh, hình, màn hình đều có.
5. Ghi lại `bytes` và `durationMs`, quy ra MB mỗi giờ cho cả video và `AUDIO_ONLY`.
6. Kiểm tra lỗi: tắt `recording.enabled` khi đang ghi (worker dừng trong 1 phút, lý do `DISABLED`);
   rời phòng khi đang ghi (kết thúc `ROOM_FINISHED`); xóa bản ghi và xác nhận object biến mất khỏi
   bucket.
7. Mở một report trên Session, xác nhận `DELETE` trả `409 RECORDING_HELD_BY_REPORT`, và handler xem
   được qua `staff-review` kèm một dòng audit.

## 6. Ước lượng chi phí

- Egress tính theo phút ghi; số phút mỗi tháng xem ở log cảnh báo hoặc tổng `duration_ms` trong
  `session_recordings`.
- Dung lượng lưu trữ ≈ MB mỗi giờ (mục 5) × số giờ ghi trong 90 ngày.
- Bản ghi bị report giữ lại sẽ nằm lâu hơn 90 ngày.
