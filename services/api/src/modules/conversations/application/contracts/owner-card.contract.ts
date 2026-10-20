// Future Path/Schedule owners must register an explicit adapter, validate source
// identity/version and authorize object hydration. Client send DTOs cannot carry cards.
// No Path/Schedule publisher is registered by the Connections feature.
export type OwnerChatCard = Readonly<{
  sourceEventId: string;
  conversationId: string;
  objectType: "LEARNING_PATH" | "SCHEDULE_PROPOSAL";
  objectId: string;
  objectVersion: number;
}>;
export interface OwnerChatCardReader {
  assertCurrentReference(card: OwnerChatCard): Promise<void>;
}
