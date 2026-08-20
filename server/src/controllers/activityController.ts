import { Response } from 'express';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { HierarchyService } from '../services/HierarchyService.js';
import { ActivityService } from '../services/ActivityService.js';
import { NotificationService } from '../services/NotificationService.js';
import { ExcelService, sendWorkbook, describeFilters } from '../services/ExcelService.js';
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
    q: (query.q as string | undefined) || undefined,
  };
}

/** The same shape as parseActivityFilters, with nothing set — used by "export all". */
function noActivityFilters(): ReturnType<typeof parseActivityFilters> {
  return {
    start_date: undefined,
    end_date: undefined,
    status: undefined,
    activity_type_id: undefined,
    user_id: undefined,
    division_id: undefined,
    q: undefined,
  };
}

function parseTeamFilters(query: AuthRequest['query']) {
  return {
    start_date: query.start_date as string | undefined,
    end_date: query.end_date as string | undefined,
    division_id: query.division_id ? Number(query.division_id) : undefined,
    q: (query.q as string | undefined) || undefined,
    not_submitted: query.not_submitted === '1' || query.not_submitted === 'true',
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
    const filters = exportAll ? noActivityFilters() : parseActivityFilters(req.query);
    const { rows } = await ActivityService.list(user, { ...filters, limit: 0 });
    const lao = (req.query.lang || 'lo') === 'lo';

    const workbook = ExcelService.activitiesWorkbook(rows, {
      lao,
      subtitle: lao ? 'ບັນຊີກິດຈະກຳ' : 'Activity list',
      scopeLine: exportAll
        ? lao ? 'ທັງໝົດ' : 'all records'
        : describeFilters(filters, lao),
      period: { start: filters.start_date, end: filters.end_date },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return sendWorkbook(
      res,
      workbook,
      `tved-activities-${exportAll ? 'all' : 'filtered'}-${stamp}.xlsx`
    );
  } catch (e) {
    return handleErr(res, e);
  }
};

/** Excel export of the approvals queue, honouring the queue's own filters. */
export const exportApprovalsExcel = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const exportAll = req.query.all === '1' || req.query.all === 'true';
    const filters = exportAll ? noActivityFilters() : parseActivityFilters(req.query);
    const rows = await ActivityService.approvalsQueue(user, filters);
    const lao = (req.query.lang || 'lo') === 'lo';

    const workbook = ExcelService.activitiesWorkbook(rows, {
      lao,
      subtitle: lao ? 'ລາຍການລໍຖ້າອະນຸມັດ' : 'Pending approvals',
      scopeLine: exportAll
        ? lao ? 'ທັງໝົດ' : 'all pending'
        : describeFilters(filters, lao),
      period: { start: filters.start_date, end: filters.end_date },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return sendWorkbook(res, workbook, `tved-approvals-${stamp}.xlsx`);
  } catch (e) {
    return handleErr(res, e);
  }
};

/** Excel export of the team page. */
export const exportTeamExcel = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const filters = parseTeamFilters(req.query);
    const { rows, period } = await ActivityService.teamSummary(user, filters);
    const lao = (req.query.lang || 'lo') === 'lo';

    const workbook = ExcelService.staffWorkbook(rows, {
      lao,
      subtitle: lao ? 'ບັນຊີພະນັກງານໃນຄວາມຮັບຜິດຊອບ' : 'Team reporting summary',
      scopeLine: describeFilters(
        { q: filters.q, division_id: filters.division_id, not_submitted: filters.not_submitted || undefined },
        lao
      ),
      period,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return sendWorkbook(res, workbook, `tved-team-${stamp}.xlsx`);
  } catch (e) {
    return handleErr(res, e);
  }
};


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
    const data = await ActivityService.approvalsQueue(user, parseActivityFilters(req.query));
    return res.json({ success: true, data });
  } catch (e) {
    return handleErr(res, e);
  }
};

export const myTeam = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows, period } = await ActivityService.teamSummary(user, parseTeamFilters(req.query));
    return res.json({ success: true, data: rows, period });
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
