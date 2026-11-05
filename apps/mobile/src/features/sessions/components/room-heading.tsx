import { Text, View } from "react-native";
import { roomStyles as styles } from "./native-room.styles";

export function RoomHeading({
  subtitle,
  status,
  connected = false,
  action,
}: Readonly<{
  subtitle: string;
  status?: string;
  connected?: boolean;
  action?: React.ReactNode;
}>) {
  return (
    <View style={styles.header}>
      <View style={styles.heading}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>S</Text>
        </View>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            Phòng học <Text style={styles.brandName}>SkillHub</Text>
          </Text>
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </View>
      {action}
      {!!status && (
        <View style={styles.connection}>
          <View
            style={[styles.connectionDot, connected && styles.connectedDot]}
          />
          <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
            {status}
          </Text>
        </View>
      )}
    </View>
  );
}
