import { Text, View } from "react-native";
import { requestDetailStyles as styles } from "./request-detail.styles";

export function RequestDetailTag({ label }: Readonly<{ label: string }>) {
  return (
    <View style={styles.topic}>
      <Text selectable style={styles.topicText}>
        #{label}
      </Text>
    </View>
  );
}
