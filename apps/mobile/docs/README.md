# Bản đồ tài liệu SkillHub Mobile

Mobile tiếp tục từ ứng dụng và source đang có. Quy trình phát triển hiện hành không dùng Spec Kit; lịch sử được tra cứu tại [archive](archive/README.md). [Migration](migration.md) sở hữu hồ sơ Phase 00, không phải lệnh bắt đầu phase sản phẩm.

| Công việc                | Đường đọc chính                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chạy app/kiểm tra        | [Mobile README](../README.md) → [contributing](contributing.md)                                                                                                                          |
| Tiếp tục phase           | [work](work/README.md) → plan/status được chỉ định → contract và guide liên quan                                                                                                         |
| Chỉnh UI                 | [UI](guides/ui-and-styling.md) → thiết kế/pattern/component thật → [navigation/forms](guides/navigation-and-forms.md)                                                                    |
| Gắn API                  | [contract domain](contracts/README.md) → [API client](guides/api-client.md) → [state/session](guides/state-and-session.md)                                                               |
| Sửa auth/session         | [auth](contracts/auth-account.md) → [state/session](guides/state-and-session.md) + [security](guides/security-and-privacy.md) → runtime hiện hành                                        |
| Upload/evidence/realtime | [skills/evidence](contracts/skills-evidence.md) hoặc contract liên quan → [upload/realtime](guides/uploads-and-realtime.md) → [privacy](guides/security-and-privacy.md)                  |
| Wallet/Payment           | [contract tài chính](contracts/wallet-payments.md) + [work Wallet](work/phase-03-wallet-topup/plan.md) → [state/session](guides/state-and-session.md) → matrix kiểm chứng trong contract |
| Session/đổi lịch         | [contract Session](contracts/sessions.md) → [work Phase07](work/phase-07-session-api/plan.md) → [status](work/phase-07-session-api/status.md); LiveKit do nhánh khác sở hữu |
| Xác định nghiệp vụ       | [domain rules](domain-rules.md) / [state machines](state-machines.md) → SRS mục liên quan → chênh lệch contract                                                                          |
| Tra quyết định/lịch sử   | [ADR](adr/README.md) hoặc [archive](archive/README.md); quay lại tài liệu hiện hành trước khi sửa                                                                                        |

## Nguồn sở hữu

| Câu hỏi                | Nguồn chính                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sản phẩm phải làm gì?  | [SRS 1.6](../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), quyết định người dùng có nguồn xác nhận |
| API giao tiếp thế nào? | Backend contract/controller/DTO/schema; [contracts](contracts/README.md) ghi phần mobile dùng và chênh lệch     |
| Mobile đã viết gì?     | Source working tree, điều kiện runtime; [feature matrix](feature-matrix.md) chỉ là bản đồ                       |
| Đã kiểm chứng gì?      | Status của work tương ứng, bằng chứng có thời điểm/môi trường; lịch sử giữ trong specs                          |
| Vì sao chọn cách làm?  | Quyết định có nguồn hoặc ADR được xác nhận; không suy lịch sử phê duyệt từ source                               |
| Đã thay đổi qua đâu?   | Git, specs và [archive](archive/README.md)                                                                      |

Không có một thứ tự ưu tiên chung thay thế tất cả các loại sự thật. SRS không chứng minh implementation; source không chứng minh deployment; fixture/JS export không chứng minh native hay thanh toán thật. Khi lệch nhau ghi yêu cầu / contract / source / bằng chứng / câu hỏi cần chốt.

**Đang có** là điều đã xác minh source; **Quy chuẩn cho thay đổi mới** là chất lượng áp dụng về sau; **Đề xuất** chưa phải quyết định. PHẢI là bắt buộc trong phạm vi, KHÔNG ĐƯỢC là cấm, NÊN là khuyến nghị (ghi lý do khi làm khác ảnh hưởng chất lượng/kiến trúc). Không sửa hàng loạt code cũ chỉ để khớp guide.

[Architecture](architecture.md) sở hữu boundaries và nợ kỹ thuật; [workflow](workflow.md) sở hữu quy trình; [roadmap](roadmap.md) chỉ mô tả kết quả/phụ thuộc. Plan sở hữu task; status sở hữu hiện trạng và evidence. Index không phải nhật ký thứ hai.
