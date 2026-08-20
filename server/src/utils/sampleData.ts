/**
 * Sample org + activity data for local demos / e2e checks.
 * Idempotent: safe to re-run (upserts by staff_code / slug).
 *
 * Default password for all sample staff: Staff123!
 */
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { clearHierarchyCache } from '../services/HierarchyService.js';

const PASSWORD = 'Staff123!';

async function roleId(code: string) {
  const r = await pool.query(`SELECT id FROM roles WHERE code = $1`, [code]);
  return r.rows[0].id as number;
}
async function positionId(code: string) {
  const r = await pool.query(`SELECT id FROM positions WHERE code = $1`, [code]);
  return r.rows[0].id as number;
}
async function divisionId(code: string) {
  const r = await pool.query(`SELECT id FROM divisions WHERE code = $1`, [code]);
  return r.rows[0].id as number;
}
async function typeId(code: string) {
  const r = await pool.query(`SELECT id FROM activity_types WHERE code = $1`, [code]);
  return r.rows[0].id as number;
}

async function upsertUser(u: {
  username: string;
  staff_code: string;
  email: string;
  role_code: string;
  position_code: string;
  division_code?: string | null;
  supervisor_staff?: string | null;
  full_name: string;
  first_name_en: string;
  last_name_en: string;
  first_name_lo: string;
  last_name_lo: string;
  phone?: string;
}) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const role_id = await roleId(u.role_code);
  const position_id = await positionId(u.position_code);
  const division_id = u.division_code ? await divisionId(u.division_code) : null;
  let supervisor_id: number | null = null;
  if (u.supervisor_staff) {
    const s = await pool.query(`SELECT id FROM users WHERE staff_code = $1`, [u.supervisor_staff]);
    supervisor_id = s.rows[0]?.id ?? null;
  }

  const result = await pool.query(
    `INSERT INTO users (
       username, staff_code, email, password, role, role_id, full_name,
       first_name_en, last_name_en, first_name_lo, last_name_lo, phone,
       position_id, division_id, supervisor_id, locale_pref, is_active, must_change_password
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'lo',true,false)
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
       phone = EXCLUDED.phone,
       position_id = EXCLUDED.position_id,
       division_id = EXCLUDED.division_id,
       supervisor_id = EXCLUDED.supervisor_id,
       deleted_at = NULL,
       is_active = true,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, staff_code, role`,
    [
      u.username,
      u.staff_code,
      u.email,
      hash,
      u.role_code,
      role_id,
      u.full_name,
      u.first_name_en,
      u.last_name_en,
      u.first_name_lo,
      u.last_name_lo,
      u.phone || null,
      position_id,
      division_id,
      supervisor_id,
    ]
  );
  return result.rows[0] as { id: number; staff_code: string; role: string };
}

async function ensureActivity(a: {
  owner_staff: string;
  type_code: string;
  title_lo: string;
  title_en: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean;
  status: string;
  location?: string;
  assigned_by_staff?: string | null;
  duration_minutes: number;
}) {
  const owner = await pool.query(`SELECT id, division_id FROM users WHERE staff_code = $1`, [
    a.owner_staff,
  ]);
  if (!owner.rows[0]) throw new Error(`Missing user ${a.owner_staff}`);
  const type_id = await typeId(a.type_code);
  let assigned_by: number | null = null;
  if (a.assigned_by_staff) {
    assigned_by = (
      await pool.query(`SELECT id FROM users WHERE staff_code = $1`, [a.assigned_by_staff])
    ).rows[0]?.id;
  }

  const existing = await pool.query(
    `SELECT id FROM activities
     WHERE user_id = $1 AND title_en = $2 AND start_date = $3 AND deleted_at IS NULL`,
    [owner.rows[0].id, a.title_en, a.start_date]
  );
  if (existing.rows[0]) return existing.rows[0];

  const result = await pool.query(
    `INSERT INTO activities (
       user_id, division_id, activity_type_id, title_lo, title_en, description,
       start_date, end_date, start_time, end_time, is_all_day, duration_minutes,
       location, status, progress_percent, priority, assigned_by_user_id,
       approved_by_user_id, approved_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'normal',$16,$17,$18
     ) RETURNING id, status`,
    [
      owner.rows[0].id,
      owner.rows[0].division_id,
      type_id,
      a.title_lo,
      a.title_en,
      `${a.title_en} — sample seeded activity`,
      a.start_date,
      a.end_date,
      a.is_all_day ? null : a.start_time || null,
      a.is_all_day ? null : a.end_time || null,
      !!a.is_all_day,
      a.duration_minutes,
      a.location || null,
      a.status,
      a.status === 'approved' ? 100 : 50,
      assigned_by,
      a.status === 'approved' ? assigned_by : null,
      a.status === 'approved' ? new Date() : null,
    ]
  );
  return result.rows[0];
}

