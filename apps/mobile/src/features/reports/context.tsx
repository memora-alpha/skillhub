import { createContext, useContext, useState, type ReactNode } from "react";
export type PreviewReport = {
  id: string;
  target: "SESSION" | "MATERIAL";
  targetId: string;
  pathId?: string;
  description: string;
  reason: string;
  files: string[];
  status: "OPEN" | "UNDER_REVIEW" | "NEED_MORE_INFO" | "RESOLVED" | "REJECTED";
  note?: string;
  additional?: string;
};
const initial: PreviewReport[] = [
  {
    id: "report-info",
    target: "SESSION",
    targetId: "disputed-ts-0",
    pathId: "path-disputed",
    description:
      "Kịch bản mẫu: người tham gia cần bổ sung chi tiết về thời gian gặp vấn đề kết nối.",
    reason: "TECHNICAL_ISSUE",
    files: [],
    status: "NEED_MORE_INFO",
    note: "Vui lòng bổ sung thời điểm và ảnh chụp thông báo lỗi nếu có.",
  },
  {
    id: "report-resolved",
    target: "MATERIAL",
    targetId: "ux-workbook",
    description:
      "Kịch bản mẫu: yêu cầu xem xét mô tả tài liệu đã được giải quyết.",
    reason: "INAPPROPRIATE_CONTENT",
    files: [],
    status: "RESOLVED",
    note: "Nội dung công khai đã được xem xét và điều chỉnh trong kịch bản mẫu.",
  },
];
const Context = createContext<{
  reports: PreviewReport[];
  save: (r: PreviewReport) => void;
} | null>(null);
export function ReportsPreviewProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState(initial);
  return (
    <Context.Provider
      value={{
        reports,
        save: (r) =>
          setReports((items) => [r, ...items.filter((i) => i.id !== r.id)]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReportsPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("ReportsPreviewProvider missing");
  return v;
}
