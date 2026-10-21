import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createSkillFixture } from "../skills/helpers.mjs";
import { CreditProvenanceService } from "../../dist/modules/credit/application/services/credit-provenance.service.js";
import { CreditOperationsService } from "../../dist/modules/credit/application/services/credit-operations.service.js";
import { seedPathFeePolicies } from "../../dist/modules/credit/application/seed-fee-policies.js";
import { MaterialsService } from "../../dist/modules/materials/application/services/materials.service.js";
import { MaterialModerationService } from "../../dist/modules/materials/application/services/material-moderation.service.js";
import { MaterialCatalogService } from "../../dist/modules/materials/application/services/material-catalog.service.js";
import { MaterialPurchaseService } from "../../dist/modules/materials/application/services/material-purchase.service.js";
import { MaterialReportsService } from "../../dist/modules/materials/application/services/material-reports.service.js";

/** Fresh UUID schema with all migrations, fee policies and one ACTIVE skill. */
export async function createMaterialFixture() {
  const f = await createSkillFixture();
  let skill;
  try {
    await f.transactions.run(seedPathFeePolicies);
    skill = await f.db.skill.create({
      data: {
        name: `Materials ${randomUUID()}`,
        nameKey: randomUUID(),
        slug: `materials-${randomUUID()}`,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    // A failed setup must not leak the schema or pool handles.
    await f.dispose();
    throw error;
  }
  const credits = new CreditOperationsService(new CreditProvenanceService());
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
  const moderation = new MaterialModerationService(f.transactions, f.audit);
  const catalog = new MaterialCatalogService(
    f.transactions,
    f.storage,
    f.attachments,
  );
  const purchases = new MaterialPurchaseService(
    f.transactions,
    credits,
    f.audit,
  );
  const reports = new MaterialReportsService(f.transactions);
  const moderator = await f.account("STAFF");
  /** Create → attach file → submit → approve, through the real services. */
  async function publishedMaterial(owner, overrides = {}) {
    const file = await materialFile(owner);
    const draft = await materials.create(
      owner.principal,
      draftInput({ fileId: file.id, ...overrides }),
    );
    const submitted = await materials.submit(owner.principal, draft.id);
    return moderation.moderate(moderator.principal, draft.id, "approve", {
      expectedListingVersion: submitted.listingVersion,
    });
  }
  return {
    ...f,
    credits,
    skill,
    fund,
    materials,
    materialFile,
    draftInput,
    moderation,
    catalog,
    purchases,
    reports,
    moderator,
    publishedMaterial,
  };
}
