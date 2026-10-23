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
      read: () => Promise.resolve(preview.get(key) ?? null),
      write: (value) => {
        preview.set(key, value);
        return Promise.resolve();
      },
    };
  let hash = 0;
  // Keep the existing UTF-16 hash so saved outbox filenames remain stable.
  for (const char of scope)
    hash = (Math.imul(hash, 31) + char.slice(0, 1).codePointAt(0)!) | 0;
  const directory = new Directory(Paths.document, "chat-outbox");
  const file = new File(directory, `${hash >>> 0}-${ownerId}.json`);
  return {
    read: () =>
      Promise.resolve().then(() => (file.exists ? file.text() : null)),
    write: (value) =>
      Promise.resolve().then(async () => {
        directory.create({ intermediates: true, idempotent: true });
        const temporary = new File(directory, `${hash >>> 0}-${ownerId}.tmp`);
        await temporary.write(value);
        temporary.move(file, { overwrite: true });
      }),
  };
}
