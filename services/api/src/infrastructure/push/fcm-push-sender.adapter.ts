import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createSign } from "node:crypto";
import type { PushSender } from "../../modules/notifications/application/ports/notification-channels";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const messagingScope = "https://www.googleapis.com/auth/firebase.messaging";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * Firebase Cloud Messaging HTTP v1 with a service account
 * (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY).
 */
@Injectable()
export class FcmPushSender implements PushSender {
  private readonly account?: ServiceAccount;
  private accessToken?: { value: string; expiresAt: number };

  constructor(config: ConfigService) {
    const projectId = config.get<string>("FCM_PROJECT_ID");
    const clientEmail = config.get<string>("FCM_CLIENT_EMAIL");
    const privateKey = config
      .get<string>("FCM_PRIVATE_KEY")
      ?.replaceAll(String.raw`\n`, "\n");
    if (projectId && clientEmail && privateKey) {
      this.account = { projectId, clientEmail, privateKey };
    }
  }

  get configured(): boolean {
    return this.account !== undefined;
  }

  async send(input: {
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<{ invalidTokens: string[] }> {
    if (!this.account) {
      throw new ServiceUnavailableException("PUSH_NOT_CONFIGURED");
    }
    const { projectId } = this.account;
    const bearer = await this.bearerToken(this.account);
    const outcomes = await Promise.all(
      input.tokens.map(async (token) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${bearer}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: input.title, body: input.body },
                data: input.data,
              },
            }),
          },
        );
        if (response.ok) return null;
        // 404 UNREGISTERED: the browser dropped this registration.
        if (response.status === 404) return token;
        throw new ServiceUnavailableException("PUSH_DELIVERY_FAILED");
      }),
    );
    return {
      invalidTokens: outcomes.filter((token): token is string => !!token),
    };
  }

  /** OAuth2 JWT-bearer grant, cached until a minute before expiry. */
  private async bearerToken(account: ServiceAccount): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > now) {
      return this.accessToken.value;
    }
    const issuedAt = Math.floor(now / 1000);
    const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
      iss: account.clientEmail,
      scope: messagingScope,
      aud: tokenEndpoint,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })}`;
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(account.privateKey, "base64url");
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
      }),
    });
    const grant = response.ok
      ? ((await response.json()) as {
          access_token?: unknown;
          expires_in?: unknown;
        })
      : {};
    if (typeof grant.access_token !== "string") {
      throw new ServiceUnavailableException("PUSH_AUTH_FAILED");
    }
    this.accessToken = {
      value: grant.access_token,
      expiresAt: now + Number(grant.expires_in ?? 3600) * 1000,
    };
    return grant.access_token;
  }
}
