import type {
  AiFileInput,
  AiFileResult,
  AiSnapshot,
} from "../../domain/verification-ai.types";

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
export abstract class VerificationAiProvider {
  abstract analyze(input: {
    snapshot: AiSnapshot;
    file: AiFileInput;
    bytes: Buffer;
    currentDate: string;
  }): Promise<{ result: AiFileResult; usage: AiUsage }>;
}
