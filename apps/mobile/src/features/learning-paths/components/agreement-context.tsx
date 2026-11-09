import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useParticipantProfile } from "@/features/connections";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function AgreementContext({
  name,
  partnerId,
}: Readonly<{ name: string; partnerId?: string }>) {
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
});
