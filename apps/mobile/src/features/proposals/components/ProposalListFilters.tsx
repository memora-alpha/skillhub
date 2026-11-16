import { useState } from "react";
import { Button } from "@/components/Button";
import { FilterBar } from "@/components/filter-bar";
import { IconAction } from "@/components/icon-action";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

export type ProposalListTab = "all" | Proposal["status"];
const statuses: readonly ProposalListTab[] = [
  "all",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];
const directions = [
  { value: "received", label: "Nhận được" },
  { value: "sent", label: "Đã gửi" },
  { value: "all", label: "Tất cả" },
] as const;
export function ProposalListFilters({
  value = "all",
  onChange,
  direction,
  onDirectionChange,
  statusOnly = false,
}: Readonly<{
  value?: ProposalListTab;
  onChange: (value: ProposalListTab) => void;
  direction: "sent" | "received" | "all";
  onDirectionChange: (value: "sent" | "received" | "all") => void;
  statusOnly?: boolean;
}>) {
  const [expanded, setExpanded] = useState(false);
  if (statusOnly || expanded)
    return (
      <FilterBar
        options={statuses.map((status) => ({
          value: status,
          label:
            status === "all"
              ? "Tất cả trạng thái"
              : proposalStatusLabels[status],
        }))}
        value={value}
        onChange={(status) => {
          onChange(status);
          setExpanded(false);
        }}
        label="Bộ lọc trạng thái đề xuất"
        role="tab"
        action={
          !statusOnly ? (
            <IconAction
              icon="close"
              label="Đóng bộ lọc trạng thái"
              onPress={() => setExpanded(false)}
            />
          ) : undefined
        }
      />
    );
  return (
    <FilterBar
      options={directions}
      value={direction}
      onChange={onDirectionChange}
      label="Chiều đề xuất"
      role="tab"
      action={
        value === "all" ? (
          <IconAction
            icon="filter"
            label="Lọc theo trạng thái"
            expanded={expanded}
            onPress={() => setExpanded(true)}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="filter"
            accessibilityLabel={`Lọc theo trạng thái: ${proposalStatusLabels[value]}`}
            accessibilityState={{ expanded, selected: true }}
            style={{ minHeight: 44 }}
            onPress={() => setExpanded(true)}
          >
            {proposalStatusLabels[value]}
          </Button>
        )
      }
    />
  );
}
