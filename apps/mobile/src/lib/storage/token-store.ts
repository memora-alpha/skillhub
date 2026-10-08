import { AppError } from "../http/errors";
import { isRecord } from "../http/response";

export type RefreshCredential = {
  refreshToken: string;
  refreshExpiresAt: string;
  rotationPending?: boolean;
};
export type TokenStore = {
  read: () => Promise<RefreshCredential | null>;
  write: (value: RefreshCredential) => Promise<void>;
  clear: () => Promise<void>;
};
type SecretDriver = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  clear: () => Promise<void>;
};

export function createTokenStore(driver: SecretDriver): TokenStore {
  const secure = async <T>(action: () => Promise<T>) => {
    try {
      return await action();
    } catch {
      throw new AppError("storage");
    }
  };
  return {
    async read() {
      const raw = await secure(driver.read);
      if (!raw) return null;
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        value = null;
      }
      if (
        !isRecord(value) ||
        typeof value.refreshToken !== "string" ||
        !value.refreshToken ||
        typeof value.refreshExpiresAt !== "string" ||
        !Number.isFinite(Date.parse(value.refreshExpiresAt)) ||
        (value.rotationPending !== undefined &&
          typeof value.rotationPending !== "boolean")
      ) {
        await secure(driver.clear);
        return null;
      }
      return value as RefreshCredential;
    },
    write: (value) => secure(() => driver.write(JSON.stringify(value))),
    clear: () => secure(driver.clear),
  };
}
