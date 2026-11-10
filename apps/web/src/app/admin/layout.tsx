import { StaffShell } from "@/components/staff/shell";
import "../staff/staff.css";
import "../staff/account.css";
import "../staff/workspace-layout.css";
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StaffShell portal="admin">{children}</StaffShell>;
}
