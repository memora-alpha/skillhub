import assert from "node:assert/strict";
import test from "node:test";
import { readNegotiationMessage } from "../src/features/learning-paths/utils/negotiation-reader";
import { negotiationMessage } from "../src/features/learning-paths/utils/negotiation";
import {
  confirmedFormMessage,
  readConfirmedForm,
} from "../src/features/learning-paths/utils/confirmed-form";
import { confirmAndShare } from "../src/features/learning-paths/api/confirm-and-share";
import { fixtureId } from "./fixtures/learning-requests-data";

test("legacy negotiation stays unconfirmed and cannot be read as a schedule confirmation", () => {
  const message = negotiationMessage({
    type: "TWO_WAY",
    role: "teacher",
    skill: "React",
    goal: "Xây dựng website",
    credit: "20",
    outline: "Thực hành React",
  });
  assert.deepEqual(readNegotiationMessage(message), {
    skill: "React",
    goal: "Xây dựng website",
  });
  assert.equal(readConfirmedForm(message), null);
  assert.deepEqual(
    readNegotiationMessage(
      message.replace("GỢI Ý LỘ TRÌNH", "GỢI Ý LEARNING PATH"),
    ),
    { skill: "React", goal: "Xây dựng website" },
  );
  assert.equal(
    readNegotiationMessage("GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN\nNội dung thường"),
    null,
  );
});
test("successful schedule confirmation shares an exact schedule card, and failed confirmation sends nothing", async () => {
  const shares: string[] = [];
  const share = (result: { version: number }) =>
    shares.push(
      confirmedFormMessage({
        kind: "schedule",
        pathId: fixtureId(30),
        planId: fixtureId(11),
        scheduleId: fixtureId(50),
        version: result.version,
        title: "Lịch học React",
        summary: "3 buổi · Bắt đầu 23/10/2026",
      }),
    );
  await confirmAndShare(
    async () => ({ version: 4 }),
    share,
    () => true,
  )(fixtureId(90));
  assert.equal(readConfirmedForm(shares[0]!)?.kind, "schedule");
  assert.equal(readConfirmedForm(shares[0]!)?.scheduleId, fixtureId(50));
  assert.equal(readConfirmedForm(shares[0]!)?.version, 4);
  assert.equal(readNegotiationMessage(shares[0]!), null);
  await assert.rejects(
    confirmAndShare(
      async () => {
        throw new Error("failed");
      },
      share,
      () => true,
    )(fixtureId(91)),
  );
  assert.equal(shares.length, 1);
});
