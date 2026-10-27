import { Pressable, Text, View, useWindowDimensions } from "react-native";
import type { Href } from "expo-router";
import { Icon } from "@/components/Icon";
import { iconSizes } from "@/constants/theme";
import type { AccountSession } from "@/features/auth";
import { HomeWalletBalance } from "@/features/wallet";
import { homeColors as colors } from "../constants/theme";
import type { HomeData } from "../hooks/use-home-data";
import { HomeSection, SectionHeading, homeStyles } from "./HomePrimitives";
import { styles } from "./HomeContent.styles";
import { NewUserGuide } from "./NewUserGuide";
import { HomePathCard, HomeSessionCard } from "./HomeLearningCards";
import { HomeMessages, HomeRequests } from "./HomeFeed";

export function HomeContent({
  session,
  data,
  onNavigate,
}: Readonly<{
  session: AccountSession;
  data: HomeData;
  onNavigate: (href: Href) => void;
}>) {
  const wide = useWindowDimensions().width >= 840;
  const name = session.name.trim().split(/\s+/).slice(-2).join(" ");
  const stats = [
    {
      label: "Reputation",
      value: session.reputationScore ?? "—",
      color: colors.orange,
    },
    {
      label: "Buổi hoàn tất",
      value: session.completedSessionCount,
      color: colors.ink,
    },
    {
      label: "Kỹ năng xác minh",
      value: session.verifiedSkillCount,
      color: colors.ink,
    },
  ];
  return (
    <View style={homeStyles.stack}>
      <View style={[homeStyles.row, { gap: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>CHÀO BẠN</Text>
          <Text style={homeStyles.title}>{name}!</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ví Credit"
          onPress={() => onNavigate("/wallet")}
          style={({ pressed }) => [
            styles.wallet,
            { maxWidth: "60%", flexShrink: 1 },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.walletIcon}>
            <Icon
              name="wallet"
              size={iconSizes.control}
              color={colors.orange}
            />
          </View>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={styles.walletLabel}>SỐ DƯ</Text>
            <HomeWalletBalance />
          </View>
        </Pressable>
      </View>
      {session.isNew && <NewUserGuide onNavigate={onNavigate} />}
      <View style={[styles.columns, wide && styles.wideColumns]}>
        <View style={[styles.primary, wide && styles.wideColumn]}>
          <HomeSessionCard data={data} onNavigate={onNavigate} />
          <HomePathCard data={data} onNavigate={onNavigate} />
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View key={stat.label} style={[styles.card, styles.stat]}>
                <View style={styles.statValueRow}>
                  {index === 0 && (
                    <Icon name="star" size={14} color={colors.yellow} />
                  )}
                  <Text
                    style={[styles.statValue, { color: stat.color }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {stat.value}
                  </Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <HomeSection>
            <SectionHeading
              title="Thành tích & danh hiệu"
              action="Xem tất cả"
              accent={colors.yellow}
              onPress={() => onNavigate("/achievements")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem thành tích và danh hiệu"
              onPress={() => onNavigate("/achievements")}
              style={({ pressed }) => [
                styles.card,
                styles.achievement,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.award}>
                <Icon
                  name="award"
                  size={iconSizes.feature}
                  color={colors.yellow}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={homeStyles.label}>
                  {session.selectedTitle ?? "Thành tích của bạn"}
                </Text>
                <Text style={homeStyles.caption}>
                  {session.selectedTitle
                    ? "Danh hiệu đang hiển thị trên hồ sơ"
                    : "Xem thành tích đã mở khóa và chọn danh hiệu cho hồ sơ."}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.orange} />
            </Pressable>
          </HomeSection>
        </View>
        <View style={[styles.secondary, wide && styles.wideColumn]}>
          <HomeRequests data={data} onNavigate={onNavigate} />
          <HomeMessages data={data} onNavigate={onNavigate} />
        </View>
      </View>
    </View>
  );
}
