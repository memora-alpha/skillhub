import { z } from "zod";
import { uuid, version, timestamp, sequence } from "@/lib/http/contracts";
import {
  chatAttachmentMetadata,
  attachmentAvailabilitySchema,
} from "./chat-attachment-contracts";
export { attachmentAvailabilitySchema } from "./chat-attachment-contracts";

export const conversationSchema = z.object({
  id: uuid,
  proposalId: uuid,
  learningRequestId: uuid.nullable(),
  participantAId: uuid,
  participantBId: uuid,
  createdAt: timestamp,
  lastActivityAt: timestamp.optional(),
});
const inboxCount = z.number().int().nonnegative();
export const inboxGroupSchema = z
  .discriminatedUnion("groupType", [
    z.object({
      groupType: z.literal("LEARNING_REQUEST"),
      id: z.string(),
      learningRequestId: uuid,
      conversationId: z.null(),
      title: z.string().nullable(),
      viewerRole: z.enum(["OWNER", "PROPOSER", "PARTICIPANT"]),
      receivedProposalCount: inboxCount.nullable(),
      sentProposalCount: inboxCount,
      conversationCount: inboxCount,
      lastActivityAt: timestamp,
    }),
    z.object({
      groupType: z.literal("DIRECT_CONVERSATION"),
      id: z.string(),
      learningRequestId: z.null(),
      conversationId: uuid,
      title: z.string().nullable(),
      viewerRole: z.literal("PARTICIPANT"),
      receivedProposalCount: z.null(),
      sentProposalCount: z.null(),
      conversationCount: z.literal(1),
      lastActivityAt: timestamp,
    }),
  ])
  .refine((group) =>
    group.groupType === "LEARNING_REQUEST"
      ? group.id === `request:${group.learningRequestId}` &&
        (group.viewerRole === "OWNER") ===
          (group.receivedProposalCount !== null)
      : group.id === `conversation:${group.conversationId}`,
  );
export type ApiInboxGroup = z.infer<typeof inboxGroupSchema>;
export type AttachmentAvailability = z.infer<
  typeof attachmentAvailabilitySchema
>;
export const attachmentSchema = z
  .object({
    ...chatAttachmentMetadata,
    attachmentId: uuid,
    fileId: uuid,
    filename: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number().int().nonnegative(),
    downloadUrlEndpoint: z.string(),
    contentUrlEndpoint: z.string().optional(),
    previewUrlEndpoint: z.string().optional(),
    thumbnailUrlEndpoint: z.string().optional(),
  })
  .transform((file) =>
    file.accessStatus ? { ...file, availability: file.accessStatus } : file,
  );
export const messageSchema = z.object({
  id: uuid,
  conversationId: uuid,
  senderId: uuid,
  messageText: z.string(),
  messageType: z.enum(["TEXT", "FILE", "SYSTEM"]),
  attachments: z.array(attachmentSchema),
  sequence,
  sentAt: timestamp,
  readAt: timestamp.nullable(),
  objectType: z.string().optional(),
  objectId: uuid.optional(),
  objectVersion: version.optional(),
});
export const deliverySchema = z.discriminatedUnion("deliveryStatus", [
  z.object({ deliveryStatus: z.literal("DELIVERED"), message: messageSchema }),
  z.object({
    deliveryStatus: z.enum(["PREPARING", "PENDING"]),
    messageId: uuid,
    clientMessageId: uuid,
    statusUrl: z.string(),
    failureCode: z.string().nullable(),
  }),
]);
export type ApiConversation = z.infer<typeof conversationSchema>;
export type ApiMessage = z.infer<typeof messageSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type MessageBubbleModel = {
  id: string;
  from: "them" | "me";
  text: string;
  time: string;
};
export type MessageDraft = {
  clientMessageId: string;
  messageText?: string;
  attachmentFileIds?: string[];
};
