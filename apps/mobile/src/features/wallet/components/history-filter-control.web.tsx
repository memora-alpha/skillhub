import { useRef, useState } from "react";
import type { View } from "react-native";
import { appColors } from "@/constants/theme";
import {
  HistoryFilterCard,
  type FilterControlProps,
} from "./history-filter-card";

export function HistoryFilterControl(props: FilterControlProps) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<View>(null);
  const close = () => {
    setExpanded(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="wallet-history-filter-card"
      onKeyDown={(event) => {
        if (expanded && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setExpanded(false);
      }}
    >
      <style>{`.wallet-history-filter-card [role=button]:focus-visible {outline:2px solid ${appColors.primary};outline-offset:-3px;} .wallet-history-filter-card [role=button]:focus:not(:focus-visible) {outline:none;}`}</style>
      <HistoryFilterCard
        {...props}
        expanded={expanded}
        triggerRef={trigger}
        onToggle={() => setExpanded((open) => !open)}
        onClose={close}
      />
    </div>
  );
}
