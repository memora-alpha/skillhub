import assert from "node:assert/strict";
import test from "node:test";
import { agreementInputSchema } from "../src/features/learning-paths/agreement-input";
import {
  apiProposalForm,
  proposalHints,
  proposalFormValues,
} from "../src/features/proposals/schemas/api-proposal-form";
import { proposal as savedProposal } from "./fixtures/proposals-data";
import {
  validateChatFile,
  chatFileFormData,
} from "../src/features/messages/utils/chat-file";

const proposal = {
  message: "Mình có thể hướng dẫn bạn học React.",
  type: "" as const,
  credit: "",
  sessions: "",
  duration: "",
};

test("official agreement Credit matches the API's canonical decimal format and exchange minimum", () => {
  const base = { type: "ONE_WAY" as const, role: "teacher" as const };
  for (const credit of ["0.01", "20", "20.00", "9999999999.99"])
    assert.equal(
      agreementInputSchema.safeParse({ ...base, credit }).success,
      true,
      credit,
    );
  for (const credit of [
    "020",
    "00.50",
    "0",
    "0.00",
    "10000000000",
    "20.001",
    "1e2",
    "+20",
    "20,00",
  ])
    assert.equal(
      agreementInputSchema.safeParse({ ...base, credit }).success,
      false,
      credit,
    );
  assert.equal(
    agreementInputSchema.safeParse({
      ...base,
      type: "TWO_WAY",
      credit: "19.99",
    }).success,
    false,
  );
  assert.equal(
    agreementInputSchema.parse({ ...base, type: "TWO_WAY", credit: " 20.00 " })
      .credit,
    "20.00",
  );
});

test("proposal messages count Unicode code points, normalize NFC and retain server-allowed whitespace", () => {
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "😀".repeat(5) }).success,
    false,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "😀".repeat(10) })
      .success,
    true,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "😀".repeat(1000) })
      .success,
    true,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "😀".repeat(1001) })
      .success,
    false,
  );
  assert.equal(
    apiProposalForm.parse({ ...proposal, message: ` ${"e\u0301".repeat(10)} ` })
      .message,
    "é".repeat(10),
  );
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "e\u0301".repeat(9) })
      .success,
    false,
  );
  assert.equal(
    apiProposalForm.safeParse({ ...proposal, message: "Học\tReact\nvới nhau" })
      .success,
    true,
  );
  assert.equal(
    apiProposalForm.safeParse({
      ...proposal,
      message: "Học React\u0000 cùng nhau",
    }).success,
    false,
  );
});

test("proposal edits preserve saved candidate slots unless the owner explicitly clears them", () => {
  const saved = {
    ...savedProposal,
    candidateSlots: "Tối thứ 5 và thứ 7",
  };
  const values = apiProposalForm.parse(proposalFormValues(saved));
  assert.equal(
    Object.hasOwn(proposalHints(values, saved), "candidateSlots"),
    false,
  );
  assert.deepEqual(
    proposalHints({ ...values, candidateSlots: "" }, saved).candidateSlots,
    null,
  );
});

test("chat file MIME matching normalizes case and whitespace like the storage contract", () => {
  const file = { name: "lesson.pdf", uri: "local://file", size: 5 };
  assert.equal(
    validateChatFile({ ...file, mimeType: " APPLICATION/PDF " }).mime,
    "application/pdf",
  );
  assert.equal(
    validateChatFile({ ...file, mimeType: " APPLICATION/OCTET-STREAM " }).mime,
    "application/pdf",
  );
  assert.throws(() => validateChatFile({ ...file, mimeType: " IMAGE/PNG " }));
  const content = new File(["hello"], file.name, { type: "application/pdf" });
  const form = chatFileFormData({
    ...file,
    file: content,
    mimeType: " APPLICATION/PDF ",
  });
  assert.equal((form.get("file") as File).type, "application/pdf");
});
