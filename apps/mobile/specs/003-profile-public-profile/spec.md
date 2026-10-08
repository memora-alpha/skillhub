# Spec 003: Profile và Public Profile

Ngày: 2026-10-08. Nhánh: `feat/mobile-profile`.
Trạng thái sau rebase 2026-10-09: dùng Auth spec 002 và API own-profile có sẵn;
public self-preview lấy account thật, public target khác vẫn là fixture.

Spec 001 là Mobile Foundation; spec 002 là Auth/account shell đã có trên `dev`.
Spec 003 tiếp tục phần hồ sơ, không triển khai lại Auth.

## Phạm vi

- Hoàn thiện màn hồ sơ cá nhân và chỉnh sửa hiện có.
- Thêm màn hồ sơ công khai của người khác và xem trước hồ sơ công khai của mình.
- Hiển thị kỹ năng chia sẻ và trạng thái xác minh ở mức read-only.
- Tái sử dụng UI, shell, theme và component hiện tại.

Nguồn nghiệp vụ: [SRS V1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
FR-PRO-01/02/03, PRO-001/002/003 và mục 18.7.
Tuân thủ [hướng dẫn mobile](../../AGENTS.md). Cách triển khai và contract BE nằm
trong [plan.md](plan.md); chỉ duy trì hai tài liệu này cho feature.

Giữ API lưu own-profile và auth hiện có khi rebase. Không thêm public-profile
API hoặc skill-list API trong lần giải quyết conflict này. Skill list own account
chưa được kết nối; không hiển thị skill fixture như kỹ năng của tài khoản thật.

Chưa bao gồm: My Skills CRUD, evidence, chọn/upload avatar thật, achievement/title,
reviews, chat/proposal, wallet và backend/schema. Own-profile lưu qua API có sẵn;
public target fixtures không có persistence.

## Yêu cầu

### Hồ sơ cá nhân

1. Hiển thị đúng người đang đăng nhập: tên, headline, bio, avatar/fallback,
   reputation, số kỹ năng xác minh và số buổi hoàn thành.
2. User mới có reputation 50, hoạt động bằng 0 và kỹ năng rỗng. Dữ liệu mẫu cũng
   phải nằm trong thang reputation 0–100.
3. Reputation, counter và trạng thái xác minh chỉ đọc; không cho user tự sửa.
4. Không gán `completedSessionCount` thành số lộ trình, số đã học/đã dạy hoặc rating.
   Website, huy hiệu/rating chưa có contract chỉ được giữ rõ là demo trong own view.

### Chỉnh sửa hồ sơ

1. Các field hỗ trợ: `fullName`, `headline`, `bio`. Timezone/locale chưa thêm UI.
2. Tên trim, 2–100 Unicode code points, có ít nhất một chữ; chỉ cho chữ, dấu kết
   hợp, khoảng trắng, apostrophe thẳng/cong và hyphen theo validation BE.
3. Headline 0–120, bio 0–1000 theo quy tắc đếm độ dài của BE; cho phép chuỗi rỗng
   để xóa nội dung. Không tự thay chuỗi rỗng bằng dữ liệu mẫu.
4. Save hợp lệ cập nhật một lần; không thay đổi/không hợp lệ thì không mutate.
   Lỗi giữ nguyên draft; cancel/back bỏ draft. Tên đã lưu đồng bộ với home/menu.
5. Logout/đổi account bỏ draft và timer cũ, không tác động session mới.
6. Avatar hiện giữ fallback và notice; không giả lập upload thành công.

### Hồ sơ công khai

1. Route `/profiles/[userId]`, ngoài tabs; giữ gate đăng nhập của ứng dụng.
2. Chỉ hiển thị tên, headline, bio, avatar, reputation, counter công khai được BE
   hỗ trợ và kỹ năng hiển thị. Projection phải liệt kê field rõ ràng.
3. Không đưa email, điện thoại, ngày sinh, timezone/locale, role, account metadata,
   payment, evidence hoặc URL/file riêng tư vào nội dung target.
4. Không có nút sửa, thông tin riêng tư hay quản lý kỹ năng của target. Account
   menu chung vẫn thuộc người đang đăng nhập, không thuộc hồ sơ đang xem.
5. Badge xác minh gắn từng skill `VERIFIED`; không suy ra badge toàn tài khoản từ
   emailVerified hay số kỹ năng xác minh.
6. ID thiếu/không rõ/không tồn tại hiển thị unavailable, không chọn user thay thế.
   Đổi target không hiển thị dữ liệu cũ; có loading/error/retry/empty states.
7. Có entry “Xem hồ sơ công khai” từ own profile; self-preview dùng dữ liệu đã lưu.
   Back dùng lịch sử, fallback `/profile`; không sửa discovery/chat để tạo entry.
8. Bio/headline render bằng native Text, không diễn giải HTML hay link riêng tư.

## Tiêu chí nghiệm thu

- Own/edit hoạt động đúng với user mới và user cũ; save/cancel/clear đúng trạng thái.
- Kiểm tra biên tên 1/2/100/101, headline 120/121, bio 1000/1001, tên tiếng Việt
  và dữ liệu có markup; lỗi không làm mất draft hoặc thay profile đã lưu.
- Self-preview và profile người khác đúng identity; fixture cố tình chứa thông
  tin riêng tư không làm rò rỉ field; chỉ skill VERIFIED có badge.
- Kiểm tra signed-out, target thiếu/không tồn tại, đổi target/account, back/deep link,
  loading/error/empty và repeated save.
- Kiểm tra safe area, keyboard, large text, accessibility và width 320/375/430;
  đối chiếu thiết kế được cung cấp, ghi phần chưa kiểm chứng.
- Mobile typecheck, lint, structure pass sau triển khai. Không đổi BE, root/shared
  tooling hoặc thêm dependency ngoài phạm vi. Không coi mock test là API E2E.
