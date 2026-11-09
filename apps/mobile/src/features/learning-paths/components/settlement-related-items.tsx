import { View } from "react-native";
import { RouteButton } from "@/components/feature-page";
import type { SettlementStatus } from "../api/path-changes-contract";
import { pathTargetHref } from "../utils/path-overview-presentation";

const targetLabels: Record<string, string> = {
  CASE_SUMMARY: "Xem vụ việc ảnh hưởng quyết toán",
  SESSION: "Xem buổi học cần xử lý",
};

export function SettlementRelatedItems({
  status,
}: Readonly<{ status: SettlementStatus }>) {
  const targets = [
    status.nextActionTarget,
    ...(status.relatedItems ?? []),
  ].filter(
    (target, index, all) =>
      target &&
      target.type !== "LEARNING_PATH" &&
      all.findIndex(
        (other) => other?.id === target.id && other.type === target.type,
      ) === index,
  );
  return (
    <View style={{ gap: 8 }}>
      {targets.map((target) => {
        if (!target) return null;
        const href = pathTargetHref(status.pathId, target);
        return href ? (
          <RouteButton
            secondary
            key={`${target.type}:${target.id}`}
            href={href}
          >
            {targetLabels[target.type] ?? "Xem yêu cầu hủy"}
          </RouteButton>
        ) : null;
      })}
    </View>
  );
}
