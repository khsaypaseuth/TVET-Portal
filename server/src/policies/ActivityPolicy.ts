import { HierarchyService, HierarchyUser } from '../services/HierarchyService.js';
import pool from '../config/database.js';

export interface ActivityRow {
  id: number;
  user_id: number;
  division_id: number | null;
  status: string;
  assigned_by_user_id: number | null;
  approved_by_user_id: number | null;
}

async function hasPermission(userId: number, code: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM users u
     JOIN role_permission rp ON rp.role_id = u.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = $1 AND p.code = $2
     LIMIT 1`,
    [userId, code]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export const ActivityPolicy = {
  async canView(me: HierarchyUser, activity: ActivityRow): Promise<boolean> {
    if (me.role_code === 'super_admin') return true;
    const visible = await HierarchyService.visibleUserIds(me);
    return visible.includes(activity.user_id);
  },

  async canCreate(me: HierarchyUser): Promise<boolean> {
    return hasPermission(me.id, 'activity.create') || me.role_code === 'super_admin';
  },

  async canUpdate(me: HierarchyUser, activity: ActivityRow): Promise<boolean> {
    if (me.role_code === 'super_admin') return true;
    if (activity.status === 'approved') {
      return activity.approved_by_user_id === me.id;
    }
    if (activity.user_id === me.id && ['draft', 'rejected'].includes(activity.status)) {
      return true;
    }
    if (activity.assigned_by_user_id === me.id && activity.status === 'draft') {
      return true;
    }
    return false;
  },

  async canDelete(me: HierarchyUser, activity: ActivityRow): Promise<boolean> {
    if (me.role_code === 'super_admin') return true;
    return activity.user_id === me.id && activity.status === 'draft';
  },

  async canApprove(me: HierarchyUser, activity: ActivityRow): Promise<boolean> {
    if (!(await hasPermission(me.id, 'activity.approve')) && me.role_code !== 'super_admin') {
      return false;
    }
    if (activity.status !== 'submitted') return false;
    if (me.role_code === 'super_admin') return true;
    const visible = await HierarchyService.visibleUserIds(me);
    return visible.includes(activity.user_id) && activity.user_id !== me.id;
  },

  async canAssign(me: HierarchyUser, targetUserId: number): Promise<boolean> {
    if (!(await hasPermission(me.id, 'activity.assign')) && me.role_code !== 'super_admin') {
      return false;
    }
    if (me.role_code === 'super_admin') return true;
    const visible = await HierarchyService.visibleUserIds(me);
    return visible.includes(targetUserId);
  },
};
