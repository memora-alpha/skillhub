import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import type { PublicRequest } from "../types";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestRequesterDetails({
  owner,
}: Readonly<{
  owner: PublicRequest["owner"];
}>) {
  return (
    <View style={[styles.card, styles.metadataRow]}>
      <Avatar
        name={owner.displayName}
        userId={owner.id}
        size={44}
        shape="square"
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.caption}>Người đăng yêu cầu</Text>
        <Text selectable style={styles.emphasis}>
          {owner.displayName}
        </Text>
      </View>
    </View>
  );
}

export function RequestPublicFooter({
  request,
}: Readonly<{ request: PublicRequest }>) {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <Text style={styles.caption}>
          Gửi đề xuất để trao đổi về cách học và lịch phù hợp.
        </Text>
        <View style={styles.footerRow}>
          <Button
            variant="paper"
            style={[styles.secondary, styles.footerSecondary]}
            accessibilityLabel="Xem hồ sơ người đăng yêu cầu"
            onPress={() =>
              router.push({
                pathname: "/profiles/[userId]",
                params: { userId: request.owner.id, requestId: request.id },
              })
            }
          >
            <Text style={styles.secondaryLabel}>Xem hồ sơ</Text>
          </Button>
          <Button
            variant="craft"
            style={[styles.publish, styles.footerPrimary]}
            accessibilityLabel="Gửi đề xuất"
            onPress={() =>
              router.push({
                pathname: "/send-proposal",
                params: {
                  requestId: request.id,
                },
              })
            }
          >
            <Icon name="message" size={17} color={colors.white} />
            <Text style={styles.publishLabel}>Gửi đề xuất</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
