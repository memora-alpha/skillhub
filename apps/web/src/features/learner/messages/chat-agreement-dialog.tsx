"use client";
import { useEffect, useId, useRef } from "react";
import type { Conversation, Proposal } from "../types";
import { AgreementCreator } from "../paths/agreement-creator";
import { ProductIcon } from "../components/product-icon";
import styles from "./chat.module.css";

export function ChatAgreementDialog({
  conversation,
  proposal,
  onClose,
}: Readonly<{
  conversation: Conversation;
  proposal?: Proposal;
  onClose: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={heading}
      onCancel={onClose}
    >
      <div className={styles.dialogHeading}>
        <h2 id={heading}>Thỏa thuận của hai bạn</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Đóng thỏa thuận"
          onClick={onClose}
        >
          <ProductIcon name="close" />
        </button>
      </div>
      <p className={styles.dialogNote}>
        Cùng thống nhất hình thức, Credit và lộ trình. Tin nhắn không thay thế
        xác nhận trên thỏa thuận.
      </p>
      {proposal ? (
        <AgreementCreator conversation={conversation} proposal={proposal} />
      ) : (
        <p>Đang tải thông tin đề nghị. Bạn có thể đóng và thử lại sau.</p>
      )}
    </dialog>
  );
}
