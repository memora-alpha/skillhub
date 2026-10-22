import type { ReactNode } from "react";
import { useParticipantName } from "@/features/connections";
import { Badge } from "@/components/Badge";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import type { ApiSession } from "../api/sessions-api";
import { sessionStatusLabels } from "../utils/session-calendar";

type SessionCardData = Pick<
  ApiSession,
  "id" | "startAt" | "endAt" | "status" | "role" | "teacherId" | "learnerId"
>;
export function ApiSessionCard({
  session,
  title = "Buổi học",
  children,
}: Readonly<{
  session: SessionCardData;
  title?: string;
  children?: ReactNode;
}>) {
  const partnerId =
    session.role === "TEACHER" ? session.learnerId : session.teacherId;
  const partner = useParticipantName(partnerId);
  return (
    <Panel title={title}>
      <Badge label={sessionStatusLabels[session.status]} />
      <Copy>
        {session.role === "TEACHER" ? "Bạn dạy" : "Bạn học"} ·{" "}
        {partner.data ?? "Người trao đổi"}
      </Copy>
      <Copy>
        {new Date(session.startAt).toLocaleString("vi-VN")} –{" "}
        {new Date(session.endAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {(Date.parse(session.endAt) - Date.parse(session.startAt)) / 60000}{" "}
        phút
      </Copy>
      {children ?? (
        <RouteButton href={`/learning-sessions/${session.id}`}>
          Chi tiết buổi học
        </RouteButton>
      )}
    </Panel>
  );
}
