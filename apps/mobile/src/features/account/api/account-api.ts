import type { HttpClient } from "@/lib/http/client";
import {
  parseIdentity,
  parseProfile,
  type ProfilePatch,
} from "./account-contracts";

export function createAccountApi(client: HttpClient) {
  return {
    getMe: async () =>
      parseIdentity(await client.request("/me", { authenticated: true })),
    updateProfile: async (body: ProfilePatch) =>
      parseProfile(
        await client.request("/me/profile", {
          method: "PATCH",
          body,
          authenticated: true,
        }),
      ),
  };
}
