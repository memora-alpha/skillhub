import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { purchaseIntent, proId } from "./fixtures/subscriptions";

test("native recovery isolates owners/environments, serializes writes and only deletes the matching key", async () => {
  const local = createRequire(
    new URL(
      "../src/features/subscriptions/storage/subscription-store.native.ts",
      import.meta.url,
    ),
  );
  const values = new Map<string, string>();
  const options: unknown[] = [];
  const mocks = [
    mock.module(pathToFileURL(local.resolve("expo-secure-store")), {
      namedExports: {
        isAvailableAsync: async () => true,
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
        getItemAsync: async (key: string) => values.get(key) ?? null,
        setItemAsync: async (key: string, value: string, option: unknown) => {
          options.push(option);
          values.set(key, value);
        },
        deleteItemAsync: async (key: string) => {
          values.delete(key);
        },
      },
    }),
    mock.module(pathToFileURL(local.resolve("expo-crypto")), {
      namedExports: {
        CryptoDigestAlgorithm: { SHA256: "SHA-256" },
        digestStringAsync: async (_algorithm: string, value: string) =>
          Buffer.from(value).toString("hex"),
      },
    }),
  ];
  const filename = local.resolve("./subscription-store.native.ts");
  try {
    delete local.cache[filename];
    const { openSubscriptionStore } = local(
      filename,
    ) as typeof import("../src/features/subscriptions/storage/subscription-store.native");
    const first = await openSubscriptionStore("owner-a", "api-a");
    const sameOwner = await openSubscriptionStore("owner-a", "api-a");
    const otherOwner = await openSubscriptionStore("owner-b", "api-a");
    const otherEnvironment = await openSubscriptionStore("owner-a", "api-b");
    await first.write(purchaseIntent);
    assert.deepEqual(await sameOwner.read(), purchaseIntent);
    assert.equal(await otherOwner.read(), null);
    assert.equal(await otherEnvironment.read(), null);
    await sameOwner.remove(proId);
    assert.deepEqual(await first.read(), purchaseIntent);
    const different = { ...purchaseIntent, key: proId };
    await assert.rejects(sameOwner.write(different), { kind: "storage" });
    await first.remove(purchaseIntent.key);
    assert.equal(await sameOwner.read(), null);
    const writes = await Promise.allSettled([
      first.write(purchaseIntent),
      sameOwner.write(different),
    ]);
    assert.deepEqual(
      writes.map((row) => row.status),
      ["fulfilled", "rejected"],
    );
    assert.equal(options.length, 2);
    assert.deepEqual(options[0], {
      keychainService: "skillhub.subscription.v1",
      keychainAccessible: 6,
    });
    const storedKey = [...values.keys()][0]!;
    values.set(storedKey, "not-json");
    await assert.rejects(first.read(), { kind: "storage" });
    await assert.rejects(first.write(different), { kind: "storage" });
    assert.equal(values.get(storedKey), "not-json");
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((entry) => entry.restore());
  }
});
