import Link from "next/link";
import { Panel } from "../components/common";
import "./attendance-rules.css";

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
    <Panel title="Quy tắc tham gia và vắng học">
      <p>
        Kết quả sau khi kết luận được chốt, không có tranh chấp giữ kết quả:
      </p>
      <dl className="attendance-rules">
        {cases.map(([title, text]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        Mặc định cần tham gia ít nhất 80% thời lượng. Hạn giải trình vắng học là
        48 giờ sau buổi học; hạn chốt lịch học bù là 7 ngày từ khi yêu cầu học
        bù. Thời hạn thực tế và thao tác được phép theo dữ liệu buổi học phía
        trên.
      </p>
      <p className="muted">
        Lý do được chấp nhận: học bù, không phạt uy tín. Thiếu dữ liệu đáng tin
        cậy: chưa xác minh, không tự phạt vắng. Vắng học không cần tạo báo cáo
        sự cố. Cả hai vắng không áp dụng tự chấp nhận lý do giữa hai bên.
      </p>
      <p className="muted">
        Mỗi buổi học bù tối đa một lần. Mỗi người có hạn mức riêng: tối thiểu
        một lượt, hoặc một lượt cho mỗi năm buổi tham gia trong thỏa thuận. Hết
        lượt sẽ chuyển nhân sự xem xét thay vì tự cấp lịch bù mới.
      </p>
      <p className="muted">
        Điểm uy tín khác Credit. Hoàn tất một buổi chưa quyết toán ngay; cần đủ
        điều kiện cả lộ trình và không có tranh chấp giữ quyết toán. Sau khi học
        xong toàn bộ, hai bên đồng ý giải ngân bằng thao tác riêng thì hệ thống
        tự xử lý; nếu không, tiếp tục chờ hết hạn.
      </p>
      <Link href="/terms#attendance">Đọc điều khoản về buổi học →</Link>
    </Panel>
  );
}
