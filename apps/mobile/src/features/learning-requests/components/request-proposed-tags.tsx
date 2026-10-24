import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import { RequestDetailSection } from "./request-detail-section";
import { RequestDetailTag } from "./request-detail-tag";

export function RequestProposedTags({
  labels = [],
}: Readonly<{ labels?: string[] }>) {
  if (!labels.length) return null;
  return (
    <RequestDetailSection title="Tag đề xuất" icon="filter" tone="amber">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {labels.map((label) => (
          <RequestDetailTag key={label} label={label} />
        ))}
      </View>
      <Copy muted>Tag mới sẽ được duyệt cùng bài.</Copy>
    </RequestDetailSection>
  );
}
