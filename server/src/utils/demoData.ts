/**
 * Large, realistic demo dataset for the TVED portal.
 *
 * Generates a full department: ~30 staff across 4 divisions, several months of
 * day-by-day activities, meeting participants, review comments, notifications,
 * audit trail and public CMS content — enough for every dashboard widget,
 * chart and report period to look populated.
 *
 * Every row it writes is tagged so a re-run replaces its own data and never
 * touches anything entered by hand.
 *
 *   npm run seed:demo              # default 6 months of history
 *   DEMO_MONTHS=12 npm run seed:demo
 *
 * Default password for every generated account: Staff123!
 */
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { clearHierarchyCache } from '../services/HierarchyService.js';

const MARKER = '[demo-seed]';
const PASSWORD = 'Staff123!';
const MONTHS_BACK = Number(process.env.DEMO_MONTHS || 6);
const DAYS_FORWARD = 21;

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-randomness — same command, same dataset.
 * ------------------------------------------------------------------ */
let seedState = 20260820;
const rnd = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */
const today = new Date();
const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const daysAgo = (d: Date) => Math.round((midnight.getTime() - d.getTime()) / 86400000);

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */
const LAO_FIRST = [
  ['ສົມພອນ', 'Somphone'], ['ບຸນທະວີ', 'Bounthavy'], ['ຄຳສຸກ', 'Khamsouk'],
  ['ວັນນະສອນ', 'Vannason'], ['ສີສະຫວາດ', 'Sisavath'], ['ພອນສະຫວັນ', 'Phonesavanh'],
  ['ດາລາ', 'Dala'], ['ມະນີວອນ', 'Manivone'], ['ຈັນທະລາ', 'Chanthala'],
  ['ໄພວັນ', 'Phaivanh'], ['ສຸກສະຫວັນ', 'Souksavanh'], ['ອຳໄພ', 'Amphay'],
  ['ບົວພັນ', 'Bouaphanh'], ['ຄຳຫລ້າ', 'Khamla'], ['ວິໄລພອນ', 'Vilayphone'],
  ['ຄຳຜົງ', 'Khamphong'], ['ສົມຈິດ', 'Somchit'], ['ພູທອນ', 'Phouthone'],
  ['ແສງດາວ', 'Sengdao'], ['ອາລຸນ', 'Aloun'], ['ດວງໃຈ', 'Douangchai'],
  ['ທອງສຸກ', 'Thongsouk'], ['ນາລີ', 'Naly'], ['ສີພອນ', 'Siphone'],
  ['ຄຳມະນີ', 'Khammany'], ['ວົງເດືອນ', 'Vongduane'], ['ບຸນປອນ', 'Bounpone'],
  ['ສະຫວັນ', 'Savanh'], ['ພຸດທະສອນ', 'Phoutthason'], ['ຈິນຕະນາ', 'Chintana'],
] as const;

const LAO_LAST = [
  ['ພົມມະຈັນ', 'Phommachanh'], ['ວົງສະຫວັນ', 'Vongsavanh'], ['ສີວິໄລ', 'Sivilay'],
  ['ແກ້ວມະນີ', 'Keomany'], ['ຈັນທະວົງ', 'Chanthavong'], ['ອິນທະວົງ', 'Inthavong'],
  ['ລັດຕະນະວົງ', 'Rattanavong'], ['ສຸວັນນະລາດ', 'Souvannalath'], ['ພັນທະວົງ', 'Phanthavong'],
  ['ໄຊຍະສານ', 'Xaiyasane'], ['ນໍລະສິງ', 'Norasing'], ['ດວງມະນີ', 'Douangmany'],
] as const;

type Staff = {
  username: string;
  staff_code: string;
  email: string;
  role_code: string;
  position_code: string;
  division_code: string | null;
  supervisor_staff: string | null;
  first_lo: string;
  last_lo: string;
  first_en: string;
  last_en: string;
  phone: string;
  id?: number;
  division_id?: number | null;
};

let phoneSeq = 100;
const nextPhone = () => `20 55${String(++phoneSeq).padStart(3, '0')} ${int(1000, 9999)}`;

const usedNames = new Set<string>();
function freshName() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const f = pick(LAO_FIRST);
    const l = pick(LAO_LAST);
    const key = `${f[1]} ${l[1]}`;
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return { first_lo: f[0], last_lo: l[0], first_en: f[1], last_en: l[1] };
    }
  }
  const f = pick(LAO_FIRST);
  const l = pick(LAO_LAST);
  return { first_lo: f[0], last_lo: l[0], first_en: f[1], last_en: `${l[1]}${usedNames.size}` };
}

/** Builds the whole org chart: DG → DDG → HD → DHD → staff, per division. */
function buildRoster(): Staff[] {
  const roster: Staff[] = [];
  const add = (s: Omit<Staff, 'first_lo' | 'last_lo' | 'first_en' | 'last_en' | 'phone'>) => {
    const n = freshName();
    roster.push({ ...s, ...n, phone: nextPhone() });
  };

  add({
    username: 'demo.dg', staff_code: 'DG100', email: 'dg100@tved.local',
    role_code: 'dg', position_code: 'DG', division_code: null, supervisor_staff: null,
  });
  add({
    username: 'demo.ddg.1', staff_code: 'DDG101', email: 'ddg101@tved.local',
    role_code: 'ddg', position_code: 'DDG', division_code: null, supervisor_staff: 'DG100',
  });
  add({
    username: 'demo.ddg.2', staff_code: 'DDG102', email: 'ddg102@tved.local',
    role_code: 'ddg', position_code: 'DDG', division_code: null, supervisor_staff: 'DG100',
  });

  const divisions: { code: string; staff: number; admin?: boolean }[] = [
    { code: 'PLAN', staff: 6 },
    { code: 'TRAIN', staff: 6 },
    { code: 'QA', staff: 5 },
    { code: 'ADMIN', staff: 5, admin: true },
  ];

  divisions.forEach((div, idx) => {
    const ddg = idx < 2 ? 'DDG101' : 'DDG102';
    const hd = `HD-${div.code}-D`;
    const dhd = `DHD-${div.code}-D`;
    add({
      username: `demo.hd.${div.code.toLowerCase()}`, staff_code: hd,
      email: `hd.${div.code.toLowerCase()}.demo@tved.local`,
      role_code: 'hd', position_code: 'HD', division_code: div.code, supervisor_staff: ddg,
    });
    add({
      username: `demo.dhd.${div.code.toLowerCase()}`, staff_code: dhd,
      email: `dhd.${div.code.toLowerCase()}.demo@tved.local`,
      role_code: 'dhd', position_code: 'DHD', division_code: div.code, supervisor_staff: hd,
    });
    for (let i = 1; i <= div.staff; i++) {
      add({
        username: `demo.${div.code.toLowerCase()}.${i}`,
        staff_code: `${div.code}-S${String(i).padStart(2, '0')}`,
        email: `${div.code.toLowerCase()}.s${i}.demo@tved.local`,
        role_code: div.admin ? 'admin_staff' : 'tech',
        position_code: div.admin ? 'ADMIN' : 'TECH',
        division_code: div.code,
        // half report to the DHD, half straight to the HD — a realistic mixed tree
        supervisor_staff: i % 2 === 0 ? hd : dhd,
      });
    }
  });

  return roster;
}

