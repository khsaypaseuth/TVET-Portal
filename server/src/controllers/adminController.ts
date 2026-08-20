import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { HierarchyService, clearHierarchyCache } from '../services/HierarchyService.js';
import { writeAuditLog } from '../services/AuditService.js';

function isSuperAdmin(req: AuthRequest) {
  return req.user?.role === 'super_admin';
}

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const me = await HierarchyService.getUserWithScope(req.user!.id);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const visible = await HierarchyService.visibleUserIds(me);
    const result = await pool.query(
      `SELECT u.id, u.username, u.staff_code, u.email, u.full_name, u.role, u.role_id,
              u.position_id, u.division_id, u.supervisor_id, u.is_active, u.locale_pref,
              u.first_name_lo, u.last_name_lo, u.first_name_en, u.last_name_en, u.phone,
              r.code AS role_code, r.data_scope, p.code AS position_code,
              d.name_en AS division_name_en, d.name_lo AS division_name_lo
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
       WHERE u.deleted_at IS NULL AND u.id = ANY($1::int[])
       ORDER BY u.full_name NULLS LAST, u.username`,
      [visible]
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const {
      username, staff_code, email, password, full_name,
      first_name_lo, last_name_lo, first_name_en, last_name_en,
      phone, position_id, division_id, supervisor_id, role_id, locale_pref,
    } = req.body;

    if (!username || !email || !password || !role_id) {
      return res.status(400).json({ error: 'username, email, password, role_id required' });
    }

    if (supervisor_id) {
      // temporary id unknown — cycle check after insert not needed for create with supervisor
    }

    const hash = await bcrypt.hash(password, 10);
    const roleRes = await pool.query(`SELECT code FROM roles WHERE id = $1`, [role_id]);
    const roleCode = roleRes.rows[0]?.code || 'tech';

    const result = await pool.query(
      `INSERT INTO users (
         username, staff_code, email, password, role, role_id, full_name,
         first_name_lo, last_name_lo, first_name_en, last_name_en,
         phone, position_id, division_id, supervisor_id, locale_pref, must_change_password, is_active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,true)
       RETURNING id, username, staff_code, email, full_name, role, role_id, position_id, division_id, supervisor_id, is_active`,
      [
        username,
        staff_code || username,
        email,
        hash,
        roleCode,
        role_id,
        full_name || null,
        first_name_lo || null,
        last_name_lo || null,
        first_name_en || null,
        last_name_en || null,
        phone || null,
        position_id || null,
        division_id || null,
        supervisor_id || null,
        locale_pref || 'lo',
      ]
    );

    if (supervisor_id) {
      const cycle = await HierarchyService.wouldCreateCycle(result.rows[0].id, supervisor_id);
      if (cycle) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [result.rows[0].id]);
        return res.status(400).json({ error: 'Supervisor assignment would create a cycle' });
      }
    }

    clearHierarchyCache();
    await writeAuditLog({
      userId: req.user!.id,
      action: 'create',
      auditableType: 'user',
      auditableId: result.rows[0].id,
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    console.error(e);
    if (e.code === '23505') return res.status(400).json({ error: 'Username, email or staff_code already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    const {
      email, full_name, first_name_lo, last_name_lo, first_name_en, last_name_en,
      phone, position_id, division_id, supervisor_id, role_id, locale_pref, is_active, staff_code,
      password,
    } = req.body;

    if (supervisor_id !== undefined) {
      const cycle = await HierarchyService.wouldCreateCycle(id, supervisor_id);
      if (cycle) return res.status(400).json({ error: 'Supervisor assignment would create a cycle' });
    }

    let roleCode: string | undefined;
    if (role_id) {
      const roleRes = await pool.query(`SELECT code FROM roles WHERE id = $1`, [role_id]);
      roleCode = roleRes.rows[0]?.code;
    }

    const old = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'User not found' });

    const hash = password ? await bcrypt.hash(password, 10) : null;

    const result = await pool.query(
      `UPDATE users SET
         email = COALESCE($2, email),
         full_name = COALESCE($3, full_name),
         first_name_lo = COALESCE($4, first_name_lo),
         last_name_lo = COALESCE($5, last_name_lo),
         first_name_en = COALESCE($6, first_name_en),
         last_name_en = COALESCE($7, last_name_en),
         phone = COALESCE($8, phone),
         position_id = COALESCE($9, position_id),
         division_id = COALESCE($10, division_id),
         supervisor_id = $11,
         role_id = COALESCE($12, role_id),
         role = COALESCE($13, role),
         locale_pref = COALESCE($14, locale_pref),
         is_active = COALESCE($15, is_active),
         staff_code = COALESCE($16, staff_code),
         password = COALESCE($17, password),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, username, staff_code, email, full_name, role, role_id, position_id, division_id, supervisor_id, is_active`,
      [
        id,
        email ?? null,
        full_name ?? null,
        first_name_lo ?? null,
        last_name_lo ?? null,
        first_name_en ?? null,
        last_name_en ?? null,
        phone ?? null,
        position_id ?? null,
        division_id ?? null,
        supervisor_id === undefined ? old.rows[0].supervisor_id : supervisor_id,
        role_id ?? null,
        roleCode ?? null,
        locale_pref ?? null,
        is_active ?? null,
        staff_code ?? null,
        hash,
      ]
    );

    clearHierarchyCache();
    await writeAuditLog({
      userId: req.user!.id,
      action: 'update',
      auditableType: 'user',
      auditableId: id,
      oldValues: { ...old.rows[0], password: undefined },
      newValues: result.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivateUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE users SET is_active = false, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    clearHierarchyCache();
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listDivisions = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.full_name AS head_name
       FROM divisions d
       LEFT JOIN users u ON u.id = d.head_user_id
       WHERE d.is_active = true
       ORDER BY d.sort_order, d.name_en`
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDivision = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const { code, name_lo, name_en, parent_id, head_user_id, sort_order } = req.body;
    if (!code || !name_lo || !name_en) {
      return res.status(400).json({ error: 'code, name_lo, name_en required' });
    }
    const result = await pool.query(
      `INSERT INTO divisions (code, name_lo, name_en, parent_id, head_user_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, name_lo, name_en, parent_id || null, head_user_id || null, sort_order || 0]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    if (e.code === '23505') return res.status(400).json({ error: 'Division code exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateDivision = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    const { name_lo, name_en, parent_id, head_user_id, sort_order, is_active } = req.body;
    const result = await pool.query(
      `UPDATE divisions SET
         name_lo = COALESCE($2, name_lo),
         name_en = COALESCE($3, name_en),
         parent_id = COALESCE($4, parent_id),
         head_user_id = COALESCE($5, head_user_id),
         sort_order = COALESCE($6, sort_order),
         is_active = COALESCE($7, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name_lo, name_en, parent_id, head_user_id, sort_order, is_active]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listPositions = async (_req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT * FROM positions WHERE COALESCE(is_active, true) = true ORDER BY rank_level, name_en`
  );
  return res.json({ success: true, data: result.rows });
};

export const createPosition = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const { code, name_lo, name_en, rank_level } = req.body;
    if (!code || !name_lo || !name_en || rank_level === undefined || rank_level === null) {
      return res.status(400).json({ error: 'code, name_lo, name_en, rank_level required' });
    }
    const result = await pool.query(
      `INSERT INTO positions (code, name_lo, name_en, rank_level)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [code, name_lo, name_en, Number(rank_level)]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e: any) {
    if (e.code === '23505') return res.status(400).json({ error: 'Position code exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePosition = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    const { name_lo, name_en, rank_level, is_active } = req.body;
    const result = await pool.query(
      `UPDATE positions SET
         name_lo = COALESCE($2, name_lo),
         name_en = COALESCE($3, name_en),
         rank_level = COALESCE($4, rank_level),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name_lo ?? null, name_en ?? null, rank_level ?? null, is_active ?? null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Position not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivatePosition = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE positions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deactivateDivision = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE divisions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listRoles = async (_req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT * FROM roles ORDER BY id`);
  return res.json({ success: true, data: result.rows });
};

export const setOversight = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = Number(req.params.id);
    const { division_ids } = req.body as { division_ids: number[] };
    await pool.query(`DELETE FROM division_user_oversight WHERE user_id = $1`, [userId]);
    for (const divisionId of division_ids || []) {
      await pool.query(
        `INSERT INTO division_user_oversight (user_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, divisionId]
      );
    }
    clearHierarchyCache();
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!isSuperAdmin(req) && req.user?.role !== 'dg') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await pool.query(
      `SELECT a.*, u.full_name AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 200`
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
