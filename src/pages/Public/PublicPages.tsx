import { FormEvent, useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import { apiService } from '../../services/api';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';

function PublicShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('lo') ? 'lo' : 'en';
  const links = [
    { to: `/p/${locale}`, label: t('public.home') },
    { to: `/p/${locale}/about`, label: t('public.about') },
    { to: `/p/${locale}/news`, label: t('public.news') },
    { to: `/p/${locale}/documents`, label: t('public.documents') },
    { to: `/p/${locale}/institutions`, label: t('public.institutions') },
    { to: `/p/${locale}/contact`, label: t('public.contact') },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to={`/p/${locale}`} className="text-xl font-bold text-brand-600">TVED</Link>
          <nav className="flex flex-wrap gap-3 text-sm">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-brand-600">{l.label}</Link>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t bg-white py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TVED
      </footer>
    </div>
  );
}

export function PublicLayout() {
  return (
    <PublicShell>
      <Outlet />
    </PublicShell>
  );
}

export function PublicHomePage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  useEffect(() => { apiService.getPublicHome().then((r) => setData(r.data)); }, []);
  const lo = i18n.language?.startsWith('lo');

  return (
    <>
      <PageMeta title={`${t('public.home')} | TVED`} description={t('app.fullName')} />
      <section className="mb-10">
        <h1 className="mb-2 text-3xl font-bold leading-relaxed">{t('app.fullName')}</h1>
        <p className="text-slate-600">{t('app.tagline')}</p>
      </section>
      {data?.banners?.[0] && (
        <img src={data.banners[0].image_path} alt="" className="mb-8 h-48 w-full rounded-xl object-cover md:h-72" />
      )}
      <h2 className="mb-4 text-xl font-semibold">{t('public.news')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.latest_news || []).map((n: any) => (
          <Link key={n.id} to={`news/${n.slug}`} className="rounded-xl border bg-white p-4 hover:shadow-sm">
            <h3 className="font-medium leading-relaxed">{lo ? n.title_lo : n.title_en || n.title_lo}</h3>
            <p className="mt-2 text-sm text-slate-600">{lo ? n.excerpt_lo : n.excerpt_en || n.excerpt_lo}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500">Institutions: {data?.stats?.institutions ?? 0}</p>
    </>
  );
}

export function PublicAboutPage() {
  const { i18n, t } = useTranslation();
  const [page, setPage] = useState<any>(null);
  useEffect(() => { apiService.getPublicPage('about').then((r) => setPage(r.data)).catch(() => setPage(null)); }, []);
  const lo = i18n.language?.startsWith('lo');
  return (
    <>
      <PageMeta title={`${t('public.about')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-4 text-3xl font-bold leading-relaxed">{page ? (lo ? page.title_lo : page.title_en || page.title_lo) : t('public.about')}</h1>
      <div className="prose max-w-none leading-relaxed whitespace-pre-wrap">
        {page ? (lo ? page.body_lo : page.body_en || page.body_lo) : t('app.tagline')}
      </div>
    </>
  );
}

export function PublicNewsListPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { apiService.getPublicNews().then((r) => setRows(r.data)); }, []);
  const lo = i18n.language?.startsWith('lo');
  return (
    <>
      <PageMeta title={`${t('public.news')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-3xl font-bold">{t('public.news')}</h1>
      <div className="space-y-4">
        {rows.map((n) => (
          <Link key={n.id} to={n.slug} className="block rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold leading-relaxed">{lo ? n.title_lo : n.title_en || n.title_lo}</h2>
          </Link>
        ))}
      </div>
    </>
  );
}

export function PublicNewsDetailPage() {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const [n, setN] = useState<any>(null);
  useEffect(() => { if (slug) apiService.getPublicNewsDetail(slug).then((r) => setN(r.data)); }, [slug]);
  const lo = i18n.language?.startsWith('lo');
  if (!n) return null;
  return (
    <>
      <PageMeta title={`${n.title_lo} | TVED`} description={n.excerpt_lo || ''} />
      <h1 className="mb-4 text-3xl font-bold leading-relaxed">{lo ? n.title_lo : n.title_en || n.title_lo}</h1>
      <div className="whitespace-pre-wrap leading-relaxed">{lo ? n.body_lo : n.body_en || n.body_lo}</div>
    </>
  );
}

export function PublicDocumentsPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { apiService.getPublicDocuments().then((r) => setRows(r.data)); }, []);
  const lo = i18n.language?.startsWith('lo');
  return (
    <>
      <PageMeta title={`${t('public.documents')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-3xl font-bold">{t('public.documents')}</h1>
      <ul className="space-y-2">
        {rows.map((d) => (
          <li key={d.id} className="rounded-lg border bg-white px-4 py-3 text-sm">
            {lo ? d.title_lo : d.title_en || d.title_lo}
          </li>
        ))}
      </ul>
    </>
  );
}

export function PublicInstitutionsPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [province, setProvince] = useState('');
  useEffect(() => {
    apiService.getPublicInstitutions(province ? { province } : {}).then((r) => setRows(r.data));
  }, [province]);
  const lo = i18n.language?.startsWith('lo');
  return (
    <>
      <PageMeta title={`${t('public.institutions')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-3xl font-bold">{t('public.institutions')}</h1>
      <input
        className="mb-4 rounded-lg border px-3 py-2 text-sm"
        placeholder="Filter by province"
        value={province}
        onChange={(e) => setProvince(e.target.value)}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((i) => (
          <div key={i.id} className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold leading-relaxed">{lo ? i.name_lo : i.name_en || i.name_lo}</h2>
            <p className="text-sm text-slate-600">{i.province} · {i.type}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function PublicContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [done, setDone] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await apiService.submitContact(form);
    setDone(true);
  };
  return (
    <>
      <PageMeta title={`${t('public.contact')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-3xl font-bold">{t('public.contact')}</h1>
      {done ? (
        <p className="text-green-700">Message sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-lg space-y-3">
          {(['name', 'email', 'phone', 'subject'] as const).map((k) => (
            <input
              key={k}
              required={k === 'name' || k === 'email'}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder={k}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <textarea
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={5}
            placeholder="message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-white">{t('public.send')}</button>
        </form>
      )}
    </>
  );
}
