/**
 * Role-based permissions, checked on the server by every mutation (see
 * `requirePermission` in lib/auth/context.ts). Hiding buttons in the UI is a
 * convenience on top of this, never a substitute.
 */

export const ROLES = ["agency_admin", "admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export const SUB_ACCOUNT_ROLES = ["admin", "user"] as const;
export type SubAccountRole = (typeof SUB_ACCOUNT_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  agency_admin: "Agency Admin",
  admin: "Sub-Account Admin",
  user: "Sub-Account User",
};

const RANK: Record<Role, number> = { user: 1, admin: 2, agency_admin: 3 };

/** Minimum role required for each action. */
const PERMISSIONS = {
  "contacts:write": "user",
  "contacts:delete": "admin",
  "notes:write": "user",
  "tasks:write": "user",
  "opportunities:write": "user",
  "pipelines:manage": "admin",
  "appointments:write": "user",
  "campaigns:manage": "admin",
  "campaigns:enroll": "user",
  "workflows:manage": "admin",
  "automation:process": "user",
  "payments:collect": "admin",
  "team:manage": "admin",
  "agency:manage": "agency_admin",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return RANK[role] >= RANK[PERMISSIONS[permission]];
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`You do not have permission to do that (${permission}).`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}
