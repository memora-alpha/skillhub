import { useRef, useState } from "react";
import { Text, View, ScrollView, type ScrollViewInstance } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { legalPolicies } from "../content";
import { PolicyContent } from "../policy-content";
import { PolicySummary } from "../policy-summary";
import { policyScreenStyles as styles } from "../policies.styles";

export function PoliciesScreen() {
  const router = useRouter();
  const scroll = useRef<ScrollViewInstance>(null);
  const [type, setType] = useState<"terms" | "privacy">("terms");
  const [full, setFull] = useState(false);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Button
          variant="ghost"
          accessibilityLabel="Quay lại"
          style={styles.back}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
        >
          <View style={styles.backIcon}>
            <Icon name="arrow" size={22} color={colors.ink} />
          </View>
        </Button>
        <Text accessibilityRole="header" style={styles.navigationTitle}>
          Chính sách
        </Text>
        <View style={styles.headerBalance} />
      </View>
      <View style={styles.tabs}>
        {(["terms", "privacy"] as const).map((item) => (
          <Button
            key={item}
            variant="ghost"
            style={[styles.tab, type === item && styles.activeTab]}
            accessibilityState={{ selected: type === item }}
            onPress={() => {
              setType(item);
              setFull(false);
              scroll.current?.scrollTo({ y: 0, animated: false });
            }}
          >
            <Text
              style={[styles.tabLabel, type === item && styles.activeTabLabel]}
            >
              {item === "terms" ? "Điều khoản" : "Bảo mật"}
            </Text>
          </Button>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.introduction}>
          <Text accessibilityRole="header" style={styles.title}>
            {legalPolicies[type].title}
          </Text>
          <Text style={styles.subtitle}>
            {type === "terms"
              ? "Tài khoản, lịch học, Credit và trách nhiệm của bạn."
              : "Cách SkillHub sử dụng dữ liệu và những lựa chọn của bạn."}
          </Text>
          <View style={styles.metadata}>
            <Text style={styles.date}>Cập nhật {legalPolicies.updatedAt}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Bản dự thảo</Text>
            </View>
          </View>
        </View>
        {full ? (
          <View style={styles.reading}>
            <Button
              variant="ghost"
              style={styles.documentLink}
              onPress={() => setFull(false)}
            >
              <View style={styles.backIcon}>
                <Icon name="arrow" size={16} color={colors.primary} />
              </View>
              <Text style={styles.documentTitle}>Xem tóm tắt</Text>
            </Button>
            <PolicyContent type={type} showMetadata={false} />
          </View>
        ) : (
          <>
            <PolicySummary key={type} type={type} />
            <Button
              variant="ghost"
              style={styles.documentLink}
              accessibilityLabel="Đọc bản đầy đủ"
              onPress={() => {
                setFull(true);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
            >
              <View style={styles.documentIcon}>
                <Icon name="file" size={21} color={colors.primary} />
              </View>
              <View style={styles.topicLabels}>
                <Text style={styles.documentTitle}>Đọc bản đầy đủ</Text>
                <Text style={styles.documentHint}>
                  Các điều kiện và thời hạn chi tiết
                </Text>
              </View>
              <Icon name="arrow" size={18} color={colors.primary} />
            </Button>
          </>
        )}
        <View style={styles.draft}>
          <Text style={styles.draftCopy}>{legalPolicies.notice}</Text>
          <Text selectable style={styles.version}>
            Phiên bản {legalPolicies.version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
