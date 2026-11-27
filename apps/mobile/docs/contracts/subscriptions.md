# Gói thành viên trên mobile

Đối chiếu source BE tại `dev@126699c4`, module `services/api/src/modules/subscriptions`
và [contract 021](../../../../services/api/specs/021-subscriptions/contracts.md).
Chỉ thay đổi `apps/mobile`; chưa xác minh API đã triển khai.

## Endpoint đang dùng

Các đường dẫn dưới `/api/v1`, dùng HTTP/session runtime hiện có.

| Endpoint | Mobile |
| --- | --- |
| `GET /subscriptions/plans` | Phiên bản CREATOR/PRO đã duyệt và có hiệu lực; giá Credit dạng chuỗi, quyền lợi từ response. |
| `GET /me/subscription` | Gói hiện tại hoặc null, entitlements, usage hoặc null, materialStorage cho cả Free. |
| `POST /me/subscription` | `{planCode, interval, expectedPlanVersionId}`, header `Idempotency-Key`. Source thực tế trả toàn bộ membership qua `me()`, không chỉ subscription như phần mô tả ngắn trong contract BE. |
| `GET /me/subscription/upgrade-quote?planCode=PRO` | Lấy amount, planVersionId và version mới trước xác nhận. |
| `POST /me/subscription/upgrade` | `{planCode, expectedPlanVersionId, expectedAmount, expectedVersion}`, cùng idempotency; trả membership. |
| `PATCH /me/subscription` | expectedVersion; bật/tắt autoRenew, hẹn đổi gói/chu kỳ hoặc xóa lịch bằng null. Trả membership. |
| `GET /me/subscription/charges?limit=20&cursor=…` | PURCHASE/UPGRADE/RENEWAL/RECORDING_ADDON, mới nhất trước, cursor từ BE. |

## Nghiệp vụ và lifecycle

- FREE là không có subscription hiện hành. Không suy Free khi read chưa xong hoặc lỗi.
- MONTH = 30 ngày, YEAR = 365 ngày; không gọi là tháng/năm lịch. Phút ghi hình cấp theo kỳ 30 ngày bên trong thời hạn gói.
- Giá, quota và quyền lợi từ API. Không hardcode giá, phần trăm giảm phí, ngày grace hay phút add-on. feeTier không cung cấp tỷ lệ phí số cụ thể.
- Mua gói tự bật gia hạn. Tắt gia hạn không hoàn Credit; quyền lợi giữ đến hết kỳ. GRACE còn quyền lợi đến graceUntil; BE xử lý thu phí/gia hạn/hết hạn.
- Nâng CREATOR → PRO cần ACTIVE và giữ chu kỳ hiện tại; báo giá tính ở BE, không tính prorata trên mobile. Version/giá thay đổi khóa xác nhận cũ; báo giá thay đổi tại POST yêu cầu lấy lại.
- Hạ gói/đổi chu kỳ có hiệu lực ở lần gia hạn tới theo giá hiệu lực khi đó. UI nhắc nếu autoRenew đang tắt; không tự bật lại khi hẹn đổi.
- Lưu `{key, command}` vào SecureStore trước POST, key phân vùng bằng hash của owner và API URL. Không ghi được thì không POST. Native store serialize cùng owner/environment, chỉ xóa đúng key. Web preview chỉ đọc/quản lý gia hạn; không POST thu Credit khi thiếu durable store.
- Mất phản hồi, protocol, 5xx, 401/403 hoặc lỗi xóa intent giữ recovery và khóa giao dịch mới. Chỉ lỗi nghiệp vụ xác định trước commit mới cho cleanup. `IDEMPOTENCY_KEY_REUSED` giữ intent để hỗ trợ đối chiếu.
- BE subscription chưa có lookup như voucher. Thẻ **Hoàn tất đăng ký/Hoàn tất nâng cấp** dùng nút **Tiếp tục thanh toán** chủ động POST lại đúng endpoint/body/key; có thể thực hiện giao dịch nếu lần trước chưa chạy, hoặc replay kết quả cũ mà không thu thêm. Không gọi đây là thao tác chỉ đọc. Nội dung sản phẩm ngắn, không trình bày chi tiết kỹ thuật; lỗi sau thao tác dùng toast.
- Bootstrap/focus/reconnect/background không tự POST hoặc replay. Scope generation bảo vệ kết quả, cache và điều hướng khi đổi tài khoản; invalidate membership/charges/wallet sau kết quả, không tính lại số dư trên client.
- PATCH dùng version guard, không tự replay sau refresh token; lỗi không báo thành công, invalidate để đọc trạng thái trước khi xác nhận lại.
- Query chỉ chạy khi focus/phiên hiện hành, hủy read khi blur; báo giá bị hủy và hộp xác nhận đóng khi rời màn.