/* ------------------------------------------------------------------ *
 * Activity title banks (Lao required, English secondary)
 * ------------------------------------------------------------------ */
const TITLES: Record<string, readonly (readonly [string, string])[]> = {
  TASK: [
    ['ຂຽນແຜນງານປະຈຳອາທິດ', 'Draft the weekly work plan'],
    ['ອັບເດດຖານຂໍ້ມູນສະຖາບັນ', 'Update the institution database'],
    ['ກວດແກ້ເອກະສານຫຼັກສູດ', 'Revise curriculum documents'],
    ['ຈັດລຽງແຟ້ມເອກະສານລາຊະການ', 'Organise official document files'],
    ['ກະກຽມຂໍ້ມູນສະຖິຕິນັກຮຽນ', 'Prepare student statistics'],
    ['ຕິດຕາມຄວາມຄືບໜ້າໂຄງການ', 'Track project progress'],
    ['ກວດສອບງົບປະມານກິດຈະກຳ', 'Check the activity budget'],
    ['ຮ່າງໜັງສືແຈ້ງການພາຍໃນ', 'Draft an internal circular'],
    ['ປັບປຸງແບບຟອມລາຍງານ', 'Improve the reporting form'],
    ['ລວບລວມຂໍ້ມູນຈາກແຂວງ', 'Consolidate provincial data'],
  ],
  MEETING: [
    ['ປະຊຸມປະຈຳອາທິດຂອງພະແນກ', 'Weekly division meeting'],
    ['ປະຊຸມຄະນະຮັບຜິດຊອບໂຄງການ', 'Project steering meeting'],
    ['ປະຊຸມກັບຫົວໜ້າພະແນກ', 'Meeting with the division head'],
    ['ປະຊຸມກຽມການລາຍງານປະຈຳເດືອນ', 'Monthly report preparation meeting'],
    ['ປະຊຸມຮ່ວມກັບຄູ່ຮ່ວມພັດທະນາ', 'Meeting with development partners'],
    ['ປະຊຸມທົບທວນແຜນງົບປະມານ', 'Budget plan review meeting'],
    ['ປະຊຸມປຶກສາຫາລືຫຼັກສູດໃໝ່', 'Consultation on the new curriculum'],
    ['ປະຊຸມຄະນະກຳມະການວິຊາການ', 'Technical committee meeting'],
  ],
  CONFERENCE: [
    ['ກອງປະຊຸມໃຫຍ່ປະຈຳປີຂອງກົມ', 'Annual departmental conference'],
    ['ສຳມະນາການພັດທະນາອາຊີວະສຶກສາ', 'TVET development seminar'],
    ['ກອງປະຊຸມຄູອາຈານອາຊີວະສຶກສາ', 'Vocational teachers conference'],
    ['ສຳມະນາຄວາມຮ່ວມມືພາກພື້ນ ອາຊຽນ', 'ASEAN regional cooperation seminar'],
    ['ກອງປະຊຸມສະຫຼຸບແຜນ 5 ປີ', 'Five-year plan review conference'],
  ],
  TRAINING: [
    ['ຝຶກອົບຮົມຄູອາຈານດ້ານເຕັກນິກ', 'Technical teacher training'],
    ['ຝຶກອົບຮົມການນຳໃຊ້ລະບົບຂໍ້ມູນ', 'Information system training'],
    ['ຝຶກອົບຮົມຫຼັກສູດໂມດູນໃໝ່', 'New module curriculum training'],
    ['ຝຶກອົບຮົມການປະເມີນຄຸນນະພາບ', 'Quality assessment training'],
    ['ຝຶກອົບຮົມທັກສະການສອນ', 'Pedagogical skills training'],
    ['ຝຶກອົບຮົມຄວາມປອດໄພໃນໂຮງງານ', 'Workshop safety training'],
  ],
  FIELD: [
    ['ລົງຕິດຕາມສະຖາບັນອາຊີວະສຶກສາ', 'Monitoring visit to a TVET institution'],
    ['ລົງກວດຄຸນນະພາບການສິດສອນ', 'Teaching quality inspection'],
    ['ລົງເກັບຂໍ້ມູນພາກສະໜາມ', 'Field data collection'],
    ['ລົງຢ້ຽມຢາມໂຮງຮຽນວິຊາຊີບ', 'Visit to a vocational school'],
    ['ລົງກວດກາອຸປະກອນຝຶກ', 'Inspection of training equipment'],
  ],
  TRIP: [
    ['ເດີນທາງໄປປະຊຸມຢູ່ແຂວງ', 'Official trip for a provincial meeting'],
    ['ເດີນທາງຮ່ວມກອງປະຊຸມຕ່າງປະເທດ', 'Overseas conference trip'],
    ['ເດີນທາງຕິດຕາມໂຄງການພາກເໜືອ', 'Northern project monitoring trip'],
    ['ເດີນທາງປະສານງານກັບພະແນກສຶກສາແຂວງ', 'Coordination trip with the provincial education office'],
  ],
  REPORT: [
    ['ຂຽນລາຍງານປະຈຳເດືອນ', 'Write the monthly report'],
    ['ສັງລວມລາຍງານປະຈຳໄຕມາດ', 'Compile the quarterly report'],
    ['ຂຽນລາຍງານຜົນການລົງພື້ນທີ່', 'Write the field mission report'],
    ['ສ້າງບົດສະຫຼຸບການຝຶກອົບຮົມ', 'Produce the training summary'],
    ['ຂຽນບົດວິເຄາະຂໍ້ມູນສະຖິຕິ', 'Write the statistical analysis'],
    ['ກະກຽມລາຍງານສະເໜີທ່ານຫົວໜ້າກົມ', 'Prepare the report for the Director General'],
  ],
  OTHER: [
    ['ຮັບແຂກຈາກອົງການຈັດຕັ້ງສາກົນ', 'Receive an international organisation delegation'],
    ['ຈັດງານວັນສ້າງຕັ້ງກົມ', 'Organise the department anniversary'],
    ['ວຽກງານບໍລິຫານທົ່ວໄປ', 'General administrative work'],
    ['ຊ່ວຍວຽກພະແນກອື່ນ', 'Support work for another division'],
    ['ອັບເດດເນື້ອໃນເວັບໄຊທ໌ກົມ', 'Update the department website'],
  ],
};

