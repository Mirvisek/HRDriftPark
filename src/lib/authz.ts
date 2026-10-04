import { createHash, randomBytes, randomInt } from "crypto";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export type AppRole = "owner" | "manager" | "employee" | "technik";

const ROLE_RANK: Record<AppRole, number> = {
  employee: 1,
  technik: 2,
  manager: 3,
  owner: 4,
};

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS) as PermissionKey[];

export function isAppRole(role: string): role is AppRole {
  return role in ROLE_RANK;
}

/** Owner outranks everyone; otherwise actor must strictly outrank target. */
export function canManageTargetRole(actorRole: string, targetRole: string): boolean {
  if (!isAppRole(actorRole) || !isAppRole(targetRole)) return false;
  if (actorRole === "owner") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

/** Roles a caller is allowed to assign. */
export function assignableRoles(actorRole: string): AppRole[] {
  if (actorRole === "owner") return ["owner", "manager", "employee", "technik"];
  if (actorRole === "manager") return ["employee", "technik"];
  return [];
}

export function parsePermissionCsv(raw: unknown): PermissionKey[] {
  const parts =
    typeof raw === "string"
      ? raw.split(",")
      : Array.isArray(raw)
        ? raw.map(String)
        : [];
  const allowed = new Set<string>(ALL_PERMISSION_KEYS);
  return parts
    .map((p) => p.trim())
    .filter((p): p is PermissionKey => allowed.has(p));
}

/**
 * Non-owners may only grant permissions they already hold.
 * Owners may grant any known permission key.
 */
export function sanitizeGrantedPermissions(
  actor: { role?: string; permissions?: unknown },
  requested: string | undefined
): string {
  const requestedKeys = parsePermissionCsv(requested ?? "");
  if (actor.role === "owner") {
    return requestedKeys.join(",");
  }

  const actorKeys = new Set(parsePermissionCsv(actor.permissions));
  return requestedKeys.filter((k) => actorKeys.has(k)).join(",");
}

export function generateTempPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): { token: string; tokenHash: string; expires: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expires: new Date(Date.now() + 60 * 60 * 1000),
  };
}

const STATIC_ALLOWED_SETTINGS_KEYS = new Set([
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_password",
  "smtp_from",
  "site_url",
  "site_name",
  "site_address",
  "site_nip",
  "site_regon",
  "site_phone",
  "site_timezone",
  "site_logo",
  "site_currency",
  "site_date_format",
  "template_shift_reminder_lead",
  "template_shift_reminder_support",
  "template_shift_reminder_event",
  "template_assignment_lead",
  "template_assignment_support",
  "template_assignment_event",
  "template_hours_change",
  "template_schedule_published",
  "template_push_msg",
  "anomaly_long_shift_hours",
  "anomaly_missing_checkout_hours",
  "anomaly_schedule_deviation_minutes",
  "anomaly_min_rest_hours",
  "availability_lock_day",
  "cron_availability_lock_day",
  "cron_reminder_hour",
  "alert_expiry_days",
  "alert_low_stock_global",
  "warehouse_suppliers",
  "warehouse_locations",
  "sms_api_key",
  "sms_sender_name",
  "security_session_hours",
  "security_force_password_days",
  "security_2fa_required",
  "require_delete_reason",
  "max_upload_size_mb",
  "sound_notifications_enabled",
  "holiday_dates",
]);

export function isAllowedSettingsKey(key: string): boolean {
  if (STATIC_ALLOWED_SETTINGS_KEYS.has(key)) return true;
  if (key.startsWith("template_")) return true;
  if (key.startsWith("schedule_published_")) return true;
  if (key.startsWith("anomaly_")) return true;
  if (key.startsWith("alert_")) return true;
  if (key.startsWith("cron_")) return true;
  if (key.startsWith("warehouse_")) return true;
  if (key.startsWith("security_")) return true;
  if (key.startsWith("sms_")) return true;
  if (key.startsWith("site_")) return true;
  return false;
}

/** Keys redacted from settings reads and database backups. */
export const SECRET_SETTINGS_KEYS = new Set([
  "smtp_password",
  "sms_api_key",
]);

/** Prefer env base URL for password-reset links to prevent site_url phishing. */
export function getTrustedBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
