import { colors, iconSizes, iconStrokeWidth } from "@/constants/theme";
import { iconComponents, type IconName } from "./icon-map";
export type { IconName } from "./icon-map";

export function Icon({
  name,
  size = iconSizes.control,
  color = colors.brand,
  filled = name === "star",
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const IconComponent = iconComponents[name];
  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={iconStrokeWidth}
      fill={name === "star" && filled ? color : "none"}
      style={{ flexShrink: 0 }}
      accessible={false}
      accessibilityElementsHidden
      focusable={false}
    />
  );
}
