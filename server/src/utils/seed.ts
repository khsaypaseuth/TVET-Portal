import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrate.js';

const POSITIONS = [
  { code: 'DG', name_lo: 'ອຳນວຍການໃຫຍ່', name_en: 'Director General', rank_level: 1 },
  { code: 'DDG', name_lo: 'ຮອງອຳນວຍການໃຫຍ່', name_en: 'Deputy Director General', rank_level: 2 },
  { code: 'HD', name_lo: 'ຫົວໜ້າກົມ', name_en: 'Head of Division', rank_level: 3 },
  { code: 'DHD', name_lo: 'ຮອງຫົວໜ້າກົມ', name_en: 'Deputy Head of Division', rank_level: 4 },
  { code: 'TECH', name_lo: 'ພະນັກງານເຕັກນິກ', name_en: 'Technical Staff', rank_level: 5 },
  { code: 'ADMIN', name_lo: 'ພະນັກງານບໍລິຫານ', name_en: 'Administrative Staff', rank_level: 5 },
];

const ROLES = [
  { code: 'super_admin', name_lo: 'ຜູ້ດູແລລະບົບ', name_en: 'Super Admin', data_scope: 'department' },
  { code: 'dg', name_lo: 'ອຳນວຍການໃຫຍ່', name_en: 'DG', data_scope: 'department' },
  { code: 'ddg', name_lo: 'ຮອງອຳນວຍການໃຫຍ່', name_en: 'DDG', data_scope: 'assigned_divisions' },
  { code: 'hd', name_lo: 'ຫົວໜ້າກົມ', name_en: 'Head of Division', data_scope: 'division' },
  { code: 'dhd', name_lo: 'ຮອງຫົວໜ້າກົມ', name_en: 'Deputy HD', data_scope: 'division' },
  { code: 'tech', name_lo: 'ພະນັກງານເຕັກນິກ', name_en: 'Technical', data_scope: 'own' },
  { code: 'admin_staff', name_lo: 'ພະນັກງານບໍລິຫານ', name_en: 'Admin Staff', data_scope: 'own' },
];

const PERMISSIONS = [
  { code: 'activity.create', name_lo: 'ສ້າງກິດຈະກຳ', name_en: 'Create activity' },
  { code: 'activity.approve', name_lo: 'ອະນຸມັດກິດຈະກຳ', name_en: 'Approve activity' },
  { code: 'activity.assign', name_lo: 'ມອບໝາຍໜ້າວຽກ', name_en: 'Assign activity' },
  { code: 'report.division', name_lo: 'ລາຍງານກົມ', name_en: 'Division report' },
  { code: 'report.department', name_lo: 'ລາຍງານກົມກອງ', name_en: 'Department report' },
  { code: 'cms.manage', name_lo: 'ຈັດການເວັບໄຊ', name_en: 'Manage CMS' },
  { code: 'users.manage', name_lo: 'ຈັດການຜູ້ໃຊ້', name_en: 'Manage users' },
  { code: 'master.manage', name_lo: 'ຈັດການຂໍ້ມູນຫຼັກ', name_en: 'Manage master data' },
  { code: 'audit.view', name_lo: 'ເບິ່ງບັນທຶກການໃຊ້ງານ', name_en: 'View audit log' },
];

const ROLE_PERMS: Record<string, string[]> = {
  super_admin: PERMISSIONS.map((p) => p.code),
  dg: [
    'activity.create',
    'activity.approve',
    'activity.assign',
    'report.division',
    'report.department',
    'audit.view',
  ],
  ddg: [
    'activity.create',
    'activity.approve',
    'activity.assign',
    'report.division',
  ],
  hd: [
    'activity.create',
    'activity.approve',
    'activity.assign',
    'report.division',
  ],
  dhd: [
    'activity.create',
    'activity.approve',
    'activity.assign',
    'report.division',
  ],
  tech: ['activity.create'],
  admin_staff: ['activity.create', 'cms.manage'],
};

const DIVISIONS = [
  { code: 'PLAN', name_lo: 'ກົມແຜນການ', name_en: 'Planning Division', sort_order: 1 },
  { code: 'TRAIN', name_lo: 'ກົມຝຶກອົບຮົມ', name_en: 'Training Division', sort_order: 2 },
  { code: 'QA', name_lo: 'ກົມຮັບປະກັນຄຸນນະພາບ', name_en: 'Quality Assurance Division', sort_order: 3 },
  { code: 'ADMIN', name_lo: 'ກົມບໍລິຫານ', name_en: 'Administration Division', sort_order: 4 },
];

const ACTIVITY_TYPES = [
  { code: 'TASK', name_lo: 'ໜ້າວຽກ', name_en: 'Task', colour: '#3B82F6', icon: 'task' },
  { code: 'MEETING', name_lo: 'ປະຊຸມ', name_en: 'Meeting', colour: '#8B5CF6', icon: 'meeting' },
  { code: 'CONFERENCE', name_lo: 'ສຳມະນາ/ກອງປະຊຸມ', name_en: 'Conference/Seminar', colour: '#EC4899', icon: 'conference' },
  { code: 'TRAINING', name_lo: 'ການຝຶກອົບຮົມ', name_en: 'Training', colour: '#10B981', icon: 'training' },
  { code: 'FIELD', name_lo: 'ລົງພື້ນທີ່', name_en: 'Field Mission', colour: '#F59E0B', icon: 'field', requires_location: true },
  { code: 'TRIP', name_lo: 'ເດີນທາງລັດຖະການ', name_en: 'Official Trip', colour: '#EF4444', icon: 'trip', requires_location: true },
  { code: 'REPORT', name_lo: 'ຂຽນລາຍງານ', name_en: 'Report Writing', colour: '#6366F1', icon: 'report' },
  { code: 'OTHER', name_lo: 'ອື່ນໆ', name_en: 'Other', colour: '#64748B', icon: 'other' },
];

