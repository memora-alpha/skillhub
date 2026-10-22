# Learning Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship SH-115..SH-119: owners upload/list FREE or PAID materials, Staff reviews them, users search and download them, and PAID materials are bought with Available Credit atomically and idempotently.

**Architecture:** New NestJS module `src/modules/materials` in the unified folder layout (`domain/`, `application/{contracts,services}/`, `presentation/http/`). Services use `TransactionRunner` + Prisma `tx` directly, like `reports` and `credit`. File upload, scan and signed URLs reuse `infrastructure/storage`. Wallet movement is a new primitive `CreditOperationsService.purchaseMaterial` in the credit module. No new Prisma models: the runtime schema already has `Material`, `MaterialOrder` and `MaterialEntitlement`. One SQL migration adds CHECK constraints.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 7 + PostgreSQL, class-validator DTOs, `node:test` suites against `dist/`.

**Spec:** `services/api/specs/011-learning-materials/spec.md`

## Global Constraints

- Work only in `services/api`. Do not change `apps/*`.
- Branch `feature/learning-material-service` (already checked out). Commit format `feat(api/materials): …` for files inside `src/modules/materials`, `feat(api): …` when the commit spans modules.
- Credit amounts are `bigint` hundredths; API strings use `formatCredit`/`parseCredit` from `src/modules/credit/domain/money.ts`.
- Fee: `MATERIAL_PAID` policy v1 `{ feeBps: 500 }`, rounding `{ mode: "DOWN", precision: 2 }`.
- Material upload limit is the existing storage policy: purpose `MATERIAL`, ≤ 20 MB, `pdf/docx/pptx/xlsx`.
- Sonar rules from `services/api/AGENTS.md`: explicit `sort` comparators (`byCodeUnit` for UUIDs), no nested ternaries, useful exception messages, and explained sequential awaits.
- Integration tests need `TEST_DATABASE_URL` pointing to a disposable PostgreSQL. The fixture creates and drops its own schema.
- Rollout order: migrate → `pnpm db:seed-configuration` (fee policy) → `pnpm identity:seed` (permissions) → deploy code.

## File Structure

```
services/api/
├─ prisma/migrations/20261021000000_material_constraints/migration.sql   (new) DB invariants
├─ src/
│  ├─ app.module.ts                                         (modify) register MaterialsModule
│  ├─ shared/authorization/permission.catalog.ts             (modify) 3 material permissions
│  ├─ infrastructure/storage/file-attachment.service.ts      (modify) attachReady also returns originalName
│  ├─ modules/audit/domain/audit-action.catalog.ts           (modify) MATERIAL_MODERATE, MATERIAL_PURCHASE
│  ├─ modules/users/infrastructure/persistence/prisma-users-repository.ts (modify) grant MATERIAL_PERMISSIONS
│  ├─ modules/credit/application/seed-fee-policies.ts        (modify) seed MATERIAL_PAID 5%
│  ├─ modules/credit/application/services/credit-provenance.service.ts (modify) spend() + bonusFirst()
│  ├─ modules/credit/application/services/credit-operations.service.ts (modify) purchaseMaterial()
│  └─ modules/materials/
│     ├─ materials.module.ts
│     ├─ domain/material.policy.ts                 pure rules: price, text, state machine, fee, permissions
│     ├─ application/contracts/material-view.ts    response projections (no storageKey)
│     ├─ application/services/material-support.ts  principal helpers + row lock
│     ├─ application/services/materials.service.ts            owner CRUD/submit/archive/upload
│     ├─ application/services/material-moderation.service.ts  staff queue + approve/reject/hide/unhide
│     ├─ application/services/material-catalog.service.ts     public search/detail + authorized download
│     ├─ application/services/material-purchase.service.ts    purchase + order list
│     ├─ application/services/material-reports.service.ts     report MATERIAL (+ order hook)
│     └─ presentation/http/
│        ├─ materials.dto.ts
│        ├─ my-materials.controller.ts            /me/materials/*
│        ├─ public-materials.controller.ts        GET /materials, GET /materials/:id
│        ├─ material-access.controller.ts         download / purchase / orders / reports
│        └─ material-moderation.controller.ts     /staff/materials/*
└─ test/materials/
   ├─ policy.test.mjs            unit (no DB)
   ├─ fixture.mjs                builds on test/skills/helpers.mjs
   ├─ ledger.test.mjs            credit primitive
   ├─ lifecycle.test.mjs         owner + moderation
   ├─ access.test.mjs            search/detail/download rules
   ├─ purchase.test.mjs          atomic/idempotent/concurrent purchase
   └─ reports.test.mjs           material report hook
```

---

### Task 1: Domain policy

**Files:**

- Create: `src/modules/materials/domain/material.policy.ts`
- Test: `test/materials/policy.test.mjs`
- Modify: `src/shared/authorization/permission.catalog.ts` (the policy's `MATERIAL_PERMISSIONS` must type-check against `PermissionCode`)

**Interfaces:**

- Produces: `MaterialAccess`, `MaterialState`, `ModerationAction`, `MODERATION_ACTIONS`, `MATERIAL_PERMISSIONS`, `listingText({title, description})`, `priceUnits(accessType, price): bigint`, `statusAfterEdit(status)`, `assertArchivable(status)`, `moderationTransition(action, status): {status, decision}`, `assertPublishableFile(m)`, `materialFee(gross, feeBps): {fee, net}`, `PurchasedFileSnapshot`, `snapshotStorageKey(snapshot): string`.

- [ ] **Step 1: Write the failing test** — `test/materials/policy.test.mjs`

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPublishableFile,
  listingText,
  materialFee,
  moderationTransition,
  priceUnits,
  snapshotStorageKey,
  statusAfterEdit,
} from "../../dist/modules/materials/domain/material.policy.js";

test("FREE must be 0 and PAID must be positive with two decimals", () => {
  assert.equal(priceUnits("FREE", "0"), 0n);
  assert.equal(priceUnits("PAID", "12.5"), 1250n);
  assert.throws(() => priceUnits("FREE", "1"), /MATERIAL_PRICE_INVALID/);
  assert.throws(() => priceUnits("PAID", "0"), /MATERIAL_PRICE_INVALID/);
  assert.throws(() => priceUnits("PAID", "1.001"), /INVALID_CREDIT_AMOUNT/);
});

test("listing text is trimmed and bounded", () => {
  assert.deepEqual(
    listingText({ title: "  Docker  ", description: "  Ten chars!  " }),
    { title: "Docker", description: "Ten chars!" },
  );
  assert.throws(
    () => listingText({ title: "   abc   ", description: "long enough text" }),
    /MATERIAL_TEXT_INVALID/,
  );
});

test("editing a live listing sends it back to review", () => {
  assert.equal(statusAfterEdit("PUBLISHED"), "PENDING_REVIEW");
  assert.equal(statusAfterEdit("REJECTED"), "DRAFT");
  assert.equal(statusAfterEdit("DRAFT"), "DRAFT");
  assert.equal(statusAfterEdit("PENDING_REVIEW"), "PENDING_REVIEW");
  assert.throws(() => statusAfterEdit("HIDDEN"), /MATERIAL_NOT_EDITABLE/);
  assert.throws(() => statusAfterEdit("ARCHIVED"), /MATERIAL_NOT_EDITABLE/);
});

test("moderation only follows the state machine", () => {
  assert.deepEqual(moderationTransition("approve", "PENDING_REVIEW"), {
    status: "PUBLISHED",
    decision: "APPROVED",
  });
  assert.deepEqual(moderationTransition("reject", "PENDING_REVIEW"), {
    status: "REJECTED",
    decision: "REJECTED",
  });
  assert.deepEqual(moderationTransition("hide", "PUBLISHED"), {
    status: "HIDDEN",
    decision: "HIDDEN",
  });
  assert.deepEqual(moderationTransition("unhide", "HIDDEN"), {
    status: "PUBLISHED",
    decision: "APPROVED",
  });
  assert.throws(
    () => moderationTransition("approve", "DRAFT"),
    /MATERIAL_TRANSITION_INVALID/,
  );
  assert.throws(
    () => moderationTransition("unhide", "PUBLISHED"),
    /MATERIAL_TRANSITION_INVALID/,
  );
});

test("5% fee floors to hundredths and gross = fee + net", () => {
  assert.deepEqual(materialFee(10000n, 500), { fee: 500n, net: 9500n });
  assert.deepEqual(materialFee(1999n, 500), { fee: 99n, net: 1900n });
  assert.deepEqual(materialFee(1n, 500), { fee: 0n, net: 1n });
  for (const bad of [-1, 10000, 2.5, "500", undefined]) {
    assert.throws(
      () => materialFee(100n, bad),
      /MATERIAL_FEE_POLICY_UNAVAILABLE/,
    );
  }
});