async function main() {
  console.log('🌱 Seeding sample TVED data...');

  // Hierarchy:
  // DG → DDG → HD(PLAN) → DHD → TECH x2
  //              HD(TRAIN) → TECH
  // Admin staff in ADMIN division (CMS)
  const dg = await upsertUser({
    username: 'dg.somsack',
    staff_code: 'DG001',
    phone: '20 5551 0001',
    email: 'dg@tved.local',
    role_code: 'dg',
    position_code: 'DG',
    division_code: null,
    supervisor_staff: null,
    full_name: 'Somsack Director',
    first_name_en: 'Somsack',
    last_name_en: 'Director',
    first_name_lo: 'ສົມສັກ',
    last_name_lo: 'ອຳນວຍການ',
  });

  const ddg = await upsertUser({
    username: 'ddg.phouvieng',
    staff_code: 'DDG001',
    phone: '20 5551 0002',
    email: 'ddg@tved.local',
    role_code: 'ddg',
    position_code: 'DDG',
    division_code: null,
    supervisor_staff: 'DG001',
    full_name: 'Phouvieng Deputy',
    first_name_en: 'Phouvieng',
    last_name_en: 'Deputy',
    first_name_lo: 'ພູວຽງ',
    last_name_lo: 'ຮອງ',
  });

  // DDG oversight of PLAN + TRAIN
  const planId = await divisionId('PLAN');
  const trainId = await divisionId('TRAIN');
  await pool.query(`DELETE FROM division_user_oversight WHERE user_id = $1`, [ddg.id]);
  await pool.query(
    `INSERT INTO division_user_oversight (user_id, division_id) VALUES ($1,$2), ($1,$3)
     ON CONFLICT DO NOTHING`,
    [ddg.id, planId, trainId]
  );

  const hdPlan = await upsertUser({
    username: 'hd.plan',
    staff_code: 'HD-PLAN',
    phone: '20 5551 0003',
    email: 'hd.plan@tved.local',
    role_code: 'hd',
    position_code: 'HD',
    division_code: 'PLAN',
    supervisor_staff: 'DDG001',
    full_name: 'Bounmy Head-Plan',
    first_name_en: 'Bounmy',
    last_name_en: 'Head',
    first_name_lo: 'ບຸນມີ',
    last_name_lo: 'ຫົວໜ້າ',
  });

  await pool.query(`UPDATE divisions SET head_user_id = $1 WHERE code = 'PLAN'`, [hdPlan.id]);

  const dhdPlan = await upsertUser({
    username: 'dhd.plan',
    staff_code: 'DHD-PLAN',
    phone: '20 5551 0004',
    email: 'dhd.plan@tved.local',
    role_code: 'dhd',
    position_code: 'DHD',
    division_code: 'PLAN',
    supervisor_staff: 'HD-PLAN',
    full_name: 'Khamla Deputy-Plan',
    first_name_en: 'Khamla',
    last_name_en: 'Deputy',
    first_name_lo: 'ຄຳລາ',
    last_name_lo: 'ຮອງຫົວໜ້າ',
  });

  const tech1 = await upsertUser({
    username: 'tech.anousone',
    staff_code: 'TECH001',
    phone: '20 5551 0005',
    email: 'tech1@tved.local',
    role_code: 'tech',
    position_code: 'TECH',
    division_code: 'PLAN',
    supervisor_staff: 'DHD-PLAN',
    full_name: 'Anousone Technical',
    first_name_en: 'Anousone',
    last_name_en: 'Technical',
    first_name_lo: 'ອານຸສອນ',
    last_name_lo: 'ເຕັກນິກ',
  });

  const tech2 = await upsertUser({
    username: 'tech.vilay',
    staff_code: 'TECH002',
    phone: '20 5551 0006',
    email: 'tech2@tved.local',
    role_code: 'tech',
    position_code: 'TECH',
    division_code: 'PLAN',
    supervisor_staff: 'DHD-PLAN',
    full_name: 'Vilay Technical',
    first_name_en: 'Vilay',
    last_name_en: 'Technical',
    first_name_lo: 'ວິໄລ',
    last_name_lo: 'ເຕັກນິກ',
  });

  const hdTrain = await upsertUser({
    username: 'hd.train',
    staff_code: 'HD-TRAIN',
    phone: '20 5551 0007',
    email: 'hd.train@tved.local',
    role_code: 'hd',
    position_code: 'HD',
    division_code: 'TRAIN',
    supervisor_staff: 'DDG001',
    full_name: 'Sengchan Head-Train',
    first_name_en: 'Sengchan',
    last_name_en: 'Head',
    first_name_lo: 'ແສງຈັນ',
    last_name_lo: 'ຫົວໜ້າ',
  });
  await pool.query(`UPDATE divisions SET head_user_id = $1 WHERE code = 'TRAIN'`, [hdTrain.id]);

  const techTrain = await upsertUser({
    username: 'tech.noy',
    staff_code: 'TECH003',
    phone: '20 5551 0008',
    email: 'tech3@tved.local',
    role_code: 'tech',
    position_code: 'TECH',
    division_code: 'TRAIN',
    supervisor_staff: 'HD-TRAIN',
    full_name: 'Noy Trainer',
    first_name_en: 'Noy',
    last_name_en: 'Trainer',
    first_name_lo: 'ນ້ອຍ',
    last_name_lo: 'ຝຶກອົບຮົມ',
  });

  const adminStaff = await upsertUser({
    username: 'cms.admin',
    staff_code: 'ADM001',
    phone: '20 5551 0009',
    email: 'cms@tved.local',
    role_code: 'admin_staff',
    position_code: 'ADMIN',
    division_code: 'ADMIN',
    supervisor_staff: 'DG001',
    full_name: 'Phone CMS Admin',
    first_name_en: 'Phone',
    last_name_en: 'Admin',
    first_name_lo: 'ພອນ',
    last_name_lo: 'ບໍລິຫານ',
  });

  const hdQa = await upsertUser({
    username: 'hd.qa',
    staff_code: 'HD-QA',
    phone: '20 5551 0010',
    email: 'hd.qa@tved.local',
    role_code: 'hd',
    position_code: 'HD',
    division_code: 'QA',
    supervisor_staff: 'DDG001',
    full_name: 'Souk Head-QA',
    first_name_en: 'Souk',
    last_name_en: 'Head',
    first_name_lo: 'ສຸກ',
    last_name_lo: 'ຫົວໜ້າ',
  });
  await pool.query(`UPDATE divisions SET head_user_id = $1 WHERE code = 'QA'`, [hdQa.id]);

  const techQa = await upsertUser({
    username: 'tech.qa',
    staff_code: 'TECH004',
    phone: '20 5551 0011',
    email: 'tech4@tved.local',
    role_code: 'tech',
    position_code: 'TECH',
    division_code: 'QA',
    supervisor_staff: 'HD-QA',
    full_name: 'Phet Quality',
    first_name_en: 'Phet',
    last_name_en: 'Quality',
    first_name_lo: 'ເພັດ',
    last_name_lo: 'ຄຸນນະພາບ',
  });

  // Also give DDG oversight of QA
  const qaId = await divisionId('QA');
  await pool.query(
    `INSERT INTO division_user_oversight (user_id, division_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [ddg.id, qaId]
  );

  // Local calendar dates (avoid UTC shift)
  const today = new Date();
  const iso = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const d = (offset: number) => {
    const x = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    x.setDate(x.getDate() + offset);
    return iso(x);
  };
  const monthDay = (day: number) =>
    iso(new Date(today.getFullYear(), today.getMonth(), day));

  type SampleAct = {
    owner_staff: string;
    type_code: string;
    title_lo: string;
    title_en: string;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    is_all_day?: boolean;
    status: string;
    location?: string;
    assigned_by_staff?: string | null;
    duration_minutes: number;
  };

  const samples: SampleAct[] = [
    // —— TECH001 (Planning) — rich personal dashboard
    {
      owner_staff: 'TECH001', type_code: 'TASK',
      title_lo: 'ຂຽນແຜນງານອາທິດ', title_en: 'Weekly work plan',
      start_date: d(-2), end_date: d(-2), start_time: '08:00', end_time: '12:00',
      status: 'approved', duration_minutes: 240, assigned_by_staff: 'DHD-PLAN',
    },
    {
      owner_staff: 'TECH001', type_code: 'MEETING',
      title_lo: 'ປະຊຸມກົມແຜນການ', title_en: 'Planning division meeting',
      start_date: d(-1), end_date: d(-1), start_time: '09:00', end_time: '11:00',
      status: 'approved', location: 'TVED Meeting Room A', duration_minutes: 120,
      assigned_by_staff: 'DHD-PLAN',
    },
    {
      owner_staff: 'TECH001', type_code: 'FIELD',
      title_lo: 'ລົງພື້ນທີ່ສະຖາບັນ', title_en: 'Field visit to institution',
      start_date: d(1), end_date: d(1), start_time: '08:30', end_time: '16:30',
      status: 'draft', location: 'Champasak', duration_minutes: 480, assigned_by_staff: 'HD-PLAN',
    },
    {
      owner_staff: 'TECH001', type_code: 'REPORT',
      title_lo: 'ສັງລວມຂໍ້ມູນສະຖິຕິ', title_en: 'Compile statistics summary',
      start_date: d(-4), end_date: d(-4), start_time: '08:00', end_time: '16:00',
      status: 'approved', duration_minutes: 480, assigned_by_staff: 'DHD-PLAN',
    },
    {
      owner_staff: 'TECH001', type_code: 'TASK',
      title_lo: 'ກວດແຜນງານປະຈຳໄຕມາດ', title_en: 'Review quarterly plan',
      start_date: d(-5), end_date: d(-5), start_time: '09:00', end_time: '15:00',
      status: 'submitted', duration_minutes: 360,
    },
    {
      owner_staff: 'TECH001', type_code: 'CONFERENCE',
      title_lo: 'ສຳມະນາແຜນພັດທະນາ TVET', title_en: 'TVET development seminar',
      start_date: d(-8), end_date: d(-7), is_all_day: true,
      status: 'approved', location: 'Lao Plaza Hotel', duration_minutes: 960,
      assigned_by_staff: 'HD-PLAN',
    },
    {
      owner_staff: 'TECH001', type_code: 'OTHER',
      title_lo: 'ຈັດເອກະສານຄັງ', title_en: 'Archive filing',
      start_date: d(0), end_date: d(0), start_time: '14:00', end_time: '16:00',
      status: 'draft', duration_minutes: 120,
    },
    {
      owner_staff: 'TECH001', type_code: 'MEETING',
      title_lo: 'ປະຊຸມກຽມລາຍງານ DG', title_en: 'Prep meeting for DG report',
      start_date: d(-3), end_date: d(-3), start_time: '10:00', end_time: '11:30',
      status: 'approved', duration_minutes: 90, assigned_by_staff: 'HD-PLAN',
    },

    // —— TECH002
    {
      owner_staff: 'TECH002', type_code: 'REPORT',
      title_lo: 'ຂຽນລາຍງານປະຈຳເດືອນ', title_en: 'Monthly report draft',
      start_date: d(0), end_date: d(0), start_time: '13:00', end_time: '17:00',
      status: 'draft', duration_minutes: 240,
    },
    {
      owner_staff: 'TECH002', type_code: 'TASK',
      title_lo: 'ອັບເດດຖານຂໍ້ມູນໂຮງຮຽນ', title_en: 'Update school database',
      start_date: d(-3), end_date: d(-3), start_time: '08:00', end_time: '12:00',
      status: 'approved', duration_minutes: 240, assigned_by_staff: 'DHD-PLAN',
    },
    {
      owner_staff: 'TECH002', type_code: 'MEETING',
      title_lo: 'ປະຊຸມທີມງານແຜນການ', title_en: 'Planning team huddle',
      start_date: d(-2), end_date: d(-2), start_time: '15:00', end_time: '16:00',
      status: 'submitted', duration_minutes: 60,
    },
    {
      owner_staff: 'TECH002', type_code: 'FIELD',
      title_lo: 'ລົງກວດໂຮງຮຽນວຽງຈັນ', title_en: 'Inspect Vientiane school',
      start_date: d(-6), end_date: d(-6), start_time: '08:00', end_time: '16:00',
      status: 'approved', location: 'Vientiane Capital', duration_minutes: 480,
      assigned_by_staff: 'HD-PLAN',
    },
    {
      owner_staff: 'TECH002', type_code: 'TRIP',
      title_lo: 'ເດີນທາງປະຊຸມແຂວງ', title_en: 'Provincial coordination trip',
      start_date: d(-10), end_date: d(-9), is_all_day: true,
      status: 'approved', location: 'Luang Prabang', duration_minutes: 960,
      assigned_by_staff: 'HD-PLAN',
    },
    {
      owner_staff: 'TECH002', type_code: 'REPORT',
      title_lo: 'ລາຍງານຜົນລົງພື້ນທີ່', title_en: 'Field visit findings report',
      start_date: d(-5), end_date: d(-5), start_time: '09:00', end_time: '12:00',
      status: 'rejected', duration_minutes: 180, assigned_by_staff: 'DHD-PLAN',
    },

    // —— TECH003 (Training)
    {
      owner_staff: 'TECH003', type_code: 'TRAINING',
      title_lo: 'ຝຶກອົບຮົມຄູອາຈານ', title_en: 'Teacher training workshop',
      start_date: d(-3), end_date: d(-1), is_all_day: true,
      status: 'submitted', location: 'Vientiane TVET College', duration_minutes: 3 * 8 * 60,
    },
    {
      owner_staff: 'TECH003', type_code: 'TRAINING',
      title_lo: 'ຝຶກຫຼັກສູດໂມດູນ A', title_en: 'Curriculum module A training',
      start_date: d(-12), end_date: d(-11), is_all_day: true,
      status: 'approved', location: 'TVED Training Centre', duration_minutes: 960,
      assigned_by_staff: 'HD-TRAIN',
    },
    {
      owner_staff: 'TECH003', type_code: 'MEETING',
      title_lo: 'ປະຊຸມກົມຝຶກອົບຮົມ', title_en: 'Training division meeting',
      start_date: d(-4), end_date: d(-4), start_time: '09:00', end_time: '11:00',
      status: 'approved', duration_minutes: 120, assigned_by_staff: 'HD-TRAIN',
    },
    {
      owner_staff: 'TECH003', type_code: 'TASK',
      title_lo: 'ກຽມເອກະສານຝຶກ', title_en: 'Prepare training materials',
      start_date: d(0), end_date: d(0), start_time: '08:00', end_time: '11:00',
      status: 'draft', duration_minutes: 180,
    },
    {
      owner_staff: 'TECH003', type_code: 'CONFERENCE',
      title_lo: 'ກອງປະຊຸມຄູອາຊີວະ', title_en: 'Vocational teachers conference',
      start_date: d(-15), end_date: d(-14), is_all_day: true,
      status: 'approved', location: 'National Convention Hall', duration_minutes: 960,
      assigned_by_staff: 'HD-TRAIN',
    },

    // —— TECH004 (QA)
    {
      owner_staff: 'TECH004', type_code: 'FIELD',
      title_lo: 'ກວດຄຸນນະພາບສະຖາບັນ', title_en: 'Institution quality audit',
      start_date: d(-2), end_date: d(-2), start_time: '08:00', end_time: '16:00',
      status: 'submitted', location: 'Savannakhet', duration_minutes: 480,
      assigned_by_staff: 'HD-QA',
    },
    {
      owner_staff: 'TECH004', type_code: 'REPORT',
      title_lo: 'ລາຍງານກວດຄຸນນະພາບ', title_en: 'QA inspection report',
      start_date: d(-7), end_date: d(-7), start_time: '08:00', end_time: '17:00',
      status: 'approved', duration_minutes: 540, assigned_by_staff: 'HD-QA',
    },
    {
      owner_staff: 'TECH004', type_code: 'MEETING',
      title_lo: 'ປະຊຸມຄະນະ QA', title_en: 'QA committee meeting',
      start_date: d(-1), end_date: d(-1), start_time: '13:00', end_time: '15:00',
      status: 'approved', duration_minutes: 120, assigned_by_staff: 'HD-QA',
    },
    {
      owner_staff: 'TECH004', type_code: 'TASK',
      title_lo: 'ອັບເດດມາດຕະຖານ', title_en: 'Update quality standards checklist',
      start_date: d(0), end_date: d(0), start_time: '09:00', end_time: '12:00',
      status: 'draft', duration_minutes: 180,
    },

    // —— DHD / HD / leadership activities
    {
      owner_staff: 'DHD-PLAN', type_code: 'MEETING',
      title_lo: 'ປະຊຸມກວດວຽກທີມ', title_en: 'Team progress review',
      start_date: d(-1), end_date: d(-1), start_time: '08:00', end_time: '09:30',
      status: 'approved', duration_minutes: 90, assigned_by_staff: 'HD-PLAN',
    },
    {
      owner_staff: 'DHD-PLAN', type_code: 'REPORT',
      title_lo: 'ສັງລວມລາຍງານກົມ', title_en: 'Division summary report',
      start_date: d(-4), end_date: d(-4), start_time: '13:00', end_time: '17:00',
      status: 'submitted', duration_minutes: 240,
    },
    {
      owner_staff: 'HD-PLAN', type_code: 'MEETING',
      title_lo: 'ປະຊຸມກັບ DDG', title_en: 'Meeting with DDG',
      start_date: d(-2), end_date: d(-2), start_time: '10:00', end_time: '11:00',
      status: 'approved', duration_minutes: 60, assigned_by_staff: 'DDG001',
    },
    {
      owner_staff: 'HD-PLAN', type_code: 'TASK',
      title_lo: 'ອະນຸມັດແຜນງານກົມ', title_en: 'Approve division workplan',
      start_date: d(-5), end_date: d(-5), start_time: '08:00', end_time: '10:00',
      status: 'approved', duration_minutes: 120,
    },
    {
      owner_staff: 'HD-TRAIN', type_code: 'TRAINING',
      title_lo: 'ກວດການຝຶກອົບຮົມ', title_en: 'Supervise training session',
      start_date: d(-3), end_date: d(-3), start_time: '08:00', end_time: '12:00',
      status: 'approved', duration_minutes: 240,
    },
    {
      owner_staff: 'HD-QA', type_code: 'MEETING',
      title_lo: 'ປະຊຸມຄຸນນະພາບກົມ', title_en: 'Division QA briefing',
      start_date: d(-6), end_date: d(-6), start_time: '09:00', end_time: '10:30',
      status: 'approved', duration_minutes: 90,
    },
    {
      owner_staff: 'DDG001', type_code: 'MEETING',
      title_lo: 'ປະຊຸມຫົວໜ້າກົມ', title_en: 'Heads of division meeting',
      start_date: d(-3), end_date: d(-3), start_time: '09:00', end_time: '12:00',
      status: 'approved', duration_minutes: 180, assigned_by_staff: 'DG001',
    },
    {
      owner_staff: 'DG001', type_code: 'CONFERENCE',
      title_lo: 'ເຂົ້າຮ່ວມກອງປະຊຸມກະຊວງ', title_en: 'Ministry conference attendance',
      start_date: d(-8), end_date: d(-8), start_time: '08:00', end_time: '16:00',
      status: 'approved', location: 'MoES', duration_minutes: 480,
    },
    {
      owner_staff: 'ADM001', type_code: 'TASK',
      title_lo: 'ອັບເດດເວັບໄຊສາທາລະນະ', title_en: 'Update public website content',
      start_date: d(-1), end_date: d(-1), start_time: '09:00', end_time: '12:00',
      status: 'approved', duration_minutes: 180, assigned_by_staff: 'DG001',
    },
    {
      owner_staff: 'ADM001', type_code: 'OTHER',
      title_lo: 'ຈັດເອກະສານບໍລິຫານ', title_en: 'Admin document filing',
      start_date: d(0), end_date: d(0), start_time: '13:00', end_time: '15:00',
      status: 'draft', duration_minutes: 120,
    },
  ];

  // Extra spread across earlier month days for richer charts (hours_by_day / reports)
  const monthExtras: SampleAct[] = [];
  const owners = ['TECH001', 'TECH002', 'TECH003', 'TECH004', 'DHD-PLAN', 'HD-PLAN'] as const;
  const types = ['TASK', 'MEETING', 'REPORT', 'FIELD', 'TRAINING', 'OTHER'] as const;
  const statuses = ['approved', 'approved', 'approved', 'submitted', 'draft'] as const;
  for (let day = 1; day <= Math.min(today.getDate(), 28); day += 2) {
    const owner = owners[day % owners.length];
    const type = types[day % types.length];
    const status = statuses[day % statuses.length];
    const start = monthDay(day);
    // skip if same calendar day already densely covered near "today" offsets — still OK unique titles
    monthExtras.push({
      owner_staff: owner,
      type_code: type,
      title_lo: `ວຽກຕົວຢ່າງ ວັນທີ ${day}`,
      title_en: `Sample activity day ${day}`,
      start_date: start,
      end_date: start,
      start_time: '08:00',
      end_time: day % 3 === 0 ? '16:00' : '12:00',
      status,
      duration_minutes: day % 3 === 0 ? 480 : 240,
      assigned_by_staff: owner.startsWith('TECH')
        ? owner === 'TECH003'
          ? 'HD-TRAIN'
          : owner === 'TECH004'
            ? 'HD-QA'
            : 'DHD-PLAN'
        : null,
      location: type === 'FIELD' ? 'Provincial TVET site' : undefined,
    });
  }

  for (const a of [...samples, ...monthExtras]) {
    await ensureActivity(a);
  }

  // Participants on key meetings
  const meetingTitles = [
    'Planning division meeting',
    'Heads of division meeting',
    'Training division meeting',
    'QA committee meeting',
  ];
  for (const title of meetingTitles) {
    const meeting = await pool.query(
      `SELECT id, user_id FROM activities WHERE title_en = $1 AND deleted_at IS NULL LIMIT 1`,
      [title]
    );
    if (!meeting.rows[0]) continue;
    await pool.query(`DELETE FROM activity_participants WHERE activity_id = $1`, [meeting.rows[0].id]);
    const participants = [dhdPlan.id, tech1.id, tech2.id, hdPlan.id].filter(Boolean);
    for (let i = 0; i < participants.length; i++) {
      await pool.query(
        `INSERT INTO activity_participants (activity_id, user_id, role_in_activity)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [meeting.rows[0].id, participants[i], i === 0 ? 'chair' : 'member']
      );
    }
  }

  // Notifications for pending approvals
  await pool.query(
    `INSERT INTO notifications (user_id, type, title_lo, title_en, link_url, related_type, related_id)
     SELECT $1, 'submitted', 'ມີກິດຈະກຳລໍຖ້າອະນຸມັດ', 'Activities pending approval', '/approvals', 'activity', a.id
     FROM activities a
     JOIN users u ON u.id = a.user_id
     WHERE a.status = 'submitted' AND u.division_id = (SELECT id FROM divisions WHERE code = 'PLAN')
       AND NOT EXISTS (
         SELECT 1 FROM notifications n WHERE n.user_id = $1 AND n.related_id = a.id AND n.type = 'submitted'
       )`,
    [dhdPlan.id]
  );
  await pool.query(
    `INSERT INTO notifications (user_id, type, title_lo, title_en, link_url, related_type, related_id)
     SELECT $1, 'submitted', 'ມີກິດຈະກຳລໍຖ້າອະນຸມັດ', 'Activities pending approval', '/approvals', 'activity', a.id
     FROM activities a
     JOIN users u ON u.id = a.user_id
     WHERE a.status = 'submitted' AND u.staff_code = 'TECH003'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n WHERE n.user_id = $1 AND n.related_id = a.id AND n.type = 'submitted'
       )`,
    [hdTrain.id]
  );

  // CMS sample
  await pool.query(
    `INSERT INTO news (slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, is_published, published_at, is_featured)
     VALUES (
       'tved-workshop-2026',
       'ກອງປະຊຸມຝຶກອົບຮົມ TVED 2026',
       'TVED Training Workshop 2026',
       'ກອງປະຊຸມສຳລັບຄູອາຈານ',
       'Workshop for teachers',
       'ລາຍລະອຽດກອງປະຊຸມຕົວຢ່າງ',
       'Sample workshop details for the public site.',
       true, NOW(), true
     )
     ON CONFLICT (slug) DO UPDATE SET title_lo = EXCLUDED.title_lo, is_published = true`
  );
  await pool.query(
    `INSERT INTO news (slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, is_published, published_at, is_featured)
     VALUES (
       'qa-audit-round',
       'ຮອບກວດຄຸນນະພາບສະຖາບັນ',
       'Institution QA audit round',
       'ເລີ່ມກວດຄຸນນະພາບໃນ 5 ແຂວງ',
       'QA audits starting in 5 provinces',
       'ລາຍລະອຽດຮອບກວດ',
       'Details of the QA audit round for public visitors.',
       true, NOW(), false
     )
     ON CONFLICT (slug) DO UPDATE SET title_lo = EXCLUDED.title_lo, is_published = true`
  );

  await pool.query(
    `INSERT INTO institutions (name_lo, name_en, province, type, phone, website)
     SELECT * FROM (VALUES
       ('ວິທະຍາໄລເຕັກນິກ ນະຄອນຫຼວງ', 'Vientiane Technical College', 'Vientiane Capital', 'College', '021-000001', 'https://example.la'),
       ('ໂຮງຮຽນວິຊາຊີບ ຈຳປາສັກ', 'Champasak Vocational School', 'Champasak', 'School', '031-000002', NULL),
       ('ວິທະຍາໄລອາຊີວະ ສະຫວັນນະເຂດ', 'Savannakhet Vocational College', 'Savannakhet', 'College', '041-000003', NULL),
       ('ໂຮງຮຽນວິຊາຊີບ ຫຼວງພະບາງ', 'Luang Prabang Vocational School', 'Luang Prabang', 'School', '071-000004', NULL)
     ) AS v(name_lo, name_en, province, type, phone, website)
     WHERE NOT EXISTS (SELECT 1 FROM institutions i WHERE i.name_en = v.name_en)`
  );

  clearHierarchyCache();

  const counts = await pool.query(`
    SELECT
      (SELECT count(*) FROM users WHERE deleted_at IS NULL) AS users,
      (SELECT count(*) FROM activities WHERE deleted_at IS NULL) AS activities,
      (SELECT count(*) FROM activities WHERE status = 'submitted' AND deleted_at IS NULL) AS submitted,
      (SELECT count(*) FROM activities WHERE status = 'approved' AND deleted_at IS NULL) AS approved,
      (SELECT count(*) FROM institutions WHERE is_active) AS institutions,
      (SELECT count(*) FROM news WHERE is_published) AS news
  `);

  console.log('✅ Sample data ready');
  console.log('Counts:', counts.rows[0]);
  console.log('\nSample logins (password: Staff123!)');
  console.log('  DG001 / dg@tved.local');
  console.log('  DDG001 / ddg@tved.local');
  console.log('  HD-PLAN / hd.plan@tved.local');
  console.log('  DHD-PLAN / dhd.plan@tved.local');
  console.log('  HD-TRAIN / hd.train@tved.local');
  console.log('  HD-QA / hd.qa@tved.local');
  console.log('  TECH001 / tech1@tved.local');
  console.log('  TECH002 / tech2@tved.local');
  console.log('  TECH003 / tech3@tved.local');
  console.log('  TECH004 / tech4@tved.local');
  console.log('  ADM001 / cms@tved.local');
  console.log('  admin / admin123 (super admin)');

  void [dg, tech2, techTrain, adminStaff, hdTrain, techQa];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('❌ Sample seed failed:', e);
      await pool.end();
      process.exit(1);
    });
}

export default main;
