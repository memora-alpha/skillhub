import { appColors as colors, appRadius, fonts } from "@/constants/theme";
import { webDateChoice } from "../utils/request-dates";
import { RequestCalendar } from "./request-calendar";
import type { RequestDatePickerProps } from "./request-date-picker";

const controlStyle = {
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 12,
  border: `1px solid ${colors.border}`,
  borderRadius: appRadius.control,
  fontFamily: `${fonts.body}, sans-serif`,
  fontSize: 13,
  color: colors.ink,
  backgroundColor: colors.surface,
  colorScheme: "light",
};
export function RequestDatePicker({
  value,
  mode,
  onChange,
}: Readonly<RequestDatePickerProps>) {
  if (mode === "date")
    return <RequestCalendar value={value} onChange={onChange} />;
  const choose = (hours: number, minutes: number) => {
    const next = webDateChoice(
      value,
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      "time",
    );
    if (next) onChange(next);
  };
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <select
        aria-label="Chọn giờ"
        style={controlStyle}
        value={value.getHours()}
        onChange={(e) =>
          choose(Number(e.currentTarget.value), value.getMinutes())
        }
      >
        {Array.from({ length: 24 }, (_, n) => (
          <option key={n} value={n}>
            {String(n).padStart(2, "0")} giờ
          </option>
        ))}
      </select>
      <select
        aria-label="Chọn phút"
        style={controlStyle}
        value={value.getMinutes()}
        onChange={(e) =>
          choose(value.getHours(), Number(e.currentTarget.value))
        }
      >
        {Array.from({ length: 60 }, (_, n) => (
          <option key={n} value={n}>
            {String(n).padStart(2, "0")} phút
          </option>
        ))}
      </select>
    </div>
  );
}