test("publishing needs a clean rights-confirmed file", () => {
  const ok = {
    storageKey: "private/x",
    scanStatus: "CLEAN",
    distributionRightsConfirmedAt: new Date(),
  };
  assert.doesNotThrow(() => assertPublishableFile(ok));
  for (const patch of [
    { storageKey: null },
    { scanStatus: "INFECTED" },
    { distributionRightsConfirmedAt: null },
  ]) {
    assert.throws(
      () => assertPublishableFile({ ...ok, ...patch }),
      /MATERIAL_FILE_REQUIRED/,
    );
  }
  assert.equal(snapshotStorageKey({ storageKey: "private/y" }), "private/y");
  assert.throws(() => snapshotStorageKey({}), /MATERIAL_FILE_REQUIRED/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `services/api`): `pnpm build; node --test test/materials/policy.test.mjs`
Expected: FAIL, `Cannot find module …/dist/modules/materials/domain/material.policy.js`.

- [ ] **Step 3: Add permission codes** — append to `PERMISSION_CATALOG` in `src/shared/authorization/permission.catalog.ts` (before `] as const;`):

```ts
  {
    code: "material:create:self",
    description: "Create, edit and submit own learning materials",
  },
  {
    code: "material:access",
    description: "Download, purchase and report learning materials",
  },
  {
    code: "material:moderate",
    description: "Review, hide and restore learning materials",
  },
```

- [ ] **Step 4: Write the policy** — `src/modules/materials/domain/material.policy.ts`

```ts
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { RoleCode } from "../../../shared/authorization/authorization.types";
import type { PermissionCode } from "../../../shared/authorization/permission.catalog";
import { parseCredit } from "../../credit/domain/money";

export type MaterialAccess = "FREE" | "PAID";
export type MaterialState =
  "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "HIDDEN" | "ARCHIVED";
export type ModerationAction = "approve" | "reject" | "hide" | "unhide";

export const MATERIAL_PERMISSIONS = {
  USER: ["material:create:self", "material:access"],
  STAFF: ["material:create:self", "material:access", "material:moderate"],
  ADMIN: ["material:create:self", "material:access", "material:moderate"],
} satisfies Record<RoleCode, readonly PermissionCode[]>;

/** SRS 18.41: title 5–150, description 10–3000 after trimming. */
export function listingText(input: { title: string; description: string }) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (
    title.length < 5 ||
    title.length > 150 ||
    description.length < 10 ||
    description.length > 3000
  )
    throw new BadRequestException("MATERIAL_TEXT_INVALID");
  return { title, description };
}

/** BR-42: FREE is exactly 0, PAID is > 0 with at most two decimals. Returns hundredths. */
export function priceUnits(accessType: MaterialAccess, price: string): bigint {
  const units = parseCredit(price);
  const valid = accessType === "FREE" ? units === 0n : units > 0n;
  if (!valid) throw new BadRequestException("MATERIAL_PRICE_INVALID");
  return units;
}

const EDITABLE: ReadonlySet<MaterialState> = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
]);

/** D3: a live listing goes back to review; a rejected one becomes a draft again. */
export function statusAfterEdit(status: MaterialState): MaterialState {
  if (!EDITABLE.has(status))
    throw new ConflictException("MATERIAL_NOT_EDITABLE");
  if (status === "PUBLISHED") return "PENDING_REVIEW";
  if (status === "REJECTED") return "DRAFT";
  return status;
}

/** Owners may stop distributing anything they could still edit; HIDDEN stays with Staff. */
export function assertArchivable(status: MaterialState): void {
  if (!EDITABLE.has(status))
    throw new ConflictException("MATERIAL_TRANSITION_INVALID");
}

const MODERATION: Record<
  ModerationAction,
  { from: readonly MaterialState[]; to: MaterialState; decision: string }
> = {
  approve: { from: ["PENDING_REVIEW"], to: "PUBLISHED", decision: "APPROVED" },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", decision: "REJECTED" },
  hide: {
    from: ["PENDING_REVIEW", "PUBLISHED"],
    to: "HIDDEN",
    decision: "HIDDEN",
  },
  unhide: { from: ["HIDDEN"], to: "PUBLISHED", decision: "APPROVED" },
};

export const MODERATION_ACTIONS = Object.keys(MODERATION) as ModerationAction[];

export function moderationTransition(
  action: ModerationAction,
  status: MaterialState,
): { status: MaterialState; decision: string } {
  const rule = MODERATION[action];
  if (!rule.from.includes(status))
    throw new ConflictException("MATERIAL_TRANSITION_INVALID");
  return { status: rule.to, decision: rule.decision };
}

/** Mirrors the materials_published_file_check constraint. */
export function assertPublishableFile(material: {
  storageKey: string | null;
  scanStatus: string | null;
  distributionRightsConfirmedAt: Date | null;
}): void {
  if (
    !material.storageKey ||
    material.scanStatus !== "CLEAN" ||
    !material.distributionRightsConfirmedAt
  )
    throw new ConflictException("MATERIAL_FILE_REQUIRED");
}

/** D2: the fee floors to hundredths and the seller receives the remainder. */
export function materialFee(
  gross: bigint,
  feeBps: unknown,
): { fee: bigint; net: bigint } {
  if (
    gross <= 0n ||
    typeof feeBps !== "number" ||
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps >= 10_000
  )
    throw new ConflictException("MATERIAL_FEE_POLICY_UNAVAILABLE");
  const fee = (gross * BigInt(feeBps)) / 10_000n;
  return { fee, net: gross - fee };
}

/** Stored on MaterialOrder.purchasedFileSnapshot (ERD v3: no MaterialVersion). */
export type PurchasedFileSnapshot = {
  storageKey: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  checksum: string | null;
  distributionRightsConfirmedAt: string | null;
  uploadedAt: string | null;
};

export function snapshotStorageKey(snapshot: unknown): string {
  const key = (snapshot as { storageKey?: unknown } | null)?.storageKey;
  if (typeof key !== "string" || key.length === 0)
    throw new ConflictException("MATERIAL_FILE_REQUIRED");
  return key;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm build; node --test test/materials/policy.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/materials/domain/material.policy.ts src/shared/authorization/permission.catalog.ts test/materials/policy.test.mjs
git commit -m "feat(api): add learning material domain policy"
```

---

### Task 2: Catalog plumbing — grants, audit actions, 5% fee seed, DB constraints

**Files:**

- Modify: `src/modules/users/infrastructure/persistence/prisma-users-repository.ts` (permission bootstrap ~L259–330)
- Modify: `src/modules/audit/domain/audit-action.catalog.ts` (`AUDIT_ACTIONS`, projections, `projectionByAction`)
- Modify: `src/modules/credit/application/seed-fee-policies.ts`
- Create: `prisma/migrations/20261021000000_material_constraints/migration.sql`
- Create: `test/materials/fixture.mjs`
- Test: `test/materials/schema.test.mjs`

**Interfaces:**

- Consumes: `MATERIAL_PERMISSIONS` (Task 1).
- Produces: audit actions `"MATERIAL_MODERATE"` (projection `{status, listingVersion}`) and `"MATERIAL_PURCHASE"` (projection `{materialId, grossCredit, feeAmount, operationId}`, integer strings); seeded `FeePolicyVersion { policyCode: "MATERIAL_PAID", versionNo: 1, status: "APPROVED", calculationRule: { feeBps: 500 } }`; fixture `createMaterialFixture()` → `{ ...skillFixture, credits, skill, fund(account, units) }`.

- [ ] **Step 1: Write the fixture** — `test/materials/fixture.mjs`

```js
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "../skills/helpers.mjs";
import { CreditProvenanceService } from "../../dist/modules/credit/application/services/credit-provenance.service.js";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";

/** Fresh UUID schema with all migrations, fee policies and one ACTIVE skill. */
export async function createMaterialFixture() {
  const f = await createSkillFixture();
  await f.transactions.run(seedPathFeePolicies);
  const credits = new CreditOperationsService(new CreditProvenanceService());
  const skill = await f.db.skill.create({
    data: {
      name: `Materials ${randomUUID()}`,
      slug: `materials-${randomUUID()}`,
      status: "ACTIVE",
    },
  });
  /** Real TOP_UP with a PURCHASED lot so provenance stays reconciled. */
  const fund = (account, units) =>
    f.transactions.run((tx) =>
      credits.topUp(tx, {
        userId: account.user.id,
        paymentId: randomUUID(),
        amount: units,
        receiptDigest: "fixture",
      }),
    );
  return { ...f, credits, skill, fund };
}
```

- [ ] **Step 2: Write the failing test** — `test/materials/schema.test.mjs`

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { createMaterialFixture } from "./fixture.mjs";

test("material catalog plumbing on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const staff = await f.account("STAFF");
    await t.test("roles receive material permissions", () => {
      assert.ok(owner.principal.permissions.includes("material:create:self"));
      assert.ok(owner.principal.permissions.includes("material:access"));
      assert.ok(!owner.principal.permissions.includes("material:moderate"));
      assert.ok(staff.principal.permissions.includes("material:moderate"));
    });
    await t.test("MATERIAL_PAID 5% policy is seeded once", async () => {
      // The fixture already seeded once; a second run must be a no-op.
      await f.transactions.run(seedPathFeePolicies);
      const policies = await f.db.feePolicyVersion.findMany({
        where: { policyCode: "MATERIAL_PAID" },
      });
      assert.equal(policies.length, 1);
      assert.deepEqual(policies[0].calculationRule, { feeBps: 500 });
      assert.equal(policies[0].status, "APPROVED");
    });
    const base = {
      ownerId: owner.user.id,
      skillId: f.skill.id,
      title: "Docker basics",
      description: "Ten or more characters",
      listingVersion: 1,
      moderationStatus: "NONE",
      status: "DRAFT",
    };
    await t.test("price must match access type", async () => {
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "FREE",
            priceCredit: 100n,
          },
        }),
        /materials_price_by_access_check/,
      );
      await assert.rejects(
        f.db.material.create({
          data: {
            ...base,
            id: randomUUID(),
            accessType: "PAID",
            priceCredit: 0n,
          },
        }),
        /materials_price_by_access_check/,
      );
    });
    await t.test(
      "PUBLISHED requires a clean rights-confirmed file",
      async () => {
        await assert.rejects(
          f.db.material.create({
            data: {
              ...base,
              id: randomUUID(),
              accessType: "FREE",
              priceCredit: 0n,
              status: "PUBLISHED",
            },
          }),
          /materials_published_file_check/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/schema.test.mjs`
Expected: FAIL on the permission assertion (no grants yet).

- [ ] **Step 4: Grant permissions** — in `prisma-users-repository.ts` import and spread `MATERIAL_PERMISSIONS` exactly like `SKILL_PERMISSIONS`:

```ts
import { MATERIAL_PERMISSIONS } from "../../../materials/domain/material.policy";
```

In `codes`:

```ts
        ...Object.values(SKILL_PERMISSIONS).flat(),
        ...Object.values(TAG_PERMISSIONS).flat(),
        ...Object.values(MATERIAL_PERMISSIONS).flat(),
```

In `assignments`, after the `SKILL_PERMISSIONS` block:

```ts
      ...Object.entries(MATERIAL_PERMISSIONS).flatMap(([roleCode, grants]) =>
        grants.map((permissionCode) => ({
          roleCode: roleCode as RoleCode,
          permissionCode,
        })),
      ),
```

- [ ] **Step 5: Audit actions** — in `audit-action.catalog.ts` add `"MATERIAL_MODERATE", "MATERIAL_PURCHASE",` at the end of `AUDIT_ACTIONS`. Add the projections next to `credit`:

```ts
const material = z.strictObject({
  status: z.enum([
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ]),
  listingVersion: z.number().int().positive(),
});
const materialOrder = z.strictObject({
  materialId: uuid,
  grossCredit: z.string().regex(/^[1-9]\d*$/),
  feeAmount: z.string().regex(/^(0|[1-9]\d*)$/),
  operationId: uuid,
});
```

In `projectionByAction`:

```ts
  MATERIAL_MODERATE: material,
  MATERIAL_PURCHASE: materialOrder,
```

- [ ] **Step 6: Seed the 5% policy** — replace the body of `seed-fee-policies.ts`. Keep the export name, because three test suites import it:

```ts
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";

const POLICIES = [
  // The SRS fixes the 96/4 split; the product owner selected floor rounding.
  {
    policyCode: "ONE_WAY",
    calculationRule: { returnedBps: 9600, feeBps: 400 },
  },
  {
    policyCode: "TWO_WAY",
    calculationRule: { returnedBps: 9600, feeBps: 400 },
  },
  // OP-14 decided 2026-10-21: 5% material sale fee, seller keeps gross minus the floored fee.
  { policyCode: "MATERIAL_PAID", calculationRule: { feeBps: 500 } },
] as const;

/** Seeds v1 of every fee policy that has no APPROVED version yet. */
export async function seedPathFeePolicies(
  tx: TransactionContext,
): Promise<void> {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new Error("fee policy seed could not read database time");
  for (const { policyCode, calculationRule } of POLICIES) {
    const approved = await tx.feePolicyVersion.findFirst({
      where: { policyCode, status: "APPROVED" },
      select: { id: true },
    });
    if (approved) continue;
    const baseline = await tx.feePolicyVersion.findUnique({
      where: { policyCode_versionNo: { policyCode, versionNo: 1 } },
      select: { id: true },
    });
    if (baseline)
      throw new Error(`fee policy requires reconciliation: ${policyCode}`);
    await tx.feePolicyVersion.create({
      data: {
        policyCode,
        versionNo: 1,
        calculationRule,
        roundingRule: { mode: "DOWN", precision: 2 },
        status: "APPROVED",
        approvedAt: clock.now,
        effectiveAt: clock.now,
      },
    });
  }
}
```

- [ ] **Step 7: Migration** — `prisma/migrations/20261021000000_material_constraints/migration.sql`

```sql
-- SH-115..118 invariants enforced by PostgreSQL in addition to the API.
-- Preflight: the materials module never shipped, so these tables are expected empty.
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_price_by_access_check" CHECK (
    ("access_type" = 'FREE' AND "price_credit" = 0)
    OR ("access_type" = 'PAID' AND "price_credit" BETWEEN 1 AND 999999999999)
  ),
  ADD CONSTRAINT "materials_text_length_check" CHECK (
    char_length("title") BETWEEN 5 AND 150
    AND char_length("description") BETWEEN 10 AND 3000
  ),
  ADD CONSTRAINT "materials_listing_version_check" CHECK ("listing_version" >= 1),
  ADD CONSTRAINT "materials_published_file_check" CHECK (
    "status" <> 'PUBLISHED' OR (
      "storage_key" IS NOT NULL
      AND "size_bytes" > 0
      AND "scan_status" = 'CLEAN'
      AND "distribution_rights_confirmed_at" IS NOT NULL
    )
  );

ALTER TABLE "material_orders"
  ADD CONSTRAINT "material_orders_parties_check" CHECK ("buyer_id" <> "seller_id"),
  ADD CONSTRAINT "material_orders_amounts_check" CHECK (
    "gross_credit" > 0 AND "fee_amount" >= 0 AND "seller_net_credit" >= 0
    AND "gross_credit" = "fee_amount" + "seller_net_credit"
  ),
  ADD CONSTRAINT "material_orders_status_check" CHECK ("status" = 'SUCCESS');

ALTER TABLE "material_entitlements"
  ADD CONSTRAINT "material_entitlements_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
  ADD CONSTRAINT "material_entitlements_source_check" CHECK (
    ("source_type" = 'PURCHASE') = ("source_order_id" IS NOT NULL)
  );
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/schema.test.mjs; pnpm test:audit`
Expected: PASS for both.

- [ ] **Step 9: Commit**

```bash
git add prisma/migrations/20261021000000_material_constraints src/modules/users/infrastructure/persistence/prisma-users-repository.ts src/modules/audit/domain/audit-action.catalog.ts src/modules/credit/application/seed-fee-policies.ts test/materials/fixture.mjs test/materials/schema.test.mjs
git commit -m "feat(api): add material grants, audit actions, fee policy and constraints"
```

---

### Task 3: Credit primitive `purchaseMaterial`

**Files:**

- Modify: `src/modules/credit/application/services/credit-provenance.service.ts`
- Modify: `src/modules/credit/application/services/credit-operations.service.ts`
- Test: `test/materials/ledger.test.mjs`

**Interfaces:**

- Produces: `CreditProvenanceService.spend(tx, userId, amount): Promise<{ purchased: bigint; bonus: bigint }>` and `CreditOperationsService.purchaseMaterial(tx, { orderId, buyerId, sellerId, gross, fee }): Promise<{ operationId: string }>`. Throws `ConflictException("INSUFFICIENT_AVAILABLE_CREDIT")` and `ConflictException("INVALID_MATERIAL_PAYMENT")`.

- [ ] **Step 1: Write the failing test** — `test/materials/ledger.test.mjs`

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material payment ledger on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const buyer = await f.account();
    const seller = await f.account();
    await f.fund(buyer, 10000n);
    const pay = (gross, fee) =>
      f.transactions.run((tx) =>
        f.credits.purchaseMaterial(tx, {
          orderId: randomUUID(),
          buyerId: buyer.user.id,
          sellerId: seller.user.id,
          gross,
          fee,
        }),
      );
    await t.test(
      "debits gross, credits net and records the fee once",
      async () => {
        const { operationId } = await pay(2000n, 100n);
        const wallets = new Map(
          (
            await f.db.creditWallet.findMany({
              where: { userId: { in: [buyer.user.id, seller.user.id] } },
            })
          ).map((w) => [w.userId, w]),
        );
        assert.equal(wallets.get(buyer.user.id).availableCredit, 8000n);
        assert.equal(wallets.get(buyer.user.id).purchasedCredit, 8000n);
        assert.equal(wallets.get(seller.user.id).availableCredit, 1900n);
        const entries = await f.db.creditTransaction.findMany({
          where: { operationId },
          orderBy: { entryNo: "asc" },
        });
        assert.deepEqual(
          entries.map((e) => [e.type, e.availableDelta, e.availableAfter]),
          [
            ["MATERIAL_PURCHASE", -1900n, 8100n],
            ["PLATFORM_FEE", -100n, 8000n],
            ["MATERIAL_SALE", 1900n, 1900n],
          ],
        );
        // Both wallets still reconcile with their provenance lots.
        await f.transactions.run(async (tx) => {
          await f.credits.lockWallet(tx, buyer.user.id);
          await f.credits.lockWallet(tx, seller.user.id);
        });
      },
    );
    await t.test("zero fee writes no PLATFORM_FEE entry", async () => {
      const { operationId } = await pay(1n, 0n);
      const types = (
        await f.db.creditTransaction.findMany({
          where: { operationId },
          orderBy: { entryNo: "asc" },
        })
      ).map((e) => e.type);
      assert.deepEqual(types, ["MATERIAL_PURCHASE", "MATERIAL_SALE"]);
    });
    await t.test("insufficient Available changes nothing", async () => {
      const before = await f.db.creditTransaction.count();
      await assert.rejects(pay(9000n, 450n), /INSUFFICIENT_AVAILABLE_CREDIT/);
      assert.equal(await f.db.creditTransaction.count(), before);
    });
    await t.test("self payment is rejected", async () => {
      await assert.rejects(
        f.transactions.run((tx) =>
          f.credits.purchaseMaterial(tx, {
            orderId: randomUUID(),
            buyerId: buyer.user.id,
            sellerId: buyer.user.id,
            gross: 100n,
            fee: 5n,
          }),
        ),
        /INVALID_MATERIAL_PAYMENT/,
      );
    });
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/ledger.test.mjs`
Expected: FAIL, `f.credits.purchaseMaterial is not a function`.

- [ ] **Step 3: Provenance `spend`** — in `credit-provenance.service.ts` add a module-level helper and reuse it in `hold` and `settle`, whose inline partitions are identical:

```ts
/** Stable partition: BONUS lots first, FIFO inside each group. */
function bonusFirst<T extends { source: string }>(lots: T[]): T[] {
  return [
    ...lots.filter((lot) => lot.source === "BONUS"),
    ...lots.filter((lot) => lot.source !== "BONUS"),
  ];
}
```

Replace the `const ordered = [...]` blocks in `hold` and `settle` with `const ordered = bonusFirst(lots);`. Add the method:

```ts
  /** Direct spend from Available (material purchase). Returns the per-source split. */
  async spend(tx: TransactionContext, userId: string, amount: bigint) {
    const lots = await tx.creditLot.findMany({
      where: { userId, available: { gt: 0n } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let left = amount;
    let purchased = 0n;
    let bonus = 0n;
    for (const lot of bonusFirst(lots)) {
      if (left === 0n) break;
      const used = lot.available < left ? lot.available : left;
      // Each write depends on the remaining amount, so consumption stays deterministic.
      await tx.creditLot.update({
        where: { id: lot.id },
        data: { available: { decrement: used }, consumed: { increment: used } },
      });
      if (lot.source === "PURCHASED") purchased += used;
      if (lot.source === "BONUS") bonus += used;
      left -= used;
    }
    if (left) throw new ConflictException("CREDIT_PROVENANCE_BALANCE_MISMATCH");
    return { purchased, bonus };
  }
```

- [ ] **Step 4: `purchaseMaterial`** — in `credit-operations.service.ts` change the idempotency import to `import { byCodeUnit, fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";`, add `import type { CreditWallet } from "../../../../generated/prisma/client";`, then add:

```ts
  /**
   * BR-43: the buyer pays gross from Available, the seller earns gross − fee.
   * PLATFORM_FEE is the buyer's second debit entry of the same gross, never an extra charge.
   */
  async purchaseMaterial(
    tx: TransactionContext,
    input: {
      orderId: string;
      buyerId: string;
      sellerId: string;
      gross: bigint;
      fee: bigint;
    },
  ): Promise<{ operationId: string }> {
    const net = input.gross - input.fee;
    if (
      input.gross <= 0n ||
      input.fee < 0n ||
      net <= 0n ||
      input.buyerId === input.sellerId
    )
      throw new ConflictException("INVALID_MATERIAL_PAYMENT");
    const wallets = new Map<string, CreditWallet>();
    // UUID lock order prevents deadlocks between concurrent purchases of the same pair.
    for (const userId of [input.buyerId, input.sellerId].sort(byCodeUnit)) {
      wallets.set(userId, await this.lockWallet(tx, userId));
    }
    const buyer = wallets.get(input.buyerId)!;
    const seller = wallets.get(input.sellerId)!;
    if (buyer.availableCredit < input.gross)
      throw new ConflictException("INSUFFICIENT_AVAILABLE_CREDIT");
    const key = `material-purchase:${input.orderId}`;
    const operation = await tx.creditOperation.create({
      data: {
        operationType: "MATERIAL_PURCHASE",
        referenceType: "MATERIAL_ORDER",
        referenceId: input.orderId,
        idempotencyKey: key,
        status: "SUCCESS",
      },
    });
    const spent = await this.provenance.spend(tx, buyer.userId, input.gross);
    const buyerAfter = buyer.availableCredit - input.gross;
    await tx.creditWallet.update({
      where: { userId: buyer.userId },
      data: {
        availableCredit: buyerAfter,
        purchasedCredit: { decrement: spent.purchased },
        bonusCredit: { decrement: spent.bonus },
        walletVersion: { increment: 1 },
      },
    });
    const sellerAfter = seller.availableCredit + net;
    await tx.creditLot.create({
      data: {
        userId: seller.userId,
        operationId: operation.id,
        source: "EARNED",
        available: net,
        granted: net,
      },
    });
    await tx.creditWallet.update({
      where: { userId: seller.userId },
      data: { availableCredit: sellerAfter, walletVersion: { increment: 1 } },
    });
    const entries: {
      userId: string;
      type: "MATERIAL_PURCHASE" | "PLATFORM_FEE" | "MATERIAL_SALE";
      amount: bigint;
      availableDelta: bigint;
      availableAfter: bigint;
      heldAfter: bigint;
      suffix: string;
    }[] = [
      {
        userId: buyer.userId,
        type: "MATERIAL_PURCHASE",
        amount: net,
        availableDelta: -net,
        availableAfter: buyer.availableCredit - net,
        heldAfter: buyer.heldCredit,
        suffix: "purchase",
      },
      ...(input.fee > 0n
        ? [
            {
              userId: buyer.userId,
              type: "PLATFORM_FEE" as const,
              amount: input.fee,
              availableDelta: -input.fee,
              availableAfter: buyerAfter,
              heldAfter: buyer.heldCredit,
              suffix: "fee",
            },
          ]
        : []),
      {
        userId: seller.userId,
        type: "MATERIAL_SALE",
        amount: net,
        availableDelta: net,
        availableAfter: sellerAfter,
        heldAfter: seller.heldCredit,
        suffix: "sale",
      },
    ];
    for (const [index, entry] of entries.entries()) {
      // Sequential inserts keep entry_no aligned with each wallet's running balance.
      await tx.creditTransaction.create({
        data: {
          userId: entry.userId,
          operationId: operation.id,
          entryNo: index + 1,
          type: entry.type,
          amount: entry.amount,
          availableDelta: entry.availableDelta,
          heldDelta: 0n,
          availableAfter: entry.availableAfter,
          heldAfter: entry.heldAfter,
          status: "SUCCESS",
          idempotencyKey: `${key}:${entry.suffix}`,
        },
      });
    }
    return { operationId: operation.id };
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/ledger.test.mjs; pnpm test:credit; pnpm test:payments:integration`
Expected: PASS. The payments provenance suite covers the `bonusFirst` refactor.

- [ ] **Step 6: Commit**

```bash
git add src/modules/credit test/materials/ledger.test.mjs
git commit -m "feat(api/credit): add atomic material purchase ledger primitive"
```

---

### Task 4: Owner flow — upload, create, edit, submit, archive (SH-115, SH-116)

**Files:**

- Modify: `src/infrastructure/storage/file-attachment.service.ts` (`attachReady` return gains `originalName: row.originalName`)
- Create: `src/modules/materials/application/contracts/material-view.ts`
- Create: `src/modules/materials/application/services/material-support.ts`
- Create: `src/modules/materials/application/services/materials.service.ts`
- Create: `src/modules/materials/presentation/http/materials.dto.ts`
- Create: `src/modules/materials/presentation/http/my-materials.controller.ts`
- Create: `src/modules/materials/materials.module.ts`
- Modify: `src/app.module.ts` (import and register `MaterialsModule` after `PaymentsModule`)
- Modify: `test/materials/fixture.mjs`
- Test: `test/materials/lifecycle.test.mjs`

**Interfaces:**

- Consumes: Task 1 policy and Task 2 permissions.
- Produces:
  - `publicMaterialView(m)`, `ownerMaterialView(m)`, `orderView(o)`
  - `roleCodes(p)`, `storageActor(p)`, `requirePermission(p, code)`, `isModerator(p)`, `requireModerator(p)`, `auditContext()`, `lockMaterial(tx, id)`
  - `MaterialsService.{upload, fileStatus, listMine, create, update, submit, archive}`
  - fixture `f.materials` and `f.materialFile(account)` → `{ id, objectKey }`

- [ ] **Step 1: Extend the fixture** — add to `test/materials/fixture.mjs`:

```js
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
```

Inside `createMaterialFixture`, before `return`:

```js
const materials = new MaterialsService(
  f.transactions,
  f.storage,
  f.attachments,
);
/** A READY/CLEAN MATERIAL upload whose object exists in the fake bucket. */
async function materialFile(account) {
  const file = await f.readyFile(account, {
    purpose: "MATERIAL",
    originalName: "notes.pdf",
  });
  f.objects.set(file.objectKey, Buffer.alloc(1024));
  return file;
}
const draftInput = (overrides = {}) => ({
  skillId: skill.id,
  title: "Docker basics",
  description: "Hands-on Docker notes for beginners",
  accessType: "FREE",
  priceCredit: "0",
  distributionRightsConfirmed: true,
  ...overrides,
});
```

Change the return to `return { ...f, credits, skill, fund, materials, materialFile, draftInput };`.

- [ ] **Step 2: Write the failing test** — `test/materials/lifecycle.test.mjs`

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("owner material lifecycle on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const other = await f.account();
    let material;
    await t.test("creates a DRAFT without a file", async () => {
      material = await f.materials.create(owner.principal, f.draftInput());
      assert.equal(material.status, "DRAFT");
      assert.equal(material.priceCredit, "0.00");
      assert.equal(material.file, null);
      assert.equal("storageKey" in material, false);
    });
    await t.test("rejects invalid price and inactive skill", async () => {
      await assert.rejects(
        f.materials.create(owner.principal, f.draftInput({ priceCredit: "5" })),
        /MATERIAL_PRICE_INVALID/,
      );
      await assert.rejects(
        f.materials.create(
          owner.principal,
          f.draftInput({ skillId: randomUUID() }),
        ),
        /MATERIAL_SKILL_INVALID/,
      );
    });
    await t.test("submit needs a file", async () => {
      await assert.rejects(
        f.materials.submit(owner.principal, material.id),
        /MATERIAL_FILE_REQUIRED/,
      );
    });
    await t.test(
      "attaching a file needs rights confirmation and the current version",
      async () => {
        const file = await f.materialFile(owner);
        await assert.rejects(
          f.materials.update(owner.principal, material.id, {
            expectedListingVersion: 1,
            fileId: file.id,
          }),
          /MATERIAL_RIGHTS_CONFIRMATION_REQUIRED/,
        );
        await assert.rejects(
          f.materials.update(owner.principal, material.id, {
            expectedListingVersion: 9,
            fileId: file.id,
            distributionRightsConfirmed: true,
          }),
          /MATERIAL_VERSION_CONFLICT/,
        );
        material = await f.materials.update(owner.principal, material.id, {
          expectedListingVersion: 1,
          fileId: file.id,
          distributionRightsConfirmed: true,
        });
        assert.equal(material.listingVersion, 2);
        assert.equal(material.scanStatus, "CLEAN");
        assert.equal(material.file.mimeType, "application/pdf");
      },
    );
    await t.test("other users cannot see or edit the draft", async () => {
      await assert.rejects(
        f.materials.update(other.principal, material.id, {
          expectedListingVersion: 2,
          title: "Hacked title",
        }),
        /MATERIAL_NOT_FOUND/,
      );
    });
    await t.test("submit moves DRAFT to PENDING_REVIEW", async () => {
      material = await f.materials.submit(owner.principal, material.id);
      assert.equal(material.status, "PENDING_REVIEW");
      assert.equal(material.moderationStatus, "PENDING");
      const mine = await f.materials.listMine(owner.principal);
      assert.deepEqual(
        mine.map((m) => m.id),
        [material.id],
      );
    });
    await t.test("archive stops distribution and blocks edits", async () => {
      material = await f.materials.archive(owner.principal, material.id);
      assert.equal(material.status, "ARCHIVED");
      await assert.rejects(
        f.materials.update(owner.principal, material.id, {
          expectedListingVersion: 2,
          title: "New title",
        }),
        /MATERIAL_NOT_EDITABLE/,
      );
    });
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/lifecycle.test.mjs`
Expected: FAIL, cannot find `materials.service.js`.

- [ ] **Step 4: `attachReady` returns the original name** — in `file-attachment.service.ts`, inside `attachReady`'s returned object, add `originalName: row.originalName,`. Existing consumers ignore the extra field.

- [ ] **Step 5: Views** — `src/modules/materials/application/contracts/material-view.ts`

```ts
import type {
  Material,
  MaterialOrder,
} from "../../../../generated/prisma/client";
import { formatCredit } from "../../../credit/domain/money";

/** Metadata/preview only; the storage key never leaves the API (FR-MAT-03). */
export function publicMaterialView(material: Material) {
  return {
    id: material.id,
    ownerId: material.ownerId,
    skillId: material.skillId,
    title: material.title,
    description: material.description,
    accessType: material.accessType,
    priceCredit: formatCredit(material.priceCredit),
    listingVersion: material.listingVersion,
    status: material.status,
    file: material.mimeType
      ? {
          originalFilename: material.originalFilename,
          mimeType: material.mimeType,
          sizeBytes: material.sizeBytes?.toString() ?? null,
        }
      : null,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

/** Owner and moderator projection: adds review state, still no storage key. */
export function ownerMaterialView(material: Material) {
  return {
    ...publicMaterialView(material),
    scanStatus: material.scanStatus,
    moderationStatus: material.moderationStatus,
    rejectReason: material.rejectReason,
    reviewedAt: material.reviewedAt,
    distributionRightsConfirmedAt: material.distributionRightsConfirmedAt,
  };
}

export function orderView(order: MaterialOrder) {
  return {
    id: order.id,
    materialId: order.materialId,
    sellerId: order.sellerId,
    listingVersion: order.listingVersion,
    grossCredit: formatCredit(order.grossCredit),
    feeAmount: formatCredit(order.feeAmount),
    sellerNetCredit: formatCredit(order.sellerNetCredit),
    status: order.status,
    createdAt: order.createdAt,
  };
}
```

- [ ] **Step 6: Support helpers** — `src/modules/materials/application/services/material-support.ts`

```ts
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Actor,
  RoleCode,
} from "../../../../shared/authorization/authorization.types";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
import type { Principal } from "../../../auth/application/services/sessions.service";

export function roleCodes(principal: Principal): RoleCode[] {
  return principal.roles.filter(
    (role): role is RoleCode =>
      role === "USER" || role === "STAFF" || role === "ADMIN",
  );
}

export function storageActor(principal: Principal): Actor {
  return {
    userId: principal.userId,
    accountStatus: "ACTIVE",
    roles: roleCodes(principal),
    permissions: new Set(principal.permissions as PermissionCode[]),
    blockedPermissions: new Set(),
  };
}

export function requirePermission(
  principal: Principal,
  code: PermissionCode,
): void {
  if (!principal.permissions.includes(code))
    throw new ForbiddenException("MATERIAL_PERMISSION_REQUIRED");
}

export function isModerator(principal: Principal): boolean {
  return (
    principal.permissions.includes("material:moderate") &&
    (principal.roles.includes("STAFF") || principal.roles.includes("ADMIN"))
  );
}

export function requireModerator(principal: Principal): void {
  if (!isModerator(principal))
    throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
}

export function auditContext() {
  return { requestId: randomUUID(), correlationId: randomUUID() };
}

/** Row lock serializes edits, moderation and purchases of one material. */
export async function lockMaterial(tx: TransactionContext, id: string) {
  await tx.$queryRaw`SELECT material_id FROM materials WHERE material_id = ${id}::uuid FOR UPDATE`;
  const material = await tx.material.findUnique({ where: { id } });
  if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
  return material;
}
```

- [ ] **Step 7: Owner service** — `src/modules/materials/application/services/materials.service.ts`

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { formatCredit } from "../../../credit/domain/money";
import {
  assertArchivable,
  assertPublishableFile,
  listingText,
  priceUnits,
  statusAfterEdit,
  type MaterialAccess,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
  lockMaterial,
  requirePermission,
  storageActor,
} from "./material-support";

export type CreateMaterialInput = {
  skillId: string;
  title: string;
  description: string;
  accessType: MaterialAccess;
  priceCredit: string;
  distributionRightsConfirmed: boolean;
  fileId?: string;
};

export type UpdateMaterialInput = {
  expectedListingVersion: number;
  skillId?: string;
  title?: string;
  description?: string;
  accessType?: MaterialAccess;
  priceCredit?: string;
  fileId?: string;
  distributionRightsConfirmed?: boolean;
};

@Injectable()
export class MaterialsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
  ) {}

  upload(
    principal: Principal,
    input: {
      name: string;
      claimedMime: string;
      body: Readable;
      correlationId: string;
    },
  ) {
    requirePermission(principal, "material:create:self");
    return this.storage.upload({
      actor: storageActor(principal),
      purpose: "MATERIAL",
      name: input.name,
      claimedMime: input.claimedMime,
      body: input.body,
      context: { correlationId: input.correlationId },
    });
  }

  fileStatus(principal: Principal, fileId: string) {
    return this.attachments.status(principal, fileId);
  }

  listMine(principal: Principal) {
    return this.transactions.run(async (tx) => {
      // ponytail: newest 100 only; add cursor pagination when an owner exceeds it.
      const rows = await tx.material.findMany({
        where: { ownerId: principal.userId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return rows.map(ownerMaterialView);
    });
  }

  create(principal: Principal, input: CreateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    const text = listingText(input);
    const priceCredit = priceUnits(input.accessType, input.priceCredit);
    return this.transactions.run(async (tx) => {
      await assertActiveSkill(tx, input.skillId);
      const id = randomUUID();
      const file = input.fileId
        ? await this.attachFile(tx, principal, input.fileId, id)
        : {};
      const created = await tx.material.create({
        data: {
          id,
          ownerId: principal.userId,
          skillId: input.skillId,
          ...text,
          accessType: input.accessType,
          priceCredit,
          listingVersion: 1,
          moderationStatus: "NONE",
          status: "DRAFT",
          distributionRightsConfirmedAt: new Date(),
          ...file,
        },
      });
      return ownerMaterialView(created);
    });
  }

  update(principal: Principal, id: string, input: UpdateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.fileId && input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.listingVersion !== input.expectedListingVersion)
        throw new ConflictException("MATERIAL_VERSION_CONFLICT");
      const status = statusAfterEdit(current.status);
      const text = listingText({
        title: input.title ?? current.title,
        description: input.description ?? current.description,
      });
      const accessType = input.accessType ?? current.accessType;
      const priceCredit = priceUnits(
        accessType,
        input.priceCredit ?? formatCredit(current.priceCredit),
      );
      if (input.skillId) await assertActiveSkill(tx, input.skillId);
      const file = input.fileId
        ? {
            ...(await this.attachFile(tx, principal, input.fileId, id)),
            distributionRightsConfirmedAt: new Date(),
          }
        : {};
      const updated = await tx.material.update({
        where: { id },
        data: {
          ...text,
          skillId: input.skillId ?? current.skillId,
          accessType,
          priceCredit,
          ...file,
          status,
          listingVersion: { increment: 1 },
          ...(current.status === "PUBLISHED"
            ? { moderationStatus: "PENDING" }
            : {}),
          ...(status === "DRAFT" ? { rejectReason: null } : {}),
        },
      });
      return ownerMaterialView(updated);
    });
  }

  submit(principal: Principal, id: string) {
    requirePermission(principal, "material:create:self");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.status !== "DRAFT")
        throw new ConflictException("MATERIAL_TRANSITION_INVALID");
      assertPublishableFile(current);
      const updated = await tx.material.update({
        where: { id },
        data: { status: "PENDING_REVIEW", moderationStatus: "PENDING" },
      });
      return ownerMaterialView(updated);
    });
  }

  archive(principal: Principal, id: string) {
    requirePermission(principal, "material:create:self");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      assertArchivable(current.status);
      const updated = await tx.material.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
      return ownerMaterialView(updated);
    });
  }

  /** Binds a READY/CLEAN upload once; the previous object stays bound for buyers (D5). */
  private async attachFile(
    tx: TransactionContext,
    principal: Principal,
    fileId: string,
    materialId: string,
  ) {
    const file = await this.attachments.attachReady(tx, principal, fileId, {
      type: "MATERIAL",
      id: materialId,
      purpose: "MATERIAL",
    });
    return {
      storageKey: file.key,
      originalFilename: file.originalName,
      mimeType: file.mime,
      sizeBytes: BigInt(file.size),
      checksum: file.checksum,
      scanStatus: "CLEAN",
      uploadedAt: file.uploadedAt,
    };
  }
}

/** Other owners' materials get the same 404 as missing ones (no existence oracle). */
async function lockOwned(tx: TransactionContext, id: string, ownerId: string) {
  const material = await lockMaterial(tx, id);
  if (material.ownerId !== ownerId)
    throw new NotFoundException("MATERIAL_NOT_FOUND");
  return material;
}

async function assertActiveSkill(tx: TransactionContext, skillId: string) {
  const skill = await tx.skill.findUnique({
    where: { id: skillId },
    select: { status: true },
  });
  if (skill?.status !== "ACTIVE")
    throw new BadRequestException("MATERIAL_SKILL_INVALID");
}
```

- [ ] **Step 8: DTOs** — `src/modules/materials/presentation/http/materials.dto.ts`. Later tasks import from this file, so it is written once here:

```ts
import { Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { REPORT_REASON_CODES } from "../../../reports/presentation/http/reports.dto";

const ACCESS = ["FREE", "PAID"] as const;
const STATES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
] as const;

export class CreateMaterialDto {
  @IsUUID("4") skillId!: string;
  @IsString() @MinLength(5) @MaxLength(150) title!: string;
  @IsString() @MinLength(10) @MaxLength(3000) description!: string;
  @IsIn(ACCESS) accessType!: (typeof ACCESS)[number];
  /** Decimal Credit text, for example "0" or "25.50". */
  @IsString() @MaxLength(13) priceCredit!: string;
  /** BR-42: the owner confirms they may distribute this content. */
  @Equals(true) distributionRightsConfirmed!: boolean;
  @IsOptional() @IsUUID("4") fileId?: string;
}

export class UpdateMaterialDto {
  @IsInt() @Min(1) expectedListingVersion!: number;
  @IsOptional() @IsUUID("4") skillId?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(150) title?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description?: string;
  @IsOptional() @IsIn(ACCESS) accessType?: (typeof ACCESS)[number];
  @IsOptional() @IsString() @MaxLength(13) priceCredit?: string;
  @IsOptional() @IsUUID("4") fileId?: string;
  @IsOptional() @IsBoolean() distributionRightsConfirmed?: boolean;
}

export class MaterialQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID("4") skillId?: string;
  @IsOptional() @IsIn(ACCESS) accessType?: (typeof ACCESS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class StaffMaterialQueryDto {
  @IsOptional() @IsIn(STATES) status?: (typeof STATES)[number];
}

export class PurchaseMaterialDto {
  @IsInt() @Min(1) expectedListingVersion!: number;
}

export class ModerateMaterialDto {
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ReportMaterialDto {
  @IsIn(REPORT_REASON_CODES) reasonCode!: (typeof REPORT_REASON_CODES)[number];
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
}
```

- [ ] **Step 9: Owner controller** — `src/modules/materials/presentation/http/my-materials.controller.ts`

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Readable } from "node:stream";
import {
  CurrentIdentity,
  IdentityGuard,
  type IdentityRequest,
} from "../../../../shared/auth/identity.guard";
import { getOrCreateRequestContext } from "../../../../shared/http/request-context";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialsService } from "../../application/services/materials.service";
import { CreateMaterialDto, UpdateMaterialDto } from "./materials.dto";

@ApiTags("materials")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "me/materials", version: "1" })
export class MyMaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Post("files")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20_000_000, files: 1, fields: 0 },
    }),
  )
  async upload(
    @Req() req: IdentityRequest,
    @CurrentIdentity() actor: Principal,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("FILE_REQUIRED");
    return success(
      await this.materials.upload(actor, {
        name: file.originalname,
        claimedMime: file.mimetype,
        body: Readable.from(file.buffer),
        correlationId: getOrCreateRequestContext(req).correlationId,
      }),
      "Material file upload accepted.",
    );
  }

  @Get("files/:fileId")
  async fileStatus(
    @CurrentIdentity() actor: Principal,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return success(await this.materials.fileStatus(actor, fileId));
  }

  @Get()
  async mine(@CurrentIdentity() actor: Principal) {
    return success(await this.materials.listMine(actor));
  }

  @Post()
  async create(
    @CurrentIdentity() actor: Principal,
    @Body() body: CreateMaterialDto,
  ) {
    return success(
      await this.materials.create(actor, body),
      "Material draft created.",
    );
  }

  @Patch(":materialId")
  async update(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Body() body: UpdateMaterialDto,
  ) {
    return success(
      await this.materials.update(actor, id, body),
      "Material updated.",
    );
  }

  @Post(":materialId/submit")
  async submit(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(
      await this.materials.submit(actor, id),
      "Material submitted for review.",
    );
  }

  @Post(":materialId/archive")
  async archive(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(
      await this.materials.archive(actor, id),
      "Material archived.",
    );
  }
}
```

- [ ] **Step 10: Module + registration** — `src/modules/materials/materials.module.ts`

```ts
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { IdentityModule } from "../identity.module";
import { MaterialsService } from "./application/services/materials.service";
import { MyMaterialsController } from "./presentation/http/my-materials.controller";

