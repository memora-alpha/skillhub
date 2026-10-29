import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { openURL } from "expo-linking";
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
import { useMessagesApi } from "../hooks/use-messages-api";
import type { ApiMessage } from "../api/messages-api";
import { MessageBubble } from "./MessageBubble";
import { ChatWorkflowCard } from "./ChatWorkflowCard";
import { ChatFileCard } from "./ChatFileCard";
import { ChatScheduleNotice } from "./ChatScheduleNotice";
import {
  readChatSchedule,
  type ChatScheduleNotice as ScheduleNotice,
} from "../utils/schedule-notice";

export function ApiMessageBubble({
  message,
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
  const { userId, isCurrent } = useConnections(),
    api = useMessagesApi();
  const [error, setError] = useState<unknown>(),
    [pending, setPending] = useState<string>();
  const downloading = useRef(false);
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const mine = message.senderId === userId;
  const download = async (attachmentId: string) => {
    if (downloading.current) return;
    downloading.current = true;
    setPending(attachmentId);
    setError(undefined);
    setExpired(false);
    try {
      const result = await api.download(
        message.conversationId,
        message.id,
        attachmentId,
      );
      if (!isCurrent()) return;
      if (Date.parse(result.expiresAt) <= Date.now()) {
        setExpired(true);
        return;
      }
      await openURL(result.url);
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      downloading.current = false;
      if (isCurrent()) setPending(undefined);
    }
  };
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
        expanded={expanded}
        onToggleExpanded={() => setExpanded((value) => !value)}
        router={router}
        attachmentContent={
          message.attachments.length
            ? message.attachments.map((file) => (
                <ChatFileCard
                  key={file.attachmentId}
                  filename={file.filename}
                  bytes={file.fileSizeBytes}
                  mine={mine}
                  disabled={!!pending}
                  pending={pending === file.attachmentId}
                  onPress={() => {
                    void download(file.attachmentId);
                  }}
                />
              ))
            : undefined
        }
      />
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
      {expired && (
        <FormNotice tone="info" compact>
          Liên kết tải đã hết hạn. Nhấn vào tệp để thử lại.
        </FormNotice>
      )}
      {!!error && (
        <FormNotice tone="error">{connectionError(error)}</FormNotice>
      )}
    </View>
  );
}

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
}>) {
  const share = attachmentContent ? null : readPlanShare(message.messageText);
  const form = attachmentContent
    ? null
    : readConfirmedForm(message.messageText);
  const legacy = attachmentContent
    ? null
    : readNegotiationMessage(message.messageText);
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
            params: { id: schedule.pathId },
          })
        }
      />
    );
  if (message.messageType === "SYSTEM")
    return (
      <FormNotice tone="info">
        {message.messageText || "Cập nhật từ hệ thống"}
      </FormNotice>
    );
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
