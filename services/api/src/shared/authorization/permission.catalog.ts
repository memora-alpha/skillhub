// Codes are explicit actions. Role grants are stored separately by users.
export const PERMISSION_CATALOG = [
  { code: "tag:read", description: "Read the complete tag catalog" },
  { code: "tag:create", description: "Create canonical tags" },
  { code: "tag:update", description: "Update and hide canonical tags" },
  { code: "tag-request:create:self", description: "Propose a new tag" },
  { code: "tag-request:read:self", description: "Read own tag requests" },
  { code: "tag-request:read", description: "Read all tag requests" },
  { code: "tag-request:approve", description: "Approve tag requests" },
  { code: "tag-request:reject", description: "Reject tag requests" },
  {
    code: "skill-level:manage",
    description: "Manage per-skill level catalogs",
  },
  {
    code: "sharing-skill:create:self",
    description: "Create own sharing skill",
  },
  {
    code: "sharing-skill:archive:self",
    description: "Archive own sharing skill",
  },
  {
    code: "sharing-skill:restore:self",
    description: "Restore own archived sharing skill",
  },
  {
    code: "skill-verification:submit:self",
    description: "Submit own evidence",
  },
  { code: "skill-catalog:create", description: "Create catalog skill" },
  { code: "skill-catalog:update", description: "Update catalog skill" },
  { code: "skill-catalog:archive", description: "Archive catalog skill" },
  {
    code: "skill-catalog:restore",
    description: "Restore archived catalog skill",
  },
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
  { code: "learning-request:read", description: "Read learning requests" },
  {
    code: "learning-request:update:self",
    description: "Update own learning request",
  },
  {
    code: "learning-request:cancel:self",
    description: "Cancel own learning request before schedule lock",
  },
  {
    code: "learning-request:moderation:read",
    description: "Read flagged learning requests",
  },
  { code: "learning-request:approve", description: "Approve flagged request" },
  { code: "learning-request:reject", description: "Reject flagged request" },
  {
    code: "learning-request:moderation:configure",
    description: "Configure learning request moderation rules",
  },
  {
    code: "notification:read:self",
    description: "Read own in-app notifications",
  },
  {
    code: "notification:update:self",
    description: "Mark own notifications as read",
  },
  { code: "proposal:create", description: "Create proposal" },
  { code: "event:read:self", description: "Read own application event stream" },
  { code: "proposal:read:party", description: "Read own proposals" },
  { code: "proposal:update:self", description: "Update own pending proposals" },
  {
    code: "proposal:accept:recipient",
    description: "Accept proposals addressed to self",
  },
  {
    code: "proposal:reject:recipient",
    description: "Reject proposals addressed to self",
  },
  { code: "proposal:withdraw:self", description: "Withdraw own proposals" },
  {
    code: "message:create:participant",
    description: "Send participant messages",
  },
  { code: "message:delivery:read:self", description: "Read own send receipts" },
  {
    code: "conversation:read-state:update:self",
    description: "Advance own read watermark",
  },
  {
    code: "message:attachment:create:participant",
    description: "Upload own chat files",
  },
  {
    code: "message:attachment:read:participant",
    description: "Download published participant files",
  },
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
  {
    code: "report:moderate",
    description: "Process session reports and disputes",
  },
  {
    code: "credit:reverse:settlement",
    description: "Reverse a settled Credit operation",
  },
  { code: "dispute:override", description: "Override a dispute decision" },
  {
    code: "material:create:self",
    description: "Create, edit and submit own learning materials",
  },
  {
    code: "material:access",
    description: "Download, purchase and report learning materials",
  },
  {
    code: "material:moderate",
    description: "Review, hide and restore learning materials",
  },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];
