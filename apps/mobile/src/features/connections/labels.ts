import { z } from "zod";
import { AppError } from "@/lib/http/errors";
import { parse, resourcePath, uuid } from "@/lib/http/contracts";
import { useConnections } from "./runtime";
import { useConnectionQuery } from "./hooks";

export function useParticipantProfile(id: string | undefined) {
  const { call } = useConnections();
  return useConnectionQuery(
    ["participant-profile", id],
    async (signal) => {
      const profile = parse(
        z.object({
          userId: uuid,
          fullName: z.string(),
          avatarUrl: z.string().nullable(),
        }),
        await call(resourcePath("profiles", id!), { signal }),
      );
      if (profile.userId !== id) throw new AppError("protocol");
      return profile;
    },
    uuid.safeParse(id).success,
  );
}

export function useParticipantName(id: string | undefined) {
  const { call } = useConnections();
  return useConnectionQuery(
    ["participant", id],
    async (signal) => {
      const profile = parse(
        z.object({ userId: uuid, fullName: z.string() }),
        await call(resourcePath("profiles", id!), { signal }),
      );
      if (profile.userId !== id) throw new AppError("protocol");
      return profile.fullName;
    },
    uuid.safeParse(id).success,
  );
}
export function useCatalogName(id: string | undefined) {
  const { call } = useConnections();
  return useConnectionQuery(
    ["catalog", id],
    async (signal) => {
      const skill = parse(
        z.object({ id: uuid, name: z.string() }),
        await call(resourcePath("skills", id!), { signal }),
      );
      if (skill.id !== id) throw new AppError("protocol");
      return skill.name;
    },
    uuid.safeParse(id).success,
  );
}
