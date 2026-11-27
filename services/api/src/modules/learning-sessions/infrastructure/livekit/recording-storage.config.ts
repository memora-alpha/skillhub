/**
 * Spec 020: LiveKit Egress uploads recordings into the existing private bucket (S3_BUCKET, with
 * STORAGE_ENDPOINT and STORAGE_REGION) using a dedicated key. Give that key PutObject on the
 * `recordings/` prefix only; the API reads and deletes with its own storage key.
 */
export type RecordingStorageConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    };

const KEYS = [
  "RECORDING_STORAGE_ACCESS_KEY_ID",
  "RECORDING_STORAGE_SECRET_ACCESS_KEY",
] as const;

const SHARED = ["STORAGE_ENDPOINT", "STORAGE_REGION", "S3_BUCKET"] as const;

function text(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/** Optional as a pair; errors name the variables only, never their values. */
export function recordingStorageConfiguration(
  input: Record<string, unknown>,
): RecordingStorageConfiguration {
  if (KEYS.every((key) => input[key] === undefined)) return { enabled: false };
  const invalid: string[] = KEYS.filter((key) => !text(input, key));
  // ConfigService returns the validated value (boolean); raw env input is the string.
  const storageEnabled =
    input.STORAGE_ENABLED === true || input.STORAGE_ENABLED === "true";
  if (!storageEnabled) invalid.push("STORAGE_ENABLED");
  invalid.push(...SHARED.filter((key) => !text(input, key)));
  if (invalid.length)
    throw new Error(
      `Invalid recording storage configuration: ${invalid.join(", ")}`,
    );
  return {
    enabled: true,
    endpoint: text(input, "STORAGE_ENDPOINT")!,
    region: text(input, "STORAGE_REGION")!,
    bucket: text(input, "S3_BUCKET")!,
    accessKeyId: text(input, "RECORDING_STORAGE_ACCESS_KEY_ID")!,
    secretAccessKey: text(input, "RECORDING_STORAGE_SECRET_ACCESS_KEY")!,
  };
}
