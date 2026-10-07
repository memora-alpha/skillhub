// Codes are explicit actions. Role grants are stored separately by users.
export const PERMISSION_CATALOG = [
  {
    code: "sharing-skill:create:self",
    description: "Create own sharing skill",
  },
  {
    code: "sharing-skill:archive:self",
    description: "Archive own sharing skill",
  },
  {
    code: "skill-verification:submit:self",
    description: "Submit own evidence",
  },
  { code: "skill-catalog:create", description: "Create catalog skill" },
  { code: "skill-catalog:update", description: "Update catalog skill" },
  { code: "skill-catalog:archive", description: "Archive catalog skill" },
  { code: "profile:read:self", description: "Read own profile" },
  { code: "profile:update:self", description: "Update own profile" },
  {
    code: "sharing-skill:update:self",
    description: "Update own sharing skill",
  },
  { code: "skill-verification:read", description: "Read verification queue" },
  { code: "skill-verification:approve", description: "Approve skill evidence" },
  { code: "skill-verification:reject", description: "Reject skill evidence" },
  {
    code: "skill-verification:revoke",
    description: "Revoke approved evidence",
  },
  { code: "learning-request:create", description: "Create learning request" },
  { code: "learning-request:approve", description: "Approve flagged request" },
  { code: "learning-request:reject", description: "Reject flagged request" },
  { code: "proposal:create", description: "Create proposal" },
  {
    code: "conversation:read:participant",
    description: "Read participant chat",
  },
  { code: "session:read:participant", description: "Read participant session" },
  {
    code: "livekit-token:issue:participant",
    description: "Issue participant token",
  },
  { code: "credit:adjust", description: "Adjust credit with audit" },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];
