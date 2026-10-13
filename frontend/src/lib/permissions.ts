// ── Centralized frontend RBAC ──────────────────────────────────────────────
// Single source of truth for every visibility / notification decision in the
// UI. All role checks must derive from the session user's role
// (`useAuth().user.role`) — never from sessionStorage, URL params, cookies or
// hardcoded values. This module only encodes the *rules*; callers pass in the
// authoritative session role.
//
// Role hierarchy (highest → lowest):  Admin > Developer
// Admins inherit visibility of everything Developers can see.

import type { Role } from "@/lib/auth";

/**
 * Can a viewer of `viewerRole` see a record/notification created by
 * `creatorRole`?
 *
 * - Admin: sees everything (Admin + Developer records).
 * - Developer: sees only Developer records (own / assigned visibility is
 *   layered on top of this by the projects layer via team membership).
 */
export function canViewRecord(
  viewerRole: Role | null | undefined,
  creatorRole: Role | null | undefined
): boolean {
  if (!viewerRole) return false;
  if (viewerRole === "Admin") return true;
  if (viewerRole === "Developer") return creatorRole === "Developer";
  return false;
}

/**
 * Whether a user of `viewerRole` should receive a notification triggered by
 * an actor of `actorRole`. Notifications flow upward through the hierarchy.
 *
 *  - Admin action     → Admin
 *  - Developer action → Developer, Admin
 */
export function canReceiveNotification(
  viewerRole: Role | null | undefined,
  actorRole: Role | null | undefined
): boolean {
  return canViewRecord(viewerRole, actorRole);
}