@Module({
  imports: [DatabaseModule, StorageModule, IdentityModule],
  controllers: [MyMaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
```

In `src/app.module.ts` add `import { MaterialsModule } from "./modules/materials/materials.module";` and list `MaterialsModule` after `PaymentsModule` in `imports`.

- [ ] **Step 11: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/lifecycle.test.mjs; pnpm test:files`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/infrastructure/storage/file-attachment.service.ts src/modules/materials src/app.module.ts test/materials
git commit -m "feat(api): add material owner upload and draft lifecycle"
```

---

### Task 5: Staff moderation (SH-116, SH-119)

**Files:**

- Create: `src/modules/materials/application/services/material-moderation.service.ts`
- Create: `src/modules/materials/presentation/http/material-moderation.controller.ts`
- Modify: `src/modules/materials/materials.module.ts` (import `AuditModule`, add provider and controller)
- Modify: `test/materials/fixture.mjs`
- Modify: `test/materials/lifecycle.test.mjs`

**Interfaces:**

- Consumes: `lockMaterial`, `requireModerator`, `roleCodes`, `auditContext` (Task 4); `moderationTransition`, `assertPublishableFile` (Task 1).
- Produces: `MaterialModerationService.queue(principal, status?)` and `MaterialModerationService.moderate(principal, id, action, reason?)`; fixture `f.moderation` and `f.publishedMaterial(owner, overrides?)` → owner view of a PUBLISHED material.

- [ ] **Step 1: Extend the fixture**

```js
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
```

Inside the factory:

```js
const moderation = new MaterialModerationService(f.transactions, f.audit);
const moderator = await f.account("STAFF");
/** Create → attach file → submit → approve, through the real services. */
async function publishedMaterial(owner, overrides = {}) {
  const file = await materialFile(owner);
  const draft = await materials.create(
    owner.principal,
    draftInput({ fileId: file.id, ...overrides }),
  );
  await materials.submit(owner.principal, draft.id);
  return moderation.moderate(moderator.principal, draft.id, "approve");
}
```

Add `moderation, moderator, publishedMaterial` to the returned object.

- [ ] **Step 2: Write the failing test** — append inside the `try` of `test/materials/lifecycle.test.mjs`, after the archive subtest:

```js
await t.test(
  "staff approve, reject with reason, hide and unhide with audit",
  async () => {
    const published = await f.publishedMaterial(owner);
    assert.equal(published.status, "PUBLISHED");
    assert.equal(published.moderationStatus, "APPROVED");
    await assert.rejects(
      f.moderation.moderate(owner.principal, published.id, "hide", "spam"),
      /STAFF_ACCESS_REQUIRED/,
    );
    await assert.rejects(
      f.moderation.moderate(f.moderator.principal, published.id, "hide"),
      /MATERIAL_REASON_REQUIRED/,
    );
    const hidden = await f.moderation.moderate(
      f.moderator.principal,
      published.id,
      "hide",
      "Copyright claim",
    );
    assert.equal(hidden.status, "HIDDEN");
    await assert.rejects(
      f.materials.update(owner.principal, published.id, {
        expectedListingVersion: hidden.listingVersion,
        title: "Escaping review",
      }),
      /MATERIAL_NOT_EDITABLE/,
    );
    const restored = await f.moderation.moderate(
      f.moderator.principal,
      published.id,
      "unhide",
      "Claim withdrawn",
    );
    assert.equal(restored.status, "PUBLISHED");
    const audits = await f.db.auditLog.count({
      where: { action: "MATERIAL_MODERATE", targetId: published.id },
    });
    assert.equal(audits, 3);
  },
);
await t.test("editing a PUBLISHED material returns it to review", async () => {
  const live = await f.publishedMaterial(owner);
  const edited = await f.materials.update(owner.principal, live.id, {
    expectedListingVersion: live.listingVersion,
    description: "Updated description text",
  });
  assert.equal(edited.status, "PENDING_REVIEW");
  const rejected = await f.moderation.moderate(
    f.moderator.principal,
    live.id,
    "reject",
    "Needs clearer scope",
  );
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.rejectReason, "Needs clearer scope");
  const queue = await f.moderation.queue(f.moderator.principal, "REJECTED");
  assert.ok(queue.some((m) => m.id === live.id));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/lifecycle.test.mjs`
Expected: FAIL, cannot find `material-moderation.service.js`.

- [ ] **Step 4: Moderation service** — `src/modules/materials/application/services/material-moderation.service.ts`

```ts
import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  assertPublishableFile,
  moderationTransition,
  type MaterialState,
  type ModerationAction,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
  auditContext,
  lockMaterial,
  requireModerator,
  roleCodes,
} from "./material-support";

@Injectable()
export class MaterialModerationService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  queue(principal: Principal, status: MaterialState = "PENDING_REVIEW") {
    requireModerator(principal);
    return this.transactions.run(async (tx) => {
      // ponytail: oldest 100 first; paginate when the queue grows past it.
      const rows = await tx.material.findMany({
        where: { status },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: 100,
      });
      return rows.map(ownerMaterialView);
    });
  }

  /** FR-MAT-06: every decision that changes access carries a reason and an audit row. */
  moderate(
    principal: Principal,
    id: string,
    action: ModerationAction,
    reason?: string,
  ) {
    requireModerator(principal);
    const defaultNote = action === "approve" ? "Material approved" : "";
    const note = reason?.trim() || defaultNote;
    if (!note) throw new BadRequestException("MATERIAL_REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      const current = await lockMaterial(tx, id);
      const next = moderationTransition(action, current.status);
      if (next.status === "PUBLISHED") assertPublishableFile(current);
      const updated = await tx.material.update({
        where: { id },
        data: {
          status: next.status,
          moderationStatus: next.decision,
          reviewedByUserId: principal.userId,
          reviewedAt: new Date(),
          ...(action === "reject" ? { rejectReason: note } : {}),
        },
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_MODERATE",
        target: { type: "MATERIAL", id },
        before: {
          status: current.status,
          listingVersion: current.listingVersion,
        },
        after: {
          status: updated.status,
          listingVersion: updated.listingVersion,
        },
        reason: note,
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL",
          aggregateId: id,
          version: updated.listingVersion,
          type: "material.moderated",
          payload: {
            materialId: id,
            ownerId: updated.ownerId,
            action,
            status: updated.status,
          },
          dedupeKey: `material-moderated:${id}:${updated.updatedAt.toISOString()}`,
          correlationId: randomUUID(),
        },
      });
      return ownerMaterialView(updated);
    });
  }
}
```

- [ ] **Step 5: Moderation controller** — `src/modules/materials/presentation/http/material-moderation.controller.ts`

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialModerationService } from "../../application/services/material-moderation.service";
import {
  MODERATION_ACTIONS,
  type ModerationAction,
} from "../../domain/material.policy";
import { ModerateMaterialDto, StaffMaterialQueryDto } from "./materials.dto";

@ApiTags("material-moderation")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "staff/materials", version: "1" })
export class MaterialModerationController {
  constructor(private readonly moderation: MaterialModerationService) {}

  @Get()
  async queue(
    @CurrentIdentity() actor: Principal,
    @Query() query: StaffMaterialQueryDto,
  ) {
    return success(await this.moderation.queue(actor, query.status));
  }

  @Post(":materialId/:action")
  async moderate(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Param("action") action: string,
    @Body() body: ModerateMaterialDto,
  ) {
    if (!MODERATION_ACTIONS.includes(action as ModerationAction))
      throw new BadRequestException("INVALID_MATERIAL_ACTION");
    return success(
      await this.moderation.moderate(
        actor,
        id,
        action as ModerationAction,
        body.reason,
      ),
      "Material moderated.",
    );
  }
}
```

