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
      <section
        className="ops-shortcuts section"
        aria-label="Danh mục và quản trị"
      >
        <div className="ops-section-heading">
          <h2>Danh mục & quản trị</h2>
        </div>
        <div className="grid grid-2">
          <Card title="Quản lý tài khoản">
            <Link className="link" href="/admin/users">
              Mở danh sách người dùng →
            </Link>
          </Card>
          <Card title="Danh mục kỹ năng">
            <Link className="link" href="/admin/skills">
              Quản lý kỹ năng →
            </Link>
          </Card>
          <Card title="Quy tắc kiểm duyệt">
            <Link className="link" href="/admin/config">
              Mở cấu hình →
            </Link>
          </Card>
          <Card title="Tag cộng đồng">
            <Link className="link" href="/admin/tags">
              Quản lý tag →
            </Link>
          </Card>
        </div>
      </section>
    </>
  );
}
