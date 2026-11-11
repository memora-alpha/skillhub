import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { sectionStyles as styles } from "./session-section.styles";

export function SessionLessonContent({
  content,
}: Readonly<{ content: string }>) {
  const [expanded, setExpanded] = useState(false);
  const long = content.length > 180 || content.split("\n").length > 4;
  return (
    <View style={styles.content}>
      <Text
        selectable
        numberOfLines={long && !expanded ? 3 : undefined}
        style={styles.lesson}
      >
        {content}
      </Text>
      {long && (
        <Button
          variant="ghost"
          style={styles.linkButton}
          accessibilityLabel={
            expanded
              ? "Thu gọn nội dung buổi học"
              : "Xem thêm nội dung buổi học"
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.linkLabel}>
            {expanded ? "Thu gọn" : "Xem thêm"}
          </Text>
        </Button>
      )}
    </View>
  );
}