## Entry và phần liên quan

- `/membership`: Hồ sơ có thẻ trên nhóm shortcut chứa Ví; entry phụ từ Ví và account menu. Hai lựa chọn Creator/Pro, chu kỳ, quyền lợi theo gói được chọn và footer xác nhận cố định; chọn thẻ/chu kỳ chỉ đổi trình bày, không gửi mutation.
- `/membership/manage`: thẻ gói hiện tại dẫn đến usage/quota và quản lý gia hạn; PATCH/version guard như contract phía trên. Cả trang chọn gói và quản lý đều có Lịch sử trên header cố định.
- Gia hạn dùng dòng thao tác Hủy tự động gia hạn/Tiếp tục gia hạn, luôn qua xác nhận trước PATCH; không dùng switch đổi trạng thái ngay. Tham khảo cách đặt hành động hủy trong [Spotify](https://support.spotify.com/us/article/cancel-premium/) và [Apple Subscriptions](https://support.apple.com/en-us/118428).
- Lỗi/thành công sau mua, nâng cấp, thay đổi gia hạn hoặc tiếp tục yêu cầu dùng toast chung, chỉ khi màn/phiên còn hoạt động. Lỗi đọc/lưu/recovery và xác nhận cũ dùng chữ gọn, không banner; giữ retry và recovery khi cần.
- Xác nhận gắn với ID subscription hiện tại và version; row mới dù trùng version cũng làm xác nhận cũ hết hiệu lực. Đây là guard phía mobile, không thêm field vào DTO BE.
- Kết quả PATCH vẫn invalidate dữ liệu của cùng phiên sau khi rời màn; chỉ toast/đóng xác nhận ở lượt focus đã bắt đầu thao tác. Không tự replay PATCH.
- Khi GRACE, hủy gia hạn dẫn tới kết thúc ở lần xử lý tiếp theo theo policy BE; không hứa giữ gói đến termEnd đã qua hoặc toàn bộ graceUntil sau khi hủy.
- `/membership/history`: lịch sử thanh toán gói.
- Notifications `subscription.renewed`, `subscription.grace-started`, `subscription.expired` mở `/membership`. Template BE hiện đã là tiếng Việt.
- Wallet thêm filter/nhãn `SUBSCRIPTION_PURCHASE`, reference `SUBSCRIPTION_CHARGE`.
- Material attach hiển thị lỗi `MATERIAL_STORAGE_QUOTA_EXCEEDED` và nút mở Gói thành viên. Không đổi API/backend của materials.

## Gap và giới hạn

- Chưa có read cung cấp `subscription.recordingAddon` (giá/phút mỗi pack). Không triển khai CTA mua thêm phút bằng giá mặc định.
- Chưa có capability riêng báo có thể mua gói; `SUBSCRIPTIONS_DISABLED` được xử lý từ lỗi BE. Không suy flag bán gói từ `materialStorage.enforced`.
- Mobile chưa triển khai recording/whiteboard; hiển thị quyền lợi và usage không chứng minh các công cụ này đã được tích hợp.
- BE mặc định `subscription.enabled=false`. Quyền, migration `20261127000000_subscriptions`, config/plan đã approve là dependency của API owner; mobile không seed hay bật flag.
- SRS amendment, phê duyệt giá/quota và IAP là release gates theo [policies BE](../../../../services/api/specs/021-subscriptions/policies.md). Không dùng các default staging làm chính sách production.
- Native SecureStore/app restart, deployed API, giao dịch và store billing chưa được nghiệm thu. Unit/component fixture không thay thế các bằng chứng đó.
