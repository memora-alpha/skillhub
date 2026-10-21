type Message = { senderId: string; sentAt: string; messageType?: string };
const groupGap = 15 * 60 * 1000;
function separated(older: Message, newer: Message) {
  const first = new Date(older.sentAt),
    second = new Date(newer.sentAt);
  return (
    first.toDateString() !== second.toDateString() ||
    second.getTime() - first.getTime() >= groupGap
  );
}
// Neighbours are chronological, even when the rendered FlatList is inverted.
export function messageGrouping(
  message: Message,
  older?: Message,
  newer?: Message,
) {
  const day =
    !older ||
    new Date(older.sentAt).toDateString() !==
      new Date(message.sentAt).toDateString();
  const timestamp = day ? "day" : separated(older, message) ? "time" : null;
  return {
    timestamp,
    startsGroup:
      !older ||
      older.senderId !== message.senderId ||
      !!timestamp ||
      older.messageType === "SYSTEM" ||
      message.messageType === "SYSTEM",
    showAvatar:
      !newer ||
      newer.senderId !== message.senderId ||
      separated(message, newer) ||
      newer.messageType === "SYSTEM" ||
      message.messageType === "SYSTEM",
  };
}
