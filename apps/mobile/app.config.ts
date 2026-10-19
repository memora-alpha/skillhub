import type { ConfigContext, ExpoConfig } from "expo/config";

// Build metadata is public. It contains no credential and grants no backend rights.
export default ({ config }: ConfigContext): ExpoConfig => {
  const mode = process.env.SKILLHUB_PAYMENT_QA_MODE;
  const environment = process.env.SKILLHUB_PAYMENT_QA_ENV;
  const buildId = process.env.SKILLHUB_PAYMENT_QA_BUILD;
  const ownerId = process.env.SKILLHUB_PAYMENT_QA_OWNER;
  const internal =
    process.env.SKILLHUB_PAYMENT_QA_DISTRIBUTION === "internal" &&
    process.env.EAS_BUILD_PROFILE !== "production";
  const paymentQa =
    internal &&
    ["read", "financial"].includes(mode ?? "") &&
    environment &&
    buildId &&
    ownerId
      ? {
          mode,
          environment,
          buildId,
          ownerId,
          distribution: "internal",
          actions: (process.env.SKILLHUB_PAYMENT_QA_ACTIONS ?? "").split(","),
        }
      : null;
  return {
    ...config,
    name: config.name ?? "SkillHub",
    slug: config.slug ?? "skillhub-mobile",
    extra: { ...config.extra, paymentQa },
  };
};
