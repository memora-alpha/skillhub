export const severities = [
  { code: "LOW", label: "Thấp" },
  { code: "MEDIUM", label: "Vừa" },
  { code: "HIGH", label: "Cao" },
  { code: "CRITICAL", label: "Khẩn cấp" },
];
export type SupportCase = {
  id: string;
  reasonCode: string;
  status: string;
  handlerId: string | null;
  createdAt: string;
  severity: string;
  version: number;
  incidentId: string | null;
  targetType: string;
  targetId: string;
  relatedPathId: string | null;
  relatedSessionId: string | null;
};
export type Incident = {
  id: string;
  status: string;
  version: number;
  severity: string;
  handlerId: string;
  reason: string;
  cases: { id: string; status: string; version: number; severity: string }[];
};
