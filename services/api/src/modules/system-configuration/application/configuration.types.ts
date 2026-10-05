import type { AuditActor } from "../../audit/application/audit.types";
import type { RequestContext } from "../../../shared/http/request-context";
import type {
  ConfigurationKey,
  ConfigurationValue,
  ConfigurationValues,
} from "../domain/configuration.catalog";

export type ConfigurationSnapshot<K extends ConfigurationKey> = {
  values: ConfigurationValues<K>;
  versions: Record<K, number>;
  readAt: Date;
};

export type ConfigurationChange = {
  [K in ConfigurationKey]: { key: K; value: ConfigurationValue<K> };
}[ConfigurationKey];

export type UpdateConfigurationCommand = {
  changes: readonly ConfigurationChange[];
  expectedVersions: Readonly<Record<string, number>>;
  actor: AuditActor;
  reason: string;
  context: RequestContext;
  /** Future-effective policy activation is deliberately unsupported. */
  effectiveAt?: never;
};
