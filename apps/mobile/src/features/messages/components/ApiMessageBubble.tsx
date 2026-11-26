import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { avatarSizes, colors, fonts, typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import {
  readPlanShare,
  readConfirmedForm,
  confirmedFormLabels,
  readNegotiationMessage,
} from "@/features/learning-paths/policy";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, connectionError } from "@/features/connections";
import { useChatAttachmentDownload } from "../hooks/use-chat-attachment-download";
import {
  attachmentDownloadProblem,
  attachmentAvailabilityLabel,
  canDownloadAttachment,
  revokedAttachmentCopy,
} from "../utils/attachment-availability";
import { visibleChatMessage } from "../utils/chat-visibility";
import { AppError } from "@/lib/http/errors";
import type { ApiMessage } from "../api/messages-api";
import { MessageBubble } from "./MessageBubble";
import { ChatWorkflowCard } from "./ChatWorkflowCard";
import { ChatMessageAttachment } from "./ChatMessageAttachment";
import { attachmentCopy, isChatImage } from "../utils/chat-attachment-kind";
import { ChatScheduleNotice } from "./ChatScheduleNotice";
import {
  readChatSchedule,
  type ChatScheduleNotice as ScheduleNotice,
} from "../utils/schedule-notice";
import { ChatSystemNotice } from "./ChatSystemNotice";

