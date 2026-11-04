import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { colors, fonts, typography } from "@/constants/theme";
import { legalPolicies } from "../content";
import { PolicyContent } from "../policy-content";

export function PoliciesScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Button
          variant="paper"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        >
          Quay lại
        </Button>
        <Text accessibilityRole="header" style={styles.title}>
          Chính sách & điều khoản
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {(["terms", "privacy"] as const).map((type) => (
          <View key={type} style={styles.document}>
            <Text accessibilityRole="header" style={styles.heading}>
              {legalPolicies[type].title}
            </Text>
            <PolicyContent type={type} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    padding: 16,
    gap: 12,
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
  },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 40,
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
  },
  document: { gap: 20 },
  heading: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
});
