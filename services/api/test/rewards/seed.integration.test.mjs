import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSkillFixture } from "../skills/helpers.mjs";
import { seedRewardCatalog } from "../../dist/modules/rewards/application/seed-rewards.js";
import { CatalogSyncService } from "../../dist/modules/rewards/application/services/catalog-sync.service.js";
import { MockVoucherProvider } from "../../dist/modules/rewards/infrastructure/providers/mock-voucher.provider.js";
import {
  MOCK_BRANDS,
  MOCK_PRODUCTS,
} from "../../dist/modules/rewards/infrastructure/providers/mock-catalog.js";

test(
  "reward catalog seed on isolated PostgreSQL",
  { skip: !process.env.DATABASE_URL, timeout: 120_000 },
  async () => {
    process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
    const f = await createSkillFixture();
    try {
      const product = (providerProductId) =>
        f.db.rewardProduct.findFirstOrThrow({ where: { providerProductId } });

      // Without --activate the catalog loads, but nothing is priced or visible.
      const loaded = await seedRewardCatalog(f.db, { activate: false });
      assert.equal(loaded.brands, MOCK_BRANDS.length);
      assert.equal(loaded.products, MOCK_PRODUCTS.length);
      assert.equal(loaded.activated, 0);
      assert.equal(
        await f.db.rewardProduct.count({ where: { status: "ACTIVE" } }),
        0,
      );
      assert.equal(
        await f.db.rewardProduct.count({
          where: { priceCredit: { not: null } },
        }),
        0,
      );

      // --activate prices the catalog products at the demo rate: 50.000 VND = 50 Credit.
      const first = await seedRewardCatalog(f.db, { activate: true });
      assert.ok(first.activated > 100);
      const highlands = await product("highlands-coffee-50k-ok");
      assert.equal(highlands.status, "ACTIVE");
      assert.equal(highlands.priceCredit, 5000n);
      assert.equal(highlands.priceVersion, 2);
      assert.equal(
        (await product("highlands-coffee-100k-ok")).priceCredit,
        10000n,
      );
      // The fictional scenario products carry no demo price and stay hidden.
      for (const id of ["coffee-50k-ok", "mart-oos", "books-lost"]) {
        const row = await product(id);
        assert.equal(row.status, "INACTIVE");
        assert.equal(row.priceCredit, null);
      }

      // An admin's price, and a product an admin switched off, survive a second run.
      await f.db.rewardProduct.update({
        where: { id: highlands.id },
        data: { priceCredit: 7000n, priceVersion: 3 },
      });
      const katinat = await product("katinat-50k-ok");
      await f.db.rewardProduct.update({
        where: { id: katinat.id },
        data: { status: "INACTIVE" },
      });
      const second = await seedRewardCatalog(f.db, { activate: true });
      assert.equal(second.activated, 0);
      const kept = await product("highlands-coffee-50k-ok");
      assert.equal(kept.priceCredit, 7000n);
      assert.equal(kept.priceVersion, 3);
      assert.equal((await product("katinat-50k-ok")).status, "INACTIVE");
      assert.equal(await f.db.rewardProduct.count(), MOCK_PRODUCTS.length);

      // An admin sync lists the same catalog, so it removes nothing.
      const sync = await new CatalogSyncService(
        f.transactions,
        new MockVoucherProvider(),
      ).sync();
      assert.equal(sync.removed, 0);
      assert.equal(
        (await product("highlands-coffee-100k-ok")).status,
        "ACTIVE",
      );
    } finally {
      await f.dispose();
    }
  },
);
