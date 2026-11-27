import Link from "next/link";
import type { Message } from "../types";
import { ProfileAvatar } from "../components/profile-avatar";
import { ProductIcon } from "../components/product-icon";
import { formatTime } from "../components/common";
import { formatVietnamTime } from "@/lib/vietnam-time";
import { ChatDownload, ChatImagePreview } from "./chat-download";
import styles from "./chat.module.css";

function attachmentStatusMessage(
  file: Message["attachments"][number],
): string | null {
  const status = file.accessStatus ?? file.availability;
  if (!status || status === "AVAILABLE") return null;
  if (status === "PENDING_SCAN")
    return "Đang kiểm tra an toàn tệp. Tệp sẽ mở tải sau khi hoàn tất.";
  if (status === "REVOKED")
    return file.restrictionReason === "REVOKED"
      ? "Tệp đã bị kiểm duyệt viên thu hồi quyền tải."
      : "Tệp đã bị chặn do vi phạm tiêu chuẩn cộng đồng.";
  return "Tệp hiện không khả dụng.";
}

export function ChatMessage({
  message,
  conversationId,
  mine,
  partner,
  showAvatar = true,
  showTime = true,
  onOpenAgreement,
}: Readonly<{
  message: Message;
  conversationId: string;
  mine: boolean;
  partner: { fullName: string; avatarUrl: string | null };
  showAvatar?: boolean;
  showTime?: boolean;
  onOpenAgreement?: () => void;
}>) {
  const workflowCard =
    message.objectType === "LEARNING_PATH" && message.objectId ? (
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
    ) : message.objectType === "SCHEDULE_PROPOSAL" && message.objectId ? (
      onOpenAgreement ? (
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
      ) : (
        <Link className={styles.workflow} href="/learn/paths">
          <ProductIcon name="calendar" size={22} />
          <span>
            <small>ĐỀ XUẤT LỊCH HỌC</small>
            <strong>Xem lộ trình & lịch học</strong>
          </span>
          <ProductIcon name="arrow" size={16} />
        </Link>
      )
    ) : null;
  if (message.messageType === "SYSTEM")
    return (
      <article className={styles.system}>
        <p>{message.messageText || "Cập nhật từ hệ thống"}</p>
        {workflowCard}
      </article>
    );
  return (
    <div className={styles.message + (mine ? " " + styles.mine : "")}>
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
        <article className={styles.bubble} title={formatTime(message.sentAt)}>
          {message.messageText.trim() && <p>{message.messageText}</p>}
          {message.attachments.map((file) => {
            const blockedText = attachmentStatusMessage(file);
            const isImage =
              file.attachmentType === "IMAGE" ||
              Boolean(file.mimeType?.startsWith("image/"));
            return (
              <div className={styles.fileCard} key={file.attachmentId}>
                <ProductIcon name="file" size={19} />
                <div className={styles.fileBody}>
                  {blockedText ? (
                    <div className={styles.fileStatusNote}>
                      <strong>{file.filename}</strong>
                      <span>{blockedText}</span>
                    </div>
                  ) : (
                    <>
                      {isImage && (
                        <ChatImagePreview
                          conversationId={conversationId}
                          messageId={message.id}
                          attachmentId={file.attachmentId}
                          filename={file.filename}
                          width={file.width}
                          height={file.height}
                        />
                      )}
                      <ChatDownload
                        conversationId={conversationId}
                        messageId={message.id}
                        attachmentId={file.attachmentId}
                        filename={file.filename}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {workflowCard}
        </article>
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
