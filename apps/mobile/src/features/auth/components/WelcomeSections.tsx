import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { BrandLogo } from "@/components/BrandLogo";
import { colors, fonts, layout, radius } from "@/constants/theme";
import {
  welcomeBenefits,
  welcomeCategories,
  welcomeFooter,
  welcomeReviews,
  welcomeSteps,
  welcomeWallet,
} from "../mocks/welcome";
import { WelcomeAvatar, WelcomeStars } from "./WelcomeSocial";

type SectionsProps = {
  onRegister: () => void;
  onLink: (label: string) => void;
  onSectionLayout: (
    section: "how" | "categories" | "credit",
    event: LayoutChangeEvent,
  ) => void;
};
export function WelcomeSections({
  onRegister,
  onLink,
  onSectionLayout,
}: SectionsProps) {
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  return (
    <>
      <View
        style={styles.howSection}
        onLayout={(event) => onSectionLayout("how", event)}
      >
        <View style={styles.container}>
          <View style={styles.howHeading}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, styles.center]}
            >
              SkillHub hoạt động như thế nào?
            </Text>
            <Text style={[styles.subtitle, styles.center, { marginTop: 8 }]}>
              Đơn giản, minh bạch, hiệu quả.
            </Text>
          </View>
          <View style={[styles.steps, tablet && styles.row]}>
            {welcomeSteps.map((step) => (
              <View
                key={step.step}
                style={[styles.step, tablet && styles.column]}
              >
                <View style={styles.stepIcon}>
                  <Icon name={step.icon} size={28} />
                  <View style={styles.stepNumber}>
                    <Text style={styles.number}>{step.step}</Text>
                  </View>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={[styles.body, styles.center]}>
                  {step.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View
        style={[styles.container, styles.section]}
        onLayout={(event) => onSectionLayout("categories", event)}
      >
        <View style={styles.categoryHeading}>
          <View style={styles.column}>
            <Text accessibilityRole="header" style={styles.heading}>
              Khám phá kỹ năng
            </Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              Từ kỹ thuật đến sáng tạo, từ kinh doanh đến nghệ thuật.
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => onLink("Xem tất cả")}
          >
            <Text style={styles.linkLabel}>Xem tất cả</Text>
            <Icon name="arrow" size={16} color={colors.inkSoft} />
          </Button>
        </View>
        <View style={styles.categories}>
          {welcomeCategories.map((category) => (
            <Pressable
              key={category.title}
              accessibilityRole="button"
              accessibilityLabel={category.title + ": " + category.description}
              onPress={() => onLink(category.title)}
              style={({ pressed }) => [
                styles.category,
                { flexBasis: tablet ? "20%" : "40%" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name={category.icon} color={category.color} size={24} />
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text
                style={[styles.categoryDescription, { color: category.color }]}
              >
                {category.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View
        style={styles.creditSection}
        onLayout={(event) => onSectionLayout("credit", event)}
      >
        <View
          style={[
            styles.container,
            { maxWidth: 896, gap: 48 },
            tablet && styles.row,
          ]}
        >
          <View style={[styles.creditCopy, tablet && styles.column]}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: colors.white }]}
            >
              Credit là gì?
            </Text>
            <Text style={styles.creditDescription}>
              Credit là đơn vị trao đổi trên SkillHub. Credit được tạm giữ và
              chỉ quyết toán khi toàn bộ lộ trình hoàn thành.
            </Text>
            <View style={{ gap: 12 }}>
              {welcomeBenefits.map((benefit) => (
                <View key={benefit} style={styles.benefit}>
                  <View style={styles.check}>
                    <Icon name="check" color={colors.white} size={12} />
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
            <Button
              variant="secondary"
              onPress={onRegister}
              style={{ alignSelf: "flex-start" }}
            >
              Nhận 50 Credit miễn phí
            </Button>
          </View>
          <View style={[styles.wallet, tablet && styles.column]}>
            <View style={styles.balance}>
              <Text style={styles.walletLabel}>Số dư hiện tại</Text>
              <Text style={styles.amount}>{welcomeWallet.balance}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {welcomeWallet.transactions.map((transaction) => (
                <View key={transaction.label} style={styles.transaction}>
                  <Text style={[styles.walletLabel, { flex: 1 }]}>
                    {transaction.label}
                  </Text>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: transaction.color },
                    ]}
                  >
                    {transaction.amount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.container, styles.section]}>
        <Text
          accessibilityRole="header"
          style={[styles.heading, styles.center, { marginBottom: 40 }]}
        >
          Cộng đồng tin tưởng SkillHub
        </Text>
        <View style={[styles.reviews, tablet && styles.row]}>
          {welcomeReviews.map((review) => (
            <View
              key={review.name}
              style={[styles.review, tablet && styles.column]}
            >
              <WelcomeStars />
              <Text style={styles.reviewText}>{review.text}</Text>
              <View style={styles.reviewer}>
                <WelcomeAvatar name={review.name} />
                <View style={styles.column}>
                  <Text style={styles.reviewName}>{review.name}</Text>
                  <Text style={styles.reviewRole}>{review.role}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.ctaSection}>
        <View style={[styles.container, styles.cta]}>
          <Text accessibilityRole="header" style={styles.ctaHeading}>
            Bắt đầu hành trình của bạn ngay hôm nay
          </Text>
          <Text style={styles.ctaDescription}>
            Miễn phí đăng ký. 50 Credit chào mừng. Không cần thẻ ngân hàng.
          </Text>
          <Button variant="white" size="xl" onPress={onRegister}>
            Tạo tài khoản miễn phí
          </Button>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.container}>
          <View style={[styles.footerColumns, tablet && styles.row]}>
            <View style={[styles.footerBrand, tablet && styles.column]}>
              <BrandLogo compact />
              <Text style={styles.footerText}>
                Nền tảng trao đổi kỹ năng 1:1 dành cho cộng đồng Việt Nam.
              </Text>
            </View>
            {welcomeFooter.map((column) => (
              <View key={column.title} style={tablet && styles.column}>
                <Text style={styles.footerTitle}>{column.title}</Text>
                <View style={{ gap: 8 }}>
                  {column.links.map((link) => (
                    <Pressable
                      key={link}
                      accessibilityRole="button"
                      onPress={() => onLink(link)}
                    >
                      <Text style={styles.footerText}>{link}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.copyright}>
            © 2024 SkillHub. Phát triển tại Việt Nam.
          </Text>
        </View>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
  },
  section: { paddingVertical: layout.sectionPadding },
  heading: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
  },
  subtitle: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  body: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  center: { textAlign: "center" },
  row: { flexDirection: "row" },
  column: { flex: 1 },
  howSection: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: layout.sectionPadding,
  },
  howHeading: { marginBottom: 48 },
  steps: { gap: 32 },
  step: { alignItems: "center", gap: 16 },
  stepIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
  },
  stepTitle: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
  },
  categoryHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 32,
  },
  linkLabel: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  category: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 20,
  },
  categoryTitle: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 17.5,
    color: colors.ink,
    marginTop: 12,
  },
  categoryDescription: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  creditSection: {
    backgroundColor: colors.ink,
    paddingVertical: layout.sectionPadding,
  },
  creditCopy: { gap: 24 },
  creditDescription: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    color: colors.mutedLight,
    fontSize: 16,
    lineHeight: 26,
  },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.border,
    flex: 1,
  },
  wallet: {
    padding: 32,
    borderRadius: radius.card,
    backgroundColor: colors.inkSoft,
    gap: 16,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.ink,
    padding: 16,
    borderRadius: radius.card,
    gap: 8,
  },
  walletLabel: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 20,
  },
  amount: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    color: colors.brand,
    fontSize: 24,
    lineHeight: 32,
  },
  transaction: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 8,
  },
  transactionAmount: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  reviews: { gap: 24 },
  review: {
    padding: 24,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 16,
  },
  reviewText: {
    includeFontPadding: false,
    fontFamily: fonts.italic,
    color: colors.body,
    fontSize: 14,
    lineHeight: 22.75,
  },
  reviewer: { flexDirection: "row", gap: 12, alignItems: "center" },
  reviewName: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  reviewRole: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  ctaSection: {
    backgroundColor: colors.brand,
    paddingVertical: layout.sectionPadding,
  },
  cta: { maxWidth: 672, gap: 24, alignItems: "center" },
  ctaHeading: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.white,
    textAlign: "center",
  },
  ctaDescription: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.brandLight,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: 40,
  },
  footerColumns: { gap: 32, marginBottom: 32 },
  footerBrand: { gap: 12 },
  footerText: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  footerTitle: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: 12,
  },
  copyright: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 24,
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    color: colors.muted,
  },
});
