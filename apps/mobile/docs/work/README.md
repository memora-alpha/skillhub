# Chỉ mục công việc mobile

[Review source sau migration](source-audit/status.md) có findings, checks và bằng chứng; [phạm vi review](source-audit/plan.md). Đây là hồ sơ review, không thay acceptance của phase sản phẩm.

Đọc plan rồi status của công việc được người dùng yêu cầu; không tự chọn từ feature.json, không chạy phase sản phẩm sau migration. Index chỉ trỏ đến nơi sở hữu trạng thái, không lặp checkpoint/số tests.

| Work tiếp nhận                                                                       | Plan                                                | Hiện trạng và bước tiếp                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| Phase03 Wallet & Top-up — đang phát triển ở nhánh khác, ngoài công việc checkout này | [plan](phase-03-wallet-topup/plan.md)               | [status](phase-03-wallet-topup/status.md)               |
| Phase04 Learning Request & Discovery, tiếp nhận acceptance đang mở từ spec005        | [plan](phase-04-learning-request-discovery/plan.md) | [status](phase-04-learning-request-discovery/status.md) |

Wallet ở bảng trên chỉ là điểm tham chiếu liên nhánh; không phải hàng đợi task triển khai/rà code của nhánh hiện tại. Tên nhánh chưa được cung cấp, không tự checkout/merge hoặc lập checklist trùng với nhánh đang làm.

Phase00 có hồ sơ chính tại [migration](../migration.md), không tạo progress song song. [Roadmap](../roadmap.md) không phải bảng trạng thái thực hiện.

| Feature khác cần đánh giá khi được giao | Lịch sử và nguồn hiện trạng                                                                             | Phần cần xét tiếp                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Foundation001                           | [tasks](../../specs/001-mobile-foundation/tasks.md), [source/package](../../package.json)               | Hai checkbox scaffold/scripts cũ còn mở nhưng app/package đã có; không tự tick hay scaffold lại |
| Account/session002                      | [tasks](../../specs/002-auth-account-shell/tasks.md), [auth contract](../contracts/auth-account.md)     | Provider/storage/integration/real mailbox/native, legacy/extraction debt                        |
| Profile003                              | [tasks](../../specs/003-profile-public-profile/tasks.md), [profile contract](../contracts/profile.md)   | Pending Back/iOS/real CLEAN/native gallery/recovery/Figma, title/count/privacy gaps             |
| Skills004                               | [tasks](../../specs/004-skills-management/tasks.md), [skills contract](../contracts/skills-evidence.md) | Full User API/scanner/native/EXIF/background; GAP-09 historical sorting                         |
| Proposal/Chat/Plan/Session/Materials    | [feature matrix](../feature-matrix.md), [archive](../archive/README.md)                                 | Contract/thiết kế/implementation cần khảo sát khi chọn phase, không nhận “Done” từ UI           |

Không tạo lại sáu bộ hồ sơ lịch sử. Task đang mở trong specs khác giữ nguyên ID/nội dung gốc; contract và liên kết trên giữ giới hạn để không thất lạc. Mẫu cho việc nhiều phiên tại [_template/plan](_template/plan.md) và [_template/status](_template/status.md); việc nhỏ có thể làm trực tiếp theo workflow.
