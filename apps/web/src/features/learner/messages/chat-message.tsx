import Link from "next/link";
import { safeChatText } from "@/lib/contact-policy";
import type { Message } from "../types";
import { ProfileAvatar } from "../components/profile-avatar";
import { ProductIcon } from "../components/product-icon";
import { formatTime } from "../components/common";
import { formatVietnamTime } from "@/lib/vietnam-time";
import { ChatDownload } from "./chat-download";
import styles from "./chat.module.css";

export function ChatMessage({
  message,
  conversationId,
  mine,
  partner,
  showAvatar = true,
  showTime = true,
}: Readonly<{
  message: Message;
  conversationId: string;
  mine: boolean;
  partner: { fullName: string; avatarUrl: string | null };
  showAvatar?: boolean;
  showTime?: boolean;
}>) {
  if (message.messageType === "SYSTEM")
    return (
      <article className={styles.system}>
        {message.messageText || "Cập nhật từ hệ thống"}
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
          {message.messageText.trim() && (
            <p>{safeChatText(message.messageText)}</p>
          )}
          {message.attachments.map((file) => (
            <div className={styles.fileCard} key={file.attachmentId}>
              <ProductIcon name="file" size={19} />
              <ChatDownload
                conversationId={conversationId}
                messageId={message.id}
                attachmentId={file.attachmentId}
                filename={file.filename}
              />
            </div>
          ))}
          {message.objectType === "LEARNING_PATH" && message.objectId && (
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
          )}
        </article>
      </div>
      {showTime && (
        <time dateTime={message.sentAt} className={styles.messageTime}>
          {formatVietnamTime(message.sentAt)}
        </time>
      )}
    </div>
  );
}
