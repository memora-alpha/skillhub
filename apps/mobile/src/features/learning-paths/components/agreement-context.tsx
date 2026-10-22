import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useParticipantProfile } from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function AgreementContext({
  name,
  pathId,
  partnerId,
}: Readonly<{ name: string; pathId: string; partnerId?: string }>) {
  const profile = useParticipantProfile(partnerId);
  return (
    <View style={styles.row}>
      <View style={styles.person}>
        {partnerId && (
          <Avatar
            name={name}
            userId={partnerId}
            size={40}
            sourceUri={profile.data?.avatarUrl}
          />
        )}
        <View style={styles.identity}>
          <Text style={styles.caption}>
            {partnerId ? "Cùng đối tác" : "Cùng"}
          </Text>
          <Text numberOfLines={2} style={styles.name}>
            {name}
          </Text>
        </View>
      </View>
      <Text
        accessibilityLabel={`Mã thỏa thuận ${pathId}`}
        style={styles.reference}
      >
        #{pathId.slice(-8).toUpperCase()}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  person: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  identity: { flexShrink: 1, gap: 2 },
  name: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  caption: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  reference: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
    backgroundColor: colors.surfaceLow,
  },
});
