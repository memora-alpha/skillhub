import Link from "next/link";
import { Card } from "@/components/console/ui";
import { OverviewScreen } from "./overview";
export function AdminOverviewScreen() {
  return (
    <>
      <OverviewScreen />
      <div className="grid grid-3 section">
        <Card title="Quản lý tài khoản">
          <p>Kiểm tra tài khoản, khóa hoặc mở khóa và cấp quyền Staff.</p>
          <Link className="link" href="/admin/users">
            Mở danh sách người dùng →
          </Link>
        </Card>
        <Card title="Danh mục kỹ năng">
          <p>Thêm, chỉnh sửa và quản lý trạng thái kỹ năng.</p>
          <Link className="link" href="/admin/skills">
            Quản lý kỹ năng →
          </Link>
        </Card>
        <Card title="Quy tắc kiểm duyệt">
          <p>Điều chỉnh bộ quy tắc cho nội dung yêu cầu học.</p>
          <Link className="link" href="/admin/config">
            Mở cấu hình →
          </Link>
        </Card>
      </div>
    </>
  );
}
