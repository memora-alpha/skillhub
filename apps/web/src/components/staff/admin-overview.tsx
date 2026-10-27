"use client";

import Link from "next/link";
import { Card } from "@/components/console/ui";
import { OverviewScreen } from "./overview";
import { useStaffList } from "./hooks";
import type { TagRequest } from "@/lib/staff/admin-types";
export function AdminOverviewScreen() {
  const tagRequests = useStaffList<TagRequest>(
    "tag-requests?status=PENDING&limit=20",
  );
  return (
    <>
      <OverviewScreen tagRequests={tagRequests} />
      <div className="grid grid-2 section">
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
        <Card title="Tag cộng đồng">
          <p>Quản lý tag và xem xét đề xuất mới từ người dùng.</p>
          <Link className="link" href="/admin/tags">
            Quản lý tag →
          </Link>
        </Card>
      </div>
    </>
  );
}
