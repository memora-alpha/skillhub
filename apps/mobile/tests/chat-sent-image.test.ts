import assert from "node:assert/strict";
import { test } from "node:test";
import { sentImageKey } from "../src/features/messages/outbox/sent-chat-images";
import {
  attachmentFixture,
  delivered,
  file,
  until,
} from "./fixtures/attachment-outbox";
import { fixtureId } from "./fixtures/learning-requests-data";

test("published pending images retain their local bytes across reconciliation, release on server replacement or revocation and clear on owner exit", async () => {
  for (const end of ["thumbnail", "revoked", "owner"] as const) {
    const h = attachmentFixture();
    let disposed = 0;
    const photo = {
      ...file,
      name: "photo.jpg",
      mimeType: "image/jpeg",
      cleanup: () => disposed++,
    };
    assert.equal(delivered.deliveryStatus, "DELIVERED");
    const message = {
      ...delivered.message,
      attachments: delivered.message.attachments.map((item) => ({
        ...item,
        filename: photo.name,
        mimeType: photo.mimeType,
        availability: "PENDING_SCAN" as const,
      })),
    };
    h.api.send = async () => ({ deliveryStatus: "DELIVERED", message });
    h.status({
      canAttach: true,
      availability: "PENDING_SCAN",
      moderationStatus: "PENDING",
    });
    try {
      await h.store.start();
      assert.equal(h.store.enqueue(fixtureId(10), "caption", photo), true);
      await until(() => h.row().state === "sent");
      const key = sentImageKey(message, message.attachments[0]!);
      assert.equal(
        disposed,
        0,
        "a receipt does not dispose an image that still has no server thumbnail",
      );
      assert.equal(h.store.images.get(key), photo.uri);
      h.store.reconcile([message.id]);
      assert.equal(h.store.getSnapshot().items.length, 0);
      assert.equal(h.store.images.get(key), photo.uri);
      if (end === "thumbnail") h.store.images.remove(key);
      else if (end === "revoked")
        h.store.images.reconcile([
          {
            ...message,
            attachments: message.attachments.map((item) => ({
              ...item,
              availability: "REVOKED",
            })),
          },
        ]);
      else h.store.stop();
      assert.equal(h.store.images.get(key), undefined);
      assert.equal(disposed, 1);
      h.store.images.remove(key);
      assert.equal(disposed, 1);
    } finally {
      h.store.stop();
    }
    assert.equal(disposed, 1);
  }
});
