import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import type { Page } from "../src/lib/http/response";
import {
  ownSkillSchema,
  publicSkillSchema,
} from "../src/features/skills/api/skill-contracts";
import type {
  OwnSkill,
  PublicSkill,
} from "../src/features/skills/types/skills";
import { recordSkillQueries } from "../src/features/skills/utils/record-skill-queries";
import { ownSkill, ids } from "./skills-fixtures";

const scope = ["skills", 1, ids.user];
const pagination = { limit: 20, hasMore: true, nextCursor: "server-cursor" };
const list = <T>(items: T[]): InfiniteData<Page<T>> => ({
  pages: [{ data: items, pagination }],
  pageParams: [undefined],
});

test("a confirmed create remains in loaded owner caches if refresh fails without inventing pagination or public data", () => {
  const client = new QueryClient();
  try {
    const saved = ownSkillSchema.parse({ ...ownSkill, version: 2 });
    const otherScope = ["skills", 2, ids.other];
    client.setQueryData([...scope, "own", false, "ALL"], list<OwnSkill>([]));
    client.setQueryData(
      [...scope, "own", false, "VERIFIED"],
      list<OwnSkill>([]),
    );
    client.setQueryData([...scope, "public", ids.user], list<PublicSkill>([]));
    client.setQueryData(
      [...otherScope, "own", false, "ALL"],
      list<OwnSkill>([]),
    );
    recordSkillQueries(client, scope, saved);
    const current = client.getQueryData<InfiniteData<Page<OwnSkill>>>([
      ...scope,
      "own",
      false,
      "ALL",
    ])!;
    assert.deepEqual(current.pages[0]?.data, [saved]);
    assert.deepEqual(current.pages[0]?.pagination, pagination);
    assert.deepEqual(current.pageParams, [undefined]);
    assert.deepEqual(
      client.getQueryData([...scope, "detail", saved.id]),
      saved,
    );
    for (const key of [
      [...scope, "own", false, "VERIFIED"],
      [...scope, "public", ids.user],
      [...otherScope, "own", false, "ALL"],
    ])
      assert.deepEqual(client.getQueryData(key), list([]));
    assert.equal(
      client.getQueryData([...scope, "own", false, "PENDING"]),
      undefined,
    );
  } finally {
    client.clear();
  }
});

test("confirmed updates replace existing pages, move filters and keep public metadata private", () => {
  const client = new QueryClient();
  try {
    const old = ownSkillSchema.parse({ ...ownSkill, isVisible: true });
    const saved = ownSkillSchema.parse({
      ...old,
      version: 2,
      description: "A new server-confirmed description",
      verificationStatus: "VERIFIED",
    });
    const other = { ...old, id: ids.other };
    client.setQueryData([...scope, "detail", old.id], old);
    client.setQueryData([...scope, "own", false, "ALL"], list([other, old]));
    client.setQueryData([...scope, "own", false, "UNVERIFIED"], list([old]));
    client.setQueryData([...scope, "own", false, "VERIFIED"], list([]));
    client.setQueryData(
      [...scope, "public", ids.user],
      list([publicSkillSchema.parse(old)]),
    );
    recordSkillQueries(client, scope, saved);
    assert.deepEqual(
      client.getQueryData([...scope, "own", false, "ALL"]),
      list([other, saved]),
    );
    assert.deepEqual(
      client.getQueryData([...scope, "own", false, "UNVERIFIED"]),
      list([]),
    );
    assert.deepEqual(
      client.getQueryData([...scope, "own", false, "VERIFIED"]),
      list([saved]),
    );
    assert.deepEqual(
      client.getQueryData([...scope, "public", ids.user]),
      list([publicSkillSchema.parse(saved)]),
    );
    const hidden = { ...saved, version: 3, isVisible: false };
    recordSkillQueries(client, scope, hidden);
    assert.deepEqual(
      client.getQueryData([...scope, "public", ids.user]),
      list([]),
    );
    assert.deepEqual(client.getQueryData([...scope, "detail", old.id]), hidden);
  } finally {
    client.clear();
  }
});

test("an old mutation replay cannot overwrite a newer owner snapshot", () => {
  const client = new QueryClient();
  try {
    const replay = ownSkillSchema.parse(ownSkill);
    const current = {
      ...replay,
      version: 3,
      isVisible: true,
      description: "Latest content returned by the server",
    };
    client.setQueryData([...scope, "own", false, "ALL"], list([current]));
    recordSkillQueries(client, scope, replay);
    assert.deepEqual(
      client.getQueryData([...scope, "detail", replay.id]),
      current,
    );
    assert.deepEqual(
      client.getQueryData([...scope, "own", false, "ALL"]),
      list([current]),
    );
  } finally {
    client.clear();
  }
});
