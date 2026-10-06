import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { colors, fonts, radius } from "@/constants/theme";
import { chatCopy } from "../mocks/chat";

export function AcceptedProposalNotice() {
  return (
    <View style={styles.accepted}>
      <Icon name="check-circle" size={17} color={colors.sage} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.acceptedTitle}>{chatCopy.acceptedTitle}</Text>
        <Text style={styles.caption}>{chatCopy.acceptedBody}</Text>
      </View>
    </View>
  );
}
export function ChatNextStep({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.nextStep}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.stepLabel}>BƯỚC TIẾP THEO</Text>
          <Badge label="Chưa chọn" variant="warning" />
        </View>
        <Text style={styles.title}>{chatCopy.nextStepTitle}</Text>
        <Text style={styles.muted}>{chatCopy.nextStepBody}</Text>
        <Button onPress={onPress} style={{ marginTop: 12 }}>
          Chọn hình thức học
        </Button>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  accepted: {
    width: "100%",
    maxWidth: 512,
    alignSelf: "center",
    backgroundColor: colors.sageLight,
    borderWidth: 1,
    borderColor: "#C9DDD3",
    borderRadius: radius.card,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  acceptedTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.sage,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
  },
  nextStep: {
    width: "100%",
    maxWidth: 512,
    alignSelf: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#D8CCBE",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  accent: { height: 4, backgroundColor: colors.brand },
  content: { padding: 16, gap: 4 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  stepLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.ink,
    marginTop: 4,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
});
