import { StaffShell } from "@/components/staff/shell";
import "./staff.css";
import "./account.css";
import "./workspace-layout.css";
import "./ops-console.css";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StaffShell portal="staff">{children}</StaffShell>;
}