const LOCATIONS = [
  'TVED Meeting Room A', 'TVED Meeting Room B', 'Vientiane Capital',
  'Luang Prabang', 'Champasak', 'Savannakhet', 'Xieng Khouang',
  'Oudomxay', 'Vientiane TVET College', 'Lao Plaza Hotel',
  'National Convention Hall', 'MoES Head Office',
];

/** How a given role spends its week. */
const TYPE_MIX: Record<string, readonly string[]> = {
  tech: ['TASK', 'TASK', 'TASK', 'REPORT', 'REPORT', 'MEETING', 'MEETING', 'FIELD', 'TRAINING', 'OTHER', 'CONFERENCE', 'TRIP'],
  admin_staff: ['TASK', 'TASK', 'TASK', 'OTHER', 'OTHER', 'MEETING', 'REPORT', 'MEETING', 'TASK', 'OTHER'],
  dhd: ['MEETING', 'MEETING', 'REPORT', 'TASK', 'FIELD', 'TRAINING', 'MEETING', 'REPORT'],
  hd: ['MEETING', 'MEETING', 'MEETING', 'REPORT', 'CONFERENCE', 'FIELD', 'TASK', 'TRIP'],
  ddg: ['MEETING', 'MEETING', 'CONFERENCE', 'REPORT', 'TRIP', 'MEETING'],
  dg: ['MEETING', 'CONFERENCE', 'CONFERENCE', 'MEETING', 'TRIP', 'REPORT'],
  super_admin: ['TASK', 'MEETING', 'REPORT', 'OTHER', 'TASK', 'MEETING'],
};

/** Multi-day, all-day activity types. */
const MULTIDAY = new Set(['CONFERENCE', 'TRAINING', 'TRIP']);

const TIME_SLOTS = [
  ['08:00', '10:00', 120], ['08:00', '12:00', 240], ['08:30', '11:30', 180],
  ['09:00', '11:00', 120], ['09:00', '12:00', 180], ['10:00', '11:30', 90],
  ['13:00', '15:00', 120], ['13:00', '17:00', 240], ['14:00', '16:00', 120],
  ['08:00', '16:00', 480], ['08:00', '17:00', 540], ['15:00', '16:00', 60],
] as const;

/* ------------------------------------------------------------------ *
 * Batched insert helper
 * ------------------------------------------------------------------ */
