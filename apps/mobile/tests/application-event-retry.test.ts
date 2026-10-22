import assert from "node:assert/strict";
import test from "node:test";
import { createEventRetryBudget } from "../src/features/messages/utils/event-retry-budget";

test("ready followed by a repeatedly failing replay cannot bypass the six-retry budget", () => {
  const budget = createEventRetryBudget(() => 1000);
  const delays = Array.from({ length: 8 }, () => {
    budget.ready();
    return budget.failed();
  });
  assert.deepEqual(delays, [
    3000,
    6000,
    12000,
    24000,
    30000,
    30000,
    undefined,
    undefined,
  ]);
});

test("a stable connection or an explicit foreground restart restores the retry budget", () => {
  let now = 0;
  const budget = createEventRetryBudget(() => now);
  for (let i = 0; i < 6; i++) budget.failed();
  budget.ready();
  now = 29999;
  assert.equal(
    budget.failed(),
    undefined,
    "short-lived connections cannot reset exhaustion",
  );
  budget.ready();
  now += 30000;
  assert.equal(budget.failed(), 3000);
  assert.equal(budget.failed(), 6000);
  budget.reset();
  assert.equal(budget.failed(), 3000);
});
