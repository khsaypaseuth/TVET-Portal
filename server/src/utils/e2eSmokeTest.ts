/**
 * End-to-end API verification with sample data.
 * Run after: npm run seed && npm run seed:sample
 */
const API = process.env.API_URL || 'http://localhost:5001/api';

async function req(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function login(identifier: string, password: string) {
  const { status, body } = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: identifier, password }),
  });
  if (status !== 200 || !body?.data?.token) {
    throw new Error(`Login failed for ${identifier}: ${status} ${JSON.stringify(body)}`);
  }
  return body.data.token as string;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log('✓', msg);
}

async function main() {
  console.log(`Running e2e against ${API}\n`);

  // Health
  const health = await req('/health');
  assert(health.status === 200, 'health OK');

  // Public
  const home = await req('/public/home');
  assert(home.status === 200 && home.body.success, 'public home');
  assert((home.body.data.latest_news || []).length >= 1, 'public news present');
  const institutions = await req('/public/institutions');
  assert(institutions.status === 200 && institutions.body.data.length >= 2, 'institutions sample');

  // Tech login + scoped list
  const techToken = await login('TECH001', 'Staff123!');
  const me = await req('/auth/me', {}, techToken);
  assert(me.body.data.role_code === 'tech', 'TECH001 role is tech');
  const techActs = await req('/activities', {}, techToken);
  assert(techActs.status === 200, 'tech can list activities');
  const techIds = new Set(techActs.body.data.map((a: any) => a.owner_staff_code || a.user_id));
  // all returned activities should be visible to tech (own)
  assert(techActs.body.data.every((a: any) => a.user_id === me.body.data.id), 'tech only sees own activities');

  // Tech cannot open colleague activity
  const allForHd = await (async () => {
    const hdToken = await login('HD-PLAN', 'Staff123!');
    return { hdToken, list: await req('/activities', {}, hdToken) };
  })();
  const other = allForHd.list.body.data.find((a: any) => a.owner_staff_code === 'TECH002' || a.user_id !== me.body.data.id);
  // find TECH002 activity id via DHD who can see division
  const dhdToken = await login('DHD-PLAN', 'Staff123!');
  const dhdList = await req('/activities', {}, dhdToken);
  assert(dhdList.body.data.length >= 2, 'DHD sees multiple division activities');
  const tech2Act = dhdList.body.data.find((a: any) => a.owner_staff_code === 'TECH002' || a.title_en === 'Monthly report draft');
  assert(!!tech2Act, 'found TECH002 activity');
  const forbidden = await req(`/activities/${tech2Act.id}`, {}, techToken);
  assert(forbidden.status === 403, 'tech cannot open colleague activity (403)');

  // Approvals queue for DHD
  const approvals = await req('/activities/approvals', {}, dhdToken);
  assert(approvals.status === 200, 'approvals endpoint');
  assert(approvals.body.data.length >= 1, 'DHD has pending approvals');
  const pendingId = approvals.body.data[0].id;
  const approve = await req(`/activities/${pendingId}/approve`, { method: 'POST' }, dhdToken);
  assert(approve.status === 200 && approve.body.data.status === 'approved', 'DHD approved submission');

  // Team view
  const team = await req('/activities/team', {}, dhdToken);
  assert(team.status === 200 && team.body.data.length >= 1, 'my team has rows');

  // Dashboard + report
  const dash = await req('/reports/dashboard', {}, dhdToken);
  assert(dash.status === 200 && dash.body.success, 'dashboard stats');
  const report = await req(
    '/reports/individual?start_date=2026-01-01&end_date=2026-12-31&scope=division',
    {},
    dhdToken
  );
  assert(report.status === 200 && Array.isArray(report.body.data.rows), 'division-scoped individual report');

  // Admin create check
  const adminToken = await login('admin', 'admin123');
  const users = await req('/admin/users', {}, adminToken);
  assert(users.body.data.length >= 8, `admin sees sample users (${users.body.data.length})`);

  // CMS staff
  const cmsToken = await login('ADM001', 'Staff123!');
  const cmsNews = await req('/cms/news', {}, cmsToken);
  assert(cmsNews.status === 200, 'CMS admin can list news');

  // Tech cannot access admin users
  const denied = await req('/admin/users', { method: 'POST', body: JSON.stringify({}) }, techToken);
  assert(denied.status === 403, 'tech cannot create users');

  console.log('\n✅ All e2e checks passed');
}

main().catch((e) => {
  console.error('\n❌ E2E failed:', e.message || e);
  process.exit(1);
});
