import { Response } from 'express';
import ExcelJS from 'exceljs';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { HierarchyService } from '../services/HierarchyService.js';
import { ActivityService } from '../services/ActivityService.js';
import { NotificationService } from '../services/NotificationService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

async function me(req: AuthRequest) {
  return HierarchyService.getUserWithScope(req.user!.id);
}

function handleErr(res: Response, e: any) {
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: 'Internal server error' });
}

export const listActivityTypes = async (_req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT * FROM activity_types WHERE is_active = true ORDER BY id`
  );
  return res.json({ success: true, data: result.rows });
};

const PAGE_SIZES = [20, 50, 100];

/** Filters shared by the list endpoint and the Excel exporter. */
function parseActivityFilters(query: AuthRequest['query']) {
  return {
    start_date: query.start_date as string | undefined,
    end_date: query.end_date as string | undefined,
    status: query.status as string | undefined,
    activity_type_id: query.activity_type_id ? Number(query.activity_type_id) : undefined,
    user_id: query.user_id ? Number(query.user_id) : undefined,
    division_id: query.division_id ? Number(query.division_id) : undefined,
  };
}

export const listActivities = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // `all=1` skips paging for consumers that need a whole date range at once
    // (the calendar); it is still capped by EXPORT_MAX_ROWS in the service.
    const unpaged = req.query.all === '1' || req.query.all === 'true';
    const requested = Number(req.query.limit);
    const limit = PAGE_SIZES.includes(requested) ? requested : 20;
    const page = Math.max(Number(req.query.page) || 1, 1);

    const { rows, total } = await ActivityService.list(user, {
      ...parseActivityFilters(req.query),
      limit: unpaged ? 0 : limit,
      offset: unpaged ? 0 : (page - 1) * limit,
    });

    return res.json({
      success: true,
      data: rows,
      meta: unpaged
        ? { total, page: 1, limit: rows.length, pages: 1, has_prev: false, has_next: false }
        : {
            total,
            page,
            limit,
            pages: Math.max(Math.ceil(total / limit), 1),
            has_prev: page > 1,
            has_next: page * limit < total,
          },
    });
  } catch (e) {
    return handleErr(res, e);
  }
};

/**
 * Excel export of the activity list.
 *
 * Honours the same filters as the list endpoint, so the sheet matches what the
 * user is looking at. `?all=1` drops the filters and exports everything the
 * user is allowed to see — visibility still runs through the hierarchy scope,
 * never the query string.
 */
export const exportActivitiesExcel = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const exportAll = req.query.all === '1' || req.query.all === 'true';
    const filters = exportAll ? {} : parseActivityFilters(req.query);
    const { rows, total } = await ActivityService.list(user, { ...filters, limit: 0 });
    const lao = (req.query.lang || 'lo') === 'lo';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TVED Activity & Task Tracking System';
    const sheet = workbook.addWorksheet(lao ? 'ກິດຈະກຳ' : 'Activities');

    sheet.addRow([
      lao
        ? 'ກົມອາຊີວະສຶກສາ ແລະ ການຝຶກອົບຮົມວິຊາຊີບ'
        : 'Department of Technical and Vocational Education and Training',
    ]);
    sheet.addRow([lao ? 'ບັນຊີກິດຈະກຳ' : 'Activity list']);
    sheet.addRow([
      exportAll
        ? lao ? 'ຂອບເຂດ: ທັງໝົດ' : 'Scope: all records'
        : lao ? 'ຂອບເຂດ: ຕາມການກັ່ນຕອງ' : 'Scope: current filter',
      describeFilters(filters, lao),
    ]);
    sheet.addRow([
      lao ? 'ວັນທີສົ່ງອອກ' : 'Exported at',
      new Date().toISOString().slice(0, 16).replace('T', ' '),
    ]);
    sheet.addRow([]);

    const headers = lao
      ? ['ລຳດັບ', 'ວັນທີເລີ່ມ', 'ວັນທີສິ້ນສຸດ', 'ເວລາ', 'ປະເພດ', 'ຫົວຂໍ້ (ລາວ)', 'ຫົວຂໍ້ (ອັງກິດ)',
         'ຜູ້ຮັບຜິດຊອບ', 'ລະຫັດພະນັກງານ', 'ພະແນກ', 'ສະຖານະ', 'ຊົ່ວໂມງ', 'ສະຖານທີ່', 'ຄວາມສຳຄັນ', 'ຄວາມຄືບໜ້າ (%)']
      : ['#', 'Start date', 'End date', 'Time', 'Type', 'Title (Lao)', 'Title (English)',
         'Owner', 'Staff code', 'Division', 'Status', 'Hours', 'Location', 'Priority', 'Progress (%)'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } } };
    });

    rows.forEach((r: any, i: number) => {
      sheet.addRow([
        i + 1,
        ymd(r.start_date),
        ymd(r.end_date),
        r.is_all_day
          ? lao ? 'ຕະຫຼອດມື້' : 'All day'
          : [r.start_time, r.end_time].filter(Boolean).map((x: string) => String(x).slice(0, 5)).join(' – '),
        lao ? r.type_name_lo : r.type_name_en,
        r.title_lo,
        r.title_en || '',
        r.owner_name || '',
        r.owner_staff_code || '',
        (lao ? r.division_name_lo : r.division_name_en) || '',
        r.status,
        Number(((r.duration_minutes || 0) / 60).toFixed(2)),
        r.location || '',
        r.priority || '',
        r.progress_percent ?? 0,
      ]);
    });

    sheet.addRow([]);
    const totalRow = sheet.addRow([
      lao ? 'ລວມ' : 'Total',
      `${rows.length}${total > rows.length ? ` / ${total}` : ''}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Number((rows.reduce((sum: number, r: any) => sum + (r.duration_minutes || 0), 0) / 60).toFixed(2)),
    ]);
    totalRow.font = { bold: true };

    // Lao script needs generous column widths and a font that can render it.
    const widths = [6, 13, 13, 14, 18, 42, 42, 24, 14, 24, 12, 9, 24, 12, 13];
    sheet.columns.forEach((col, i) => {
      col.width = widths[i] || 16;
    });
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.font = { ...(cell.font || {}), name: 'Noto Sans Lao' };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    });
    sheet.views = [{ state: 'frozen', ySplit: 6 }];
    if (rows.length) {
      sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: headers.length } };
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tved-activities-${exportAll ? 'all' : 'filtered'}-${stamp}.xlsx"`
    );
    await workbook.xlsx.write(res);
    return res.end();
  } catch (e) {
    return handleErr(res, e);
  }
};

