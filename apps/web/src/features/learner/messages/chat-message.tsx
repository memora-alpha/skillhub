import Link from "next/link";
import type { Message, MessageAttachment } from "../types";
import { ProfileAvatar } from "../components/profile-avatar";
import { ProductIcon } from "../components/product-icon";
import { formatTime } from "../components/common";
import { formatVietnamTime } from "@/lib/vietnam-time";
import {
  attachmentStatusMessage,
  isBlockedAttachment,
  partitionMessageAttachments,
  visibleAttachmentFilename,
} from "./chat-attachment-display";
import { ChatFileAttachment, ChatImageAttachment } from "./chat-download";
import styles from "./chat.module.css";

export function ChatMessage({
  message,
  conversationId,
  mine,
  partner,
  showAvatar = true,
  showTime = true,
  groupPos = "single",
  onOpenAgreement,
  onMediaLoad,
}: Readonly<{
  message: Message;
  conversationId: string;
  mine: boolean;
  partner: { fullName: string; avatarUrl: string | null };
  showAvatar?: boolean;
  showTime?: boolean;
  groupPos?: "single" | "first" | "middle" | "last";
  onOpenAgreement?: () => void;
  onMediaLoad?: () => void;
}>) {
  const workflowCard = workflowCardFor(message, onOpenAgreement);
  if (message.messageType === "SYSTEM")
    return (
      <article className={styles.system}>
        <p>{message.messageText || "Cập nhật từ hệ thống"}</p>
        {workflowCard}
      </article>
    );

  const hasText = message.messageText.trim().length > 0;
  const hasAttachments = message.attachments.length > 0;
  const { images, files, restricted } = partitionMessageAttachments(
    message.attachments,
  );
  const groupedImages = images.length > 1;

  return (
    <div
      className={styles.message + (mine ? " " + styles.mine : "")}
      data-pos={groupPos}
      data-attachments={hasAttachments || undefined}
    >
      <div className={styles.messageRow}>
        {!mine &&
          (showAvatar ? (
            <ProfileAvatar
              fullName={partner.fullName}
              avatarUrl={partner.avatarUrl}
              className={styles.avatar}
            />
          ) : (
            <span className={styles.avatarSpace} />
          ))}
        <div className={styles.messageStack} title={formatTime(message.sentAt)}>
          {(hasText || workflowCard) && (
            <article className={styles.bubble}>
              {hasText && <p>{message.messageText}</p>}
              {workflowCard}
            </article>
          )}
          {images.length > 0 && (
            <div className={styles.imageGrid} data-count={images.length}>
              {images.map((file) => (
                <ChatImageAttachment
                  key={file.attachmentId}
                  conversationId={conversationId}
                  messageId={message.id}
                  file={file}
                  mine={mine}
                  grouped={groupedImages}
                  onMediaLoad={onMediaLoad}
                />
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div
              className={styles.fileList}
              data-multi={files.length > 1 || undefined}
            >
              {files.map((file) => (
                <ChatFileAttachment
                  key={file.attachmentId}
                  conversationId={conversationId}
                  messageId={message.id}
                  file={file}
                  mine={mine}
                />
              ))}
            </div>
          )}
          {restricted.length > 0 && (
            <div
              className={styles.fileList}
              data-multi={restricted.length > 1 || undefined}
            >
              {restricted.map((file) => (
                <RestrictedAttachmentCard
                  key={file.attachmentId}
                  file={file}
                  mine={mine}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {mine && message.readAt && (
        <small className={styles.messageTime}>
          Đã xem · {formatVietnamTime(message.readAt)}
        </small>
      )}
      {showTime && (
        <time dateTime={message.sentAt} className={styles.messageTime}>
          {formatVietnamTime(message.sentAt)}
        </time>
      )}
    </div>
  );
}

function RestrictedAttachmentCard({
  file,
  mine,
}: Readonly<{
  file: MessageAttachment;
  mine: boolean;
}>) {
  const blocked = isBlockedAttachment(file);
  const status = file.accessStatus ?? file.availability;
  const note = attachmentStatusMessage(file);
  let iconName: "lock" | "clock" | "alert" = "alert";
  if (blocked) iconName = "lock";
  else if (status === "PENDING_SCAN") iconName = "clock";

  return (
    <div
      className={styles.statusCard}
      data-blocked={blocked || undefined}
      data-pending={status === "PENDING_SCAN" || undefined}
    >
      <span className={styles.statusIcon} aria-hidden="true">
        <ProductIcon name={iconName} size={17} />
      </span>
      <div className={styles.fileStatusNote}>
        <strong>{visibleAttachmentFilename(file, mine)}</strong>
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}

function workflowCardFor(
  message: Message,
  onOpenAgreement: (() => void) | undefined,
) {
  if (message.objectType === "LEARNING_PATH" && message.objectId) {
    return (
      <Link
        className={styles.workflow}
        href={"/learn/paths/" + message.objectId}
      >
        <ProductIcon name="book" size={22} />
        <span>
          <small>THỎA THUẬN HỌC TẬP</small>
          <strong>Xem lộ trình được chia sẻ</strong>
        </span>
        <ProductIcon name="arrow" size={16} />
      </Link>
    );
  }
  if (message.objectType === "SCHEDULE_PROPOSAL" && message.objectId) {
    if (onOpenAgreement) {
      return (
        <button
          type="button"
          className={styles.workflow}
          onClick={onOpenAgreement}
        >
          <ProductIcon name="calendar" size={22} />
          <span>
            <small>ĐỀ XUẤT LỊCH HỌC</small>
            <strong>Mở thỏa thuận & lịch học</strong>
          </span>
          <ProductIcon name="arrow" size={16} />
        </button>
      );
    }
    return (
      <Link className={styles.workflow} href="/learn/paths">
        <ProductIcon name="calendar" size={22} />
        <span>
          <small>ĐỀ XUẤT LỊCH HỌC</small>
          <strong>Xem lộ trình & lịch học</strong>
        </span>
        <ProductIcon name="arrow" size={16} />
      </Link>
    );
  }
  return null;
}
