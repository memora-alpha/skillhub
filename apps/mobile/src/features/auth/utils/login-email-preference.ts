import { forgotPasswordSchema } from "../schemas/auth-schemas";

type EmailStorage = {
  read: () => Promise<string | null>;
  write: (email: string) => Promise<void>;
};

function normalizedEmail(value: string | null) {
  const result = forgotPasswordSchema.safeParse({ email: value });
  return result.success ? result.data.email.toLowerCase() : "";
}

export function createLoginEmailPreference(storage: EmailStorage) {
  let email = "";
  let revision = 0;
  let persistedEmail: string | null = null;
  let pendingWrite: { email: string } | null = null;
  let reading: Promise<string> | null = null;
  let writing = Promise.resolve();
  return {
    load() {
      if (revision > 0) return Promise.resolve(email);
      if (!reading) {
        const started = revision;
        reading = storage
          .read()
          .then((stored) => {
            if (started === revision) {
              email = normalizedEmail(stored);
              persistedEmail = email;
            }
            return email;
          })
          .catch(() => {
            reading = null;
            return email;
          });
      }
      return reading;
    },
    remember(value: string) {
      const next = normalizedEmail(value);
      if (!next) return;
      if (
        next === email &&
        (persistedEmail === next || pendingWrite?.email === next)
      )
        return;
      email = next;
      revision++;
      const request = { email: next };
      pendingWrite = request;
      // This optional preference cannot block login; credentials use a separate store.
      writing = writing
        .then(async () => {
          await storage.write(next);
          persistedEmail = next;
        })
        .catch(() => {})
        .finally(() => {
          if (pendingWrite === request) pendingWrite = null;
        });
    },
  };
}