/** pg returns date columns as Date objects — render them as local YYYY-MM-DD. */
function ymd(value: unknown) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;
  }
  return value ? String(value).slice(0, 10) : '';
}

function describeFilters(filters: Record<string, unknown>, lao: boolean) {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  if (!parts.length) return lao ? 'ບໍ່ມີການກັ່ນຕອງ' : 'no filters';
  return parts.join(', ');
}

export const getActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.getById(user, Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const createActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await ActivityService.create(user, req.body, {
      ip: req.ip,
      ua: req.get('user-agent') || undefined,
    });
    if (result.activity.assigned_by_user_id && result.activity.user_id !== user.id) {
      await NotificationService.create({
        userId: result.activity.user_id,
        type: 'assigned',
        title_lo: 'ທ່ານໄດ້ຮັບການມອບໝາຍໜ້າວຽກ',
        title_en: 'You have been assigned an activity',
        link_url: `/activities/${result.activity.id}`,
        related_type: 'activity',
        related_id: result.activity.id,
      });
    }
    return res.status(201).json({ success: true, data: result.activity, warnings: result.warnings });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const updateActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await ActivityService.update(user, Number(req.params.id), req.body, {
      ip: req.ip,
      ua: req.get('user-agent') || undefined,
    });
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, data: result.activity, warnings: result.warnings });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const deleteActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await ActivityService.softDelete(user, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const duplicateActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await ActivityService.duplicate(user, Number(req.params.id));
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.status(201).json({ success: true, data: result.activity, warnings: result.warnings });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const submitActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.submit(user, Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Not found' });

    const ancestors = await HierarchyService.ancestors(user.id);
    for (const supervisorId of ancestors.slice(0, 1)) {
      await NotificationService.create({
        userId: supervisorId,
        type: 'submitted',
        title_lo: 'ມີກິດຈະກຳລໍຖ້າອະນຸມັດ',
        title_en: 'Activity pending approval',
        link_url: `/approvals`,
        related_type: 'activity',
        related_id: data.id,
      });
    }
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const approveActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.approve(user, Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Not found' });
    await NotificationService.create({
      userId: data.user_id,
      type: 'approved',
      title_lo: 'ກິດຈະກຳຂອງທ່ານໄດ້ຮັບການອະນຸມັດ',
      title_en: 'Your activity was approved',
      link_url: `/activities/${data.id}`,
      related_type: 'activity',
      related_id: data.id,
    });
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const rejectActivity = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.reject(user, Number(req.params.id), req.body.reason || '');
    if (!data) return res.status(404).json({ error: 'Not found' });
    await NotificationService.create({
      userId: data.user_id,
      type: 'rejected',
      title_lo: 'ກິດຈະກຳຂອງທ່ານຖືກປະຕິເສດ',
      title_en: 'Your activity was rejected',
      body_lo: req.body.reason,
      body_en: req.body.reason,
      link_url: `/activities/${data.id}`,
      related_type: 'activity',
      related_id: data.id,
    });
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const bulkApprove = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const ids: number[] = req.body.ids || [];
    const results = [];
    for (const id of ids) {
      try {
        const data = await ActivityService.approve(user, id);
        if (data) {
          await NotificationService.create({
            userId: data.user_id,
            type: 'approved',
            title_lo: 'ກິດຈະກຳຂອງທ່ານໄດ້ຮັບການອະນຸມັດ',
            title_en: 'Your activity was approved',
            link_url: `/activities/${data.id}`,
            related_type: 'activity',
            related_id: data.id,
          });
          results.push(data);
        }
      } catch {
        // skip forbidden
      }
    }
    return res.json({ success: true, data: results });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const approvalsQueue = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.approvalsQueue(user);
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const myTeam = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const visible = await HierarchyService.visibleUserIds(user);
    const start = (req.query.start_date as string) || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10);
    const end = (req.query.end_date as string) || new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.staff_code, u.phone, u.email,
              d.name_en AS division_name_en, d.name_lo AS division_name_lo,
              COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int AS submitted_count,
              COUNT(a.id) FILTER (WHERE a.status = 'approved')::int AS approved_count,
              COALESCE(SUM(a.duration_minutes),0)::int AS total_minutes,
              CASE WHEN COUNT(a.id) FILTER (WHERE a.status IN ('submitted','approved')) = 0 THEN true ELSE false END AS not_submitted
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN activities a ON a.user_id = u.id AND a.deleted_at IS NULL
         AND a.start_date <= $3 AND a.end_date >= $2
       WHERE u.id = ANY($1::int[]) AND u.id <> $4 AND u.deleted_at IS NULL AND u.is_active = true
       GROUP BY u.id, u.full_name, u.staff_code, u.phone, u.email, d.name_en, d.name_lo
       ORDER BY u.full_name`,
      [visible, start, end, user.id]
    );
    return res.json({ success: true, data: result.rows, period: { start, end } });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const activity = await ActivityService.getById(user, Number(req.params.id));
    if (!activity) return res.status(404).json({ error: 'Not found' });
    const result = await pool.query(
      `INSERT INTO activity_comments (activity_id, user_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [activity.id, user.id, req.body.body]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const activityId = Number(req.params.id);
    const activity = await ActivityService.getById(user, activityId);
    if (!activity) return res.status(404).json({ error: 'Not found' });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'File required' });

    if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const dest = path.join(uploadRoot, safeName);
    fs.writeFileSync(dest, file.buffer);

    const result = await pool.query(
      `INSERT INTO attachments (activity_id, file_path, original_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [activityId, safeName, file.originalname, file.mimetype, file.size, user.id]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    return handleErr(res, e);
  }
};
