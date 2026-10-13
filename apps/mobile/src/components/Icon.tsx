import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";
import { colors, iconSizes } from "@/constants/theme";

export type IconName =
  | "zap"
  | "compass"
  | "users"
  | "search"
  | "arrow"
  | "star"
  | "check"
  | "eye"
  | "eye-off"
  | "alert"
  | "check-circle"
  | "chevron"
  | "bell"
  | "home"
  | "message"
  | "user"
  | "calendar"
  | "plus"
  | "logout"
  | "clock"
  | "book"
  | "close"
  | "wallet"
  | "settings"
  | "filter"
  | "clipboard"
  | "trash"
  | "help"
  | "edit"
  | "shield"
  | "award"
  | "lock"
  | "flag"
  | "send"
  | "paperclip"
  | "image"
  | "video"
  | "wifi-off";
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
  return (
    <Svg
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill={name === "star" && filled ? color : "none"}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "zap" && (
        <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      )}
      {name === "image" && (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={3} />
          <Circle cx={8} cy={8} r={1.5} />
          <Polyline points="21 15 16 10 5 21" />
        </>
      )}
      {name === "wifi-off" && (
        <>
          <Line x1={2} y1={2} x2={22} y2={22} />
          <Path d="M8.5 8.5A12 12 0 0 0 2 12M6 16a8 8 0 0 1 6-2.5M15.5 9.3A12 12 0 0 1 22 12M12 5a16 16 0 0 1 10 3.5M2 8.5a16 16 0 0 1 2.6-1.8" />
          <Circle cx={12} cy={19} r={1} />
        </>
      )}
      {name === "compass" && (
        <>
          <Circle cx={12} cy={12} r={10} />
          <Polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </>
      )}
      {name === "users" && (
        <>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "search" && (
        <>
          <Circle cx={11} cy={11} r={8} />
          <Line x1={21} y1={21} x2={16.65} y2={16.65} />
        </>
      )}
      {name === "arrow" && (
        <>
          <Line x1={5} y1={12} x2={19} y2={12} />
          <Polyline points="12 5 19 12 12 19" />
        </>
      )}
      {name === "star" && (
        <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      )}
      {name === "check" && <Polyline points="3 12 9 18 21 5" />}
      {name === "eye" && (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx={12} cy={12} r={3} />
        </>
      )}
      {name === "eye-off" && (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Line x1={1} y1={1} x2={23} y2={23} />
        </>
      )}
      {name === "alert" && (
        <>
          <Circle cx={12} cy={12} r={10} />
          <Line x1={12} y1={8} x2={12} y2={12} />
          <Line x1={12} y1={16} x2={12.01} y2={16} />
        </>
      )}
      {name === "check-circle" && (
        <>
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline points="22 4 12 14.01 9 11.01" />
        </>
      )}
      {name === "chevron" && <Polyline points="9 18 15 12 9 6" />}
      {name === "bell" && (
        <>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      )}
      {name === "home" && (
        <>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </>
      )}
      {name === "message" && (
        <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      )}
      {name === "user" && (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx={12} cy={7} r={4} />
        </>
      )}
      {name === "video" && (
        <>
          <Rect x={3} y={5} width={12} height={14} rx={2} />
          <Polygon points="15 9 21 6 21 18 15 15 15 9" />
        </>
      )}
      {name === "calendar" && (
        <>
          <Rect x={3} y={4} width={18} height={18} rx={2} />
          <Line x1={16} y1={2} x2={16} y2={6} />
          <Line x1={8} y1={2} x2={8} y2={6} />
          <Line x1={3} y1={10} x2={21} y2={10} />
        </>
      )}
      {name === "plus" && (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} />
          <Line x1={5} y1={12} x2={19} y2={12} />
        </>
      )}
      {name === "logout" && (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline points="16 17 21 12 16 7" />
          <Line x1={21} y1={12} x2={9} y2={12} />
        </>
      )}
      {name === "clock" && (
        <>
          <Circle cx={12} cy={12} r={10} />
          <Polyline points="12 6 12 12 16 14" />
        </>
      )}
      {name === "book" && (
        <>
          <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </>
      )}
      {name === "close" && (
        <>
          <Line x1={18} y1={6} x2={6} y2={18} />
          <Line x1={6} y1={6} x2={18} y2={18} />
        </>
      )}
      {name === "wallet" && (
        <>
          <Path d="M20 12V22H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16v4" />
          <Path d="M22 12a2 2 0 0 0-2-2h-2a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2z" />
        </>
      )}
      {name === "settings" && (
        <>
          <Circle cx={12} cy={12} r={3} />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      )}
      {name === "filter" && (
        <>
          <Line x1={3} y1={6} x2={7} y2={6} />
          <Line x1={11} y1={6} x2={21} y2={6} />
          <Circle cx={9} cy={6} r={2} />
          <Line x1={3} y1={12} x2={13} y2={12} />
          <Line x1={17} y1={12} x2={21} y2={12} />
          <Circle cx={15} cy={12} r={2} />
          <Line x1={3} y1={18} x2={7} y2={18} />
          <Line x1={11} y1={18} x2={21} y2={18} />
          <Circle cx={9} cy={18} r={2} />
        </>
      )}
      {name === "trash" && (
        <>
          <Path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14" />
          <Line x1="10" y1="10" x2="10" y2="16" />
          <Line x1="14" y1="10" x2="14" y2="16" />
        </>
      )}
      {name === "clipboard" && (
        <>
          <Path d="M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
          <Rect x={9} y={2} width={6} height={6} rx={1} />
          <Line x1={9} y1={12} x2={15} y2={12} />
          <Line x1={9} y1={16} x2={15} y2={16} />
        </>
      )}
      {name === "help" && (
        <>
          <Circle cx={12} cy={12} r={10} />
          <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <Line x1={12} y1={17} x2={12.01} y2={17} />
        </>
      )}
      {name === "edit" && (
        <>
          <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </>
      )}
      {name === "shield" && (
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      )}
      {name === "award" && (
        <>
          <Circle cx={12} cy={8} r={6} />
          <Path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </>
      )}
      {name === "send" && (
        <>
          <Line x1={22} y1={2} x2={11} y2={13} />
          <Polygon points="22 2 15 22 11 13 2 9 22 2" />
        </>
      )}
      {name === "paperclip" && (
        <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      )}
      {name === "flag" && (
        <>
          <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <Line x1={4} y1={22} x2={4} y2={15} />
        </>
      )}
      {name === "lock" && (
        <>
          <Rect x={3} y={11} width={18} height={11} rx={2} />
          <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      )}
    </Svg>
  );
}