async function insertBatch(table: string, columns: string[], rows: unknown[][], returning?: string) {
  const out: any[] = [];
  const perStatement = Math.max(1, Math.floor(60000 / columns.length));
  for (let offset = 0; offset < rows.length; offset += perStatement) {
    const slice = rows.slice(offset, offset + perStatement);
    const values: unknown[] = [];
    const tuples = slice.map((row) => {
      const placeholders = row.map((v) => {
        values.push(v);
        return `$${values.length}`;
      });
      return `(${placeholders.join(',')})`;
    });
    const sql =
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}` +
      (returning ? ` RETURNING ${returning}` : '');
    const res = await pool.query(sql, values);
    if (returning) out.push(...res.rows);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
async function main() {
  console.log(`🌱 Generating demo data — ${MONTHS_BACK} months of history…`);

  const lookup = async (table: string) => {
    const r = await pool.query(`SELECT id, code FROM ${table}`);
    return new Map<string, number>(r.rows.map((x: any) => [x.code, x.id]));
  };
  const roles = await lookup('roles');
  const positions = await lookup('positions');
  const divisions = await lookup('divisions');
  const types = await lookup('activity_types');

  /* ---- 1. clear anything a previous run of THIS script wrote ---- */
  console.log('🧹 Removing previous demo rows…');
  await pool.query(`DELETE FROM notifications WHERE body_en LIKE $1`, [`%${MARKER}%`]);
  await pool.query(`DELETE FROM audit_logs WHERE new_values->>'demo' = 'true'`);
  await pool.query(`DELETE FROM activities WHERE description LIKE $1`, [`%${MARKER}%`]);
  await pool.query(`DELETE FROM public_events WHERE description_en LIKE $1`, [`%${MARKER}%`]);
  await pool.query(`DELETE FROM documents WHERE file_path LIKE '/demo/%'`);
  await pool.query(`DELETE FROM banners WHERE image_path LIKE '/demo/%'`);
  await pool.query(`DELETE FROM contact_messages WHERE email LIKE '%@demo.invalid'`);

  /* ---- 2. staff ---- */
  const roster = buildRoster();
  const hash = await bcrypt.hash(PASSWORD, 10);
  const byStaffCode = new Map<string, Staff>();

  for (const s of roster) {
    const division_id = s.division_code ? divisions.get(s.division_code)! : null;
    const supervisor_id = s.supervisor_staff
      ? byStaffCode.get(s.supervisor_staff)?.id ?? null
      : null;
    const res = await pool.query(
      `INSERT INTO users (
         username, staff_code, email, password, role, role_id, full_name,
         first_name_en, last_name_en, first_name_lo, last_name_lo, phone,
         position_id, division_id, supervisor_id, locale_pref, is_active, must_change_password
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'lo',true,false)
       ON CONFLICT (username) DO UPDATE SET
         staff_code = EXCLUDED.staff_code, email = EXCLUDED.email,
         password = EXCLUDED.password, role = EXCLUDED.role, role_id = EXCLUDED.role_id,
         full_name = EXCLUDED.full_name,
         first_name_en = EXCLUDED.first_name_en, last_name_en = EXCLUDED.last_name_en,
         first_name_lo = EXCLUDED.first_name_lo, last_name_lo = EXCLUDED.last_name_lo,
         phone = EXCLUDED.phone, position_id = EXCLUDED.position_id,
         division_id = EXCLUDED.division_id, supervisor_id = EXCLUDED.supervisor_id,
         deleted_at = NULL, is_active = true, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        s.username, s.staff_code, s.email, hash, s.role_code, roles.get(s.role_code),
        `${s.first_en} ${s.last_en}`, s.first_en, s.last_en, s.first_lo, s.last_lo,
        s.phone, positions.get(s.position_code), division_id, supervisor_id,
      ]
    );
    s.id = res.rows[0].id;
    s.division_id = division_id;
    byStaffCode.set(s.staff_code, s);
  }
  console.log(`👥 ${roster.length} staff accounts ready`);

  // DDG oversight: DDG101 → PLAN + TRAIN, DDG102 → QA + ADMIN
  const ddg1 = byStaffCode.get('DDG101')!;
  const ddg2 = byStaffCode.get('DDG102')!;
  await pool.query(`DELETE FROM division_user_oversight WHERE user_id = ANY($1::int[])`, [
    [ddg1.id, ddg2.id],
  ]);
  await insertBatch(
    'division_user_oversight',
    ['user_id', 'division_id'],
    [
      [ddg1.id, divisions.get('PLAN')], [ddg1.id, divisions.get('TRAIN')],
      [ddg2.id, divisions.get('QA')], [ddg2.id, divisions.get('ADMIN')],
    ]
  );

  // Division heads
  for (const code of ['PLAN', 'TRAIN', 'QA', 'ADMIN']) {
    const head = byStaffCode.get(`HD-${code}-D`)!;
    await pool.query(`UPDATE divisions SET head_user_id = $1 WHERE code = $2`, [head.id, code]);
  }

  /* ---- 3. activities ---- */
  // The super admin gets a working diary too, so their own KPI cards are populated.
  const superAdmin = await pool.query(
    `SELECT id, division_id, staff_code FROM users WHERE username = 'admin' LIMIT 1`
  );

  type Actor = { id: number; division_id: number | null; role_code: string; supervisor_id: number | null };
  const actors: Actor[] = roster.map((s) => ({
    id: s.id!,
    division_id: s.division_id ?? null,
    role_code: s.role_code,
    supervisor_id: s.supervisor_staff ? byStaffCode.get(s.supervisor_staff)!.id! : null,
  }));
  if (superAdmin.rows[0]) {
    actors.push({
      id: superAdmin.rows[0].id,
      division_id: superAdmin.rows[0].division_id ?? divisions.get('ADMIN')!,
      role_code: 'super_admin',
      supervisor_id: null,
    });
  }

  const firstDay = addDays(midnight, -MONTHS_BACK * 30);
  const lastDay = addDays(midnight, DAYS_FORWARD);

  const activityCols = [
    'user_id', 'division_id', 'activity_type_id', 'title_lo', 'title_en', 'description',
    'start_date', 'end_date', 'start_time', 'end_time', 'is_all_day', 'duration_minutes',
    'location', 'status', 'progress_percent', 'priority', 'assigned_by_user_id',
    'approved_by_user_id', 'approved_at', 'created_at', 'updated_at',
  ];
  const activityRows: unknown[][] = [];
  // Remember what we generate so participants/comments/notifications can reference it.
  const generated: {
    idx: number; user_id: number; division_id: number | null; type_code: string;
    status: string; start_date: string; supervisor_id: number | null;
  }[] = [];

  /** Chooses a status that makes sense for how long ago the work happened. */
  const statusFor = (age: number) => {
    if (age < 0) return chance(0.65) ? 'draft' : 'submitted';        // future
    if (age <= 6) return pick(['draft', 'draft', 'submitted', 'submitted', 'submitted', 'approved']);
    if (age <= 20) return pick(['submitted', 'submitted', 'approved', 'approved', 'approved', 'draft']);
    return pick(['approved', 'approved', 'approved', 'approved', 'approved', 'approved',
      'approved', 'approved', 'approved', 'submitted', 'rejected', 'cancelled']);
  };

  for (const actor of actors) {
    const mix = TYPE_MIX[actor.role_code] || TYPE_MIX.tech;
    // Leadership records fewer, longer items; staff record more granular work.
    const density = ['dg', 'ddg'].includes(actor.role_code) ? 0.45
      : ['hd', 'dhd'].includes(actor.role_code) ? 0.7
        : 0.85;
    let skipUntil: Date | null = null;

    for (let day = new Date(firstDay); day <= lastDay; day = addDays(day, 1)) {
      if (isWeekend(day)) continue;
      if (skipUntil && day <= skipUntil) continue;      // still away on a multi-day mission
      if (!chance(density)) continue;

      const perDay = chance(0.35) ? 2 : chance(0.12) ? 3 : 1;
      for (let n = 0; n < perDay; n++) {
        const type_code = pick(mix);
        const [title_lo, title_en] = pick(TITLES[type_code]);
        const age = daysAgo(day);
        const status = statusFor(age);
        const multi = MULTIDAY.has(type_code) && chance(0.6);
        const span = multi ? int(1, 4) : 0;
        const end = addDays(day, span);
        if (end > lastDay) continue;
        if (multi) skipUntil = end;

        const slot = pick(TIME_SLOTS);
        const duration = multi ? (span + 1) * 480 : slot[2];
        const approved = status === 'approved';
        const createdAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, int(0, 59));

        generated.push({
          idx: activityRows.length,
          user_id: actor.id,
          division_id: actor.division_id,
          type_code,
          status,
          start_date: iso(day),
          supervisor_id: actor.supervisor_id,
        });

        activityRows.push([
          actor.id,
          actor.division_id,
          types.get(type_code),
          title_lo,
          title_en,
          `${title_en} — ${MARKER}`,
          iso(day),
          iso(end),
          multi ? null : slot[0],
          multi ? null : slot[1],
          multi,
          duration,
          ['FIELD', 'TRIP', 'CONFERENCE', 'TRAINING', 'MEETING'].includes(type_code)
            ? pick(LOCATIONS)
            : null,
          status,
          approved ? 100 : status === 'submitted' ? int(70, 95) : status === 'draft' ? int(0, 60) : int(20, 80),
          pick(['normal', 'normal', 'normal', 'low', 'high', 'high', 'urgent']),
          chance(0.5) ? actor.supervisor_id : null,
          approved ? actor.supervisor_id : null,
          approved ? addDays(day, int(1, 4)) : null,
          createdAt,
          createdAt,
        ]);
      }
    }
  }

  console.log(`📅 Inserting ${activityRows.length} activities…`);
  const inserted = await insertBatch('activities', activityCols, activityRows, 'id');
  const activityIds = inserted.map((r) => r.id as number);

  /* ---- 4. participants on group activities ---- */
  const byDivision = new Map<number, number[]>();
  for (const a of actors) {
    if (a.division_id == null) continue;
    if (!byDivision.has(a.division_id)) byDivision.set(a.division_id, []);
    byDivision.get(a.division_id)!.push(a.id);
  }

  const participantRows: unknown[][] = [];
  const commentRows: unknown[][] = [];
  const COMMENTS = [
    'ຂໍ້ມູນຄົບຖ້ວນ, ອະນຸມັດໄດ້.',
    'ກະລຸນາເພີ່ມເອກະສານຊ້ອນທ້າຍ.',
    'ຜົນງານດີ, ສືບຕໍ່ຕິດຕາມ.',
    'ຂໍໃຫ້ແກ້ໄຂເວລາເລີ່ມຕົ້ນໃຫ້ຖືກຕ້ອງ.',
    'ໄດ້ຮັບຊາບແລ້ວ, ຂອບໃຈ.',
    'ກະລຸນາສົ່ງລາຍງານສະຫຼຸບພາຍໃນອາທິດນີ້.',
  ];

  for (const g of generated) {
    const activityId = activityIds[g.idx];
    if (activityId == null) continue;

    if (['MEETING', 'CONFERENCE', 'TRAINING'].includes(g.type_code) && chance(0.6)) {
      const pool_ = (g.division_id != null ? byDivision.get(g.division_id) : null) || [];
      const others = pool_.filter((id) => id !== g.user_id);
      const count = Math.min(others.length, int(2, 5));
      const chosen = new Set<number>();
      while (chosen.size < count && others.length) chosen.add(pick(others));
      participantRows.push([activityId, g.user_id, 'chair']);
      for (const uid of chosen) participantRows.push([activityId, uid, 'member']);
    }

    if (g.supervisor_id && (g.status === 'rejected' || (g.status === 'approved' && chance(0.08)))) {
      commentRows.push([activityId, g.supervisor_id, pick(COMMENTS)]);
    }
  }

  await insertBatch('activity_participants', ['activity_id', 'user_id', 'role_in_activity'], participantRows);
  await insertBatch('activity_comments', ['activity_id', 'user_id', 'body'], commentRows);
  console.log(`🤝 ${participantRows.length} participants, ${commentRows.length} review comments`);

  /* ---- 5. notifications ---- */
  const notifRows: unknown[][] = [];
  const recent = generated.filter((g) => {
    const age = daysAgo(new Date(g.start_date));
    return age >= -DAYS_FORWARD && age <= 25;
  });

  for (const g of recent) {
    const activityId = activityIds[g.idx];
    if (activityId == null || !g.supervisor_id) continue;

    if (g.status === 'submitted' && chance(0.55)) {
      notifRows.push([
        g.supervisor_id, 'submitted',
        'ມີກິດຈະກຳລໍຖ້າການອະນຸມັດ', 'An activity is waiting for your approval',
        'ພະນັກງານໄດ້ສົ່ງກິດຈະກຳເພື່ອຂໍອະນຸມັດ', `Staff submitted an activity for approval ${MARKER}`,
        `/activities/${activityId}`, 'activity', activityId, chance(0.4),
      ]);
    } else if (g.status === 'approved' && chance(0.25)) {
      notifRows.push([
        g.user_id, 'approved',
        'ກິດຈະກຳຂອງທ່ານໄດ້ຮັບການອະນຸມັດ', 'Your activity was approved',
        'ຫົວໜ້າໄດ້ອະນຸມັດກິດຈະກຳຂອງທ່ານແລ້ວ', `Your supervisor approved this activity ${MARKER}`,
        `/activities/${activityId}`, 'activity', activityId, chance(0.6),
      ]);
    } else if (g.status === 'rejected') {
      notifRows.push([
        g.user_id, 'rejected',
        'ກິດຈະກຳຂອງທ່ານຖືກສົ່ງກັບຄືນ', 'Your activity was sent back',
        'ກະລຸນາກວດແກ້ ແລະ ສົ່ງຄືນໃໝ່', `Please revise and resubmit ${MARKER}`,
        `/activities/${activityId}`, 'activity', activityId, false,
      ]);
    }
  }

  await insertBatch(
    'notifications',
    ['user_id', 'type', 'title_lo', 'title_en', 'body_lo', 'body_en', 'link_url', 'related_type', 'related_id', 'is_read'],
    notifRows
  );
  console.log(`🔔 ${notifRows.length} notifications`);

  /* ---- 6. audit trail ---- */
  const auditRows: unknown[][] = [];
  for (const g of generated) {
    if (!chance(0.12)) continue;
    const activityId = activityIds[g.idx];
    if (activityId == null) continue;
    auditRows.push([
      g.user_id, 'create', 'activity', activityId,
      JSON.stringify({ demo: true, status: g.status }), '127.0.0.1',
      new Date(`${g.start_date}T08:30:00`),
    ]);
    if (g.status === 'approved' && g.supervisor_id) {
      auditRows.push([
        g.supervisor_id, 'approve', 'activity', activityId,
        JSON.stringify({ demo: true, status: 'approved' }), '127.0.0.1',
        new Date(`${g.start_date}T16:30:00`),
      ]);
    }
  }
  await insertBatch(
    'audit_logs',
    ['user_id', 'action', 'auditable_type', 'auditable_id', 'new_values', 'ip_address', 'created_at'],
    auditRows
  );
  console.log(`📜 ${auditRows.length} audit entries`);

  /* ---- 7. public site content ---- */
  await seedPublicContent();

  clearHierarchyCache();

  const counts = await pool.query(`
    SELECT
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND is_active) AS users,
      (SELECT count(*) FROM activities WHERE deleted_at IS NULL) AS activities,
      (SELECT count(*) FROM activities WHERE status='draft' AND deleted_at IS NULL) AS draft,
      (SELECT count(*) FROM activities WHERE status='submitted' AND deleted_at IS NULL) AS submitted,
      (SELECT count(*) FROM activities WHERE status='approved' AND deleted_at IS NULL) AS approved,
      (SELECT count(*) FROM activity_participants) AS participants,
      (SELECT count(*) FROM notifications) AS notifications,
      (SELECT count(*) FROM news WHERE is_published) AS news,
      (SELECT count(*) FROM public_events) AS events,
      (SELECT count(*) FROM institutions WHERE is_active) AS institutions
  `);

  console.log('\n✅ Demo data ready');
  console.table(counts.rows[0]);
  console.log(`\nGenerated logins (password: ${PASSWORD})`);
  console.log('  DG100        — Director General (whole department)');
  console.log('  DDG101/102   — Deputy DGs (assigned divisions)');
  console.log('  HD-PLAN-D    — Head of Planning Division');
  console.log('  DHD-PLAN-D   — Deputy Head of Planning Division');
  console.log('  PLAN-S01…S06 — Planning technical staff');
  console.log('  TRAIN-*, QA-*, ADMIN-* — same pattern per division');
  console.log('  admin / admin123 — super admin (now has its own diary too)');
}

