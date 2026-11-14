import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureMaterial,
  materialOwnerId,
  materialOtherId,
} from "./fixtures/materials-data";

test("purchase handles exact-intent retry, successful access, refunded receipts and late session completion without writing balances", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/hooks/use-material-purchase.ts",
      import.meta.url,
    ),
  );
  const cache = new QueryClient();
  const material = fixtureMaterial({
    status: "PUBLISHED",
    ownerId: materialOtherId,
    accessType: "PAID",
    priceCredit: "25.50",
  });
  let current = true,
    walletRefreshes = 0,
    mode = "unknown";
  const requests: unknown[] = [],
    navigation: string[] = [];
  const receipt = {
    id: materialOtherId,
    materialId: material.id,
    sellerId: material.ownerId,
    listingVersion: 1,
    grossCredit: "25.50",
    feeAmount: "1.27",
    sellerNetCredit: "24.23",
    status: "SUCCESS",
    createdAt: material.createdAt,
  };
  const api = createMaterialsApi(async (_path, options) => {
    requests.push(options);
    if (mode === "unknown") throw new AppError("network");
    return { ...receipt, status: mode === "refunded" ? "REFUNDED" : "SUCCESS" };
  }, materialOwnerId);
  let send!: (key: string) => Promise<unknown>;
  const command = {
    run: async (_intent: unknown, next: typeof send) => {
      send = next;
      try {
        return await send("stable-purchase-key");
      } catch {
        return undefined;
      }
    },
    retry: () => send("stable-purchase-key"),
  };
  const runtime = {
    key: ["connections", materialOwnerId, 1],
    isCurrent: () => current,
  };
  const contexts = Object.entries({
    "@tanstack/react-query": { useQueryClient: () => cache },
    "expo-router": {
      useRouter: () => ({ replace: (path: string) => navigation.push(path) }),
    },
    "@/features/connections": {
      useConnections: () => runtime,
      useConnectionCommand: () => command,
    },
    "@/features/wallet": {
      useRefreshWallet: () => () => {
        walletRefreshes++;
        return Promise.resolve();
      },
    },
    "./use-materials": { useMaterialsApi: () => api },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./use-material-purchase.ts");
  try {
    delete local.cache[file];
    const { useMaterialPurchase } = local(file);
    const hook = useMaterialPurchase(material.id);
    await hook.buy(material);
    assert.equal(walletRefreshes, 0);
    assert.deepEqual(navigation, []);
    mode = "success";
    await hook.check();
    assert.deepEqual(requests[0], requests[1]);
    assert.deepEqual(navigation, [`/materials/${material.id}`]);
    assert.equal(
      cache.getQueryData<{ status: string }>([
        ...runtime.key,
        "materials",
        "orders",
        material.id,
      ])?.status,
      "SUCCESS",
    );
    assert.equal(cache.getQueriesData({ queryKey: ["wallet"] }).length, 0);
    mode = "refunded";
    await hook.buy(material);
    assert.equal(navigation.length, 1);
    assert.equal(
      cache.getQueryData([...runtime.key, "materials", "orders", material.id]),
      null,
    );
    const refreshed = walletRefreshes;
    current = false;
    mode = "success";
    await hook.buy(material);
    assert.equal(walletRefreshes, refreshed);
    assert.equal(navigation.length, 1);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
    cache.clear();
  }
});
