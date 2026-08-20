import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../services/AuditService.js';
import { clearHierarchyCache } from '../services/HierarchyService.js';

const USER_SELECT = `
  u.id, u.username, u.staff_code, u.email, u.role, u.role_id, u.full_name,
  u.first_name_lo, u.last_name_lo, u.first_name_en, u.last_name_en,
  u.phone, u.position_id, u.division_id, u.supervisor_id, u.locale_pref,
  u.avatar_path, u.bio, u.country, u.city, u.postal_code,
  u.facebook_url, u.twitter_url, u.linkedin_url, u.instagram_url,
  u.must_change_password, u.is_active, u.last_login_at, u.created_at, u.updated_at,
  r.code AS role_code, r.data_scope, r.name_en AS role_name_en, r.name_lo AS role_name_lo,
  p.code AS position_code, p.name_en AS position_name_en, p.name_lo AS position_name_lo,
  d.code AS division_code, d.name_en AS division_name_en, d.name_lo AS division_name_lo
`;

function signToken(user: { id: number; username: string; email: string; role: string; role_code?: string }) {
  const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_code || user.role,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
  );
}

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, staff_code } = req.body;
    const identifier = (staff_code || email || username || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: 'staff_code/email and password are required' });
    }

    const result = await pool.query(
      `SELECT u.*, r.code AS role_code, r.data_scope
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = true AND u.deleted_at IS NULL
         AND (u.username = $1 OR u.email = $1 OR u.staff_code = $1)
       LIMIT 1`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await pool.query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);
    clearHierarchyCache();

    const token = signToken(user);
    const { password: _, ...safe } = user;
    return res.json({
      success: true,
      message: 'Login successful',
      data: { user: safe, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const result = await pool.query(
      `SELECT ${USER_SELECT}
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
       WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    const perms = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permission rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [result.rows[0].role_id]
    );

    return res.json({
      success: true,
      data: { ...result.rows[0], permissions: perms.rows.map((p: { code: string }) => p.code) },
    });
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.must_change_password) {
      if (!current_password || !(await bcrypt.compare(current_password, user.password))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hash, req.user.id]
    );
    await writeAuditLog({
      userId: req.user.id,
      action: 'change_password',
      auditableType: 'user',
      auditableId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

function buildFullName(body: {
  first_name_en?: string | null;
  last_name_en?: string | null;
  first_name_lo?: string | null;
  last_name_lo?: string | null;
  full_name?: string | null;
}) {
  const en = [body.first_name_en, body.last_name_en].filter(Boolean).join(' ').trim();
  const lo = [body.first_name_lo, body.last_name_lo].filter(Boolean).join(' ').trim();
  return body.full_name?.trim() || en || lo || null;
}

/** Authenticated user updates their own profile (not role / org assignment). */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const id = req.user.id;
    const {
      first_name_lo, last_name_lo, first_name_en, last_name_en,
      email, phone, bio, country, city, postal_code, locale_pref,
      facebook_url, twitter_url, linkedin_url, instagram_url, avatar_path,
    } = req.body;

    if (email !== undefined && !String(email).includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const old = await pool.query(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'User not found' });

    const next = {
      first_name_lo: first_name_lo !== undefined ? first_name_lo : old.rows[0].first_name_lo,
      last_name_lo: last_name_lo !== undefined ? last_name_lo : old.rows[0].last_name_lo,
      first_name_en: first_name_en !== undefined ? first_name_en : old.rows[0].first_name_en,
      last_name_en: last_name_en !== undefined ? last_name_en : old.rows[0].last_name_en,
    };
    const full_name = buildFullName(next);

    const result = await pool.query(
      `UPDATE users SET
         first_name_lo = $2,
         last_name_lo = $3,
         first_name_en = $4,
         last_name_en = $5,
         full_name = $6,
         email = $7,
         phone = NULLIF($8, ''),
         bio = NULLIF($9, ''),
         country = NULLIF($10, ''),
         city = NULLIF($11, ''),
         postal_code = NULLIF($12, ''),
         locale_pref = COALESCE(NULLIF($13, ''), locale_pref),
         facebook_url = NULLIF($14, ''),
         twitter_url = NULLIF($15, ''),
         linkedin_url = NULLIF($16, ''),
         instagram_url = NULLIF($17, ''),
         avatar_path = COALESCE($18, avatar_path),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [
        id,
        next.first_name_lo || null,
        next.last_name_lo || null,
        next.first_name_en || null,
        next.last_name_en || null,
        full_name,
        email !== undefined ? String(email).trim() : old.rows[0].email,
        phone !== undefined ? String(phone).trim() : (old.rows[0].phone || ''),
        bio !== undefined ? String(bio) : (old.rows[0].bio || ''),
        country !== undefined ? String(country).trim() : (old.rows[0].country || ''),
        city !== undefined ? String(city).trim() : (old.rows[0].city || ''),
        postal_code !== undefined ? String(postal_code).trim() : (old.rows[0].postal_code || ''),
        locale_pref !== undefined ? String(locale_pref) : (old.rows[0].locale_pref || 'lo'),
        facebook_url !== undefined ? String(facebook_url).trim() : (old.rows[0].facebook_url || ''),
        twitter_url !== undefined ? String(twitter_url).trim() : (old.rows[0].twitter_url || ''),
        linkedin_url !== undefined ? String(linkedin_url).trim() : (old.rows[0].linkedin_url || ''),
        instagram_url !== undefined ? String(instagram_url).trim() : (old.rows[0].instagram_url || ''),
        avatar_path ?? null,
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    await writeAuditLog({
      userId: id,
      action: 'update_profile',
      auditableType: 'user',
      auditableId: id,
      oldValues: {
        email: old.rows[0].email,
        phone: old.rows[0].phone,
        bio: old.rows[0].bio,
      },
      newValues: { email, phone, bio, country, city },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const me = await pool.query(
      `SELECT ${USER_SELECT}
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
       WHERE u.id = $1`,
      [id]
    );

    return res.json({ success: true, data: me.rows[0] });
  } catch (e: any) {
    console.error('updateProfile error:', e);
    if (e.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