- [ ] **Step 6: Wire the module** — `materials.module.ts`: add `AuditModule` (`import { AuditModule } from "../audit/audit.module";`) to `imports`, `MaterialModerationService` to `providers` and `MaterialModerationController` to `controllers`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/lifecycle.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/materials test/materials
git commit -m "feat(api/materials): add staff review, hide and restore with audit"
```

---

### Task 6: Public search/detail and entitlement-protected download (SH-117)

**Files:**

- Create: `src/modules/materials/application/services/material-catalog.service.ts`
- Create: `src/modules/materials/presentation/http/public-materials.controller.ts`
- Create: `src/modules/materials/presentation/http/material-access.controller.ts`
- Modify: `src/modules/materials/materials.module.ts`
- Modify: `test/materials/fixture.mjs`
- Test: `test/materials/access.test.mjs`

**Interfaces:**

- Consumes: Tasks 4–5 helpers; `snapshotStorageKey` (Task 1); `FileStorageService.issueDownload`; `FileAttachmentService.assertBoundReady`.
- Produces: `MaterialCatalogService.search(query) → { data, pagination: { page, limit, total } }`, `.detail(id)`, `.download(principal, id) → { url, expiresAt }`; fixture `f.catalog`.

- [ ] **Step 1: Extend the fixture**

```js
import { MaterialCatalogService } from "../../dist/modules/materials/application/services/material-catalog.service.js";
```

Inside: `const catalog = new MaterialCatalogService(f.transactions, f.storage, f.attachments);` and add `catalog` to the return.

- [ ] **Step 2: Write the failing test** — `test/materials/access.test.mjs`

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material search, preview and download rules on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const owner = await f.account();
    const reader = await f.account();
    const free = await f.publishedMaterial(owner, {
      title: "Kubernetes primer",
    });
    const paid = await f.publishedMaterial(owner, {
      title: "Paid Kubernetes deep dive",
      accessType: "PAID",
      priceCredit: "20",
    });
    const draft = await f.materials.create(
      owner.principal,
      f.draftInput({ title: "Secret draft" }),
    );
    await t.test("search returns only PUBLISHED metadata", async () => {
      const result = await f.catalog.search({
        q: "kubernetes",
        page: 1,
        limit: 20,
      });
      assert.deepEqual(
        new Set(result.data.map((m) => m.id)),
        new Set([free.id, paid.id]),
      );
      assert.equal(result.pagination.total, 2);
      const body = JSON.stringify(result);
      assert.equal(body.includes("storageKey"), false);
      assert.equal(body.includes("fixture/"), false);
      const paidOnly = await f.catalog.search({
        accessType: "PAID",
        page: 1,
        limit: 20,
      });
      assert.deepEqual(
        paidOnly.data.map((m) => m.id),
        [paid.id],
      );
    });
    await t.test("detail hides unpublished materials", async () => {
      assert.equal((await f.catalog.detail(paid.id)).priceCredit, "20.00");
      await assert.rejects(f.catalog.detail(draft.id), /MATERIAL_NOT_FOUND/);
    });
    await t.test("FREE downloads with a short-lived URL", async () => {
      const link = await f.catalog.download(reader.principal, free.id);
      assert.match(link.url, /^https:\/\/fixture\.invalid\/private/);
      assert.ok(link.expiresAt instanceof Date);
    });
    await t.test(
      "PAID without entitlement is denied, owner is allowed",
      async () => {
        await assert.rejects(
          f.catalog.download(reader.principal, paid.id),
          /MATERIAL_ACCESS_DENIED/,
        );
        assert.ok((await f.catalog.download(owner.principal, paid.id)).url);
      },
    );
    await t.test("HIDDEN blocks readers but not the moderator", async () => {
      await f.moderation.moderate(
        f.moderator.principal,
        free.id,
        "hide",
        "Under review",
      );
      await assert.rejects(
        f.catalog.download(reader.principal, free.id),
        /MATERIAL_NOT_PUBLISHED/,
      );
      assert.ok((await f.catalog.download(f.moderator.principal, free.id)).url);
    });
    await t.test("a file that turned unsafe is not served", async () => {
      await f.db.storedFile.updateMany({
        where: { resourceType: "MATERIAL", resourceId: paid.id },
        data: { scanVerdict: "INFECTED" },
      });
      await assert.rejects(
        f.catalog.download(owner.principal, paid.id),
        /FILE_NOT_READY/,
      );
    });
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/access.test.mjs`
Expected: FAIL, cannot find `material-catalog.service.js`.

