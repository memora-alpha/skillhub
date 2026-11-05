import type { ChatUpload } from "./chat-file-policy";
export type ChatDraft = {
  clientMessageId: string;
  messageText: string;
  attachmentFileIds: string[];
  files?: ChatUpload[];
};
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function parseChatDraft(serialized: string | null): ChatDraft | null {
  try {
    const value = JSON.parse(serialized ?? "null");
    if (
      !value ||
      !uuid(value.clientMessageId) ||
      typeof value.messageText !== "string" ||
      value.messageText.length > 2000 ||
      !Array.isArray(value.attachmentFileIds) ||
      value.attachmentFileIds.length > 5 ||
      !value.attachmentFileIds.every(uuid) ||
      new Set(value.attachmentFileIds).size !== value.attachmentFileIds.length
    )
      return null;
    const files = value.attachmentFileIds.map((id: string) => {
      const file = Array.isArray(value.files)
        ? value.files.find(
            (item: unknown) =>
              !!item &&
              typeof item === "object" &&
              "id" in item &&
              item.id === id,
          )
        : undefined;
      return {
        id,
        filename:
          typeof file?.filename === "string"
            ? file.filename.slice(0, 255)
            : "Tệp trong bản gửi đang chờ",
        size: Number.isFinite(file?.size) && file.size >= 0 ? file.size : 0,
        state: "CHECKING",
      };
    });
    // Preserve all immutable message fields exactly; only local display metadata is rebuilt.
    return {
      clientMessageId: value.clientMessageId,
      messageText: value.messageText,
      attachmentFileIds: value.attachmentFileIds,
      files,
    };
  } catch {
    return null;
  }
}
export function parseEditingDraft(
  serialized: string | null,
): { messageText: string; files: ChatUpload[] } | null {
  try {
    const value = JSON.parse(serialized ?? "null");
    if (
      !value ||
      typeof value.messageText !== "string" ||
      value.messageText.length > 2000 ||
      !Array.isArray(value.files) ||
      value.files.length > 5
    )
      return null;
    const parsed = parseChatDraft(
      JSON.stringify({
        ...value,
        clientMessageId: "00000000-0000-4000-8000-000000000000",
        attachmentFileIds: value.files.map((file: ChatUpload) => file.id),
      }),
    );
    return parsed
      ? { messageText: parsed.messageText, files: parsed.files ?? [] }
      : null;
  } catch {
    return null;
  }
}
