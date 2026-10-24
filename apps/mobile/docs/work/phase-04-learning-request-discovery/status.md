# Trạng thái Phase04 Learning Request và Discovery

## Hiện trạng

- Cập nhật lúc: 2026-10-19T19:58:07+07:00.
- Trạng thái: In progress — phần source đã có; acceptance pending, chưa bắt đầu code mới trong migration.
- Đã có trong source: CRUD/list/detail/discovery, Tag/weekly/FR-35, profile API context, mock Proposal context có nhãn. Backend Catalog/owner/matching wired; riêng REQUEST_LOCK_READER vẫn unavailable.
- Nghiệm thu người dùng: Chưa thực hiện trong migration; không giả nhận từ checkbox lịch sử.
- Chưa hoàn tất: T025..T029 real API theo từng gate và T030..T032 Android/iOS/native fixes khi có lỗi thật; FR-35/weekly/catalog mobile User acceptance cùng các task đó.
- Bước tiếp theo khi được giao: xác minh B06 môi trường/migration/grants/test accounts trước T025 hoặc chọn device-native T030/T031 độc lập; B04 chỉ chặn case NEGOTIATING cần lock reader. Task/conditions tại [plan](plan.md).

## Bằng chứng hiện hành

| Phạm vi                                       | Kết quả                                                       | Mốc nguồn                 | Evidence/giới hạn                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review source/contract hiện tại               | Có API và Tag/weekly/preferences; không blanket503 cũ         | 2026-10-19T19:58:07+07:00 | [requests-api](../../../src/features/learning-requests/api/requests-api.ts), [backend module](../../../../../services/api/src/modules/learning-requests/learning-requests.module.ts), [contract](../../contracts/learning-requests.md), HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd |
| Automated/fixture/web                         | Kết quả được ghi nhận ở lần chạy trước, không chạy lại        | 2026-10-13/14             | [validation005](../../../specs/005-learning-request/validation.md): development-readiness266 tests; follow-up cuối267; số đếm thuộc các revision riêng, không cộng                                                                                                                    |
| Profile context/mock Proposal                 | Fixture navigation/denial/back/local-only có evidence lịch sử | 2026-10-13                | Cùng validation005 và [validation003](../../../specs/003-profile-public-profile/validation.md); zero Proposal HTTP trong fixture không chứng minh API thật                                                                                                                            |
| Real API/LR migration/runtime moderation/lock | NOT_RUN trong migration; acceptance trước còn mở              | Tasks/resume005           | API source không chứng minh deployment; không tạo/sửa/hủy bài thật                                                                                                                                                                                                                    |
| Android/iOS                                   | NOT_RUN cho phần acceptance đang mở                           | Tasks005 T030..T032       | JS/Hermes export/ảnh web không native UAT                                                                                                                                                                                                                                             |
| Sonar remote closure                          | Chưa xác minh                                                 | Validation005 2026-10-14  | Local fixes/tests không thay CI analysis/Quality Gate mới                                                                                                                                                                                                                             |

## Blocker và đính chính lịch sử

B05 Tag và B08 weekly không còn là thiếu source contract ở baseline hiện tại. T021..T024/T036 đã checked trong tasks và có source; các đoạn “weekly Save disabled”, “Tag deferred” hoặc blanket503 là lịch sử. Không sửa specs gốc. B01/B02/B03 source wired nhưng runtime/data chưa nghiệm thu; B06 migration/grants/config vẫn cần kiểm môi trường. B04 NEGOTIATING lock chưa wired. B07 Proposal/Notification ngoài scope; public profile source đã nối theo amendment003.

resume nhắc T037/FR-35 nhưng tasks không có task definition T037. Giữ tham chiếu và đưa acceptance vào T026/T030/T031 theo plan, không tạo lịch sử hoàn thành giả. Một số checkbox tổng hợp cũ còn mở dù task con/source mới đã có: không đếm lại và không tick thay chủ sở hữu.

## Review và nhật ký

### 2026-10-19T19:58:07+07:00

Review loại Technical cho tài liệu/source baseline bởi agent thực hiện migration: cập nhật contract/readiness từ working tree, giữ task gốc và giới hạn evidence. UI review/native/Product acceptance NOT_RUN; không có lời phê duyệt người dùng. Chưa chạy app checks trong migration. Hồ sơ kiểm tra docs/tooling tại [migration](../../migration.md); tiến hành phần độc lập khi có yêu cầu triển khai về sau.