- [ ] **Step 4: Catalog service** — `src/modules/materials/application/services/material-catalog.service.ts`

```ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Material, Prisma } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  snapshotStorageKey,
  type MaterialAccess,
} from "../../domain/material.policy";
import { publicMaterialView } from "../contracts/material-view";
import {
  isModerator,
  requirePermission,
  storageActor,
} from "./material-support";

const LISTED = { status: "PUBLISHED", scanStatus: "CLEAN" } as const;

@Injectable()
export class MaterialCatalogService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
  ) {}

  search(query: {
    q?: string;
    skillId?: string;
    accessType?: MaterialAccess;
    page: number;
    limit: number;
  }) {
    const q = query.q?.trim();
    const where: Prisma.MaterialWhereInput = {
      ...LISTED,
      ...(query.skillId ? { skillId: query.skillId } : {}),
      ...(query.accessType ? { accessType: query.accessType } : {}),
      // ponytail: ILIKE scan; add a pg_trgm index when the catalog outgrows it.
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(
      async (tx) => {
        const rows = await tx.material.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.material.count({ where });
        return {
          data: rows.map(publicMaterialView),
          pagination: { page: query.page, limit: query.limit, total },
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async detail(id: string) {
    const material = await this.transactions.run(
      (tx) => tx.material.findFirst({ where: { id, ...LISTED } }),
      { isolationLevel: "ReadCommitted" },
    );
    if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
    return publicMaterialView(material);
  }

  /** FR-MAT-04: authorize every download, then sign a short-lived URL. */
  async download(principal: Principal, id: string) {
    const fileId = await this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({ where: { id } });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const objectKey = await this.downloadKey(tx, principal, material);
      const stored = await tx.storedFile.findFirst({
        where: {
          objectKey,
          resourceType: "MATERIAL",
          resourceId: id,
          purpose: "MATERIAL",
        },
        select: { id: true },
      });
      if (!stored) throw new NotFoundException("MATERIAL_FILE_NOT_FOUND");
      await this.attachments.assertBoundReady(tx, stored.id, {
        type: "MATERIAL",
        id,
      });
      return stored.id;
    });
    return this.storage.issueDownload(
      {
        actor: storageActor(principal),
        fileId,
        resource: { type: "MATERIAL", id },
      },
      // Authorization already ran inside the transaction above.
      { assertRead: () => Promise.resolve() },
    );
  }

  /** Owner/moderator: current file. FREE: PUBLISHED only. PAID: the purchased snapshot (D4, D5, D9). */
  private async downloadKey(
    tx: TransactionContext,
    principal: Principal,
    material: Material,
  ): Promise<string> {
    if (material.ownerId === principal.userId || isModerator(principal)) {
      if (!material.storageKey)
        throw new ConflictException("MATERIAL_FILE_REQUIRED");
      return material.storageKey;
    }
    requirePermission(principal, "material:access");
    if (material.accessType === "FREE") {
      if (material.status !== "PUBLISHED" || !material.storageKey)
        throw new ConflictException("MATERIAL_NOT_PUBLISHED");
      return material.storageKey;
    }
    if (material.status !== "PUBLISHED" && material.status !== "ARCHIVED")
      throw new ConflictException("MATERIAL_NOT_PUBLISHED");
    const entitlement = await tx.materialEntitlement.findUnique({
      where: {
        userId_materialId: {
          userId: principal.userId,
          materialId: material.id,
        },
      },
      include: { sourceOrderIdRecord: true },
    });
    if (entitlement?.status !== "ACTIVE" || !entitlement.sourceOrderIdRecord)
      throw new ForbiddenException("MATERIAL_ACCESS_DENIED");
    return snapshotStorageKey(
      entitlement.sourceOrderIdRecord.purchasedFileSnapshot,
    );
  }
}
```

