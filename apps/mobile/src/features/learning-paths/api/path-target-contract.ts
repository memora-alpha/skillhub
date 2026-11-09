import { z } from "zod";
import { uuid } from "@/lib/http/contracts";

// Unknown types remain readable, but navigation only accepts known local targets.
export const pathTarget = z.object({ type: z.string().min(1), id: uuid });
export type PathTarget = z.infer<typeof pathTarget>;
