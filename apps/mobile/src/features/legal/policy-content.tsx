import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, typography } from "@/constants/theme";
import { legalPolicies } from "./content";

export function PolicyContent({
  type,
}: Readonly<{ type: "terms" | "privacy" }>) {
  const policy = legalPolicies[type];
  return (
    <View style={styles.content}>
      <Text selectable style={styles.meta}>
        Cập nhật {legalPolicies.updatedAt} · Phiên bản {legalPolicies.version}
      </Text>
      <Text selectable style={styles.notice}>
        {legalPolicies.notice}
      </Text>
      <Text selectable style={styles.body}>
        {policy.introduction}
      </Text>
      {policy.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text selectable accessibilityRole="header" style={styles.heading}>
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text selectable key={paragraph} style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 20 },
  section: { gap: 12 },
  heading: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.ink },
  meta: { ...typography.caption, fontFamily: fonts.body, color: colors.muted },
  notice: {
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.ink,
    backgroundColor: colors.cream,
    padding: 16,
    borderRadius: 12,
  },
});
