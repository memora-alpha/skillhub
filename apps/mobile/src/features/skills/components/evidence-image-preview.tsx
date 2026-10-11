import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { appColors } from "@/constants/theme";
import type { EvidenceDraft } from "../utils/evidence-draft";
import { skillStyles } from "./SkillsLayout";

export function EvidenceImagePreview({ file }: { file: EvidenceDraft }) {
  const [failed, setFailed] = useState(false);
  if (!file.mime.startsWith("image/")) return null;
  return (
    <View
      style={{
        backgroundColor: appColors.surfaceLow,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {failed ? (
        <Text
          style={[
            skillStyles.caption,
            { padding: 16, paddingRight: 64, minHeight: 64 },
          ]}
        >
          Không xem trước được ảnh.
        </Text>
      ) : (
        <Image
          source={{ uri: file.asset.uri }}
          style={{ width: "100%", aspectRatio: 4 / 3, maxHeight: 160 }}
          contentFit="contain"
          cachePolicy="none"
          accessible
          accessibilityLabel={`Xem trước: ${file.asset.name}`}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
