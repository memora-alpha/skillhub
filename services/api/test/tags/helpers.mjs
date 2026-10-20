import { createSkillFixture } from "../skills/helpers.mjs";
import { TagsService } from "../../dist/modules/skills/application/services/tags.service.js";
import { TagRequestsService } from "../../dist/modules/skills/application/services/tag-requests.service.js";
import { TagsRepository } from "../../dist/modules/skills/infrastructure/persistence/tags.repository.js";

export const status = (code) => (error) => error.getStatus?.() === code;
export async function createTagFixture() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error("TEST_DATABASE_URL required");
  const f = await createSkillFixture();
  const repo = new TagsRepository(f.db);
  f.tags = new TagsService(repo, f.actors, f.commands, f.transactions, f.audit);
  f.tagRequests = new TagRequestsService(
    repo,
    f.actors,
    f.commands,
    f.transactions,
    f.audit,
  );
  return f;
}
