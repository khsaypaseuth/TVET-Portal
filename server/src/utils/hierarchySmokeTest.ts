import { HierarchyService, clearHierarchyCache } from '../services/HierarchyService.js';
import pool from '../config/database.js';

async function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log('✓', msg);
}

async function main() {
  clearHierarchyCache();
  const admin = await HierarchyService.getUserWithScope(
    (await pool.query(`SELECT id FROM users WHERE username = 'admin'`)).rows[0].id
  );
  await assert(!!admin, 'admin user exists');
  const visible = await HierarchyService.visibleUserIds(admin!);
  await assert(visible.includes(admin!.id), 'admin sees self');
  await assert(admin!.data_scope === 'department' || admin!.role_code === 'super_admin', 'admin has department scope');

  const cycle = await HierarchyService.wouldCreateCycle(admin!.id, admin!.id);
  await assert(cycle === true, 'self-supervisor is a cycle');

  console.log('HierarchyService smoke tests passed');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
