import pool from '../config/database.js';
import { HierarchyUser } from './HierarchyService.js';
import { HierarchyService } from './HierarchyService.js';
import { ActivityPolicy } from '../policies/ActivityPolicy.js';
import { writeAuditLog } from './AuditService.js';

/** Upper bound on rows any single list/export request may return. */
export const EXPORT_MAX_ROWS = 5000;

export interface ActivityInput {
  user_id?: number;
  division_id?: number | null;
  activity_type_id: number;
  title_lo: string;
  title_en?: string | null;
  description?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean;
  location?: string | null;
  status?: string;
  progress_percent?: number;
  priority?: string;
  parent_activity_id?: number | null;
  assigned_by_user_id?: number | null;
  participants?: Array<{
    user_id?: number | null;
    external_name?: string | null;
    role_in_activity?: string | null;
  }>;
}

function computeDurationMinutes(input: {
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean;
}): number {
  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;

  if (input.is_all_day || !input.start_time || !input.end_time) {
    return days * 8 * 60; // nominal working day minutes for all-day spans
  }

  if (input.start_date === input.end_date) {
    const [sh, sm] = input.start_time.split(':').map(Number);
    const [eh, em] = input.end_time.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }

  // Multi-day with times: approximate as full days between + partial ends
  return days * 8 * 60;
}

function validateDates(input: ActivityInput): string | null {
  if (input.end_date < input.start_date) return 'end_date must be >= start_date';
  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  const spanDays =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (spanDays > 31) return 'Activity span cannot exceed 31 days';
  if (
    !input.is_all_day &&
    input.start_date === input.end_date &&
    input.start_time &&
    input.end_time &&
    input.end_time <= input.start_time
  ) {
    return 'end_time must be after start_time on the same day';
  }
  return null;
}

async function checkRetroactive(me: HierarchyUser, startDate: string): Promise<string | null> {
  if (me.role_code === 'super_admin') return null;
  const settings = await pool.query(
    `SELECT value_json FROM settings WHERE key = 'retroactive_entry_days'`
  );
  const days = Number(settings.rows[0]?.value_json ?? 14);
  const min = new Date();
  min.setDate(min.getDate() - days);
  const minStr = min.toISOString().slice(0, 10);
  if (startDate < minStr) {
    return `Cannot create activities older than ${days} days`;
  }
  return null;
}

