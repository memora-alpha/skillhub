import {
  Ellipse,
  G,
  Image,
  Path,
  Polygon,
  Rect,
  Text,
  TSpan,
} from "react-native-svg";
import type { BoardElement, BoardScene } from "../api/classroom-contracts";

export const supportedBoardTypes = [
  "freedraw",
  "line",
  "arrow",
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "image",
];
export function WhiteboardElements({ scene }: Readonly<{ scene: BoardScene }>) {
  return scene.elements
    .filter((el) => !el.isDeleted)
    .map((el) => <BoardShape key={el.id} element={el} files={scene.files} />);
}
function BoardShape({
  element: el,
  files,
}: Readonly<{ element: BoardElement; files?: BoardScene["files"] }>) {
  const x = el.x ?? 0,
    y = el.y ?? 0,
    w = el.width ?? 0,
    h = el.height ?? 0;
  const stroke = el.strokeColor ?? "#1e1e1e",
    strokeWidth = Math.min(30, el.strokeWidth ?? 2);
  const common = {
    stroke,
    strokeWidth,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const points = el.points ?? [];
  const path = points
    .map(([px, py], i) => `${i ? "L" : "M"}${x + px},${y + py}`)
    .join(" ");
  let content;
  switch (el.type) {
    case "freedraw":
    case "line":
    case "arrow": {
      const first = points[0],
        last = points[points.length - 1],
        previous = points[points.length - 2];
      let tip = "";
      if (el.type === "arrow" && last && previous) {
        const angle = Math.atan2(last[1] - previous[1], last[0] - previous[0]);
        const size = Math.max(10, strokeWidth * 4);
        tip = [-Math.PI / 6, Math.PI / 6]
          .map(
            (offset) =>
              `M${x + last[0]},${y + last[1]} L${x + last[0] - size * Math.cos(angle + offset)},${y + last[1] - size * Math.sin(angle + offset)}`,
          )
          .join(" ");
      }
      const dot =
        first && points.length === 1
          ? ` L${x + first[0] + 0.5},${y + first[1] + 0.5}`
          : "";
      content = <Path {...common} d={path + dot + " " + tip} />;
      break;
    }
    case "rectangle":
      content = (
        <Rect
          {...common}
          x={Math.min(x, x + w)}
          y={Math.min(y, y + h)}
          width={Math.abs(w)}
          height={Math.abs(h)}
        />
      );
      break;
    case "ellipse":
      content = (
        <Ellipse
          {...common}
          cx={x + w / 2}
          cy={y + h / 2}
          rx={Math.abs(w / 2)}
          ry={Math.abs(h / 2)}
        />
      );
      break;
    case "diamond":
      content = (
        <Polygon
          {...common}
          points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
        />
      );
      break;
    case "text": {
      const size = Math.min(300, el.fontSize ?? 20);
      content = (
        <Text x={x} y={y + size} fill={stroke} fontSize={size}>
          {(el.text ?? "").split("\n").map((line, i) => (
            <TSpan key={i} x={x} dy={i ? size * 1.25 : 0}>
              {line}
            </TSpan>
          ))}
        </Text>
      );
      break;
    }
    case "image": {
      const file = typeof el.fileId === "string" ? files?.[el.fileId] : null;
      const data =
        file && typeof file === "object" && "dataURL" in file
          ? file.dataURL
          : null;
      if (
        typeof data !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,/i.test(data)
      )
        return null;
      content = (
        <Image
          x={x}
          y={y}
          width={Math.abs(w)}
          height={Math.abs(h)}
          href={data}
        />
      );
      break;
    }
    default:
      return null;
  }
  const angle =
    typeof el.angle === "number" && Number.isFinite(el.angle)
      ? (el.angle * 180) / Math.PI
      : 0;
  return (
    <G rotation={angle} originX={x + w / 2} originY={y + h / 2}>
      {content}
    </G>
  );
}
