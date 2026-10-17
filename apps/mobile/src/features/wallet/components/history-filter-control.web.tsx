import { appColors, fonts } from "@/constants/theme";
import type { FilterControlProps } from "./history-filter-control";

// Installed universal web Picker does not forward an accessible name. Native
// uses @expo/ui; the web adapter uses a labeled HTML select without new deps.
export function HistoryFilterControl({
  label,
  value,
  options,
  onChange,
}: FilterControlProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width: "100%",
        minWidth: 0,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${appColors.muted}`,
        backgroundColor: appColors.surface,
        color: appColors.ink,
        fontFamily: fonts.body,
        fontSize: 14,
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
