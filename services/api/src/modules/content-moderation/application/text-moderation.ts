import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { ModerationSurface } from "../domain/moderation-policy";
import {
  type ContentModerationService,
  requireAllowed,
} from "./content-moderation.service";

export type TextToModerate = {
  sourceVersion: string;
  fields: readonly (string | null | undefined)[];
};

export async function moderateText(
  moderation: ContentModerationService,
  surface: ModerationSurface,
  input: TextToModerate | undefined,
): Promise<void> {
  if (input)
    requireAllowed(
      await moderation.evaluateText(surface, input.sourceVersion, input.fields),
    );
}

export function textModerationPreflight(
  moderation: ContentModerationService,
  surface: ModerationSurface,
  prepare: (tx: TransactionContext) => Promise<TextToModerate | undefined>,
) {
  if (!moderation) return undefined;
  return {
    prepare,
    check: (input: TextToModerate | undefined) =>
      moderateText(moderation, surface, input),
  };
}
