import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import { apiService } from '../../services/api';

export function CmsNewsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ slug: '', title_lo: '', title_en: '', excerpt_lo: '', body_lo: '', is_published: true });
  const load = () => apiService.cmsListNews().then((r) => setRows(r.data));
  useEffect(() => { load().catch(console.error); }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await apiService.cmsSaveNews(form);
    setForm({ slug: '', title_lo: '', title_en: '', excerpt_lo: '', body_lo: '', is_published: true });
    load();
  };

  return (
    <>
      <PageMeta title={`${t('sidebar.news')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold">{t('sidebar.news')}</h1>
      <form onSubmit={onSubmit} className="mb-6 grid gap-2 rounded-2xl border p-4 md:grid-cols-2">
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="title_lo" value={form.title_lo} onChange={(e) => setForm({ ...form, title_lo: e.target.value })} required />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="title_en" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="excerpt_lo" value={form.excerpt_lo} onChange={(e) => setForm({ ...form, excerpt_lo: e.target.value })} />
        <textarea className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="body_lo" value={form.body_lo} onChange={(e) => setForm({ ...form, body_lo: e.target.value })} />
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-white">{t('common.save')}</button>
      </form>
      <ul className="space-y-2">{rows.map((n) => <li key={n.id} className="rounded-lg border px-4 py-2 text-sm">{n.title_lo} ({n.slug})</li>)}</ul>
    </>
  );
}

export function CmsPagesPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ slug: '', title_lo: '', title_en: '', body_lo: '', is_published: true });
  const load = () => apiService.cmsListPages().then((r) => setRows(r.data));
  useEffect(() => { load().catch(console.error); }, []);
  return (
    <>
      <PageMeta title={`${t('sidebar.pages')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold">{t('sidebar.pages')}</h1>
      <form
        className="mb-6 grid gap-2 rounded-2xl border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await apiService.cmsSavePage(form);
          setForm({ slug: '', title_lo: '', title_en: '', body_lo: '', is_published: true });
          load();
        }}
      >
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="title_lo" value={form.title_lo} onChange={(e) => setForm({ ...form, title_lo: e.target.value })} required />
        <textarea className="rounded-lg border px-3 py-2 text-sm" placeholder="body_lo" value={form.body_lo} onChange={(e) => setForm({ ...form, body_lo: e.target.value })} />
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-white">{t('common.save')}</button>
      </form>
      <ul className="space-y-2">{rows.map((p) => <li key={p.id} className="rounded-lg border px-4 py-2 text-sm">{p.slug} — {p.title_lo}</li>)}</ul>
    </>
  );
}

export function CmsInstitutionsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name_lo: '', name_en: '', province: '', type: '' });
  const load = () => apiService.cmsListInstitutions().then((r) => setRows(r.data));
  useEffect(() => { load().catch(console.error); }, []);
  return (
    <>
      <PageMeta title={`${t('sidebar.institutions')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold">{t('sidebar.institutions')}</h1>
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await apiService.cmsSaveInstitution(form);
          setForm({ name_lo: '', name_en: '', province: '', type: '' });
          load();
        }}
      >
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="name_lo" value={form.name_lo} onChange={(e) => setForm({ ...form, name_lo: e.target.value })} required />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="name_en" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-white">{t('common.create')}</button>
      </form>
      <ul className="space-y-2">{rows.map((i) => <li key={i.id} className="rounded-lg border px-4 py-2 text-sm">{i.name_lo} — {i.province}</li>)}</ul>
    </>
  );
}

export function CmsContactsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { apiService.cmsListContacts().then((r) => setRows(r.data)).catch(console.error); }, []);
  return (
    <>
      <PageMeta title={`${t('sidebar.contacts')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold">{t('sidebar.contacts')}</h1>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="rounded-lg border px-4 py-3 text-sm">
            <strong>{c.name}</strong> ({c.email}) — {c.subject}
            <p className="mt-1 text-gray-600">{c.message}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
