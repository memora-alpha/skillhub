import { View } from "react-native";
import { SessionCopy } from "./session-page";

const cases = [
  [
    "Cả hai tham gia đủ thời lượng",
    "Xác nhận hoàn thành hoặc tự hoàn tất khi đủ điều kiện và hết hạn xác nhận.",
  ],
  [
    "Chỉ người dạy có mặt",
    "Người học −8 điểm uy tín; buổi được tính đã sử dụng.",
  ],
  ["Chỉ người học có mặt", "Người dạy −8 điểm uy tín; yêu cầu học bù."],
  ["Cả hai đều vắng", "Mỗi người −8 điểm uy tín; yêu cầu học bù."],
] as const;

export function AttendanceRules() {
  return (
    <View style={{ gap: 12 }}>
      <SessionCopy>
        Quy tắc sau khi kết luận được chốt, không có tranh chấp giữ kết quả:
      </SessionCopy>
      {cases.map(([title, text]) => (
        <View key={title} style={{ gap: 4 }}>
          <SessionCopy>{title}</SessionCopy>
          <SessionCopy muted>{text}</SessionCopy>
        </View>
      ))}
      <SessionCopy muted>
        Mặc định cần tham gia ít nhất 80% thời lượng. Hạn giải trình/báo cáo là
        48 giờ sau buổi học; hạn chốt lịch học bù là 7 ngày từ khi yêu cầu học
        bù. Thời hạn thực tế và thao tác được phép theo dữ liệu buổi học phía
        trên.
      </SessionCopy>
      <SessionCopy muted>
        Lý do được chấp nhận: học bù, không phạt uy tín. Thiếu dữ liệu đáng tin
        cậy: chưa xác minh, không tự phạt vắng. Cả hai vắng có thể gửi báo cáo,
        không áp dụng tự chấp nhận lý do giữa hai bên.
      </SessionCopy>
      <SessionCopy muted>
        Mỗi buổi chỉ được học bù một lần. Lượt học bù tính riêng mỗi người, dùng
        chung cả chiều dạy và học; hết lượt chuyển nhân sự xử lý.
      </SessionCopy>
      <SessionCopy muted>
        Điểm uy tín khác Credit. Hoàn tất một buổi chưa quyết toán ngay; cần đủ
        điều kiện cả lộ trình và không có tranh chấp giữ quyết toán. Sau khi học
        xong toàn bộ, hai bên có thể đồng ý quyết toán sớm bằng thao tác riêng;
        nếu không thì chờ hết thời hạn.
      </SessionCopy>
    </View>
  );
}
