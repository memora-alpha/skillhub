import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  iconSizes,
  typography,
  appRadius as radius,
  fonts,
} from "@/constants/theme";
import { chatCopy } from "../mocks/chat";
import { messageColors as colors } from "../constants/theme";

export function AcceptedProposalNotice() {
  return (
    <View style={styles.accepted}>
      <Icon name="check-circle" size={iconSizes.control} color={colors.sage} />
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
        <Button variant="craft" onPress={onPress} style={{ marginTop: 10 }}>
          <Text style={styles.buttonLabel}>Chọn hình thức học</Text>
          <Icon name="arrow" size={iconSizes.inline} color={colors.white} />
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
    borderColor: "#BDEFD6",
    borderRadius: radius.card,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  acceptedTitle: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: "#179B69",
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  nextStep: {
    width: "100%",
    maxWidth: 512,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#D8CCBE",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  accent: { height: 4, backgroundColor: colors.brand },
  content: { padding: 12, gap: 3 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  stepLabel: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.brand,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.ink,
    marginTop: 4,
  },
  muted: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: colors.muted,
  },
  buttonLabel: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.white,
    includeFontPadding: false,
  },
});
