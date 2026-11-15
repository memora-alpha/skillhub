# Đồng nhất giao diện đánh giá

## Phạm vi và thiết kế

Thiết kế lại UI Expo cho `/reviews`, `/paths/[id]/review` và khu vực đánh giá trên own/public Profile. Dùng theme Crafted Exchange, Nunito, Avatar/Icon/Button/Input, FeaturePage và ProfileSection hiện có. Không đổi backend hoặc dependencies.

Nguồn nghiệp vụ: [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), API/schema/hook đánh giá hiện hành. Chỉ đánh giá cuối lộ trình hoàn tất và đã quyết toán; 1–5 sao, nhận xét không bắt buộc tối đa 1.000 ký tự; mỗi bên gửi tối đa một lần. Giữ cơ chế chống gửi lặp, kiểm tra kết quả chưa rõ và cache theo phiên.

Tham khảo cấu trúc sao cạnh nhận xét của [Airbnb](https://www.airbnb.com/resources/hosting-homes/a/revamped-ratings-and-reviews-643) và ngữ cảnh đánh giá người dạy của [Preply](https://help.preply.com/en/articles/4179411-evaluation-of-tutors). Bố cục điều chỉnh theo SkillHub; không sao chép asset hoặc thêm chính sách đánh giá từ các sản phẩm tham khảo.

## Công việc

- [x] Danh sách lộ trình: tiêu đề, hình thức trao đổi, avatar đối tác, trạng thái hoàn tất và hành động mở đánh giá.
- [x] Form: chọn sao trực tiếp, nhãn mức hài lòng, nhận xét/đếm ký tự, phản hồi gửi thành công và danh sách nhận xét hai bên.
- [x] Own Profile: tổng quan đánh giá nhận được và nút mở danh sách. Public Profile: điểm trung bình, phân bố sao, nhận xét có avatar/ngày, mở rộng/thu gọn và tải thêm.
- [x] Giữ loading/error/empty/denied, điều kiện settlement, bản nháp khi lỗi và recovery cho kết quả chưa rõ.
- [x] Kiểm tra TypeScript, ESLint, cấu trúc, mobile tests, browser fixture responsive/keyboard và web export; bằng chứng/giới hạn tại [status](status.md).
- [x] Đối chiếu API review với `origin/dev`, ghi tổng theo user và giới hạn vai trò tại [audit](api-review-audit.md).
- [x] Bỏ intro/note lặp, đồng bộ tiêu đề và điểm trung bình sang Nunito; nhận xét chỉ có sao không thêm dòng giải thích trống.
- [x] Xác định người dạy theo chiều học: TWO_WAY mỗi bên đánh giá người đã dạy mình; ONE_WAY người học viết, người dạy xem nhận xét. Giữ khóa theo settlement và cơ chế gửi/recovery hiện hành.
- [x] `/reviews` mặc định nhận được, có3 mục Nhận được/Đã gửi/Viết đánh giá; chỉ mục nhận được có thống kê cá nhân, mục đã gửi ghi rõ người được đánh giá, mục viết mới tải lộ trình. Back từ editor quay về mục viết.
- [x] Dùng chung adapter/hook đọc reviews ở Profile và màn cá nhân; key phân biệt own/public/direction dưới owner/session, gửi thành công invalidate lịch sử trong đúng phiên. Kiểm cursor, schema và late result không ghi phiên khác.
- [x] Bỏ shortcut “Đánh giá về tôi” bị trùng; Profile chỉ còn thẻ “Đánh giá về bạn” và nút Xem tất cả để mở danh sách.
- [x] Đưa lối xem hồ sơ công khai vào Cài đặt chính, nhóm Tài khoản & bảo mật; không đặt liên kết trên thẻ thông tin cá nhân. Mở self public profile hiện có.
- [x] Đưa Cài đặt vào ô cạnh Uy tín trong nhóm lối tắt Profile; bỏ action Cài đặt trên thẻ thông tin cá nhân.
- [x] Rà lại luồng sau khi kết thúc lộ trình: shortcut phân biệt viết/xem/đã gửi theo cache review và vai trò, editor Back theo lịch sử, khóa trong lúc tải lại điều kiện, refresh đọc cả path và review.
- [x] Thiết kế lại editor với thẻ người dạy gọn, sao không có ô nền, nhận xét tùy chọn và nút gửi cố định cuối màn; success hiển thị đúng review BE đã lưu một lần. Tham khảo [Preply](https://help.preply.com/en/articles/4182856-how-to-leave-a-public-review-to-your-tutor) và Airbnb đã dẫn ở trên, giữ theme và chính sách SkillHub.
- [x] Đồng bộ lịch sử review và hồ sơ công khai người nhận sau POST thành công, phản hồi đã gửi trước đó hoặc GET xác nhận kết quả chưa rõ; không replay mutation. Kiểm bằng hook/adapter/cache thật với transport fixture và Node regression.

Nghiệm thu Android/iOS và API triển khai chưa thực hiện. Browser fixture chỉ kiểm chứng UI với hook thay thế; không chứng minh giao dịch hoặc quyền trên server thật.
