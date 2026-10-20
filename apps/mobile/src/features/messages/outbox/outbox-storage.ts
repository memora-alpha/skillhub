import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { OutboxStorage } from "./outbox-types";

const preview = new Map<string, string>();
export function createOutboxStorage(
  ownerId: string,
  scope: string,
): OutboxStorage {
  const key = `${scope}:${ownerId}`;
  // Web preview follows the app's memory-only session policy.
  if (Platform.OS === "web")
    return {
      read: async () => preview.get(key) ?? null,
      write: async (value) => {
        preview.set(key, value);
      },
    };
  let hash = 0;
  for (const char of scope)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  const directory = new Directory(Paths.document, "chat-outbox");
  const file = new File(directory, `${hash >>> 0}-${ownerId}.json`);
  return {
    read: async () => (file.exists ? file.text() : null),
    write: async (value) => {
      directory.create({ intermediates: true, idempotent: true });
      const temporary = new File(directory, `${hash >>> 0}-${ownerId}.tmp`);
      temporary.write(value);
      temporary.move(file, { overwrite: true });
    },
  };
}
