import { AppError } from "@/lib/http/errors";
import type { TokenStore, RefreshCredential } from "@/lib/storage/token-store";
import type { AuthApi } from "../api/auth-api";
import type { LoginInput, TokenPair } from "../api/auth-contracts";

export type SessionStatus =
  "bootstrapping" | "guest" | "ready" | "offline" | "reauth";

export class SessionController {
  private status: SessionStatus = "bootstrapping";
  private credential: RefreshCredential | null = null;
  private accessToken: string | null = null;
  private expiresAt = 0;
  private epoch = 0;
  private listeners = new Set<() => void>();
  private rotation: Promise<void> | null = null;
  private bootstrapTask: Promise<void> | null = null;
  private logoutAllTask: { epoch: number; promise: Promise<void> } | null =
    null;
  private writes: Promise<void> = Promise.resolve();
  error: unknown = null;

  constructor(
    private api: AuthApi,
    private store: TokenStore,
    private now = Date.now,
  ) {}

  getSnapshot = () => this.status;
  get generation() {
    return this.epoch;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(status: SessionStatus, error: unknown = null) {
    this.status = status;
    this.error = error;
    this.listeners.forEach((listener) => listener());
  }
  private persist(action: () => Promise<void>) {
    const next = this.writes.then(action, action);
    this.writes = next.catch(() => {});
    return next;
  }
  private async accept(pair: TokenPair, epoch: number) {
    if (epoch !== this.epoch) {
      await this.api.logout(pair.refreshToken).catch(() => {});
      throw new AppError("session");
    }
    const credential = {
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt,
    };
    try {
      await this.persist(() => this.store.write(credential));
    } catch (error) {
      await this.api.logout(pair.refreshToken).catch(() => {});
      throw error;
    }
    if (epoch !== this.epoch) {
      await this.api.logout(pair.refreshToken).catch(() => {});
      throw new AppError("session");
    }
    this.credential = credential;
    this.accessToken = pair.accessToken;
    this.expiresAt = this.now() + pair.expiresIn * 1000;
    this.publish("ready");
  }
  bootstrap = () => {
    if (this.bootstrapTask) return this.bootstrapTask;
    this.bootstrapTask = this.restore().finally(() => {
      this.bootstrapTask = null;
    });
    return this.bootstrapTask;
  };
  private async restore() {
    if (this.status === "ready" || this.status === "reauth") return;
    const epoch = this.epoch;
    this.publish("bootstrapping");
    try {
      const stored = await this.store.read();
      if (epoch !== this.epoch) return;
      if (!stored || Date.parse(stored.refreshExpiresAt) <= this.now()) {
        await this.expire();
        return;
      }
      this.credential = stored;
      if (stored.rotationPending) {
        this.publish("reauth", new AppError("session"));
        return;
      }
      await this.renew();
    } catch (error) {
      if (epoch === this.epoch && this.status === "bootstrapping")
        this.publish("offline", error);
    }
  }
  login = async (input: LoginInput) => {
    const epoch = ++this.epoch;
    const pair = await this.api.login(input);
    try {
      await this.accept(pair, epoch);
    } catch (error) {
      if (epoch === this.epoch) await this.expire();
      throw error;
    }
  };
  getToken = async () => {
    if (this.accessToken && this.now() + 15_000 >= this.expiresAt)
      await this.renew();
    return this.accessToken;
  };
  renew = (staleToken?: string): Promise<void> => {
    if (staleToken && this.accessToken && staleToken !== this.accessToken)
      return Promise.resolve();
    if (this.rotation) return this.rotation;
    this.rotation = this.rotate().finally(() => {
      this.rotation = null;
    });
    return this.rotation;
  };
  private async rotate() {
    const credential = this.credential;
    const epoch = this.epoch;
    if (
      !credential ||
      credential.rotationPending ||
      Date.parse(credential.refreshExpiresAt) <= this.now()
    ) {
      await this.expire();
      throw new AppError("session");
    }
    let sent = false;
    try {
      // Persist the in-flight marker before sending. A lost response must never replay a consumed token after restart.
      await this.persist(() =>
        this.store.write({ ...credential, rotationPending: true }),
      );
      if (epoch !== this.epoch) throw new AppError("session");
      this.credential = { ...credential, rotationPending: true };
      sent = true;
      const pair = await this.api.refresh(credential.refreshToken);
      await this.accept(pair, epoch);
    } catch (error) {
      if (epoch !== this.epoch) throw error;
      this.accessToken = null;
      if (sent && error instanceof AppError && error.kind === "network") {
        this.publish("reauth", error);
      } else if (
        !sent ||
        (error instanceof AppError && error.kind === "config")
      ) {
        this.credential = credential;
        await this.persist(() => this.store.write(credential)).catch(() => {});
        this.publish("offline", error);
      } else {
        await this.expire();
      }
      throw error;
    }
  }
  expire = async () => {
    ++this.epoch;
    this.accessToken = null;
    this.credential = null;
    this.publish("guest");
    try {
      await this.persist(() => this.store.clear());
    } catch (error) {
      this.publish("offline", error);
    }
  };
  signOut = async () => {
    const token = this.credential?.refreshToken;
    await this.expire();
    if (token) void this.api.logout(token).catch(() => {});
  };
  signOutAll = () => {
    const epoch = this.epoch;
    if (this.logoutAllTask?.epoch === epoch) return this.logoutAllTask.promise;
    const promise = this.revokeAll(epoch).finally(() => {
      if (this.logoutAllTask?.promise === promise) this.logoutAllTask = null;
    });
    this.logoutAllTask = { epoch, promise };
    return promise;
  };
  private async revokeAll(epoch: number) {
    await this.api.logoutAll();
    if (epoch !== this.epoch) throw new AppError("session");
    await this.expire();
  }
}
