import assert from "node:assert/strict";
import { test } from "node:test";
import { guestDestination } from "../src/features/product-shell/public-navigation";

const id = "123e4567-e89b-42d3-a456-426614174000";

test("guest entry routes lead to real resources after authentication and reject demo IDs", () => {
  assert.deepEqual(guestDestination("profile", id), {
    pathname: "/profiles/[userId]",
    params: { userId: id },
  });
  assert.deepEqual(guestDestination("request", id), {
    pathname: "/requests/[id]",
    params: { id },
  });
  for (const invalid of [undefined, "demo-hong-anh", "react", [id], ""]) {
    assert.equal(guestDestination("profile", invalid), "/search");
    assert.equal(guestDestination("request", invalid), "/discover");
  }
  assert.deepEqual(guestDestination("explore", "  Ｒｅａｃｔ "), {
    pathname: "/discover",
    params: { tab: "requests", query: "React" },
  });
  assert.deepEqual(guestDestination("explore", ["React"]), {
    pathname: "/discover",
    params: { tab: "requests", query: "" },
  });
});
