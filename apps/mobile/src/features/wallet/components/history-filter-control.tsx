import { useRef, useState } from "react";
import { View } from "react-native";
import {
  HistoryFilterCard,
  type FilterControlProps,
} from "./history-filter-card";
export type { FilterControlProps } from "./history-filter-card";

export function HistoryFilterControl(props: FilterControlProps) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<View>(null);
  const close = () => {
    setExpanded(false);
    trigger.current?.focus();
  };
  return (
    <HistoryFilterCard
      {...props}
      expanded={expanded}
      triggerRef={trigger}
      onToggle={() => setExpanded((open) => !open)}
      onClose={close}
    />
  );
}