/* ------------------------------------------------------------------ *
 * Public website content
 * ------------------------------------------------------------------ */
async function seedPublicContent() {
  const cats = [
    ['announcements', 'ແຈ້ງການ', 'Announcements'],
    ['news', 'ຂ່າວສານ', 'News'],
    ['training', 'ການຝຶກອົບຮົມ', 'Training'],
    ['cooperation', 'ຄວາມຮ່ວມມື', 'Cooperation'],
  ];
  for (const [slug, lo, en] of cats) {
    await pool.query(
      `INSERT INTO news_categories (slug, name_lo, name_en) VALUES ($1,$2,$3)
       ON CONFLICT (slug) DO UPDATE SET name_lo = EXCLUDED.name_lo, name_en = EXCLUDED.name_en`,
      [slug, lo, en]
    );
  }
  const catIds = new Map<string, number>(
    (await pool.query(`SELECT slug, id FROM news_categories`)).rows.map((r: any) => [r.slug, r.id])
  );

  const news: [string, string, string, string, string, string][] = [
    ['annual-conference-2026', 'ກອງປະຊຸມໃຫຍ່ປະຈຳປີ 2026', 'Annual Conference 2026',
      'ກົມອາຊີວະສຶກສາຈັດກອງປະຊຸມສະຫຼຸບວຽກງານປະຈຳປີ', 'The department holds its annual review conference', 'news'],
    ['new-curriculum-launch', 'ເປີດຕົວຫຼັກສູດໃໝ່ 12 ສາຂາ', 'Twelve new curricula launched',
      'ຫຼັກສູດອາຊີວະສຶກສາໃໝ່ຖືກນຳໃຊ້ໃນທົ່ວປະເທດ', 'New TVET curricula roll out nationwide', 'announcements'],
    ['teacher-training-round-3', 'ຝຶກອົບຮົມຄູອາຈານ ຮອບທີ 3', 'Teacher training — round three',
      'ຄູອາຈານ 240 ທ່ານເຂົ້າຮ່ວມການຝຶກອົບຮົມ', '240 teachers joined the training round', 'training'],
    ['asean-tvet-cooperation', 'ຄວາມຮ່ວມມືອາຊີວະສຶກສາ ອາຊຽນ', 'ASEAN TVET cooperation',
      'ລົງນາມບົດບັນທຶກຄວາມເຂົ້າໃຈກັບປະເທດສະມາຊິກ', 'MoU signed with member states', 'cooperation'],
    ['scholarship-announcement', 'ແຈ້ງການທຶນການສຶກສາ', 'Scholarship announcement',
      'ເປີດຮັບສະໝັກທຶນສຳລັບນັກຮຽນອາຊີວະສຶກສາ', 'Applications open for TVET student scholarships', 'announcements'],
    ['quality-audit-results', 'ຜົນການກວດຄຸນນະພາບສະຖາບັນ', 'Institution quality audit results',
      'ສະຫຼຸບຜົນການປະເມີນ 32 ສະຖາບັນ', 'Assessment results for 32 institutions', 'news'],
    ['skills-competition', 'ງານແຂ່ງຂັນສີມືແຮງງານແຫ່ງຊາດ', 'National skills competition',
      'ນັກຮຽນຈາກ 17 ແຂວງເຂົ້າຮ່ວມແຂ່ງຂັນ', 'Students from 17 provinces competed', 'news'],
    ['digital-system-rollout', 'ນຳໃຊ້ລະບົບຕິດຕາມວຽກງານດິຈິຕອນ', 'Digital activity tracking rolled out',
      'ພະນັກງານທຸກພະແນກເລີ່ມນຳໃຊ້ລະບົບໃໝ່', 'All divisions begin using the new system', 'announcements'],
    ['industry-partnership', 'ຮ່ວມມືກັບພາກທຸລະກິດ', 'Partnership with industry',
      'ສ້າງໂອກາດຝຶກງານໃຫ້ນັກຮຽນ', 'Creating internship opportunities for students', 'cooperation'],
    ['women-in-tvet', 'ສົ່ງເສີມແມ່ຍິງໃນອາຊີວະສຶກສາ', 'Promoting women in TVET',
      'ໂຄງການສົ່ງເສີມການມີສ່ວນຮ່ວມຂອງແມ່ຍິງ', 'A programme to boost women’s participation', 'news'],
    ['budget-plan-2027', 'ແຜນງົບປະມານ ປີ 2027', 'Budget plan for 2027',
      'ສະເໜີແຜນງົບປະມານຕໍ່ກະຊວງ', 'Budget plan submitted to the ministry', 'announcements'],
    ['green-skills-training', 'ຝຶກອົບຮົມທັກສະສີຂຽວ', 'Green skills training',
      'ຫຼັກສູດພະລັງງານທົດແທນສຳລັບຄູອາຈານ', 'Renewable energy curriculum for teachers', 'training'],
  ];

  for (let i = 0; i < news.length; i++) {
    const [slug, title_lo, title_en, ex_lo, ex_en, cat] = news[i];
    await pool.query(
      `INSERT INTO news (slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en,
                         category_id, is_published, published_at, is_featured, view_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)
       ON CONFLICT (slug) DO UPDATE SET
         title_lo = EXCLUDED.title_lo, title_en = EXCLUDED.title_en,
         excerpt_lo = EXCLUDED.excerpt_lo, excerpt_en = EXCLUDED.excerpt_en,
         body_lo = EXCLUDED.body_lo, body_en = EXCLUDED.body_en,
         category_id = EXCLUDED.category_id, is_published = true,
         published_at = EXCLUDED.published_at, is_featured = EXCLUDED.is_featured`,
      [
        slug, title_lo, title_en, ex_lo, ex_en,
        `${ex_lo}. ລາຍລະອຽດເພີ່ມເຕີມຈະຖືກປັບປຸງໃນພາຍຫຼັງ.`,
        `${ex_en}. Full article content follows here.`,
        catIds.get(cat) ?? null,
        addDays(midnight, -int(1, 160)),
        i < 3,
        int(40, 2400),
      ]
    );
  }

  const events: unknown[][] = [];
  const eventBank: [string, string, number][] = [
    ['ກອງປະຊຸມສະຫຼຸບປະຈຳໄຕມາດ', 'Quarterly review conference', 9],
    ['ຝຶກອົບຮົມຄູອາຈານ ຮອບໃໝ່', 'New teacher training round', 16],
    ['ງານວັນອາຊີວະສຶກສາແຫ່ງຊາດ', 'National TVET day', 24],
    ['ກອງປະຊຸມຄູ່ຮ່ວມພັດທະນາ', 'Development partners meeting', 31],
    ['ງານມະຫະກຳສີມືແຮງງານ', 'Skills fair', 45],
    ['ສຳມະນາຫຼັກສູດໃໝ່', 'New curriculum seminar', -12],
    ['ກອງປະຊຸມຜູ້ອຳນວຍການສະຖາບັນ', 'Institution directors meeting', -30],
    ['ຝຶກອົບຮົມການປະເມີນຄຸນນະພາບ', 'Quality assessment training', -48],
  ];
  for (const [lo, en, offset] of eventBank) {
    const start = addDays(midnight, offset);
    events.push([
      lo, en,
      `ລາຍລະອຽດງານຈະປະກາດພາຍຫຼັງ`, `Details to be announced ${MARKER}`,
      iso(start), iso(addDays(start, int(0, 2))),
      'ນະຄອນຫຼວງວຽງຈັນ', pick(LOCATIONS), true,
    ]);
  }
  await insertBatch(
    'public_events',
    ['title_lo', 'title_en', 'description_lo', 'description_en', 'start_date', 'end_date', 'location_lo', 'location_en', 'is_published'],
    events
  );

  const docs: unknown[][] = [];
  const docBank: [string, string, string][] = [
    ['ແຜນຍຸດທະສາດອາຊີວະສຶກສາ 2026-2030', 'TVET Strategic Plan 2026-2030', 'strategy'],
    ['ລະບຽບການຄຸ້ມຄອງສະຖາບັນ', 'Institution management regulation', 'regulation'],
    ['ແບບຟອມລາຍງານປະຈຳເດືອນ', 'Monthly report template', 'form'],
    ['ຄູ່ມືການປະເມີນຄຸນນະພາບ', 'Quality assessment handbook', 'handbook'],
    ['ບົດລາຍງານປະຈຳປີ 2025', 'Annual report 2025', 'report'],
    ['ຫຼັກສູດແຫ່ງຊາດ ສາຂາໄຟຟ້າ', 'National curriculum — electrical', 'curriculum'],
    ['ຫຼັກສູດແຫ່ງຊາດ ສາຂາກົນຈັກ', 'National curriculum — mechanical', 'curriculum'],
    ['ແບບຟອມສະໝັກທຶນການສຶກສາ', 'Scholarship application form', 'form'],
    ['ສະຖິຕິນັກຮຽນອາຊີວະສຶກສາ 2025', 'TVET student statistics 2025', 'report'],
    ['ຄູ່ມືການນຳໃຊ້ລະບົບຕິດຕາມວຽກງານ', 'Activity tracking system user guide', 'handbook'],
  ];
  for (let i = 0; i < docBank.length; i++) {
    const [lo, en, cat] = docBank[i];
    docs.push([lo, en, `/demo/docs/document-${i + 1}.pdf`, cat, int(120000, 4800000), int(5, 700), addDays(midnight, -int(5, 300)), true]);
  }
  await insertBatch(
    'documents',
    ['title_lo', 'title_en', 'file_path', 'category', 'file_size', 'download_count', 'published_at', 'is_published'],
    docs
  );

  await insertBatch(
    'banners',
    ['image_path', 'title_lo', 'title_en', 'link_url', 'sort_order', 'is_active'],
    [
      ['/demo/banners/banner-1.jpg', 'ພັດທະນາສີມືແຮງງານລາວ', 'Developing Lao skills', '/news', 1, true],
      ['/demo/banners/banner-2.jpg', 'ຮຽນອາຊີວະ ມີວຽກເຮັດ', 'Study TVET, get a job', '/institutions', 2, true],
      ['/demo/banners/banner-3.jpg', 'ຄວາມຮ່ວມມືສາກົນ', 'International cooperation', '/news', 3, true],
    ]
  );

  const pages: [string, string, string, string, string][] = [
    ['about', 'ກ່ຽວກັບພວກເຮົາ', 'About us',
      'ກົມອາຊີວະສຶກສາ ແລະ ການຝຶກອົບຮົມວິຊາຊີບ ຂຶ້ນກັບກະຊວງສຶກສາທິການ ແລະ ກີລາ.',
      'The Department of Technical and Vocational Education and Training sits under the Ministry of Education and Sports.'],
    ['contact', 'ຕິດຕໍ່ພວກເຮົາ', 'Contact us',
      'ທີ່ຢູ່: ນະຄອນຫຼວງວຽງຈັນ, ໂທ: 021 000 000', 'Address: Vientiane Capital. Tel: 021 000 000'],
    ['structure', 'ໂຄງຮ່າງການຈັດຕັ້ງ', 'Organisational structure',
      'ກົມປະກອບດ້ວຍ 4 ພະແນກຫຼັກ.', 'The department comprises four main divisions.'],
  ];
  for (const [slug, title_lo, title_en, body_lo, body_en] of pages) {
    await pool.query(
      `INSERT INTO pages (slug, title_lo, title_en, body_lo, body_en, is_published, published_at)
       VALUES ($1,$2,$3,$4,$5,true,NOW())
       ON CONFLICT (slug) DO UPDATE SET
         title_lo = EXCLUDED.title_lo, title_en = EXCLUDED.title_en,
         body_lo = EXCLUDED.body_lo, body_en = EXCLUDED.body_en, is_published = true`,
      [slug, title_lo, title_en, body_lo, body_en]
    );
  }

  const institutions: [string, string, string, string][] = [
    ['ວິທະຍາໄລເຕັກນິກ-ວິຊາຊີບ ນະຄອນຫຼວງ', 'Vientiane Technical-Vocational College', 'Vientiane Capital', 'College'],
    ['ວິທະຍາໄລເຕັກນິກ ປາກປ່າສັກ', 'Pakpasak Technical College', 'Vientiane Capital', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບແບບປະສົມ ຫຼວງພະບາງ', 'Luang Prabang Integrated Vocational School', 'Luang Prabang', 'School'],
    ['ວິທະຍາໄລອາຊີວະສຶກສາ ສະຫວັນນະເຂດ', 'Savannakhet Vocational College', 'Savannakhet', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ຈຳປາສັກ', 'Champasak Vocational School', 'Champasak', 'School'],
    ['ວິທະຍາໄລເຕັກນິກ ຊຽງຂວາງ', 'Xieng Khouang Technical College', 'Xieng Khouang', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ອຸດົມໄຊ', 'Oudomxay Vocational School', 'Oudomxay', 'School'],
    ['ວິທະຍາໄລກະສິກຳ ຫຼວງນ້ຳທາ', 'Luang Namtha Agriculture College', 'Luang Namtha', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ບໍລິຄຳໄຊ', 'Bolikhamxay Vocational School', 'Bolikhamxay', 'School'],
    ['ວິທະຍາໄລເຕັກນິກ ຄຳມ່ວນ', 'Khammouane Technical College', 'Khammouane', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ຜົ້ງສາລີ', 'Phongsaly Vocational School', 'Phongsaly', 'School'],
    ['ວິທະຍາໄລອາຊີວະສຶກສາ ອັດຕະປື', 'Attapeu Vocational College', 'Attapeu', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ເຊກອງ', 'Sekong Vocational School', 'Sekong', 'School'],
    ['ວິທະຍາໄລເຕັກນິກ ໄຊຍະບູລີ', 'Xayaboury Technical College', 'Xayaboury', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ຫົວພັນ', 'Houaphanh Vocational School', 'Houaphanh', 'School'],
    ['ວິທະຍາໄລເຕັກນິກ ບໍ່ແກ້ວ', 'Bokeo Technical College', 'Bokeo', 'College'],
    ['ໂຮງຮຽນວິຊາຊີບ ວຽງຈັນ', 'Vientiane Province Vocational School', 'Vientiane Province', 'School'],
    ['ວິທະຍາໄລເຕັກນິກ ສາລະວັນ', 'Salavan Technical College', 'Salavan', 'College'],
  ];
  for (let i = 0; i < institutions.length; i++) {
    const [name_lo, name_en, province, type] = institutions[i];
    await pool.query(
      `INSERT INTO institutions (name_lo, name_en, province, type, address, phone, website, is_active)
       SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::text,$6::varchar,$7::varchar,true
       WHERE NOT EXISTS (SELECT 1 FROM institutions WHERE name_en = $2::varchar)`,
      [
        name_lo, name_en, province, type,
        `${province}, Lao PDR`,
        `0${int(21, 81)}-${int(100000, 999999)}`,
        i % 3 === 0 ? 'https://example.la' : null,
      ]
    );
  }

  const messages: unknown[][] = [];
  const msgBank: [string, string, string][] = [
    ['Somsak Vilaysane', 'ຢາກສອບຖາມການສະໝັກຮຽນ', 'How do I apply for a vocational programme?'],
    ['Nalin Douangdy', 'ຂໍຂໍ້ມູນທຶນການສຶກສາ', 'Please send information about scholarships.'],
    ['Bounmy Sengdara', 'ສະເໜີຄວາມຮ່ວມມື', 'Our company would like to partner on internships.'],
    ['Khamla Phetsarath', 'ສອບຖາມການໂອນຫົວໜ່ວຍກິດ', 'Question about credit transfer between colleges.'],
    ['Vandara Sisouk', 'ແຈ້ງບັນຫາເວັບໄຊທ໌', 'The document download link seems broken.'],
    ['Souphaphone Keo', 'ຂໍໃບຢັ້ງຢືນ', 'How can I request a certified copy of my certificate?'],
    ['Thongdy Manivong', 'ສະໝັກເປັນຄູຝຶກ', 'I would like to apply as a trainer.'],
    ['Chansamone Lao', 'ຄຳຖາມທົ່ວໄປ', 'What are the office opening hours?'],
  ];
  for (let i = 0; i < msgBank.length; i++) {
    const [name, subject, message] = msgBank[i];
    messages.push([
      name, `visitor${i + 1}@demo.invalid`, `020 ${int(20000000, 99999999)}`,
      subject, message, i > 4, addDays(midnight, -int(1, 40)),
    ]);
  }
  await insertBatch(
    'contact_messages',
    ['name', 'email', 'phone', 'subject', 'message', 'is_read', 'created_at'],
    messages
  );

  console.log('📰 Public website content ready');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('❌ Demo seed failed:', e);
      await pool.end();
      process.exit(1);
    });
}

export default main;
