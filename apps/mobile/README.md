# SkillHub Mobile

Ứng dụng React Native/Expo đang có cho Android, iOS và web preview trong monorepo SkillHub. Stack thực tế: Expo SDK58, React Native0.88.0, React19.3.0, Expo Router và TypeScript; chi tiết tại [architecture](docs/architecture.md) và [nâng SDK58](docs/work/expo-sdk-58/status.md).

## Bắt đầu nhanh

Từ root, chạy pnpm install rồi pnpm --filter mobile start. Nếu chưa có cấu hình cục bộ, tạo apps/mobile/.env từ [.env.example](.env.example) và đặt EXPO_PUBLIC_API_URL tới API có thể truy cập từ thiết bị; không chứa secrets. [Contributing](docs/contributing.md) sở hữu setup, commands và kiểm tra chi tiết.

## Đọc theo công việc

- [Bản đồ tài liệu](docs/README.md) và [workflow](docs/workflow.md): quy trình mobile hiện hành không dùng Spec Kit.
- [Work đang tiếp tục](docs/work/README.md): plan, task, bằng chứng và bước tiếp theo; [roadmap](docs/roadmap.md) chỉ là đề xuất luồng/phụ thuộc.
- [Feature matrix](docs/feature-matrix.md), [contracts](docs/contracts/README.md), [network](docs/network-state.md): đối chiếu source và giới hạn tích hợp.
- [Hồ sơ lịch sử Session 006](specs/006-session/spec.md) và [validation](specs/006-session/validation.md): phạm vi, contract và giới hạn kiểm chứng.
- [SRS hiện hành](../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx) và [source of truth](../../docs/SOURCE_OF_TRUTH.md): yêu cầu toàn hệ thống.
- [Migration](docs/migration.md), [archive](docs/archive/README.md): mapping và lịch sử; specs giữ nguyên, không dùng như chỉ thị workflow mới.

## Thiết kế và license

UI có nguồn được ghi nhận từ Complete SkillHub Product Design/Figma Make do người dùng cung cấp. Ảnh hero: Kateryna Hliznitsova / Unsplash. Fraunces và Nunito kèm SIL Open Font License trong [assets/fonts](assets/fonts). Chọn frame/pattern thực tế khi làm UI, không suy pixel-match từ việc render thành công.
