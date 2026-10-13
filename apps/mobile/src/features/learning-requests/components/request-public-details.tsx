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
}: {
  owner: PublicRequest["owner"];
}) {
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

export function RequestPublicFooter({ request }: { request: PublicRequest }) {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <Text style={styles.caption}>
          Gửi đề xuất đang ở bản xem thử, chưa gửi tới người nhận.
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
            accessibilityLabel="Gửi đề xuất — bản xem thử"
            onPress={() =>
              router.push({
                pathname: "/send-proposal",
                params: {
                  mode: "mock-request",
                  requestId: request.id,
                  previewTitle: request.title,
                  previewOwnerId: request.owner.id,
                  previewOwnerName: request.owner.displayName,
                  previewSkillName: request.skill.name,
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
