import type { PaginatedHttpClient } from "@/lib/http/client";
import type { Page } from "@/lib/http/response";
import { AppError } from "@/lib/http/errors";
import type {
  SkillInput,
  SkillPatch,
  VerificationInput,
} from "../types/skills";
import {
  catalogSchema,
  ownSkillSchema,
  publicSkillSchema,
  verificationSchema,
  fileStatusSchema,
  downloadSchema,
  parseContract,
  parseOwnMutation,
} from "./skill-contracts";
import type { z } from "zod";

export function queryString(
  values: Record<string, string | boolean | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) params.set(key, String(value));
  return `?${params.toString()}`;
}
export function createSkillsApi(client: PaginatedHttpClient) {
  async function page<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<Page<T>> {
    const result = await client.requestPage(path, {
      authenticated: true,
      signal,
    });
    return {
      ...result,
      data: result.data.map((value) => parseContract(schema, value)),
    };
  }
  const own = (
    includeArchived = false,
    cursor?: string,
    signal?: AbortSignal,
  ) =>
    page(
      `/me/skills${queryString({ includeArchived, cursor })}`,
      ownSkillSchema,
      signal,
    );
  const root = (id: string) => `/me/skills/${encodeURIComponent(id)}`;
  const mutate = (
    path: string,
    body: unknown,
    key: string,
    method: "POST" | "PATCH" = "POST",
  ) =>
    client.request(path, {
      method,
      body,
      idempotencyKey: key,
      authenticated: true,
    });
  return {
    own,
    catalog: (q?: string, cursor?: string, signal?: AbortSignal) =>
      page(`/skills${queryString({ q, cursor })}`, catalogSchema, signal),
    publicSkills: (userId: string, cursor?: string, signal?: AbortSignal) =>
      page(
        `/profiles/${encodeURIComponent(userId)}/skills${queryString({ cursor })}`,
        publicSkillSchema,
        signal,
      ),
    async findOwn(id: string, signal?: AbortSignal) {
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        if (signal?.aborted) throw new AppError("session");
        const result = await own(false, cursor, signal);
        const found = result.data.find((item) => item.id === id);
        if (found?.archivedAt) return null;
        if (found) return found;
        if (!result.pagination.hasMore) return null;
        cursor = result.pagination.nextCursor ?? undefined;
        if (!cursor || seen.has(cursor)) throw new AppError("protocol");
        seen.add(cursor);
      } while (cursor);
      return null;
    },
    create: async (body: SkillInput, key: string) =>
      parseOwnMutation(
        await mutate("/me/skills", body, key),
        undefined,
        body.skillId,
      ),
    update: async (id: string, body: SkillPatch, key: string) =>
      parseOwnMutation(await mutate(root(id), body, key, "PATCH"), id),
    archive: async (id: string, expectedVersion: number, key: string) => {
      const result = parseOwnMutation(
        await mutate(`${root(id)}/archive`, { expectedVersion }, key),
        id,
      );
      if (!result.archivedAt) throw new AppError("protocol");
      return result;
    },
    async upload(id: string, body: FormData) {
      return parseContract(
        fileStatusSchema,
        await client.request(`${root(id)}/evidence-files`, {
          method: "POST",
          body,
          multipart: true,
          authenticated: true,
          replayAfterRenewal: false,
        }),
      );
    },
    async fileStatus(id: string, fileId: string, signal?: AbortSignal) {
      const file = parseContract(
        fileStatusSchema,
        await client.request(
          `${root(id)}/evidence-files/${encodeURIComponent(fileId)}`,
          { authenticated: true, signal },
        ),
      );
      if (file.fileId !== fileId) throw new AppError("protocol");
      return file;
    },
    history: async (id: string, cursor?: string, signal?: AbortSignal) => {
      const result = await page(
        `${root(id)}/verifications${queryString({ cursor })}`,
        verificationSchema,
        signal,
      );
      if (result.data.some((batch) => batch.sharingSkillId !== id))
        throw new AppError("protocol");
      return result;
    },
    async verification(
      id: string,
      verificationId: string,
      signal?: AbortSignal,
    ) {
      const result = parseContract(
        verificationSchema,
        await client.request(
          `${root(id)}/verifications/${encodeURIComponent(verificationId)}`,
          { authenticated: true, signal },
        ),
      );
      if (result.id !== verificationId || result.sharingSkillId !== id)
        throw new AppError("protocol");
      return result;
    },
    submit: async (id: string, body: VerificationInput, key: string) => {
      const result = parseContract(
        verificationSchema,
        await mutate(`${root(id)}/verifications`, body, key),
      );
      if (result.sharingSkillId !== id) throw new AppError("protocol");
      return result;
    },
    download: async (id: string, evidenceId: string, signal?: AbortSignal) =>
      parseContract(
        downloadSchema,
        await client.request(
          `${root(id)}/evidence/${encodeURIComponent(evidenceId)}/download`,
          { authenticated: true, signal },
        ),
      ),
  };
}
