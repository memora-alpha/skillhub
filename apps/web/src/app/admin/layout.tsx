import { StaffShell } from "@/components/staff/shell";
import "../staff/staff.css";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffShell portal="admin">{children}</StaffShell>;
}
