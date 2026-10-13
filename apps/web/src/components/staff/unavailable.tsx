import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/console/ui";
export function UnavailableScreen({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <Empty
          title="Chức năng chưa được hỗ trợ"
          desc="Backend hiện chưa cung cấp API quản trị cho chức năng này."
        />
        <Link className="link" href="/admin">
          ← Về tổng quan
        </Link>
      </Card>
    </>
  );
}
