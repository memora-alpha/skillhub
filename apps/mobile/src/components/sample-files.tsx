import { Text, View } from "react-native";
import { Button } from "./Button";
import { Copy } from "./feature-page";
import { fonts, appColors } from "@/constants/theme";
export const sampleFiles = [
  { name: "chung-chi.pdf", bytes: 2 * 1024 * 1024 },
  { name: "du-an.docx", bytes: 4 * 1024 * 1024 },
  { name: "minh-chung.png", bytes: 1024 * 1024 },
  { name: "tep-lon.pdf", bytes: 16 * 1024 * 1024 },
];
export function SampleFiles({
  value,
  onChange,
  maxCount = 5,
  maxBytes,
}: {
  value: string[];
  onChange: (files: string[]) => void;
  maxCount?: number;
  maxBytes?: number;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Copy muted>
        Chọn tệp mẫu để xem giao diện. Không truy cập hoặc tải tệp cá nhân lên
        máy chủ.
      </Copy>
      {sampleFiles.map((file) => {
        const selected = value.includes(file.name);
        const tooLarge = maxBytes !== undefined && file.bytes > maxBytes;
        return (
          <View
            key={file.name}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontFamily: fonts.semibold, color: appColors.ink }}
              >
                {file.name}
              </Text>
              <Copy muted>
                {file.bytes / 1024 / 1024} MB
                {tooLarge ? " · Vượt giới hạn" : ""}
              </Copy>
            </View>
            <Button
              variant="paper"
              disabled={tooLarge || (!selected && value.length >= maxCount)}
              onPress={() =>
                onChange(
                  selected
                    ? value.filter((f) => f !== file.name)
                    : [...value, file.name],
                )
              }
            >
              {selected ? "Bỏ chọn" : "Chọn"}
            </Button>
          </View>
        );
      })}
    </View>
  );
}
