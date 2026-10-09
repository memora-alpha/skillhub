import Constants from "expo-constants";

export const settingsInformation = {
  help: {
    title: "Trợ giúp",
    body: "Chỉnh sửa hồ sơ\nMở Hồ sơ → Chỉnh sửa để thay tên, giới thiệu hoặc ảnh đại diện.\n\nẢnh chưa cập nhật?\nẢnh cần được kiểm tra trước khi hiển thị. Nếu chờ lâu, mở Hồ sơ để kiểm tra lại.\n\nĐặt lại mật khẩu\nVào Cài đặt → Đặt lại mật khẩu, nhận mã xác minh qua email rồi chọn mật khẩu mới.\n\nThông tin hồ sơ công khai\nTên hiển thị, ảnh đại diện, giới thiệu, kỹ năng và thống kê hồ sơ có thể hiển thị công khai. Email đăng nhập chỉ hiển thị với bạn trong mục Tài khoản. Bạn có thể xem trước hồ sơ công khai từ trang Hồ sơ.",
  },
  about: {
    title: "Giới thiệu SkillHub",
    body: `Chia sẻ điều bạn biết. Học điều bạn muốn.\n\nSkillHub kết nối người học và người chia sẻ kỹ năng.\nPhiên bản ${Constants.expoConfig?.version ?? "chưa xác định"}.`,
  },
  sessions: {
    title: "Đăng xuất tất cả thiết bị?",
    body: "Bạn sẽ được đăng xuất trên thiết bị này và các thiết bị khác. Cần đăng nhập lại để tiếp tục sử dụng SkillHub.",
  },
} as const;
