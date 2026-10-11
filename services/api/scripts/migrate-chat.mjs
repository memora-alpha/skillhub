import "dotenv/config";
import mongoose from "mongoose";
// Explicit migration command: production runtime never relies on Mongoose autoIndex.
await mongoose.connect(process.env.MONGODB_URI, {
  autoIndex: false,
  serverSelectionTimeoutMS: 5000,
});
try {
  const db = mongoose.connection.db;
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName) throw new Error("Chat requires a MongoDB replica set");
  await db.collection("chat_messages").createIndexes([
    {
      key: { conversationId: 1, senderId: 1, clientMessageId: 1 },
      unique: true,
      name: "sender_identity",
    },
    {
      key: { conversationId: 1, sequence: 1 },
      unique: true,
      partialFilterExpression: { status: "PUBLISHED" },
      name: "published_sequence",
    },
    {
      key: { conversationId: 1, status: 1, sequence: -1 },
      name: "published_history",
    },
  ]);
  await db
    .collection("chat_read_states")
    .createIndex(
      { conversationId: 1, userId: 1 },
      { unique: true, name: "participant_read_state" },
    );
  await db
    .collection("chat_event_intents")
    .createIndex({ bridgedAt: 1, createdAt: 1 }, { name: "pending_bridge" });
  await db.createCollection("chat_counters").catch((error) => {
    if (error.code !== 48) throw error;
  });
  console.log("Chat collections and indexes ready (replica set verified).");
} finally {
  await mongoose.disconnect();
}
