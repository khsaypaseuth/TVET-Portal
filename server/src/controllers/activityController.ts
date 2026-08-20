import { Response } from 'express';
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

export const listActivities = async (req: AuthRequest, res: Response) => {
  try {
    const user = await me(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const data = await ActivityService.list(user, {
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
      status: req.query.status as string | undefined,
      activity_type_id: req.query.activity_type_id
        ? Number(req.query.activity_type_id)
        : undefined,
      user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
      division_id: req.query.division_id ? Number(req.query.division_id) : undefined,
    });
    return res.json({ success: true, data });
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
