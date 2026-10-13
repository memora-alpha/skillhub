import { useState } from "react";
import { View } from "react-native";
import { Badge } from "@/components/Badge";
import { ChoiceGroup } from "@/components/choice-group";
import { EmptyState } from "@/components/EmptyState";
import { Panel, Copy, RouteButton } from "@/components/feature-page";
import { useRequestsPreview } from "../context";

export function MyRequestsContent() {
  const { requests } = useRequestsPreview();
  const [filter, setFilter] = useState("Tất cả");
  const items = requests.filter(
    (r) => filter === "Tất cả" || r.status === filter,
  );
  return (
    <View style={{ gap: 16 }}>
      <RouteButton href="/requests/new">Đăng yêu cầu học</RouteButton>
      <ChoiceGroup
        label="Trạng thái"
        options={[
          "Tất cả",
          "DRAFT",
          "PENDING_MODERATION",
          "OPEN",
          "REJECTED",
          "NEGOTIATING",
          "MATCHED",
          "CANCELLED",
          "EXPIRED",
        ]}
        value={filter}
        onChange={setFilter}
      />
      {items.map((r) => (
        <Panel key={r.id} title={r.title}>
          <Badge label={r.status} />
          <Copy>{r.goal}</Copy>
          <RouteButton secondary href={`/requests/${r.id}`}>
            Xem yêu cầu
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Chưa có yêu cầu ở trạng thái này"
          description="Thử bộ lọc khác hoặc tạo yêu cầu mới."
        />
      )}
    </View>
  );
}
