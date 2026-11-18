import { Image, StyleSheet, Text, View } from "react-native";
import welcomePhoto from "../../../../assets/images/welcome-study.jpg";
import { LinearGradient } from "expo-linear-gradient";
import { typography, colors, fonts } from "@/constants/theme";

export function WelcomeVisual() {
  return (
    <View>
      <View style={styles.panel}>
        <View style={styles.frame} />
        <View style={styles.photo}>
          <Image
            source={welcomePhoto}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel="Hai người bạn cùng học qua máy tính xách tay"
          />
          <LinearGradient
            colors={[
              "rgba(250,247,242,0.05)",
              "transparent",
              "rgba(28,20,16,0.55)",
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.quote}>
          <Text style={styles.quoteText}>“Học cùng nhau, tiến bộ thật.”</Text>
          <Text style={styles.quoteCaption}>
            Kết nối 1:1 theo Learning Path rõ ràng
          </Text>
        </View>
      </View>
      <Text style={styles.credit}>Ảnh: Kateryna Hliznitsova / Unsplash</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    aspectRatio: 4 / 5,
  },
  frame: {
    position: "absolute",
    top: -12,
    bottom: -12,
    left: -12,
    right: -12,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 32,
    transform: [{ rotate: "2deg" }],
  },
  photo: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: "hidden" },
  quote: { position: "absolute", bottom: 28, left: 24, maxWidth: 208 },
  quoteText: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    color: colors.white,
    fontSize: 20,
    lineHeight: 26,
  },
  quoteCaption: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    color: "rgba(255,255,255,0.8)",
    ...typography.secondary,
    marginTop: 8,
  },
  credit: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    color: colors.muted,
    ...typography.caption,
    textAlign: "center",
    marginTop: 16,
  },
});
