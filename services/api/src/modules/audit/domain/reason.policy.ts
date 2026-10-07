import { BadRequestException } from "@nestjs/common";

export type ReasonBounds = { min: number; max: number };

export function validateReason(value: unknown, bounds: ReasonBounds): string {
  if (typeof value !== "string") {
    throw new BadRequestException("Invalid reason");
  }
  const reason = value.trim();
  const length = Array.from(reason).length;
  if (length < bounds.min || length > bounds.max) {
    throw new BadRequestException("Invalid reason");
  }
  return reason;
}
