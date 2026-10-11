import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors, fonts } from "@/constants/theme";
import { fileStateLabels, type EvidenceDraft } from "../utils/evidence-draft";
import { formatFileSize } from "../utils/format-file-size";
import { EvidenceImagePreview } from "./evidence-image-preview";
import { skillStyles } from "./SkillsLayout";
export function EvidenceFiles({
  files,
  disabled,
  onRemove,
}: {
  files: EvidenceDraft[];
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {files.map((file) => {
        const image = file.mime.startsWith("image/");
        const status = file.checking
          ? "Đang kiểm tra…"
          : file.state === "SELECTED"
            ? null
            : (fileStateLabels[file.state] ?? "File không khả dụng");
        const remove = (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${image ? "Xóa ảnh" : "Xóa file"}: ${file.asset.name}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onRemove(file.localId)}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || disabled ? 0.5 : 1,
              flexShrink: 0,
            })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: appColors.surface,
                borderWidth: 1,
                borderColor: appColors.border,
              }}
            >
              <Icon name="close" size={14} color={appColors.ink} />
            </View>
          </Pressable>
        );
        return (
          <View
            key={file.localId}
            style={[skillStyles.card, { padding: 10, gap: 6 }]}
          >
            {image && (
              <View>
                <EvidenceImagePreview file={file} />
                <View style={{ position: "absolute", top: 2, right: 2 }}>
                  {remove}
                </View>
              </View>
            )}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  accessibilityLabel={file.asset.name}
                  style={[
                    skillStyles.caption,
                    { fontFamily: fonts.semibold, color: appColors.ink },
                  ]}
                >
                  {file.asset.name}
                </Text>
                <Text style={skillStyles.caption}>
                  {formatFileSize(file.size)}
                  {status ? ` · ${status}` : ""}
                </Text>
              </View>
              {!image && remove}
            </View>
          </View>
        );
      })}
    </View>
  );
}