export function ApiMessageBubble({
  message: originalMessage,
  partner,
  partnerId,
  avatarUrl,
  showTime = false,
  showReadReceipt = false,
  showAvatar = true,
  scheduleNotice,
}: Readonly<{
  message: ApiMessage;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showTime?: boolean;
  showReadReceipt?: boolean;
  showAvatar?: boolean;
  scheduleNotice?: ScheduleNotice;
}>) {
  const { userId } = useConnections();
  const { error, pending, feedbackFor, download } =
    useChatAttachmentDownload(originalMessage);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const mine = originalMessage.senderId === userId;
  const message = visibleChatMessage(originalMessage, userId);
  const recipientRevoked =
    !mine &&
    originalMessage.attachments.some(
      (file) => file.availability === "REVOKED" && !isChatImage(file.mimeType),
    );
  const feedbackVisible =
    !feedbackFor ||
    message.attachments.some(
      (file) =>
        file.attachmentId === feedbackFor &&
        canDownloadAttachment(file.availability),
    );
  const recipientBlockedDownload =
    !mine &&
    error instanceof AppError &&
    error.code === "CONTENT_MODERATION_BLOCKED";
  const revokedNotice = revokedAttachmentCopy(originalMessage.attachments);
  const feedbackMime = message.attachments.find(
    (file) => file.attachmentId === feedbackFor,
  )?.mimeType;
  const downloadError =
    error && feedbackVisible && !recipientBlockedDownload
      ? (attachmentDownloadProblem(error, feedbackMime) ??
        attachmentCopy(
          connectionError(error) ?? "Không mở được tệp.",
          feedbackMime,
        ))
      : undefined;
  return (
    <View style={{ gap: 6 }}>
      <ApiMessageContent
        message={message}
        scheduleNotice={scheduleNotice}
        partner={partner}
        partnerId={partnerId}
        avatarUrl={avatarUrl}
        showTime={showTime}
        showAvatar={showAvatar}
        mine={mine}
        revokedAttachmentNotice={
          recipientRevoked ? "Tệp không còn khả dụng." : undefined
        }
        expanded={expanded}
        onToggleExpanded={() => setExpanded((value) => !value)}
        router={router}
        attachmentContent={
          message.attachments.length
            ? message.attachments.map((file) => (
                <ChatMessageAttachment
                  key={file.attachmentId}
                  message={message}
                  file={file}
                  mine={mine}
                  disabled={!!pending}
                  pending={pending === file.attachmentId}
                  downloadError={
                    feedbackFor === file.attachmentId
                      ? downloadError
                      : undefined
                  }
                  onDownload={() => void download(file.attachmentId)}
                />
              ))
            : undefined
        }
      />
      {message.attachments.some(
        (file) =>
          file.availability === "PENDING_SCAN" &&
          file.moderationStatus !== "REVIEW_REQUIRED" &&
          !isChatImage(file.mimeType),
      ) && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.scanNotice, mine ? styles.mine : styles.theirs]}
        >
          <Text style={styles.scanning}>
            {attachmentAvailabilityLabel("PENDING_SCAN")}
          </Text>
        </View>
      )}
      {mine &&
        message.attachments.some((file) => file.availability === "REVOKED") && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={revokedNotice}
            style={[
              styles.revokedNotice,
              mine ? styles.myFailureNotice : styles.theirs,
            ]}
          >
            <Text style={styles.reason}>{revokedNotice}</Text>
          </View>
        )}
      {showReadReceipt && mine && message.readAt && (
        <View
          accessible
          accessibilityLabel="Đối tác đã xem"
          style={{ alignItems: "flex-end" }}
        >
          <Avatar
            name={partner}
            userId={partnerId}
            sourceUri={avatarUrl}
            size={16}
          />
        </View>
      )}
      {!!downloadError && (
        <FormNotice tone="error" compact>
          {downloadError}
        </FormNotice>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scanNotice: { maxWidth: "90%" },
  scanning: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  revokedNotice: {
    maxWidth: "90%",
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mine: { alignSelf: "flex-end" },
  myFailureNotice: { alignSelf: "flex-end", marginRight: 22 },
  theirs: { alignSelf: "flex-start", marginLeft: avatarSizes.inline + 8 },
  reason: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
});
function ApiMessageContent({
  message,
  scheduleNotice,
  partner,
  partnerId,
  avatarUrl,
  showTime,
  showAvatar,
  mine,
  expanded,
  onToggleExpanded,
  router,
  attachmentContent,
  revokedAttachmentNotice,
}: Readonly<{
  message: ApiMessage;
  scheduleNotice?: ScheduleNotice;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showTime: boolean;
  showAvatar: boolean;
  mine: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  router: ReturnType<typeof useRouter>;
  attachmentContent?: ReactNode;
  revokedAttachmentNotice?: string;
}>) {
  const hasFile = message.messageType === "FILE" || !!attachmentContent;
  const share = hasFile ? null : readPlanShare(message.messageText);
  const form = hasFile ? null : readConfirmedForm(message.messageText);
  const legacy = hasFile ? null : readNegotiationMessage(message.messageText);
  const schedule = scheduleNotice ?? readChatSchedule(message);
  if (schedule)
    return (
      <ChatScheduleNotice
        notice={schedule}
        mine={mine}
        partner={partner}
        partnerId={partnerId}
        avatarUrl={avatarUrl}
        showAvatar={showAvatar}
        onPress={() =>
          router.push({
            pathname: "/paths/[id]/schedules",
            params: {
              id: schedule.pathId,
              ...(schedule.confirmation
                ? {
                    formPlanId: schedule.confirmation.planId,
                    formScheduleId: schedule.confirmation.scheduleId,
                    formVersion: String(schedule.confirmation.version),
                  }
                : {}),
            },
          })
        }
      />
    );
  if (message.messageType === "SYSTEM")
    return <ChatSystemNotice message={message} />;
  if (legacy)
    return (
      <>
        <ChatWorkflowCard
          mine={mine}
          partner={partner}
          partnerId={partnerId}
          avatarUrl={avatarUrl}
          showAvatar={showAvatar}
          label="Gợi ý lộ trình"
          title={legacy.goal}
          summary={legacy.skill}
          confirmed={false}
          badgeLabel="Chưa xác nhận"
          action="Xem nội dung gợi ý"
          actionText={expanded ? "Thu gọn" : "Xem gợi ý"}
          onPress={onToggleExpanded}
        />
        {expanded && <FormNotice tone="info">{message.messageText}</FormNotice>}
      </>
    );
  if (share || form)
    return (
      <SharedWorkflowMessage
        message={message}
        share={share}
        form={form}
        partner={partner}
        partnerId={partnerId}
        avatarUrl={avatarUrl}
        showAvatar={showAvatar}
        mine={mine}
        router={router}
      />
    );
  return (
    <MessageBubble
      partner={partner}
      partnerId={partnerId}
      avatarUrl={avatarUrl}
      showTime={showTime}
      showAvatar={showAvatar}
      attachmentNotice={revokedAttachmentNotice}
      failed={message.attachments.some(
        (file) =>
          (mine || !isChatImage(file.mimeType)) &&
          (file.availability === "REVOKED" ||
            file.availability === "UNAVAILABLE"),
      )}
      message={{
        id: message.id,
        from: mine ? "me" : "them",
        text: message.messageText,
        time: new Date(message.sentAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }}
    >
      {attachmentContent}
    </MessageBubble>
  );
}

function SharedWorkflowMessage({
  message,
  share,
  form,
  router,
  ...cardProps
}: Readonly<{
  message: ApiMessage;
  share: ReturnType<typeof readPlanShare>;
  form: ReturnType<typeof readConfirmedForm>;
  router: ReturnType<typeof useRouter>;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showAvatar: boolean;
  mine: boolean;
}>) {
  const label = form ? confirmedFormLabels[form.kind] : "Lộ trình học";
  const title = form?.title ?? share?.title ?? "Lộ trình học";
  const summary = form?.summary ?? message.messageText.split("\n")[1] ?? "";
  const version = form?.version ?? share?.version;
  return (
    <ChatWorkflowCard
      {...cardProps}
      label={label}
      title={title}
      summary={summary}
      version={version}
      action={
        form
          ? `Xem ${confirmedFormLabels[form.kind].toLowerCase()}`
          : "Đọc lộ trình được chia sẻ"
      }
      confirmed={!!form}
      onPress={() => openSharedWorkflow(router, message, form, share)}
    />
  );
}

function openSharedWorkflow(
  router: ReturnType<typeof useRouter>,
  message: ApiMessage,
  form: ReturnType<typeof readConfirmedForm>,
  share: ReturnType<typeof readPlanShare>,
) {
  const fromConversation = message.conversationId;
  const pathId = form?.pathId ?? share?.pathId;
  if (!pathId) return;
  if (form?.kind === "method") {
    router.push({
      pathname: "/paths/[id]",
      params: {
        id: pathId,
        fromConversation,
        formVersion: String(form.version),
      },
    });
    return;
  }
  const planId = form?.planId ?? share?.planId;
  const sharedVersion = form?.version ?? share?.version;
  if (!planId || !sharedVersion) return;
  router.push({
    pathname: "/paths/[id]/plans/[planId]",
    params: {
      id: pathId,
      planId,
      sharedVersion: String(sharedVersion),
      fromConversation,
    },
  });
}
