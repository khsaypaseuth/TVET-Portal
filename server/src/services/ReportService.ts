import pool from '../config/database.js';
import { HierarchyService, HierarchyUser } from './HierarchyService.js';

export interface ReportFilter {
  period_type?: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  start_date: string;
  end_date: string;
  scope?: 'me' | 'user' | 'division' | 'department';
  user_ids?: number[];
  division_ids?: number[];
  activity_type_ids?: number[];
  statuses?: string[];
}

async function resolveUserIds(me: HierarchyUser, filter: ReportFilter): Promise<number[]> {
  const visible = await HierarchyService.visibleUserIds(me);
  if (filter.scope === 'me' || (!filter.scope && !filter.user_ids?.length && !filter.division_ids?.length)) {
    return [me.id];
  }
  if (filter.user_ids?.length) {
    return filter.user_ids.filter((id) => visible.includes(id));
  }
  if (filter.division_ids?.length) {
    const result = await pool.query(
      `SELECT id FROM users WHERE division_id = ANY($1::int[]) AND is_active = true AND deleted_at IS NULL`,
      [filter.division_ids]
    );
    return result.rows.map((r: { id: number }) => r.id).filter((id: number) => visible.includes(id));
  }
  if (filter.scope === 'department' || filter.scope === 'division') {
    return visible;
  }
  return visible;
}

function statusClause(filter: ReportFilter, params: unknown[]): string {
  const statuses = filter.statuses?.length ? filter.statuses : ['approved', 'submitted', 'draft'];
  params.push(statuses);
  return `AND a.status = ANY($${params.length}::text[])`;
}

