import type { HttpClient } from "@/lib/http/client";
import { parseAvatarUpload } from "./avatar-contracts";
import { AppError } from "@/lib/http/errors";
import {
  parseIdentity,
  parseProfile,
  type ProfilePatch,
} from "./account-contracts";

export function createAccountApi(client: HttpClient) {
  return {
    uploadAvatar: async (body: FormData) =>
      parseAvatarUpload(
        await client.request("/me/avatar", {
          method: "POST",
          body,
          multipart: true,
          authenticated: true,
        }),
      ),
    getAvatarUpload: async (assetId: string) => {
      const upload = parseAvatarUpload(
        await client.request(
          `/me/avatar/uploads/${encodeURIComponent(assetId)}`,
          { authenticated: true },
        ),
      );
      if (upload.assetId !== assetId) throw new AppError("protocol");
      return upload;
    },
    removeAvatar: async () => {
      await client.request("/me/avatar", {
        method: "DELETE",
        authenticated: true,
      });
    },
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
