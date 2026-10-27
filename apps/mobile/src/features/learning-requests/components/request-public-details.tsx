import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  useSentRequestProposals,
  sentRequestProposalLabels,
} from "@/features/proposals/state";
import { ConnectionFeedback } from "@/features/connections";
import { useRequestOwnerAvatar } from "../hooks/use-request-owner-avatar";
import type { PublicRequest } from "../types";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestRequesterDetails({
  owner,
  requestId,
}: Readonly<{
  owner: PublicRequest["owner"];
  requestId: string;
}>) {
  const router = useRouter();
  const avatar = useRequestOwnerAvatar(owner);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem hồ sơ công khai của ${owner.displayName}`}
      onPress={() =>
        router.push({
          pathname: "/profiles/[userId]",
          params: { userId: owner.id, requestId },
        })
      }
      style={({ pressed }) => [
        styles.card,
        styles.metadataRow,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Avatar
        name={owner.displayName}
        userId={owner.id}
        size={44}
        sourceUri={avatar.sourceUri}
        onImageError={avatar.onImageError}
        shape="circle"
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.caption}>Người đăng yêu cầu</Text>
        <Text style={styles.emphasis}>{owner.displayName}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.accent} />
    </Pressable>
  );
}

export function RequestPublicFooter({
  request,
}: Readonly<{ request: PublicRequest }>) {
  const router = useRouter();
  const proposals = useSentRequestProposals();
  const proposal = proposals.data?.[request.id];
  const existing =
    !!proposal && ["PENDING", "ACCEPTED"].includes(proposal.status);
  const open =
    request.status === "OPEN" &&
    (!request.expiresAt || Date.parse(request.expiresAt) > Date.now());
  const disabled =
    !existing &&
    (proposals.isPending || proposals.isFetching || !!proposals.error || !open);
  const { label, description } = requestFooterText({
    existing,
    open,
    proposalStatus: proposal?.status,
    pending: proposals.isPending,
    hasError: !!proposals.error,
  });
  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <Text style={styles.caption}>{description}</Text>
        {!!proposals.error && (
          <ConnectionFeedback
            error={proposals.error}
            retry={proposals.refetch}
          />
        )}
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
            accessibilityLabel={label}
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              if (existing && proposal)
                router.push({
                  pathname: "/proposals/[id]",
                  params: { id: proposal.id },
                });
              else
                router.push({
                  pathname: "/send-proposal",
                  params: {
                    requestId: request.id,
                  },
                });
            }}
          >
            <Icon name="message" size={17} color={colors.white} />
            <Text style={styles.publishLabel}>{label}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

function requestFooterText(input: {
  existing: boolean;
  open: boolean;
  proposalStatus?: keyof typeof sentRequestProposalLabels;
  pending: boolean;
  hasError: boolean;
}) {
  let label = "Gửi đề xuất";
  if (input.existing) label = "Xem đề xuất";
  else if (!input.open) label = "Không nhận đề xuất";
  else if (input.proposalStatus) label = "Gửi lại đề xuất";

  let description = "Gửi đề xuất để trao đổi về cách học và lịch phù hợp.";
  if (input.proposalStatus)
    description = sentRequestProposalLabels[input.proposalStatus];
  else if (input.pending) description = "Đang kiểm tra đề xuất đã gửi…";
  else if (input.hasError) description = "Chưa kiểm tra được đề xuất đã gửi.";
  else if (!input.open) description = "Yêu cầu hiện không nhận thêm đề xuất.";

  return { label, description };
}
