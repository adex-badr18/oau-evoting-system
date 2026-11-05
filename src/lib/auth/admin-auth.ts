import { getDatabase } from "../database";
import { verifyPassword } from "./password";
import { decryptTotpSecret, verifyTotp } from "./totp";

export async function authenticateAdministrator(input: { email: string; password: string; totpCode?: string }) {
  const email = input.email.trim().toLowerCase();
  const result = await getDatabase().query<{ id: string; role: string; password_hash: string; mfa_enabled: boolean; mfa_secret_encrypted: string | null }>(
    `SELECT id, role, password_hash, mfa_enabled, mfa_secret_encrypted FROM admin_users WHERE email = $1 AND is_active = true`, [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(input.password, user.password_hash))) return null;
  if (user.mfa_enabled) {
    if (!input.totpCode || !user.mfa_secret_encrypted) return { mfaRequired: true as const };
    if (!verifyTotp(decryptTotpSecret(user.mfa_secret_encrypted), input.totpCode)) return null;
  }
  await getDatabase().query(`UPDATE admin_users SET updated_at = now() WHERE id = $1`, [user.id]);
  await getDatabase().query(`INSERT INTO audit_events (actor_admin_id, actor_type, action, success, metadata) VALUES ($1, 'ADMIN', 'ADMIN_LOGIN', true, '{}'::jsonb)`, [user.id]);
  return { mfaRequired: false as const, id: user.id, role: user.role };
}
