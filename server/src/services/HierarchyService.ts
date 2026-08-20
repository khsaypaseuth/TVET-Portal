import pool from '../config/database.js';

export type DataScope =
  | 'own'
  | 'direct_reports'
  | 'division'
  | 'assigned_divisions'
  | 'department';

export interface HierarchyUser {
  id: number;
  supervisor_id: number | null;
  division_id: number | null;
  role_id: number | null;
  data_scope?: DataScope;
  role_code?: string;
}

type CacheBag = {
  descendants: Map<number, number[]>;
  ancestors: Map<number, number[]>;
  visible: Map<number, number[]>;
};

function getRequestCache(): CacheBag {
  const g = globalThis as unknown as { __hierarchyCache?: CacheBag };
  if (!g.__hierarchyCache) {
    g.__hierarchyCache = {
      descendants: new Map(),
      ancestors: new Map(),
      visible: new Map(),
    };
  }
  return g.__hierarchyCache;
}

export function clearHierarchyCache() {
  const g = globalThis as unknown as { __hierarchyCache?: CacheBag };
  g.__hierarchyCache = undefined;
}

async function loadActiveUsers(): Promise<HierarchyUser[]> {
  const result = await pool.query(
    `SELECT u.id, u.supervisor_id, u.division_id, u.role_id,
            r.data_scope, r.code AS role_code
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = true AND u.deleted_at IS NULL`
  );
  return result.rows;
}

function buildChildrenMap(users: HierarchyUser[]) {
  const children = new Map<number, number[]>();
  for (const u of users) {
    if (u.supervisor_id) {
      const list = children.get(u.supervisor_id) || [];
      list.push(u.id);
      children.set(u.supervisor_id, list);
    }
  }
  return children;
}

export const HierarchyService = {
  async descendants(userId: number): Promise<number[]> {
    const cache = getRequestCache();
    if (cache.descendants.has(userId)) return cache.descendants.get(userId)!;

    const users = await loadActiveUsers();
    const children = buildChildrenMap(users);
    const result: number[] = [];
    const visited = new Set<number>([userId]);
    const stack = [...(children.get(userId) || [])];

    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue; // circular guard
      visited.add(id);
      result.push(id);
      for (const c of children.get(id) || []) stack.push(c);
    }

    cache.descendants.set(userId, result);
    return result;
  },

  async ancestors(userId: number): Promise<number[]> {
    const cache = getRequestCache();
    if (cache.ancestors.has(userId)) return cache.ancestors.get(userId)!;

    const users = await loadActiveUsers();
    const byId = new Map(users.map((u) => [u.id, u]));
    const result: number[] = [];
    const visited = new Set<number>();
    let current = byId.get(userId)?.supervisor_id ?? null;

    while (current) {
      if (visited.has(current)) break; // circular guard
      visited.add(current);
      result.push(current);
      current = byId.get(current)?.supervisor_id ?? null;
    }

    cache.ancestors.set(userId, result);
    return result;
  },

  async wouldCreateCycle(userId: number, newSupervisorId: number | null): Promise<boolean> {
    if (!newSupervisorId) return false;
    if (newSupervisorId === userId) return true;
    const desc = await this.descendants(userId);
    return desc.includes(newSupervisorId);
  },

  async visibleUserIds(me: HierarchyUser): Promise<number[]> {
    const cache = getRequestCache();
    if (cache.visible.has(me.id)) return cache.visible.get(me.id)!;

    const scope = me.data_scope || 'own';
    let ids: number[] = [me.id];

    if (scope === 'own') {
      ids = [me.id];
    } else if (scope === 'direct_reports') {
      const users = await loadActiveUsers();
      const directs = users.filter((u) => u.supervisor_id === me.id).map((u) => u.id);
      ids = [me.id, ...directs];
    } else if (scope === 'division') {
      if (me.division_id) {
        const result = await pool.query(
          `SELECT id FROM users
           WHERE division_id = $1 AND is_active = true AND deleted_at IS NULL`,
          [me.division_id]
        );
        ids = result.rows.map((r: { id: number }) => r.id);
        if (!ids.includes(me.id)) ids.push(me.id);
      }
    } else if (scope === 'assigned_divisions') {
      const oversight = await pool.query(
        `SELECT division_id FROM division_user_oversight WHERE user_id = $1`,
        [me.id]
      );
      const divisionIds = oversight.rows.map((r: { division_id: number }) => r.division_id);
      if (me.division_id && !divisionIds.includes(me.division_id)) {
        divisionIds.push(me.division_id);
      }
      if (divisionIds.length) {
        const result = await pool.query(
          `SELECT id FROM users
           WHERE division_id = ANY($1::int[]) AND is_active = true AND deleted_at IS NULL`,
          [divisionIds]
        );
        ids = result.rows.map((r: { id: number }) => r.id);
        if (!ids.includes(me.id)) ids.push(me.id);
      }
    } else if (scope === 'department' || me.role_code === 'super_admin') {
      const result = await pool.query(
        `SELECT id FROM users WHERE is_active = true AND deleted_at IS NULL`
      );
      ids = result.rows.map((r: { id: number }) => r.id);
    }

    cache.visible.set(me.id, ids);
    return ids;
  },

  async getUserWithScope(userId: number): Promise<HierarchyUser | null> {
    const result = await pool.query(
      `SELECT u.id, u.supervisor_id, u.division_id, u.role_id,
              r.data_scope, r.code AS role_code
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  },
};
