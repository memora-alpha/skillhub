import { useState } from "react";
import { View } from "react-native";
import { Badge } from "@/components/Badge";
import { ChoiceGroup } from "@/components/choice-group";
import { EmptyState } from "@/components/EmptyState";
import { Panel, Copy, RouteButton } from "@/components/feature-page";
import { usePathsPreview } from "../context";

export function MyPathsContent() {
  const { paths } = usePathsPreview();
  const [filter, setFilter] = useState("Tất cả");
  const items = paths.filter((p) => filter === "Tất cả" || p.status === filter);
  return (
    <View style={{ gap: 16 }}>
      <ChoiceGroup
        label="Trạng thái"
        value={filter}
        options={["Tất cả", "PROPOSED", "ACTIVE", "COMPLETED", "DISPUTED"]}
        onChange={setFilter}
      />
      {items.map((path) => (
        <Panel key={path.id} title={path.title}>
          <Badge label={path.status} />
          <Copy>
            {path.partner} ·{" "}
            {path.type === "TWO_WAY"
              ? "Trao đổi hai chiều"
              : "Dạy học một chiều"}
          </Copy>
          <Copy muted>
            {path.completedSessions}/
            {path.plans.reduce((sum, p) => sum + p.outline.length, 0)} buổi ·
            phiên bản {path.version}
          </Copy>
          <RouteButton href={`/paths/${path.id}`}>Mở lộ trình</RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Chưa có lộ trình"
          description="Chấp nhận đề xuất và thương lượng qua tin nhắn để bắt đầu."
        />
      )}
      <RouteButton secondary href="/messages">
        Đến cuộc trao đổi
      </RouteButton>
    </View>
  );
}
