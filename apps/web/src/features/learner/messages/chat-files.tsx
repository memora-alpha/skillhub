"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback } from "../components/common";
import styles from "./chat.module.css";
import {
  chatExtensions,
  validateChatFiles,
  type ChatUpload,
} from "./chat-file-policy";
export type { ChatUpload } from "./chat-file-policy";
function fileSizeText(size: number) {
  if (size >= 1_000_000) return (size / 1_000_000).toFixed(2) + " MB";
  if (size > 0) return size.toLocaleString("vi-VN") + " byte";
  return "Chưa có dung lượng";
}
export function ChatFiles({
  conversationId,
  files,
  setFiles,
  locked,
  onUploading,
  compact = false,
  inputId,
}: Readonly<{
  conversationId: string;
  files: ChatUpload[];
  setFiles: Dispatch<SetStateAction<ChatUpload[]>>;
  locked: boolean;
  onUploading: (busy: boolean) => void;
  compact?: boolean;
  inputId?: string;
}>) {
  const { request } = useUserSession();
  const [uploading, setUploading] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const update = useCallback(
    (id: string, state: string) =>
      setFiles((old) =>
        old.map((file) =>
          file.id === id && file.state !== state ? { ...file, state } : file,
        ),
      ),
    [setFiles],
  );
  async function uploadChosen(chosen: readonly File[]) {
    for (const file of chosen) {
      const form = new FormData();
      form.set("file", file);
      const result = await request<{ fileId: string; state: string }>(
        "conversations/" + conversationId + "/attachments",
        { method: "POST", body: form },
      );
      if (!active.current) return;
      if (!/^[0-9a-f-]{36}$/i.test(result.data.fileId))
        throw new Error("Chưa đọc được mã tệp đã tải.");
      setFiles((old) => [
        ...old,
        {
          id: result.data.fileId,
          filename: file.name,
          size: file.size,
          state: result.data.state,
        },
      ]);
    }
  }
  return (
    <fieldset className={compact ? styles.compactFiles : "learner-picker"}>
      <legend className={compact ? "sr-only" : undefined}>Tệp đính kèm</legend>
      <p>
        Tối đa 5 tệp, 15 MB/tệp và 50 MB/tin. Tệp được kiểm tra định dạng và
        quét trên máy chủ trước khi gửi.
      </p>
      <label>
        <span>Chọn tệp</span>
        <input
          type="file"
          id={inputId}
          multiple
          accept={chatExtensions}
          disabled={locked || uploading || files.length >= 5}
          onChange={async (event) => {
            const chosen = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = "";
            if (locked || lock.current || !chosen.length) return;
            try {
              validateChatFiles(chosen, files);
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Tệp chưa hợp lệ.",
              );
              return;
            }
            lock.current = true;
            setUploading(true);
            onUploading(true);
            setError(undefined);
            try {
              await uploadChosen(chosen);
            } catch (cause) {
              if (active.current)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Chưa tải được tệp. Các tệp đã tải vẫn được giữ.",
                );
            } finally {
              lock.current = false;
              if (active.current) {
                setUploading(false);
                onUploading(false);
              }
            }
          }}
        />
      </label>
      {uploading && (
        <p>
          <output>Đang tải tệp lên…</output>
        </p>
      )}
      <Feedback error={error} />
      {files.map((file) => (
        <ChatFileRow
          key={file.id}
          file={file}
          conversationId={conversationId}
          onState={update}
          onRemove={() =>
            setFiles((old) => old.filter((item) => item.id !== file.id))
          }
          locked={locked || uploading}
        />
      ))}
    </fieldset>
  );
}
function ChatFileRow({
  file,
  conversationId,
  onState,
  onRemove,
  locked,
}: Readonly<{
  file: ChatUpload;
  conversationId: string;
  onState: (id: string, state: string) => void;
  onRemove: () => void;
  locked: boolean;
}>) {
  const query = useUserResource<{ fileId: string; state: string }>(
    "conversations/" + conversationId + "/attachments/" + file.id + "/status",
    {
      refetchInterval: (data) =>
        data && ["QUARANTINED", "SCANNING", "UPLOADED"].includes(data.state)
          ? 2500
          : false,
    },
  );
  const state = query.error ? "UNAVAILABLE" : (query.data?.state ?? "CHECKING");
  useEffect(() => {
    onState(file.id, state);
  }, [file.id, state, onState]);
  const labels: Record<string, string> = {
    CLEAN: "Đã kiểm tra sạch, sẵn sàng gửi",
    CHECKING: "Đang đọc trạng thái",
    QUARANTINED: "Đang chờ quét",
    SCANNING: "Đang quét",
    REJECTED: "Bị từ chối",
    DELETED: "Đã xóa",
    EXPIRED: "Đã hết hạn",
    UNAVAILABLE: "Chưa kiểm tra được hoặc đã mất quyền",
  };
  return (
    <div>
      <p>
        {file.filename} · {fileSizeText(file.size)} ·{" "}
        {labels[state] ?? "Chưa sẵn sàng"}
      </p>
      <Feedback error={query.error} reload={query.reload} />
      <button
        type="button"
        className="btn"
        disabled={locked}
        onClick={onRemove}
      >
        Bỏ tệp {file.filename}
      </button>
    </div>
  );
}
