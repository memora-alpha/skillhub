import { useEffect, useRef } from "react";
import { ProfileButton as Button } from "./ProfileButton";
import { useAuthSession } from "@/features/auth";
import { useToast } from "@/providers/ToastProvider";

export function AvatarUploadNotice() {
  const { avatar } = useAuthSession();
  if (
    !avatar.upload ||
    (!avatar.error &&
      !(avatar.upload.status === "QUARANTINED" && avatar.waitingTooLong))
  )
    return null;
  return (
    <Button
      variant="ghost"
      disabled={avatar.checking}
      onPress={() => {
        void avatar.retry();
      }}
    >
      Kiểm tra lại ảnh
    </Button>
  );
}

export function AvatarUploadToasts() {
  const { avatar, runtime } = useAuthSession();
  const { showToast, dismissToast } = useToast();
  const last = useRef({ generation: runtime.controller.generation, key: "" });
  const status = avatar.upload?.status;
  const message = avatar.error
    ? status === "CLEAN" || status === "DELETED"
      ? "Chưa cập nhật được ảnh. Hãy kiểm tra lại."
      : "Chưa kiểm tra được ảnh. Hãy thử lại."
    : status === "REJECTED"
      ? "Ảnh không vượt qua kiểm tra. Hãy chọn ảnh khác."
      : status === "QUARANTINED" && avatar.waitingTooLong
        ? "Kiểm tra ảnh lâu hơn dự kiến."
        : null;
  const generation = runtime.controller.generation;
  useEffect(() => {
    if (last.current.generation !== generation) {
      if (last.current.key) dismissToast();
      last.current = { generation, key: "" };
    }
    const key = message ? `${avatar.upload?.assetId}:${message}` : "";
    if (key && key !== last.current.key && !avatar.checking)
      showToast(
        message!,
        avatar.error || status === "REJECTED" ? "error" : "info",
      );
    if (!avatar.checking) last.current.key = key;
  }, [
    avatar.upload?.assetId,
    avatar.error,
    avatar.checking,
    generation,
    message,
    status,
    showToast,
    dismissToast,
  ]);
  return null;
}
