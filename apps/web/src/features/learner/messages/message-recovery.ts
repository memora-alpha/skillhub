import type { Message } from "../types";

export async function readForwardMessages(
  read: (path: string, signal: AbortSignal) => Promise<{ data: Message[] }>,
  conversationId: string,
  afterSequence: string,
  signal: AbortSignal,
): Promise<Message[]> {
  let after = BigInt(afterSequence);
  const result = new Map<string, Message>();
  while (true) {
    signal.throwIfAborted();
    const page = await read(
      `conversations/${conversationId}/messages?limit=100&afterSequence=${after}`,
      signal,
    );
    signal.throwIfAborted();
    if (!Array.isArray(page.data) || page.data.length > 100)
      throw new Error(
        "Lịch sử tin nhắn chưa hợp lệ. Hãy tải lại cuộc trò chuyện.",
      );
    let last = after;
    for (const message of page.data) {
      if (
        !message ||
        typeof message.id !== "string" ||
        !/^(?:0|[1-9]\d{0,18})$/.test(message.sequence) ||
        BigInt(message.sequence) <= last
      )
        throw new Error(
          "Chưa khôi phục được thứ tự tin nhắn. Hãy tải lại cuộc trò chuyện.",
        );
      last = BigInt(message.sequence);
      result.set(message.id, message);
    }
    if (page.data.length < 100) return [...result.values()];
    after = last;
  }
}
