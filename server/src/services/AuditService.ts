import pool from '../config/database.js';

export async function writeAuditLog(params: {
  userId?: number | null;
  action: string;
  auditableType: string;
  auditableId?: number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, action, auditable_type, auditable_id, old_values, new_values, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      params.userId ?? null,
      params.action,
      params.auditableType,
      params.auditableId ?? null,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ]
  );
}
