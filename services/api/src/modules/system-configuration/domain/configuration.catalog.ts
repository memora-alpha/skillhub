import { z } from "zod";
import { moderationRuleSetSchema } from "./moderation-rule-set.schema";

const positiveInt = z.number().int().safe().positive();
const settlement = z
  .object({
    returned: z.number().int().min(0).max(10_000),
    fee: z.number().int().min(0).max(10_000),
  })
  .strict()
  .refine((value) => value.returned + value.fee === 10_000);
const duration = z
  .object({
    min: positiveInt,
    max: positiveInt,
  })
  .strict()
  .refine((value) => value.min <= value.max);

/** Only approved business values belong in this catalog. Provider secrets stay in env. */
export const CONFIGURATION_DEFINITIONS = {
  "livekit.joinWindow": {
    schema: z
      .object({
        earlyMinutes: z.number().int().safe().nonnegative(),
        lateMinutes: z.number().int().safe().nonnegative(),
      })
      .strict(),
    mutable: true,
  },
  "learningPath.minCreditPerUser": {
    schema: z.literal(20),
    mutable: false,
    defaultValue: 20,
  },
  "credit.topUpVndPerCredit": {
    schema: z.literal(1000),
    mutable: false,
    defaultValue: 1000,
  },
  "credit.pathSettlementBps": {
    schema: settlement.refine(
      (value) => value.returned === 9600 && value.fee === 400,
    ),
    mutable: false,
    defaultValue: { returned: 9600, fee: 400 },
  },
  "session.durationMinutes": {
    schema: duration.refine((value) => value.min === 60 && value.max === 180),
    mutable: false,
    defaultValue: { min: 60, max: 180 },
  },
  "schedule.rescheduleCutoffMinutes": {
    schema: z.literal(60),
    mutable: false,
    defaultValue: 60,
  },
  "learningRequest.moderationRuleSet": {
    schema: moderationRuleSetSchema,
    mutable: true,
    defaultValue: { rules: [] },
  },
  "storage.downloadTtlSeconds": {
    schema: z.number().int().min(1).max(300),
    mutable: true,
    defaultValue: 120,
  },
  "storage.evidenceMaxBytes": {
    schema: positiveInt.max(100_000_000),
    mutable: true,
    defaultValue: 10_000_000,
  },
} as const;

export type ConfigurationKey = keyof typeof CONFIGURATION_DEFINITIONS;
export type ConfigurationValue<K extends ConfigurationKey> = z.output<
  (typeof CONFIGURATION_DEFINITIONS)[K]["schema"]
>;
export type ConfigurationValues<K extends ConfigurationKey> = {
  [P in K]: ConfigurationValue<P>;
};

export function isConfigurationKey(input: string): input is ConfigurationKey {
  return Object.hasOwn(CONFIGURATION_DEFINITIONS, input);
}

export function parseConfigurationValue<K extends ConfigurationKey>(
  key: K,
  value: unknown,
): ConfigurationValue<K> {
  if (!isConfigurationKey(key)) {
    throw new TypeError(`unknown configuration key: ${key}`);
  }
  return CONFIGURATION_DEFINITIONS[key].schema.parse(
    value,
  ) as ConfigurationValue<K>;
}

export function requireMutableConfigurationKey(
  input: string,
): ConfigurationKey {
  if (!isConfigurationKey(input) || !CONFIGURATION_DEFINITIONS[input].mutable) {
    throw new TypeError(`configuration key is not mutable: ${input}`);
  }
  return input;
}