- [ ] **Step 5: Public controller** — `src/modules/materials/presentation/http/public-materials.controller.ts`

```ts
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { paginated, success } from "../../../../shared/http/response";
import { MaterialCatalogService } from "../../application/services/material-catalog.service";
import { MaterialQueryDto } from "./materials.dto";

/** Share links open metadata/preview only (FR-MAT-03); no identity required. */
@ApiTags("materials")
@Controller({ path: "materials", version: "1" })
export class PublicMaterialsController {
  constructor(private readonly catalog: MaterialCatalogService) {}

  @Get()
  async search(@Query() query: MaterialQueryDto) {
    const result = await this.catalog.search(query);
    return paginated(result.data, result.pagination);
  }

  @Get(":materialId")
  async detail(@Param("materialId", ParseUUIDPipe) id: string) {
    return success(await this.catalog.detail(id));
  }
}
```

- [ ] **Step 6: Access controller** — `src/modules/materials/presentation/http/material-access.controller.ts`. Tasks 7 and 8 add routes here.

```ts
import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { success } from "../../../../shared/http/response";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { MaterialCatalogService } from "../../application/services/material-catalog.service";

@ApiTags("materials")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ version: "1" })
export class MaterialAccessController {
  constructor(private readonly catalog: MaterialCatalogService) {}

  @Get("materials/:materialId/download")
  @Header("Cache-Control", "no-store")
  async download(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
  ) {
    return success(await this.catalog.download(actor, id));
  }
}
```