const seedDatabase = async () => {
  try {
    await runMigrations();

    for (const p of POSITIONS) {
      await pool.query(
        `INSERT INTO positions (code, name_lo, name_en, rank_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en, rank_level = EXCLUDED.rank_level`,
        [p.code, p.name_lo, p.name_en, p.rank_level]
      );
    }

    for (const r of ROLES) {
      await pool.query(
        `INSERT INTO roles (code, name_lo, name_en, data_scope)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en, data_scope = EXCLUDED.data_scope`,
        [r.code, r.name_lo, r.name_en, r.data_scope]
      );
    }

    for (const p of PERMISSIONS) {
      await pool.query(
        `INSERT INTO permissions (code, name_lo, name_en)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en`,
        [p.code, p.name_lo, p.name_en]
      );
    }

    for (const [roleCode, permCodes] of Object.entries(ROLE_PERMS)) {
      const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
      const roleId = roleRes.rows[0]?.id;
      if (!roleId) continue;
      for (const code of permCodes) {
        const permRes = await pool.query('SELECT id FROM permissions WHERE code = $1', [code]);
        const permId = permRes.rows[0]?.id;
        if (!permId) continue;
        await pool.query(
          `INSERT INTO role_permission (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleId, permId]
        );
      }
    }

    for (const d of DIVISIONS) {
      await pool.query(
        `INSERT INTO divisions (code, name_lo, name_en, sort_order, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (code) DO UPDATE SET name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en, sort_order = EXCLUDED.sort_order`,
        [d.code, d.name_lo, d.name_en, d.sort_order]
      );
    }

    for (const t of ACTIVITY_TYPES) {
      await pool.query(
        `INSERT INTO activity_types (code, name_lo, name_en, colour, icon, requires_location, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (code) DO UPDATE SET
           name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en,
           colour = EXCLUDED.colour, icon = EXCLUDED.icon,
           requires_location = EXCLUDED.requires_location`,
        [t.code, t.name_lo, t.name_en, t.colour, t.icon, t.requires_location || false]
      );
    }

    await pool.query(
      `INSERT INTO settings (key, value_json) VALUES
         ('org_name', '{"lo":"ກົມອາຊີວະສຶກສາ ແລະ ການຝຶກອົບຮົມວິຊາຊີບ","en":"Department of Technical and Vocational Education and Training"}'),
         ('fiscal_year_start_month', '1'),
         ('retroactive_entry_days', '14')
       ON CONFLICT (key) DO NOTHING`
    );

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const roleRes = await pool.query(`SELECT id FROM roles WHERE code = 'super_admin'`);
    const roleId = roleRes.rows[0].id;

    await pool.query(
      `INSERT INTO users (
         username, staff_code, email, password, role, role_id,
         full_name, first_name_en, last_name_en, first_name_lo, last_name_lo,
         is_active, locale_pref, must_change_password
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'lo',false)
       ON CONFLICT (username) DO UPDATE SET
         staff_code = EXCLUDED.staff_code,
         email = EXCLUDED.email,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         role_id = EXCLUDED.role_id,
         full_name = EXCLUDED.full_name,
         first_name_en = EXCLUDED.first_name_en,
         last_name_en = EXCLUDED.last_name_en,
         first_name_lo = EXCLUDED.first_name_lo,
         last_name_lo = EXCLUDED.last_name_lo,
         updated_at = CURRENT_TIMESTAMP`,
      [
        'admin',
        'admin',
        'admin@tved.local',
        hashedPassword,
        'super_admin',
        roleId,
        'Super Administrator',
        'Super',
        'Administrator',
        'ຜູ້ດູແລ',
        'ລະບົບ',
      ]
    );

    // Sample public content
    await pool.query(
      `INSERT INTO news_categories (slug, name_lo, name_en)
       VALUES ('announcements', 'ປະກາດ', 'Announcements')
       ON CONFLICT (slug) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO pages (slug, title_lo, title_en, body_lo, body_en, is_published, published_at)
       VALUES ('about', 'ກ່ຽວກັບ TVED', 'About TVED',
         'ກົມອາຊີວະສຶກສາ ແລະ ການຝຶກອົບຮົມວິຊາຊີບ',
         'Department of Technical and Vocational Education and Training',
         true, NOW())
       ON CONFLICT (slug) DO NOTHING`
    );

    await pool.query(
      `INSERT INTO banners (image_path, title_lo, title_en, sort_order, is_active)
       SELECT '/images/carousel/carousel-01.png', 'ຍິນດີຕ້ອນຮັບສູ່ TVED', 'Welcome to TVED', 1, true
       WHERE NOT EXISTS (SELECT 1 FROM banners LIMIT 1)`
    );

    console.log('✅ Database seeded successfully!');
    console.log('📝 Super Admin: admin / admin123 (admin@tved.local)');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(async () => {
      console.log('✅ Seed completed');
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}

export default seedDatabase;