export const ActivityService = {
  computeDurationMinutes,

  async findOverlaps(userId: number, startDate: string, endDate: string, excludeId?: number) {
    const result = await pool.query(
      `SELECT id, title_lo, start_date, end_date, start_time, end_time
       FROM activities
       WHERE user_id = $1 AND deleted_at IS NULL
         AND start_date <= $3 AND end_date >= $2
         AND ($4::int IS NULL OR id <> $4)`,
      [userId, startDate, endDate, excludeId ?? null]
    );
    return result.rows;
  },

  async list(
    me: HierarchyUser,
    filters: {
      start_date?: string;
      end_date?: string;
      status?: string;
      activity_type_id?: number;
      user_id?: number;
      division_id?: number;
      q?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const visible = await HierarchyService.visibleUserIds(me);
    const params: unknown[] = [visible];
    let where = `a.deleted_at IS NULL AND a.user_id = ANY($1::int[])`;

    if (filters.start_date) {
      params.push(filters.start_date);
      where += ` AND a.end_date >= $${params.length}`;
    }
    if (filters.end_date) {
      params.push(filters.end_date);
      where += ` AND a.start_date <= $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      where += ` AND a.status = $${params.length}`;
    }
    if (filters.activity_type_id) {
      params.push(filters.activity_type_id);
      where += ` AND a.activity_type_id = $${params.length}`;
    }
    if (filters.user_id) {
      params.push(filters.user_id);
      where += ` AND a.user_id = $${params.length}`;
    }
    if (filters.division_id) {
      params.push(filters.division_id);
      where += ` AND a.division_id = $${params.length}`;
    }
    if (filters.q && filters.q.trim()) {
      params.push(`%${filters.q.trim()}%`);
      where += ` AND (a.title_lo ILIKE $${params.length}
                  OR a.title_en ILIKE $${params.length}
                  OR a.location ILIKE $${params.length})`;
    }

    const total = await pool.query(
      `SELECT COUNT(*)::int AS count FROM activities a WHERE ${where}`,
      params
    );

    // A page size of 0 means "no paging" — used by the exporters, capped so a
    // single request can never pull the whole table.
    const limit = Math.min(Math.max(filters.limit ?? 500, 0) || EXPORT_MAX_ROWS, EXPORT_MAX_ROWS);
    const offset = Math.max(filters.offset ?? 0, 0);
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT a.*,
              at.code AS type_code, at.name_lo AS type_name_lo, at.name_en AS type_name_en, at.colour AS type_colour,
              u.full_name AS owner_name, u.staff_code AS owner_staff_code,
              d.name_lo AS division_name_lo, d.name_en AS division_name_en
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = a.division_id
       WHERE ${where}
       ORDER BY a.start_date DESC, a.start_time DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, total: total.rows[0].count as number, limit, offset };
  },

  async getById(me: HierarchyUser, id: number) {
    const result = await pool.query(
      `SELECT a.*,
              at.code AS type_code, at.name_lo AS type_name_lo, at.name_en AS type_name_en, at.colour AS type_colour,
              u.full_name AS owner_name
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id]
    );
    const activity = result.rows[0];
    if (!activity) return null;
    if (!(await ActivityPolicy.canView(me, activity))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }
    const participants = await pool.query(
      `SELECT * FROM activity_participants WHERE activity_id = $1`,
      [id]
    );
    const attachments = await pool.query(
      `SELECT * FROM attachments WHERE activity_id = $1`,
      [id]
    );
    const comments = await pool.query(
      `SELECT c.*, u.full_name AS author_name FROM activity_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.activity_id = $1 ORDER BY c.created_at`,
      [id]
    );
    return { ...activity, participants: participants.rows, attachments: attachments.rows, comments: comments.rows };
  },

  async create(me: HierarchyUser, input: ActivityInput, meta?: { ip?: string; ua?: string }) {
    if (!(await ActivityPolicy.canCreate(me))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }

    const ownerId = input.user_id || me.id;
    if (ownerId !== me.id) {
      if (!(await ActivityPolicy.canAssign(me, ownerId))) {
        const err = new Error('Cannot assign to this user') as Error & { status: number };
        err.status = 403;
        throw err;
      }
    }

    const dateErr = validateDates(input);
    if (dateErr) {
      const err = new Error(dateErr) as Error & { status: number };
      err.status = 400;
      throw err;
    }
    const retroErr = await checkRetroactive(me, input.start_date);
    if (retroErr) {
      const err = new Error(retroErr) as Error & { status: number };
      err.status = 400;
      throw err;
    }

    let divisionId = input.division_id;
    if (!divisionId) {
      const u = await pool.query(`SELECT division_id FROM users WHERE id = $1`, [ownerId]);
      divisionId = u.rows[0]?.division_id ?? null;
    }

    const duration = computeDurationMinutes(input);
    const overlaps = await this.findOverlaps(ownerId, input.start_date, input.end_date);

    const result = await pool.query(
      `INSERT INTO activities (
         user_id, division_id, activity_type_id, title_lo, title_en, description,
         start_date, end_date, start_time, end_time, is_all_day, duration_minutes,
         location, status, progress_percent, priority, parent_activity_id, assigned_by_user_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        ownerId,
        divisionId,
        input.activity_type_id,
        input.title_lo,
        input.title_en || null,
        input.description || null,
        input.start_date,
        input.end_date,
        input.is_all_day ? null : input.start_time || null,
        input.is_all_day ? null : input.end_time || null,
        !!input.is_all_day,
        duration,
        input.location || null,
        input.status || 'draft',
        input.progress_percent ?? 0,
        input.priority || 'normal',
        input.parent_activity_id || null,
        ownerId !== me.id ? me.id : input.assigned_by_user_id || null,
      ]
    );

    const activity = result.rows[0];
    if (input.participants?.length) {
      for (const p of input.participants) {
        await pool.query(
          `INSERT INTO activity_participants (activity_id, user_id, external_name, role_in_activity)
           VALUES ($1,$2,$3,$4)`,
          [activity.id, p.user_id || null, p.external_name || null, p.role_in_activity || null]
        );
      }
    }

    await writeAuditLog({
      userId: me.id,
      action: 'create',
      auditableType: 'activity',
      auditableId: activity.id,
      newValues: activity,
      ipAddress: meta?.ip,
      userAgent: meta?.ua,
    });

    return { activity, warnings: overlaps.length ? { overlaps } : undefined };
  },

  async update(me: HierarchyUser, id: number, input: Partial<ActivityInput>, meta?: { ip?: string; ua?: string }) {
    const existing = await pool.query(
      `SELECT * FROM activities WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const activity = existing.rows[0];
    if (!activity) return null;
    if (!(await ActivityPolicy.canUpdate(me, activity))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }

    const merged: ActivityInput = {
      activity_type_id: input.activity_type_id ?? activity.activity_type_id,
      title_lo: input.title_lo ?? activity.title_lo,
      title_en: input.title_en !== undefined ? input.title_en : activity.title_en,
      description: input.description !== undefined ? input.description : activity.description,
      start_date: input.start_date ?? activity.start_date.toISOString?.().slice(0, 10) ?? activity.start_date,
      end_date: input.end_date ?? activity.end_date.toISOString?.().slice(0, 10) ?? activity.end_date,
      start_time: input.start_time !== undefined ? input.start_time : activity.start_time,
      end_time: input.end_time !== undefined ? input.end_time : activity.end_time,
      is_all_day: input.is_all_day !== undefined ? input.is_all_day : activity.is_all_day,
      location: input.location !== undefined ? input.location : activity.location,
      progress_percent: input.progress_percent ?? activity.progress_percent,
      priority: input.priority ?? activity.priority,
      parent_activity_id: input.parent_activity_id !== undefined ? input.parent_activity_id : activity.parent_activity_id,
    };

    const dateErr = validateDates(merged);
    if (dateErr) {
      const err = new Error(dateErr) as Error & { status: number };
      err.status = 400;
      throw err;
    }

    const duration = computeDurationMinutes(merged);
    const overlaps = await this.findOverlaps(
      activity.user_id,
      merged.start_date,
      merged.end_date,
      id
    );

    const result = await pool.query(
      `UPDATE activities SET
         activity_type_id = $2, title_lo = $3, title_en = $4, description = $5,
         start_date = $6, end_date = $7, start_time = $8, end_time = $9,
         is_all_day = $10, duration_minutes = $11, location = $12,
         progress_percent = $13, priority = $14, parent_activity_id = $15,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [
        id,
        merged.activity_type_id,
        merged.title_lo,
        merged.title_en || null,
        merged.description || null,
        merged.start_date,
        merged.end_date,
        merged.is_all_day ? null : merged.start_time || null,
        merged.is_all_day ? null : merged.end_time || null,
        !!merged.is_all_day,
        duration,
        merged.location || null,
        merged.progress_percent ?? 0,
        merged.priority || 'normal',
        merged.parent_activity_id || null,
      ]
    );

    await writeAuditLog({
      userId: me.id,
      action: 'update',
      auditableType: 'activity',
      auditableId: id,
      oldValues: activity,
      newValues: result.rows[0],
      ipAddress: meta?.ip,
      userAgent: meta?.ua,
    });

    return { activity: result.rows[0], warnings: overlaps.length ? { overlaps } : undefined };
  },

  async softDelete(me: HierarchyUser, id: number) {
    const existing = await pool.query(
      `SELECT * FROM activities WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const activity = existing.rows[0];
    if (!activity) return null;
    if (!(await ActivityPolicy.canDelete(me, activity))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }
    await pool.query(
      `UPDATE activities SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return true;
  },

  async duplicate(me: HierarchyUser, id: number) {
    const source = await this.getById(me, id);
    if (!source) return null;
    const today = new Date().toISOString().slice(0, 10);
    return this.create(me, {
      activity_type_id: source.activity_type_id,
      title_lo: source.title_lo,
      title_en: source.title_en,
      description: source.description,
      start_date: today,
      end_date: today,
      start_time: source.start_time,
      end_time: source.end_time,
      is_all_day: source.is_all_day,
      location: source.location,
      priority: source.priority,
      status: 'draft',
      participants: source.participants?.map((p: { user_id: number | null; external_name: string | null; role_in_activity: string | null }) => ({
        user_id: p.user_id,
        external_name: p.external_name,
        role_in_activity: p.role_in_activity,
      })),
    });
  },

  async submit(me: HierarchyUser, id: number) {
    const existing = await pool.query(`SELECT * FROM activities WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const activity = existing.rows[0];
    if (!activity) return null;
    if (activity.user_id !== me.id && me.role_code !== 'super_admin') {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }
    if (!['draft', 'rejected'].includes(activity.status)) {
      const err = new Error('Only draft/rejected activities can be submitted') as Error & { status: number };
      err.status = 400;
      throw err;
    }
    const result = await pool.query(
      `UPDATE activities SET status = 'submitted', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async approve(me: HierarchyUser, id: number) {
    const existing = await pool.query(`SELECT * FROM activities WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const activity = existing.rows[0];
    if (!activity) return null;
    if (!(await ActivityPolicy.canApprove(me, activity))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }
    const result = await pool.query(
      `UPDATE activities SET status = 'approved', approved_by_user_id = $2, approved_at = CURRENT_TIMESTAMP,
         rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, me.id]
    );
    return result.rows[0];
  },

  async reject(me: HierarchyUser, id: number, reason: string) {
    const existing = await pool.query(`SELECT * FROM activities WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const activity = existing.rows[0];
    if (!activity) return null;
    if (!(await ActivityPolicy.canApprove(me, activity))) {
      const err = new Error('Forbidden') as Error & { status: number };
      err.status = 403;
      throw err;
    }
    if (!reason?.trim()) {
      const err = new Error('Rejection reason required') as Error & { status: number };
      err.status = 400;
      throw err;
    }
    const result = await pool.query(
      `UPDATE activities SET status = 'rejected', approved_by_user_id = $2, approved_at = CURRENT_TIMESTAMP,
         rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, me.id, reason]
    );
    return result.rows[0];
  },

  async approvalsQueue(
    me: HierarchyUser,
    filters: {
      start_date?: string;
      end_date?: string;
      activity_type_id?: number;
      user_id?: number;
      division_id?: number;
      q?: string;
    } = {}
  ) {
    const visible = await HierarchyService.visibleUserIds(me);
    const params: unknown[] = [visible, me.id];
    // The queue is always "submitted work by someone other than me that I can
    // see" — filters narrow that set, they never widen it.
    let where = `a.deleted_at IS NULL AND a.status = 'submitted'
                 AND a.user_id = ANY($1::int[]) AND a.user_id <> $2`;

    if (filters.start_date) {
      params.push(filters.start_date);
      where += ` AND a.end_date >= $${params.length}`;
    }
    if (filters.end_date) {
      params.push(filters.end_date);
      where += ` AND a.start_date <= $${params.length}`;
    }
    if (filters.activity_type_id) {
      params.push(filters.activity_type_id);
      where += ` AND a.activity_type_id = $${params.length}`;
    }
    if (filters.user_id) {
      params.push(filters.user_id);
      where += ` AND a.user_id = $${params.length}`;
    }
    if (filters.division_id) {
      params.push(filters.division_id);
      where += ` AND a.division_id = $${params.length}`;
    }
    if (filters.q && filters.q.trim()) {
      params.push(`%${filters.q.trim()}%`);
      where += ` AND (a.title_lo ILIKE $${params.length}
                  OR a.title_en ILIKE $${params.length}
                  OR a.location ILIKE $${params.length}
                  OR u.full_name ILIKE $${params.length}
                  OR u.staff_code ILIKE $${params.length})`;
    }

    const result = await pool.query(
      `SELECT a.*, at.name_lo AS type_name_lo, at.name_en AS type_name_en,
              u.full_name AS owner_name, u.staff_code AS owner_staff_code,
              d.name_lo AS division_name_lo, d.name_en AS division_name_en
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = a.division_id
       WHERE ${where}
       ORDER BY a.start_date DESC
       LIMIT ${EXPORT_MAX_ROWS}`,
      params
    );
    return result.rows;
  },

  /**
   * Per-staff reporting summary for the team page: everyone visible to `me`
   * except me, with their activity counts over the period.
   */
  async teamSummary(
    me: HierarchyUser,
    filters: {
      start_date?: string;
      end_date?: string;
      division_id?: number;
      q?: string;
      not_submitted?: boolean;
    } = {}
  ) {
    const visible = await HierarchyService.visibleUserIds(me);
    const today = new Date();
    const start =
      filters.start_date ||
      new Date(new Date().setDate(today.getDate() - 7)).toISOString().slice(0, 10);
    const end = filters.end_date || today.toISOString().slice(0, 10);

    const params: unknown[] = [visible, start, end, me.id];
    let where = `u.id = ANY($1::int[]) AND u.id <> $4 AND u.deleted_at IS NULL AND u.is_active = true`;

    if (filters.division_id) {
      params.push(filters.division_id);
      where += ` AND u.division_id = $${params.length}`;
    }
    if (filters.q && filters.q.trim()) {
      params.push(`%${filters.q.trim()}%`);
      where += ` AND (u.full_name ILIKE $${params.length}
                  OR u.staff_code ILIKE $${params.length}
                  OR u.email ILIKE $${params.length}
                  OR u.phone ILIKE $${params.length})`;
    }

    const having = filters.not_submitted
      ? `HAVING COUNT(a.id) FILTER (WHERE a.status IN ('submitted','approved')) = 0`
      : '';

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.staff_code, u.phone, u.email,
              d.name_en AS division_name_en, d.name_lo AS division_name_lo,
              COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int AS submitted_count,
              COUNT(a.id) FILTER (WHERE a.status = 'approved')::int AS approved_count,
              COUNT(a.id)::int AS activity_count,
              COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
              CASE WHEN COUNT(a.id) FILTER (WHERE a.status IN ('submitted','approved')) = 0
                THEN true ELSE false END AS not_submitted
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
         AND a.start_date <= $3 AND a.end_date >= $2
       WHERE ${where}
       GROUP BY u.id, u.full_name, u.staff_code, u.phone, u.email, d.name_en, d.name_lo
       ${having}
       ORDER BY u.full_name`,
      params
    );
    return { rows: result.rows, period: { start, end } };
  },
};
