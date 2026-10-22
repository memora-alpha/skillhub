# UI styling và component dùng chung

Đọc khi sửa layout/style/control hoặc đối chiếu thiết kế.

## Đang có và nguồn đối chiếu

[theme](../../src/constants/theme.ts), [AppProviders](../../src/providers/AppProviders.tsx), [components](../../src/components). Đã thấy colors/fonts/typography/appColors/layout và Fraunces/Nunito; dùng StyleSheet, toast hiện hữu.

## Quy chuẩn cho thay đổi mới

- Source theme hiện ở `src/constants/theme.ts`; đọc các exports thực tế (`colors`, `fonts`, `typography`, `appColors`, layout... nếu có). Không tạo token trùng hoặc đổi đường dẫn nguồn trong migration.
- Giữ StyleSheet và cách style đang được app dùng. Inline dynamic style hợp lý được phép; không áp lệnh cấm StyleSheet hoặc bắt NativeWind.
- Code mới ưu tiên token semantic và variant component hiện có; tránh hardcode lặp lại màu/font/spacing đã có token. Giá trị chỉ dành riêng một layout không bắt buộc thành global token.
- Fraunces/Nunito là font đang được README mô tả; xác minh asset/provider và giữ font đang hoạt động. Không tự đổi font để app “native hơn”.
- Không tự chuyển dark mặc định, thêm light mode hoặc bắt chụp cả hai theme khi sản phẩm hiện chưa hỗ trợ. Kiểm chứng những theme thực sự nằm trong phạm vi.
- Dùng Button/Input/AppHeader/layout/shared controls trước khi tạo bản gần giống. Prop mới phải additive hoặc đánh giá toàn bộ consumer nếu đổi hành vi.
- Khi sửa component chung, nêu ảnh hưởng tới auth, profile, wallet hoặc màn sử dụng thực tế. Không tự đổi radius/font/màu toàn app vì một phase cần một biến thể.
- Component không chứa business API call; tách presentation và state khi điều đó làm rõ trách nhiệm, không bọc abstraction thừa.
- Loading/disabled/error/selected và accessibility state phải nhất quán; chống duplicate mutation không chỉ dựa vào màu disabled của nút.
- Không nested Pressable cho các action dễ xung đột. Kiểm tra vùng chạm, focus và label của icon-only actions.
- Dùng cơ chế feedback hiện có; không thêm toast/banner/Alert thứ hai cho cùng một kết quả. Xác nhận destructive action theo mức tác động.
- Ảnh có kích thước/aspect ratio hợp lý, placeholder khi phù hợp và semantics accessible đúng; không bắt đổi toàn bộ thư viện ảnh cũ trong migration.
- Assets sản phẩm có nguồn/license rõ; không tải asset từ một dự án khác để điền chỗ thiết kế thiếu.
- Layout xét safe area, screen nhỏ, chữ lớn, keyboard, scroll và bottom navigation. Không buộc font scale nhỏ lại chỉ để khớp screenshot.
- Không gọi UI “đúng thiết kế” chỉ vì render thành công; đối chiếu frame/pattern và ghi khác biệt được chấp nhận.

## Icon dùng chung

- Dùng `Icon` trong `src/components/Icon.tsx`; bộ hiện hành là [Lucide React Native](https://lucide.dev/guide/react-native/getting-started) (license ISC), render qua `react-native-svg` đã có.
- Mapping semantic ở `src/components/icon-map.ts`, import từng icon từ entry point chính thức `lucide-react-native/icons/*`. Kiểm file runtime tồn tại khi thêm mapping vì alias type có thể khác tên file canonical.
- Giữ tên icon theo ý nghĩa thao tác, màu theme, kích thước `iconSizes` và độ dày `iconStrokeWidth`; chỉ star dùng fill cho rating. Icon trang trí ẩn với accessibility, action vẫn cần label trên nút.
- Không dùng glyph/emoji thay icon điều khiển. Logo thương hiệu (Google) và avatar vẫn giữ asset/renderer riêng. Không thay ký tự mũi tên trong nội dung nghiệp vụ.

## Giới hạn và đề xuất

Nguồn được ghi nhận là Complete SkillHub Product Design/Figma Make; chưa xác minh frame mới hoặc pixel match trong migration. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope; thay đổi icon toàn mobile ngày 21/10 được người dùng yêu cầu riêng, giữ font/theme.
