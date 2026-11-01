import { AppError } from "@/lib/http/errors";
import type { TokenStore, RefreshCredential } from "@/lib/storage/token-store";
import type { AuthApi } from "../api/auth-api";
import type { LoginInput, TokenPair, ResetInput } from "../api/auth-contracts";

export type SessionStatus =
  "bootstrapping" | "guest" | "ready" | "offline" | "reauth";

export class SessionController {
  private status: SessionStatus = "bootstrapping";
  private credential: RefreshCredential | null = null;
  private accessToken: string | null = null;
  private expiresAt = 0;
  private epoch = 0;
  private listeners = new Set<() => void>();
  private rotation: { epoch: number; promise: Promise<void> } | null = null;
  private cleanupIntent: symbol | null = null;
  private bootstrapTask: Promise<void> | null = null;
  private logoutAllTask: { epoch: number; promise: Promise<void> } | null =
    null;
  private writes: Promise<void> = Promise.resolve();
  private resetTask: {
    epoch: number;
    token: string;
    promise: Promise<void>;
  } | null = null;
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
  private persist<T>(action: () => Promise<T>) {
    const next = this.writes.then(action, action);
    this.writes = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
  private clearCredential(intent: symbol) {
    return this.persist(async () => {
      if (this.cleanupIntent !== intent) return false;
      await this.store.clear();
      if (this.cleanupIntent === intent) this.cleanupIntent = null;
      return true;
    });
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
      await this.persist(async () => {
        if (epoch !== this.epoch) throw new AppError("session");
        await this.store.write(credential);
        // Only a current, durable credential supersedes a pending logout.
        if (epoch === this.epoch) this.cleanupIntent = null;
      });
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
      // A failed logout cleanup must retry deletion, never restore its old token.
      const intent = this.cleanupIntent;
      if (intent) {
        const cleared = await this.clearCredential(intent);
        if (cleared && epoch === this.epoch && this.status === "bootstrapping")
          this.publish("guest");
        return;
      }
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
    const epoch = this.epoch;
    if (this.rotation?.epoch === epoch) return this.rotation.promise;
    const promise = this.rotate().finally(() => {
      if (this.rotation?.promise === promise) this.rotation = null;
    });
    this.rotation = { epoch, promise };
    return promise;
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
      await this.persist(async () => {
        if (epoch !== this.epoch) throw new AppError("session");
        await this.store.write({ ...credential, rotationPending: true });
      });
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
        await this.persist(async () => {
          if (epoch === this.epoch) await this.store.write(credential);
        }).catch(() => {});
        if (epoch !== this.epoch) throw error;
        this.publish("offline", error);
      } else {
        await this.expire();
      }
      throw error;
    }
  }
  expire = async () => {
    ++this.epoch;
    const intent = Symbol("credential-cleanup");
    this.cleanupIntent = intent;
    this.accessToken = null;
    this.credential = null;
    this.publish("guest");
    try {
      await this.clearCredential(intent);
    } catch (error) {
      if (this.cleanupIntent === intent) this.publish("offline", error);
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
  resetPassword = (input: ResetInput) => {
    const epoch = this.epoch;
    if (
      this.resetTask?.epoch === epoch &&
      this.resetTask.token === input.resetToken
    )
      return this.resetTask.promise;
    const promise = this.applyPasswordReset(input, epoch).finally(() => {
      if (this.resetTask?.promise === promise) this.resetTask = null;
    });
    this.resetTask = { epoch, token: input.resetToken, promise };
    return promise;
  };
  private async applyPasswordReset(input: ResetInput, epoch: number) {
    const signedIn = !!this.credential;
    await this.api.reset(input);
    if (epoch !== this.epoch) throw new AppError("session");
    if (signedIn) await this.expire();
  }
  private async revokeAll(epoch: number) {
    await this.api.logoutAll();
    if (epoch !== this.epoch) throw new AppError("session");
    await this.expire();
  }
}
