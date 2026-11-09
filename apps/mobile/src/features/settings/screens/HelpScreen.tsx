import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { ActionRow } from "@/components/ActionGroup";
import { appColors as colors } from "@/constants/theme";
import { SettingsPage } from "../components/SettingsPage";
import {
  SettingsIntro,
  SettingsSection,
  settingsStyles,
} from "../components/SettingsUI";
import { settingsFaqs } from "../constants/help";

export function HelpScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const results = settingsFaqs.filter(([question, answer]) =>
    `${question} ${answer}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <SettingsPage title="Trợ giúp">
      <SettingsIntro
        title="Bạn cần hỗ trợ điều gì?"
        description="Tìm câu trả lời nhanh để tiếp tục hành trình học tập."
      />
      <Input
        label="Tìm câu hỏi"
        placeholder="Tìm câu hỏi, lịch học, Credit..."
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        rightAccessory={<Icon name="search" color={colors.muted} />}
      />
      {results.length ? (
        <SettingsSection title="Câu hỏi thường gặp">
          {results.map(([question, answer]) => (
            <View key={question}>
              <Button
                variant="ghost"
                style={styles.question}
                accessibilityState={{ expanded: expanded === question }}
                onPress={() =>
                  setExpanded(expanded === question ? undefined : question)
                }
              >
                <Text style={[settingsStyles.title, styles.questionText]}>
                  {question}
                </Text>
                <View
                  style={{
                    transform: [
                      { rotate: expanded === question ? "90deg" : "0deg" },
                    ],
                  }}
                >
                  <Icon name="chevron" size={16} color={colors.muted} />
                </View>
              </Button>
              {expanded === question && (
                <Text selectable style={[settingsStyles.body, styles.answer]}>
                  {answer}
                </Text>
              )}
            </View>
          ))}
        </SettingsSection>
      ) : (
        <Text style={settingsStyles.caption}>
          Chưa tìm thấy câu trả lời. Thử một từ khóa khác nhé.
        </Text>
      )}
      <SettingsSection title="Thông tin hữu ích">
        <ActionRow
          icon="flag"
          label="Theo dõi báo cáo"
          description="Xem trạng thái báo cáo của bạn"
          onPress={() => router.push("/reports")}
        />
        <ActionRow
          icon="shield"
          label="Chính sách & điều khoản"
          description="Quyền riêng tư và nguyên tắc sử dụng"
          onPress={() => router.push("/policies")}
        />
      </SettingsSection>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  question: { padding: 18, justifyContent: "space-between", gap: 16 },
  questionText: { flex: 1 },
  answer: { paddingHorizontal: 18, paddingBottom: 20, color: colors.inkSoft },
});
