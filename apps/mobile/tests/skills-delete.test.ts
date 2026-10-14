import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { removeSkillQueries } from "../src/features/skills/utils/remove-skill-queries";
import { ids, ownSkill, batch } from "./skills-fixtures";

test("confirmed deletion clears all list variants/private views, preserving other pages and accounts", () => {
  const client = new QueryClient();
  const scope = ["skills", 1, "account-a"];
  const otherScope = ["skills", 2, "account-b"];
  const survivor = { ...ownSkill, id: ids.other };
  const pagination = { hasMore: true, nextCursor: "next", limit: 20 };
  const pages = {
    pages: [
      { data: [ownSkill, survivor], pagination },
      {
        data: [ownSkill],
        pagination: { ...pagination, hasMore: false, nextCursor: null },
      },
    ],
    pageParams: [undefined, "next"],
  };
  const lists = [
    [...scope, "own", false, "ALL"],
    [...scope, "own", false, "VERIFIED"],
    [...scope, "public", "account-a"],
  ];
  for (const key of [...lists, [...otherScope, "own", false, "ALL"]])
    client.setQueryData(key, pages);
  client.setQueryData([...scope, "detail", ids.sharing], ownSkill);
  client.setQueryData(
    [...scope, "public-detail", "account-a", ids.sharing],
    ownSkill,
  );
  client.setQueryData([...scope, "detail", ids.other], survivor);
  client.setQueryData([...scope, "history", ids.sharing], { pages: [batch] });
  client.setQueryData(
    [...scope, "verification", ids.sharing, ids.verification],
    batch,
  );
  removeSkillQueries(client, scope, ids.sharing);
  for (const key of lists) {
    const value = client.getQueryData<typeof pages>(key)!;
    assert.deepEqual(
      value.pages.map((page) => page.data.map((skill) => skill.id)),
      [[ids.other], []],
    );
    assert.deepEqual(value.pageParams, pages.pageParams);
    assert.deepEqual(value.pages[0]!.pagination, pagination);
  }
  assert.equal(client.getQueryData([...scope, "detail", ids.sharing]), null);
  assert.equal(
    client.getQueryData([...scope, "public-detail", "account-a", ids.sharing]),
    null,
  );
  assert.equal(
    client.getQueryData([...scope, "history", ids.sharing]),
    undefined,
  );
  assert.equal(
    client.getQueryData([
      ...scope,
      "verification",
      ids.sharing,
      ids.verification,
    ]),
    undefined,
  );
  assert.deepEqual(
    client.getQueryData([...scope, "detail", ids.other]),
    survivor,
  );
  assert.deepEqual(
    client.getQueryData([...otherScope, "own", false, "ALL"]),
    pages,
  );
  client.clear();
});