- [ ] **Step 7: Wire the module** — add `MaterialCatalogService` to `providers`, and `PublicMaterialsController` and `MaterialAccessController` to `controllers`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/access.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/materials test/materials
git commit -m "feat(api/materials): add material search, preview and authorized download"
```

---

### Task 7: Atomic, idempotent PAID purchase (SH-118)

**Files:**

- Create: `src/modules/materials/application/services/material-purchase.service.ts`
- Modify: `src/modules/materials/presentation/http/material-access.controller.ts`
- Modify: `src/modules/materials/materials.module.ts` (import `CreditModule`)
- Modify: `test/materials/fixture.mjs`
- Test: `test/materials/purchase.test.mjs`

**Interfaces:**

- Consumes: `CreditOperationsService.purchaseMaterial` (Task 3); `materialFee`, `PurchasedFileSnapshot`, `assertPublishableFile` (Task 1); `lockMaterial`, `requirePermission`, `roleCodes`, `auditContext`, `orderView` (Task 4).
- Produces: `MaterialPurchaseService.purchase(principal, materialId, expectedListingVersion, idempotencyKey) → { order, replayed }` and `.listOrders(principal)`; fixture `f.purchases`.

- [ ] **Step 1: Extend the fixture**

```js
import { MaterialPurchaseService } from "../../dist/modules/materials/application/services/material-purchase.service.js";
```

Inside: `const purchases = new MaterialPurchaseService(f.transactions, credits, f.audit);` and add `purchases` to the return.

- [ ] **Step 2: Write the failing test** — `test/materials/purchase.test.mjs`

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

const available = async (f, account) =>
  (await f.db.creditWallet.findUnique({ where: { userId: account.user.id } }))
    ?.availableCredit ?? 0n;

test("PAID material purchase on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const seller = await f.account();
    const buyer = await f.account();
    await f.fund(buyer, 5000n); // 50.00 Credit
    const paid = await f.publishedMaterial(seller, {
      accessType: "PAID",
      priceCredit: "20",
    });
    const buy = (account, key = randomUUID(), version = paid.listingVersion) =>
      f.purchases.purchase(account.principal, paid.id, version, key);

    await t.test(
      "rejects self purchase, stale price and missing key",
      async () => {
        await assert.rejects(buy(seller), /MATERIAL_SELF_PURCHASE/);
        await assert.rejects(
          buy(buyer, randomUUID(), paid.listingVersion + 1),
          /MATERIAL_PRICE_CHANGED/,
        );
        await assert.rejects(buy(buyer, ""), /IDEMPOTENCY_KEY_REQUIRED/);
      },
    );
    let first;
    await t.test(
      "charges 20.00, pays seller 19.00, grants entitlement",
      async () => {
        first = await buy(buyer, "order-1");
        assert.equal(first.replayed, false);
        assert.equal(first.order.grossCredit, "20.00");
        assert.equal(first.order.feeAmount, "1.00");
        assert.equal(first.order.sellerNetCredit, "19.00");
        assert.equal(await available(f, buyer), 3000n);
        assert.equal(await available(f, seller), 1900n);
        const link = await f.catalog.download(buyer.principal, paid.id);
        assert.ok(link.url);
      },
    );
    await t.test("retry and re-purchase never charge twice", async () => {
      const retry = await buy(buyer, "order-1");
      const again = await buy(buyer, "order-2");
      assert.equal(retry.replayed, true);
      assert.equal(again.replayed, true);
      assert.equal(retry.order.id, first.order.id);
      assert.equal(again.order.id, first.order.id);
      assert.equal(await available(f, buyer), 3000n);
      assert.equal(await f.db.materialOrder.count(), 1);
    });
    await t.test("concurrent purchases by one buyer charge once", async () => {
      const racer = await f.account();
      await f.fund(racer, 5000n);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => buy(racer)),
      );
      assert.equal(new Set(results.map((r) => r.order.id)).size, 1);
      assert.equal(await available(f, racer), 3000n);
    });
    await t.test(
      "insufficient balance fails without order or entitlement",
      async () => {
        const poor = await f.account();
        await f.fund(poor, 1000n);
        await assert.rejects(buy(poor), /INSUFFICIENT_AVAILABLE_CREDIT/);
        assert.equal(
          await f.db.materialEntitlement.count({
            where: { userId: poor.user.id },
          }),
          0,
        );
        assert.equal(await available(f, poor), 1000n);
      },
    );
    await t.test(
      "price change keeps the old order and file snapshot",
      async () => {
        const file = await f.materialFile(seller);
        const edited = await f.materials.update(seller.principal, paid.id, {
          expectedListingVersion: paid.listingVersion,
          priceCredit: "30",
          fileId: file.id,
          distributionRightsConfirmed: true,
        });
        await f.moderation.moderate(f.moderator.principal, paid.id, "approve");
        const order = await f.db.materialOrder.findUniqueOrThrow({
          where: { id: first.order.id },
        });
        assert.equal(order.grossCredit, 2000n);
        assert.notEqual(order.purchasedFileSnapshot.storageKey, file.objectKey);
        assert.ok((await f.catalog.download(buyer.principal, paid.id)).url);
        assert.equal(edited.priceCredit, "30.00");
      },
    );
    await t.test("HIDDEN blocks new purchases", async () => {
      await f.moderation.moderate(
        f.moderator.principal,
        paid.id,
        "hide",
        "Copyright claim",
      );
      const late = await f.account();
      await f.fund(late, 5000n);
      const current = await f.db.material.findUniqueOrThrow({
        where: { id: paid.id },
      });
      await assert.rejects(
        f.purchases.purchase(
          late.principal,
          paid.id,
          current.listingVersion,
          randomUUID(),
        ),
        /MATERIAL_NOT_PUBLISHED/,
      );
    });
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/purchase.test.mjs`
Expected: FAIL, cannot find `material-purchase.service.js`.

- [ ] **Step 4: Purchase service** — `src/modules/materials/application/services/material-purchase.service.ts`

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Material } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { CreditOperationsService } from "../../../credit/application/services/credit-operations.service";
import {
  assertPublishableFile,
  materialFee,
  type PurchasedFileSnapshot,
} from "../../domain/material.policy";
import { orderView } from "../contracts/material-view";
import {
  auditContext,
  lockMaterial,
  requirePermission,
  roleCodes,
} from "./material-support";

