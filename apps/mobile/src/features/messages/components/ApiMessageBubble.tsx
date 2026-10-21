import { useState } from "react";
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
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, connectionError } from "@/features/connections";
import { useMessagesApi } from "../hooks/use-messages-api";
import type { ApiMessage } from "../api/messages-api";
import { MessageBubble } from "./MessageBubble";
import { ChatWorkflowCard } from "./ChatWorkflowCard";

export function ApiMessageBubble({
  message,
  partner,
  partnerId,
  avatarUrl,
  showReadReceipt = false,
  showAvatar = true,
}: Readonly<{
  message: ApiMessage;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  showReadReceipt?: boolean;
  showAvatar?: boolean;
}>) {
  const { userId, isCurrent } = useConnections(),
    api = useMessagesApi();
  const [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const share = readPlanShare(message.messageText);
  const form = readConfirmedForm(message.messageText);
  const legacy = readNegotiationMessage(message.messageText);
  const [expanded, setExpanded] = useState(false);
  const mine = message.senderId === userId;
  const download = async (attachmentId: string) => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await api.download(
        message.conversationId,
        message.id,
        attachmentId,
      );
      if (isCurrent() && Date.parse(result.expiresAt) > Date.now())
        await openURL(result.url);
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      if (isCurrent()) setPending(false);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      {message.messageType === "SYSTEM" ? (
        <FormNotice tone="info">
          {message.messageText || "Cập nhật từ hệ thống"}
        </FormNotice>
      ) : legacy ? (
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
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <FormNotice tone="info">{message.messageText}</FormNotice>
          )}
        </>
      ) : share || form ? (
        <ChatWorkflowCard
          mine={mine}
          partner={partner}
          partnerId={partnerId}
          avatarUrl={avatarUrl}
          showAvatar={showAvatar}
          label={form ? confirmedFormLabels[form.kind] : "Lộ trình học"}
          title={form?.title ?? share!.title}
          summary={form?.summary ?? message.messageText.split("\n")[1] ?? ""}
          version={form?.version ?? share!.version}
          action={
            form
              ? `Xem ${confirmedFormLabels[form.kind].toLowerCase()}`
              : "Đọc lộ trình được chia sẻ"
          }
          confirmed={!!form}
          onPress={() => {
            const pathId = form?.pathId ?? share!.pathId;
            const fromConversation = message.conversationId;
            if (form?.kind === "method")
              router.push({
                pathname: "/paths/[id]",
                params: {
                  id: pathId,
                  fromConversation,
                  formVersion: String(form.version),
                },
              });
            else if (form?.kind === "schedule")
              router.push({
                pathname: "/paths/[id]/schedules",
                params: {
                  id: pathId,
                  formPlanId: form.planId!,
                  formScheduleId: form.scheduleId!,
                  formVersion: String(form.version),
                },
              });
            else
              router.push({
                pathname: "/paths/[id]/plans/[planId]",
                params: {
                  id: pathId,
                  planId: form?.planId ?? share!.planId,
                  sharedVersion: String(form?.version ?? share!.version),
                  fromConversation,
                },
              });
          }}
        />
      ) : (
        <MessageBubble
          partner={partner}
          partnerId={partnerId}
          avatarUrl={avatarUrl}
          showAvatar={showAvatar}
          message={{
            id: message.id,
            from: message.senderId === userId ? "me" : "them",
            text: message.messageText,
            time: new Date(message.sentAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }}
        />
      )}
      {message.attachments.map((file) => (
        <Button
          key={file.attachmentId}
          variant="secondary"
          disabled={pending}
          onPress={() => {
            void download(file.attachmentId);
          }}
        >
          {`${file.filename} · ${(file.fileSizeBytes / 1000000).toFixed(1)} MB`}
        </Button>
      ))}
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
      {!!error && (
        <FormNotice tone="error">{connectionError(error)}</FormNotice>
      )}
    </View>
  );
}
