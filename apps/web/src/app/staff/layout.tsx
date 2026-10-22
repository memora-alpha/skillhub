import { StaffShell } from "@/components/staff/shell";
import "./staff.css";
import "./account.css";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StaffShell>{children}</StaffShell>;
}
