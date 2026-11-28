import { useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from "react-native";
import Svg from "react-native-svg";
import { randomUUID } from "expo-crypto";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import type { BoardElement, BoardScene } from "../api/classroom-contracts";
import { boardHeight, boardPoint, boardWidth } from "../utils/whiteboard-scene";
import { WhiteboardElements, supportedBoardTypes } from "./whiteboard-elements";
import { classroomStyles as styles } from "./classroom.styles";

const tools = [
  ["freedraw", "Bút"],
  ["line", "Đường"],
  ["rectangle", "Hình chữ nhật"],
  ["ellipse", "Hình tròn"],
  ["text", "Chữ"],
] as const;
const palette = ["#1e1e1e", "#b91c1c", "#1d4ed8", "#15803d"];
export function WhiteboardCanvas({
  scene,
  editable,
  onChange,
}: Readonly<{
  scene: BoardScene;
  editable: boolean;
  onChange: (rows: BoardElement[]) => void;
}>) {
  const [tool, setTool] = useState<string>("freedraw");
  const [color, setColor] = useState(palette[0]!);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<BoardElement | null>(null);
  const current = useRef<BoardElement | null>(null);
  const width = useRef(1),
    own = useRef<string[]>([]);
  const point = (event: GestureResponderEvent) =>
    boardPoint(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      width.current,
    );
  function start(event: GestureResponderEvent) {
    if (!editable || (tool === "text" && !text.trim())) return;
    const [x, y] = point(event);
    current.current = {
      id: randomUUID(),
      type: tool,
      x,
      y,
      width: 0,
      height: 0,
      version: 1,
      versionNonce: 1,
      strokeColor: color,
      strokeWidth: 4,
      ...(tool === "freedraw" || tool === "line"
        ? { points: [[0, 0]] as [number, number][] }
        : {}),
      ...(tool === "text" ? { text: text.trim(), fontSize: 28 } : {}),
    };
    setDraft(current.current);
  }
  function move(event: GestureResponderEvent) {
    const el = current.current;
    if (!el || !editable || tool === "text") return;
    const [x, y] = point(event),
      px = x - (el.x ?? 0),
      py = y - (el.y ?? 0);
    let points = el.points;
    if (tool === "freedraw") {
      const previous = points?.[points.length - 1];
      if (previous && Math.hypot(px - previous[0], py - previous[1]) < 2)
        return;
      if ((points?.length ?? 0) >= 5000) return;
      points = [...(points ?? []), [px, py]];
    } else if (tool === "line")
      points = [
        [0, 0],
        [px, py],
      ];
    current.current = {
      ...el,
      width: px,
      height: py,
      ...(points ? { points } : {}),
    };
    setDraft(current.current);
  }
  function finish() {
    const el = current.current;
    current.current = null;
    setDraft(null);
    if (!el || !editable) return;
    own.current.push(el.id);
    onChange([el]);
  }
  function undo() {
    let id = own.current.pop();
    while (id) {
      const row = scene.elements.find((el) => el.id === id && !el.isDeleted);
      if (row) {
        onChange([
          {
            ...row,
            isDeleted: true,
            version: row.version + 1,
            versionNonce: row.versionNonce + 1,
          },
        ]);
        return;
      }
      id = own.current.pop();
    }
  }
  const unsupported = scene.elements.some(
    (el) => !el.isDeleted && !supportedBoardTypes.includes(el.type),
  );
  return (
    <View style={styles.stack}>
      {editable && (
        <View style={styles.toolbar}>
          <View style={styles.row}>
            {tools.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={tool === value ? "primary" : "paper"}
                accessibilityState={{ selected: tool === value }}
                onPress={() => setTool(value)}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="paper"
              onPress={undo}
              disabled={!own.current.length}
            >
              Hoàn tác nét của tôi
            </Button>
          </View>
          <View style={styles.row}>
            {palette.map((value, i) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Màu ${["đen", "đỏ", "xanh dương", "xanh lá"][i]}`}
                accessibilityState={{ selected: color === value }}
                onPress={() => setColor(value)}
                style={[
                  styles.color,
                  { backgroundColor: value },
                  color === value && styles.selectedColor,
                ]}
              />
            ))}
          </View>
          {tool === "text" && (
            <TextInput
              accessibilityLabel="Nội dung chữ trên bảng"
              placeholder="Nhập chữ rồi chạm vào bảng"
              placeholderTextColor={colors.muted}
              maxLength={3000}
              value={text}
              onChangeText={setText}
              style={styles.input}
            />
          )}
        </View>
      )}
      <View
        style={styles.canvas}
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        accessibilityLabel={
          editable ? "Bảng vẽ, kéo ngón tay để vẽ" : "Nội dung bảng trắng"
        }
        onStartShouldSetResponder={() => editable}
        onMoveShouldSetResponder={() => editable}
        onResponderGrant={start}
        onResponderMove={move}
        onResponderRelease={finish}
        onResponderTerminationRequest={() => false}
        onResponderTerminate={() => {
          current.current = null;
          setDraft(null);
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${boardWidth} ${boardHeight}`}
          pointerEvents="none"
        >
          <WhiteboardElements
            scene={
              draft ? { ...scene, elements: [...scene.elements, draft] } : scene
            }
          />
        </Svg>
      </View>
      {unsupported && (
        <Text style={styles.muted}>
          Một số đối tượng chỉ xem đầy đủ trên web. Nội dung gốc vẫn được giữ
          khi lưu.
        </Text>
      )}
      {editable && (
        <Text style={styles.muted}>
          Nét vẽ được đồng bộ với người cùng học và tự lưu khi kết nối ổn định.
        </Text>
      )}
    </View>
  );
}