export const ReportService = {
  async individual(me: HierarchyUser, filter: ReportFilter) {
    const userIds = await resolveUserIds(me, filter);
    const params: unknown[] = [userIds, filter.start_date, filter.end_date];
    const statusSql = statusClause(filter, params);
    if (filter.activity_type_ids?.length) {
      params.push(filter.activity_type_ids);
    }
    const typeSql = filter.activity_type_ids?.length
      ? `AND a.activity_type_id = ANY($${params.length}::int[])`
      : '';

    const result = await pool.query(
      `SELECT a.id, a.start_date, a.end_date, a.start_time, a.end_time, a.is_all_day,
              a.title_lo, a.title_en, a.description, a.duration_minutes, a.status, a.location,
              at.name_lo AS type_name_lo, at.name_en AS type_name_en,
              u.full_name, u.staff_code
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       JOIN users u ON u.id = a.user_id
       WHERE a.deleted_at IS NULL
         AND a.user_id = ANY($1::int[])
         AND a.start_date <= $3 AND a.end_date >= $2
         ${statusSql} ${typeSql}
       ORDER BY a.start_date, a.start_time NULLS LAST`,
      params
    );
    const totalMinutes = result.rows.reduce(
      (sum: number, r: { duration_minutes: number }) => sum + (r.duration_minutes || 0),
      0
    );
    return { rows: result.rows, total_minutes: totalMinutes, total_hours: +(totalMinutes / 60).toFixed(2) };
  },

  async divisionSummary(me: HierarchyUser, filter: ReportFilter) {
    const userIds = await resolveUserIds(me, { ...filter, scope: filter.scope || 'division' });
    const params: unknown[] = [userIds, filter.start_date, filter.end_date];
    const statusSql = statusClause(filter, params);

    const result = await pool.query(
      `SELECT u.id AS user_id, u.full_name, u.staff_code, d.name_lo AS division_name_lo, d.name_en AS division_name_en,
              COUNT(a.id)::int AS activity_count,
              COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
              COUNT(*) FILTER (WHERE a.status = 'approved')::int AS approved_count
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
         AND a.start_date <= $3 AND a.end_date >= $2 ${statusSql.replace(/a\.status/g, 'a.status')}
       WHERE u.id = ANY($1::int[]) AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name, u.staff_code, d.name_lo, d.name_en
       ORDER BY u.full_name`,
      params
    );
    return { rows: result.rows };
  },

  async departmentSummary(me: HierarchyUser, filter: ReportFilter) {
    const visible = await HierarchyService.visibleUserIds(me);
    const params: unknown[] = [visible, filter.start_date, filter.end_date];
    const statusSql = statusClause(filter, params);

    const result = await pool.query(
      `SELECT d.id AS division_id, d.name_lo, d.name_en, d.code,
              COUNT(a.id)::int AS activity_count,
              COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
              COUNT(DISTINCT a.user_id)::int AS staff_count
       FROM divisions d
       LEFT JOIN users u ON u.division_id = d.id AND u.id = ANY($1::int[]) AND u.deleted_at IS NULL
       LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
         AND a.start_date <= $3 AND a.end_date >= $2 ${statusSql}
       WHERE d.is_active = true
       GROUP BY d.id, d.name_lo, d.name_en, d.code
       ORDER BY d.sort_order, d.name_en`,
      params
    );
    return { rows: result.rows };
  },

  async meetingsRegister(me: HierarchyUser, filter: ReportFilter) {
    const userIds = await resolveUserIds(me, filter);
    const params: unknown[] = [userIds, filter.start_date, filter.end_date];
    const result = await pool.query(
      `SELECT a.*, at.code AS type_code, at.name_lo AS type_name_lo, at.name_en AS type_name_en,
              u.full_name AS owner_name,
              COALESCE(json_agg(json_build_object(
                'user_id', p.user_id, 'external_name', p.external_name, 'role_in_activity', p.role_in_activity
              ) FILTER (WHERE p.id IS NOT NULL), '[]') AS participants
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN activity_participants p ON p.activity_id = a.id
       WHERE a.deleted_at IS NULL
         AND a.user_id = ANY($1::int[])
         AND a.start_date <= $3 AND a.end_date >= $2
         AND at.code IN ('MEETING', 'CONFERENCE')
         AND a.status IN ('approved', 'submitted')
       GROUP BY a.id, at.code, at.name_lo, at.name_en, u.full_name
       ORDER BY a.start_date`,
      params
    );
    return { rows: result.rows };
  },

  async compliance(me: HierarchyUser, filter: ReportFilter) {
    const userIds = await resolveUserIds(me, { ...filter, scope: filter.scope || 'division' });
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.staff_code, d.name_en AS division_name,
              COUNT(a.id)::int AS submitted_count,
              COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
              CASE WHEN COUNT(a.id) = 0 THEN false ELSE true END AS has_submitted
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
         AND a.start_date <= $3 AND a.end_date >= $2
         AND a.status IN ('submitted', 'approved')
       WHERE u.id = ANY($1::int[]) AND u.is_active = true AND u.deleted_at IS NULL
       GROUP BY u.id, u.full_name, u.staff_code, d.name_en
       ORDER BY has_submitted ASC, u.full_name`,
      [userIds, filter.start_date, filter.end_date]
    );
    return { rows: result.rows };
  },

  async dashboardStats(
    me: HierarchyUser,
    range?: { start_date?: string; end_date?: string }
  ) {
    const visible = await HierarchyService.visibleUserIds(me);
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const toLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const start = range?.start_date || toLocal(weekStart);
    const end = range?.end_date || toLocal(now);
    const isLeadership =
      me.data_scope === 'department' ||
      me.data_scope === 'assigned_divisions' ||
      me.role_code === 'super_admin' ||
      me.role_code === 'dg' ||
      me.role_code === 'ddg';
    const isSupervisor =
      isLeadership ||
      me.data_scope === 'division' ||
      me.data_scope === 'direct_reports';

    const mine = await pool.query(
      `SELECT
         COALESCE(SUM(duration_minutes) FILTER (
           WHERE start_date <= $3 AND end_date >= $2
         ),0)::int AS my_period_minutes,
         COUNT(*) FILTER (
           WHERE status = 'draft' AND start_date <= $3 AND end_date >= $2
         )::int AS draft_count,
         COUNT(*) FILTER (
           WHERE status = 'submitted' AND start_date <= $3 AND end_date >= $2
         )::int AS submitted_count,
         COUNT(*) FILTER (
           WHERE status = 'approved' AND start_date <= $3 AND end_date >= $2
         )::int AS approved_count,
         COUNT(*) FILTER (
           WHERE status = 'rejected' AND start_date <= $3 AND end_date >= $2
         )::int AS rejected_count
       FROM activities
       WHERE deleted_at IS NULL AND user_id = $1`,
      [me.id, start, end]
    );

    const pending = await pool.query(
      `SELECT COUNT(*)::int AS count FROM activities
       WHERE deleted_at IS NULL AND status = 'submitted'
         AND user_id = ANY($1::int[]) AND user_id <> $2
         AND start_date <= $4 AND end_date >= $3`,
      [visible, me.id, start, end]
    );

    const byType = await pool.query(
      `SELECT at.name_en AS name, at.name_lo AS name_lo, at.colour, COUNT(a.id)::int AS count,
              COALESCE(SUM(a.duration_minutes),0)::int AS minutes
       FROM activity_types at
       LEFT JOIN activities a ON a.activity_type_id = at.id AND a.deleted_at IS NULL
         AND a.user_id = ANY($1::int[]) AND a.start_date <= $3 AND a.end_date >= $2
       GROUP BY at.id, at.name_en, at.name_lo, at.colour
       ORDER BY count DESC`,
      [visible, start, end]
    );

    const byStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS count,
              COALESCE(SUM(duration_minutes),0)::int AS minutes
       FROM activities
       WHERE deleted_at IS NULL AND user_id = ANY($1::int[])
         AND start_date <= $3 AND end_date >= $2
       GROUP BY status`,
      [visible, start, end]
    );

    const recent = await pool.query(
      `SELECT a.id, a.title_lo, a.title_en, a.status, a.start_date, a.end_date,
              a.duration_minutes, a.user_id,
              at.colour AS type_colour, at.name_en AS type_name_en
       FROM activities a
       JOIN activity_types at ON at.id = a.activity_type_id
       WHERE a.deleted_at IS NULL AND a.user_id = $1
         AND a.start_date <= $3 AND a.end_date >= $2
       ORDER BY a.start_date DESC, a.id DESC
       LIMIT 8`,
      [me.id, start, end]
    );

    let staff_summary: unknown[] = [];
    if (isSupervisor) {
      const staff = await pool.query(
        `SELECT u.id, u.full_name, u.staff_code, u.phone, u.email,
                d.name_en AS division_name_en, d.name_lo AS division_name_lo, d.code AS division_code,
                COUNT(a.id)::int AS activity_count,
                COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int AS submitted_count,
                COUNT(a.id) FILTER (WHERE a.status = 'approved')::int AS approved_count,
                COUNT(a.id) FILTER (WHERE a.status = 'draft')::int AS draft_count,
                COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
                CASE WHEN COUNT(a.id) FILTER (WHERE a.status IN ('submitted','approved')) = 0
                  THEN true ELSE false END AS not_submitted
         FROM users u
         LEFT JOIN divisions d ON d.id = u.division_id
         LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
           AND a.start_date <= $3 AND a.end_date >= $2
         WHERE u.id = ANY($1::int[]) AND u.id <> $4
           AND u.deleted_at IS NULL AND u.is_active = true
         GROUP BY u.id, u.full_name, u.staff_code, u.phone, u.email,
                  d.name_en, d.name_lo, d.code
         ORDER BY total_minutes DESC, u.full_name`,
        [visible, start, end, me.id]
      );
      staff_summary = staff.rows;
    }

    let division_summary: unknown[] = [];
    if (isLeadership) {
      const divisions = await pool.query(
        `SELECT d.id, d.code, d.name_en, d.name_lo,
                COUNT(DISTINCT u.id)::int AS staff_count,
                COUNT(a.id)::int AS activity_count,
                COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
                COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int AS submitted_count,
                COUNT(a.id) FILTER (WHERE a.status = 'approved')::int AS approved_count
         FROM divisions d
         LEFT JOIN users u ON u.division_id = d.id AND u.id = ANY($1::int[])
           AND u.deleted_at IS NULL AND u.is_active = true
         LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
           AND a.start_date <= $3 AND a.end_date >= $2
         WHERE d.is_active = true
         GROUP BY d.id, d.code, d.name_en, d.name_lo
         ORDER BY d.sort_order, d.name_en`,
        [visible, start, end]
      );
      division_summary = divisions.rows;
    }

    const hoursByDay = await pool.query(
      `SELECT a.start_date::text AS day,
              COALESCE(SUM(a.duration_minutes),0)::int AS minutes
       FROM activities a
       WHERE a.deleted_at IS NULL AND a.user_id = ANY($1::int[])
         AND a.start_date <= $3 AND a.end_date >= $2
       GROUP BY a.start_date
       ORDER BY a.start_date`,
      [visible, start, end]
    );

    return {
      period: { start, end },
      role_code: me.role_code,
      data_scope: me.data_scope,
      is_supervisor: isSupervisor,
      is_leadership: isLeadership,
      my_period_minutes: mine.rows[0].my_period_minutes,
      my_week_minutes: mine.rows[0].my_period_minutes, // backward compat
      draft_count: mine.rows[0].draft_count,
      submitted_count: mine.rows[0].submitted_count,
      approved_count: mine.rows[0].approved_count,
      rejected_count: mine.rows[0].rejected_count,
      pending_approvals: pending.rows[0].count,
      by_type: byType.rows,
      by_status: byStatus.rows,
      recent_activities: recent.rows,
      staff_summary,
      division_summary,
      hours_by_day: hoursByDay.rows,
      scope_user_count: visible.length,
    };
  },
};