@Injectable()
export class MaterialPurchaseService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly credit: CreditOperationsService,
    private readonly audit: AuditWriter,
  ) {}

  /**
   * FR-MAT-05 / BR-43: check, debit, credit, fee, order and entitlement commit together.
   * Retries and repeat purchases return the existing order without charging again.
   */
  purchase(
    principal: Principal,
    materialId: string,
    expectedListingVersion: number,
    idempotencyKey: string | undefined,
  ) {
    requirePermission(principal, "material:access");
    const key = orderKey(principal.userId, idempotencyKey);
    return this.transactions.run(async (tx) => {
      const replay = await tx.materialOrder.findUnique({
        where: { idempotencyKey: key },
      });
      if (replay) {
        if (replay.materialId !== materialId)
          throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
        return { order: orderView(replay), replayed: true };
      }
      const material = await lockMaterial(tx, materialId);
      const owned = await tx.materialEntitlement.findUnique({
        where: { userId_materialId: { userId: principal.userId, materialId } },
        include: { sourceOrderIdRecord: true },
      });
      if (owned?.status === "ACTIVE" && owned.sourceOrderIdRecord)
        return { order: orderView(owned.sourceOrderIdRecord), replayed: true };
      assertPurchasable(material, principal.userId, expectedListingVersion);
      const policy = await activeFeePolicy(tx);
      const { fee, net } = materialFee(material.priceCredit, policy.feeBps);
      const orderId = randomUUID();
      const { operationId } = await this.credit.purchaseMaterial(tx, {
        orderId,
        buyerId: principal.userId,
        sellerId: material.ownerId,
        gross: material.priceCredit,
        fee,
      });
      const order = await tx.materialOrder.create({
        data: {
          id: orderId,
          buyerId: principal.userId,
          sellerId: material.ownerId,
          materialId,
          purchasedFileSnapshot: fileSnapshot(material),
          listingVersion: material.listingVersion,
          grossCredit: material.priceCredit,
          feeAmount: fee,
          sellerNetCredit: net,
          feePolicyId: policy.id,
          feeSnapshot: policy.snapshot,
          operationId,
          status: "SUCCESS",
          idempotencyKey: key,
        },
      });
      await tx.materialEntitlement.create({
        data: {
          userId: principal.userId,
          materialId,
          sourceOrderId: orderId,
          sourceType: "PURCHASE",
          status: "ACTIVE",
          grantedAt: new Date(),
        },
      });
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: roleCodes(principal),
        },
        action: "MATERIAL_PURCHASE",
        target: { type: "MATERIAL_ORDER", id: orderId },
        after: {
          materialId,
          grossCredit: material.priceCredit.toString(),
          feeAmount: fee.toString(),
          operationId,
        },
        reason: "Material purchase",
        context: auditContext(),
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "MATERIAL_ORDER",
          aggregateId: orderId,
          version: 1,
          type: "material.purchased",
          payload: {
            orderId,
            materialId,
            buyerId: principal.userId,
            sellerId: material.ownerId,
          },
          dedupeKey: `material-purchased:${orderId}`,
          correlationId: randomUUID(),
        },
      });
      return { order: orderView(order), replayed: false };
    });
  }

  listOrders(principal: Principal) {
    return this.transactions.run(async (tx) => {
      // ponytail: newest 100 only; paginate when a buyer exceeds it.
      const rows = await tx.materialOrder.findMany({
        where: { buyerId: principal.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return rows.map(orderView);
    });
  }
}

/** Keys are scoped per buyer so two users can never collide on the unique column. */
function orderKey(buyerId: string, key: string | undefined): string {
  const value = key?.trim();
  if (!value || value.length > 200 || !/^[\x21-\x7e]+$/u.test(value))
    throw new BadRequestException("IDEMPOTENCY_KEY_REQUIRED");
  return `${buyerId}:${value}`;
}

function assertPurchasable(
  material: Material,
  buyerId: string,
  expectedListingVersion: number,
): void {
  if (material.ownerId === buyerId)
    throw new ConflictException("MATERIAL_SELF_PURCHASE");
  if (material.accessType !== "PAID")
    throw new ConflictException("MATERIAL_NOT_PAID");
  if (material.status !== "PUBLISHED")
    throw new ConflictException("MATERIAL_NOT_PUBLISHED");
  assertPublishableFile(material);
  if (material.listingVersion !== expectedListingVersion)
    throw new ConflictException("MATERIAL_PRICE_CHANGED");
}

function fileSnapshot(material: Material): PurchasedFileSnapshot {
  return {
    storageKey: material.storageKey as string,
    originalFilename: material.originalFilename,
    mimeType: material.mimeType,
    sizeBytes: material.sizeBytes?.toString() ?? null,
    checksum: material.checksum,
    distributionRightsConfirmedAt:
      material.distributionRightsConfirmedAt?.toISOString() ?? null,
    uploadedAt: material.uploadedAt?.toISOString() ?? null,
  };
}

/** BR-44: PAID purchase stays locked until an APPROVED, effective policy exists. */
async function activeFeePolicy(tx: TransactionContext) {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
  const policy = await tx.feePolicyVersion.findFirst({
    where: {
      policyCode: "MATERIAL_PAID",
      status: "APPROVED",
      approvedAt: { not: null },
      effectiveAt: { lte: clock.now },
    },
    orderBy: { versionNo: "desc" },
  });
  const rounding = policy?.roundingRule as {
    mode?: unknown;
    precision?: unknown;
  } | null;
  if (!policy || rounding?.mode !== "DOWN" || rounding.precision !== 2)
    throw new ConflictException("MATERIAL_FEE_POLICY_UNAVAILABLE");
  return {
    id: policy.id,
    feeBps: (policy.calculationRule as { feeBps?: unknown } | null)?.feeBps,
    snapshot: {
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      calculationRule: policy.calculationRule,
      roundingRule: policy.roundingRule,
    },
  };
}
```

- [ ] **Step 5: HTTP routes** — in `material-access.controller.ts` inject `MaterialPurchaseService` as `purchases`. Extend the imports with `Body`, `Headers`, `Post`, `Res` (`@nestjs/common`), `ApiHeader` (`@nestjs/swagger`), `import type { Response } from "express";`, and `PurchaseMaterialDto` from `./materials.dto`. Add:

```ts
  @Post("materials/:materialId/purchase")
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async purchase(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: PurchaseMaterialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.purchases.purchase(actor, id, body.expectedListingVersion, key);
    response.status(result.replayed ? 200 : 201);
    return success(result.order, "Material purchased.");
  }

  @Get("me/material-orders")
  async orders(@CurrentIdentity() actor: Principal) {
    return success(await this.purchases.listOrders(actor));
  }
```

- [ ] **Step 6: Wire the module** — add `CreditModule` (`import { CreditModule } from "../credit/credit.module";`) to `imports` and `MaterialPurchaseService` to `providers`. `CreditModule` already exports `CreditOperationsService`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/purchase.test.mjs`
Expected: PASS. If the concurrency subtest returns HTTP 500 from a unique violation instead of a replay, record the Postgres error code. Under SERIALIZABLE it should surface as 40001, which `TransactionRunner` retries.

- [ ] **Step 8: Commit**

```bash
git add src/modules/materials test/materials
git commit -m "feat(api/materials): add atomic idempotent PAID material purchase"
```

---

### Task 8: Material report hook (SH-119)

**Files:**

- Create: `src/modules/materials/application/services/material-reports.service.ts`
- Modify: `src/modules/materials/presentation/http/material-access.controller.ts`
- Modify: `src/modules/materials/materials.module.ts`
- Modify: `test/materials/fixture.mjs`
- Test: `test/materials/reports.test.mjs`

**Interfaces:**

- Consumes: `requirePermission` (Task 4); existing `ReportCase` model and the `/reports/staff/*` queue.
- Produces: `MaterialReportsService.report(principal, materialId, { reasonCode, description }) → { id, status, relatedOrderId }`; fixture `f.reports`.

- [ ] **Step 1: Extend the fixture**

```js
import { MaterialReportsService } from "../../dist/modules/materials/application/services/material-reports.service.js";
```

Inside: `const reports = new MaterialReportsService(f.transactions);` and add `reports` to the return.

- [ ] **Step 2: Write the failing test** — `test/materials/reports.test.mjs`

```js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createMaterialFixture } from "./fixture.mjs";

test("material reports on isolated PostgreSQL", async (t) => {
  const f = await createMaterialFixture();
  try {
    const seller = await f.account();
    const buyer = await f.account();
    const stranger = await f.account();
    await f.fund(buyer, 5000n);
    const paid = await f.publishedMaterial(seller, {
      accessType: "PAID",
      priceCredit: "10",
    });
    const { order } = await f.purchases.purchase(
      buyer.principal,
      paid.id,
      paid.listingVersion,
      randomUUID(),
    );
    const input = {
      reasonCode: "INAPPROPRIATE_CONTENT",
      description: "Contains copied slides",
    };
    await t.test(
      "buyer report links the order without path or session",
      async () => {
        const report = await f.reports.report(buyer.principal, paid.id, input);
        assert.equal(report.relatedOrderId, order.id);
        const row = await f.db.reportCase.findUniqueOrThrow({
          where: { id: report.id },
        });
        assert.equal(row.targetType, "MATERIAL");
        assert.equal(row.relatedMaterialId, paid.id);
        assert.equal(row.relatedPathId, null);
        assert.equal(row.blocksSettlement, false);
      },
    );
    await t.test("one active report per reporter and material", async () => {
      await assert.rejects(
        f.reports.report(buyer.principal, paid.id, input),
        /ACTIVE_MATERIAL_REPORT_EXISTS/,
      );
    });
    await t.test(
      "non-buyers can report public listings but not hidden drafts",
      async () => {
        const report = await f.reports.report(
          stranger.principal,
          paid.id,
          input,
        );
        assert.equal(report.relatedOrderId, null);
        const draft = await f.materials.create(
          seller.principal,
          f.draftInput(),
        );
        await assert.rejects(
          f.reports.report(stranger.principal, draft.id, input),
          /MATERIAL_NOT_FOUND/,
        );
      },
    );
  } finally {
    await f.dispose();
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/reports.test.mjs`
Expected: FAIL, cannot find `material-reports.service.js`.

- [ ] **Step 4: Report service** — `src/modules/materials/application/services/material-reports.service.ts`

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { requirePermission } from "./material-support";

const ACTIVE_CASE = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] as const;

/**
 * SRS 18.41: MATERIAL reports need no learningPathId/sessionId. Staff resolve them in the
 * existing /reports/staff queue; relatedOrderId is the refund hook for when OP-14 lands.
 */
@Injectable()
export class MaterialReportsService {
  constructor(private readonly transactions: TransactionRunner) {}

  report(
    principal: Principal,
    materialId: string,
    input: { reasonCode: string; description: string },
  ) {
    requirePermission(principal, "material:access");
    return this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({
        where: { id: materialId },
      });
      const entitlement = material
        ? await tx.materialEntitlement.findUnique({
            where: {
              userId_materialId: { userId: principal.userId, materialId },
            },
            select: { sourceOrderId: true },
          })
        : null;
      const visible =
        material?.status === "PUBLISHED" ||
        material?.ownerId === principal.userId ||
        entitlement !== null;
      if (!material || !visible)
        throw new NotFoundException("MATERIAL_NOT_FOUND");
      const active = await tx.reportCase.findFirst({
        where: {
          reporterId: principal.userId,
          relatedMaterialId: materialId,
          status: { in: [...ACTIVE_CASE] },
        },
        select: { id: true },
      });
      if (active) throw new ConflictException("ACTIVE_MATERIAL_REPORT_EXISTS");
      const id = randomUUID();
      const relatedOrderId = entitlement?.sourceOrderId ?? null;
      await tx.reportCase.create({
        data: {
          id,
          reporterId: principal.userId,
          targetType: "MATERIAL",
          targetId: materialId,
          relatedMaterialId: materialId,
          relatedOrderId,
          reasonCode: input.reasonCode,
          description: input.description.trim(),
          status: "OPEN",
          blocksSettlement: false,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "REPORT_CASE",
          aggregateId: id,
          version: 1,
          type: "report.material.opened",
          payload: {
            caseId: id,
            materialId,
            reporterId: principal.userId,
            relatedOrderId,
          },
          dedupeKey: `report-material-opened:${id}`,
          correlationId: randomUUID(),
        },
      });
      return { id, status: "OPEN", relatedOrderId };
    });
  }
}
```

- [ ] **Step 5: HTTP route** — inject `MaterialReportsService` as `reports` in `material-access.controller.ts`, import `ReportMaterialDto`, and add:

```ts
  @Post("materials/:materialId/reports")
  async report(
    @CurrentIdentity() actor: Principal,
    @Param("materialId", ParseUUIDPipe) id: string,
    @Body() body: ReportMaterialDto,
  ) {
    return success(await this.reports.report(actor, id, body), "Material report submitted.");
  }
```

- [ ] **Step 6: Wire the module** — add `MaterialReportsService` to `providers`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm build; node --test --test-concurrency=1 test/materials/reports.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/materials test/materials
git commit -m "feat(api/materials): add material report hook for staff review"
```

---

### Task 9: Scripts, docs and full verification

**Files:**

- Modify: `services/api/package.json` (scripts)
- Modify: `services/api/README.md` (short Learning Materials paragraph under "Phạm vi và trạng thái")

- [ ] **Step 1: Scripts** — add to `package.json` `scripts`:

```json
    "test:materials": "nest build && node --test test/materials/policy.test.mjs",
    "test:materials:integration": "node test/require-integration-env.mjs && nest build && node --test --test-concurrency=1 test/materials/schema.test.mjs test/materials/ledger.test.mjs test/materials/lifecycle.test.mjs test/materials/access.test.mjs test/materials/purchase.test.mjs test/materials/reports.test.mjs",
```

- [ ] **Step 2: README** — add one paragraph:

```markdown
Learning Materials (spec011, SH-115..119): owner upload/draft/submit, Staff review/hide,
public search/preview, authorized short-lived download and atomic PAID purchase with a 5%
MATERIAL_PAID fee. Rollout: migration `20261021000000_material_constraints` →
`pnpm db:seed-configuration` → `pnpm identity:seed`. Refund/dispute window for material
orders is still open (OP-14). See [spec](specs/011-learning-materials/spec.md).
```

- [ ] **Step 3: Full verification** (sequential, from `services/api`)

Run:

```bash
pnpm lint
pnpm check-types
pnpm build
pnpm test:materials
pnpm test:materials:integration
pnpm test:credit
pnpm test:audit
pnpm test:rbac
pnpm test:files
```

Expected: all PASS with zero lint warnings. Fix any failure before continuing. Do not skip hooks.

- [ ] **Step 4: HTTP smoke against a local API** (`pnpm dev` with migrated DB, both seeds run). Login as USER A and USER B, then:
  1. `POST /api/v1/me/materials/files` (pdf) → poll `GET /api/v1/me/materials/files/:id` until `READY`.
  2. `POST /api/v1/me/materials` PAID `"20"` with the fileId → `POST …/submit`.
  3. Staff `POST /api/v1/staff/materials/:id/approve`.
  4. Anonymous `GET /api/v1/materials?q=` shows the listing with no storage key.
  5. B `GET /api/v1/materials/:id/download` → 403 `MATERIAL_ACCESS_DENIED`.
  6. B `POST /api/v1/materials/:id/purchase` with `Idempotency-Key: k1` → 201, repeat → 200 with the same order.
  7. B download → 200 signed URL.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "docs(api): document learning materials rollout and test scripts"
```

---

## Self-review notes

- Spec coverage: D1 → Task 5. D2 → Tasks 2, 3, 7. D3 → Tasks 1, 4. D4 → Tasks 5, 6, 8. D5 → Tasks 4, 6, 7. D7/D9 → Task 6. Constraints → Task 2. Errors are thrown with their exact codes in Tasks 1 and 4–8.
- Deliberately skipped (ponytail): repository ports (one implementation each; `reports`/`credit` use `tx` directly), cursor pagination on owner/staff/order lists (capped at 100), file previews, tags, notification templates, refund.
- Risk: the reconciler/cleanup jobs must not delete an old MATERIAL object that is still bound and referenced by an order snapshot. Before merging, check `src/infrastructure/storage/file-reconciler.ts`, which today only targets unbound/UPLOADING rows.
