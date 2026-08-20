import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import ActionIcons from '../../components/common/ActionIcons';
import { controlClass, outlineButtonClass } from '../../components/common/FilterPanel';
import Pager, { PAGE_SIZES } from '../../components/common/Pager';
import { apiService } from '../../services/api';
import type { ActivityListMeta } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlusIcon } from '../../icons';

function computeLiveDuration(form: {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
}) {
  if (!form.start_date || !form.end_date) return 0;
  const start = new Date(form.start_date);
  const end = new Date(form.end_date);
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (form.is_all_day || !form.start_time || !form.end_time) return days * 8 * 60;
  if (form.start_date === form.end_date) {
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }
  return days * 8 * 60;
}

const STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'cancelled'];

const EMPTY_FILTERS = {
  q: '',
  status: '',
  activity_type_id: '',
  start_date: '',
  end_date: '',
  user_id: '',
  division_id: '',
};

export function ActivityListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ActivityListMeta | null>(null);
  // Deep links such as /activities?user_id=12 (from the team page) preload the filter bar.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const initial = { ...EMPTY_FILTERS };
    (Object.keys(initial) as (keyof typeof initial)[]).forEach((key) => {
      const value = searchParams.get(key);
      if (value) initial[key] = value;
    });
    return initial;
  });
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [types, setTypes] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'filtered' | 'all' | null>(null);

  // Which filters a user may use follows their data scope, not their opinion —
  // the server scopes the query regardless, this only hides useless controls.
  const scope = user?.data_scope || 'own';
  const canFilterStaff = scope !== 'own';
  const canFilterDivision = scope === 'department' || scope === 'assigned_divisions';

  useEffect(() => {
    apiService.getActivityTypes().then((r) => setTypes(r.data)).catch(console.error);
    if (canFilterStaff) {
      apiService.getMyTeam().then((r) => setTeam(r.data)).catch(console.error);
    }
    if (canFilterDivision) {
      apiService.getDivisions().then((r) => setDivisions(r.data)).catch(console.error);
    }
  }, [canFilterStaff, canFilterDivision]);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    lang: i18n.language,
  };

  const load = () => {
    setLoading(true);
    apiService
      .getActivities({ ...queryParams, limit, page })
      .then((r) => {
        setRows(r.data);
        setMeta(r.meta ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [JSON.stringify(filters), limit, page]);

  // Any filter change invalidates the current page number.
  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== '').length;

  const onExport = async (exportScope: 'filtered' | 'all') => {
    setExporting(exportScope);
    try {
      const { blob, filename } = await apiService.downloadActivitiesExcel(queryParams, exportScope);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || t('common.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageMeta title={`${t('activities.title')} | TVED`} description={t('app.fullName')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">{t('activities.title')}</h1>
        <Link to="/activities/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">
          <PlusIcon className="size-4 fill-current" />
          {t('activities.new')}
        </Link>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.filters')}
            {activeFilterCount > 0 && (
              <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {activeFilterCount}
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={outlineButtonClass}
              disabled={activeFilterCount === 0 && search === ''}
              onClick={resetFilters}
            >
              {t('common.reset')}
            </button>
            <button type="button" className={outlineButtonClass} disabled={exporting !== null} onClick={() => onExport('filtered')}>
              {exporting === 'filtered' ? t('common.exporting') : t('common.exportFiltered')}
            </button>
            <button type="button" className={outlineButtonClass} disabled={exporting !== null} onClick={() => onExport('all')}>
              {exporting === 'all' ? t('common.exporting') : t('common.exportAll')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.search')}</span>
            <input
              type="search"
              className={`w-full ${controlClass}`}
              placeholder={t('common.searchActivities')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.status')}</span>
            <select
              className={`w-full ${controlClass}`}
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">{t('common.allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('activities.type')}</span>
            <select
              className={`w-full ${controlClass}`}
              value={filters.activity_type_id}
              onChange={(e) => setFilter('activity_type_id', e.target.value)}
            >
              <option value="">{t('common.allTypes')}</option>
              {types.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {i18n.language === 'lo' ? ty.name_lo : ty.name_en}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.from')}</span>
            <input
              type="date"
              className={`w-full ${controlClass}`}
              value={filters.start_date}
              max={filters.end_date || undefined}
              onChange={(e) => setFilter('start_date', e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.to')}</span>
            <input
              type="date"
              className={`w-full ${controlClass}`}
              value={filters.end_date}
              min={filters.start_date || undefined}
              onChange={(e) => setFilter('end_date', e.target.value)}
            />
          </label>

          {canFilterStaff && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.staff')}</span>
              <select
                className={`w-full ${controlClass}`}
                value={filters.user_id}
                onChange={(e) => setFilter('user_id', e.target.value)}
              >
                <option value="">{t('common.allStaff')}</option>
                {user && <option value={user.id}>{t('common.myRecords')}</option>}
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} ({member.staff_code})
                  </option>
                ))}
              </select>
            </label>
          )}

          {canFilterDivision && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{t('common.division')}</span>
              <select
                className={`w-full ${controlClass}`}
                value={filters.division_id}
                onChange={(e) => setFilter('division_id', e.target.value)}
              >
                <option value="">{t('common.allDivisions')}</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {i18n.language === 'lo' ? d.name_lo : d.name_en}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.startDate')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.type')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.titleLo')}</th>
              {canFilterStaff && (
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.staff')}</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.duration')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>{t('common.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-gray-400" colSpan={7}>{t('common.noRecords')}</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{String(row.start_date).slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{i18n.language === 'lo' ? row.type_name_lo : row.type_name_en}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-white/90">
                    {i18n.language === 'en' && row.title_en ? row.title_en : row.title_lo}
                  </td>
                  {canFilterStaff && (
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.owner_name}</td>
                  )}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.status}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{((row.duration_minutes || 0) / 60).toFixed(1)}h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIcons
                        viewTo={`/activities/${row.id}`}
                        editTo={['draft', 'rejected'].includes(row.status) ? `/activities/${row.id}/edit` : undefined}
                        onDelete={
                          row.status === 'draft'
                            ? () => {
                                if (confirm(t('common.confirmDelete'))) {
                                  apiService.deleteActivity(row.id).then(load);
                                }
                              }
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        className="text-xs text-brand-500 hover:underline dark:text-brand-400"
                        onClick={() => apiService.duplicateActivity(row.id).then(load)}
                      >
                        {t('common.duplicate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        limit={limit}
        meta={meta}
        rowCount={rows.length}
        loading={loading}
        onPageChange={setPage}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
      />

    </>
  );
}

export function ActivityFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [types, setTypes] = useState<any[]>([]);
  const [warning, setWarning] = useState('');
  const [form, setForm] = useState({
    activity_type_id: '',
    title_lo: '',
    title_en: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    start_time: '08:00',
    end_time: '12:00',
    is_all_day: false,
    location: '',
    priority: 'normal',
    progress_percent: 0,
  });

  useEffect(() => {
    apiService.getActivityTypes().then((r) => {
      setTypes(r.data);
      if (r.data[0] && isNew) setForm((f) => ({ ...f, activity_type_id: String(r.data[0].id) }));
    });
    if (!isNew) {
      apiService.getActivity(Number(id)).then((r) => {
        const a = r.data;
        setForm({
          activity_type_id: String(a.activity_type_id),
          title_lo: a.title_lo || '',
          title_en: a.title_en || '',
          description: a.description || '',
          start_date: String(a.start_date).slice(0, 10),
          end_date: String(a.end_date).slice(0, 10),
          start_time: a.start_time ? String(a.start_time).slice(0, 5) : '08:00',
          end_time: a.end_time ? String(a.end_time).slice(0, 5) : '12:00',
          is_all_day: !!a.is_all_day,
          location: a.location || '',
          priority: a.priority || 'normal',
          progress_percent: a.progress_percent || 0,
        });
      }).catch((e) => alert(e.message));
    }
  }, [id, isNew]);

  const duration = useMemo(() => computeLiveDuration(form), [form]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setWarning('');
    const body = {
      ...form,
      activity_type_id: Number(form.activity_type_id),
      progress_percent: Number(form.progress_percent),
    };
    try {
      const res = isNew
        ? await apiService.createActivity(body)
        : await apiService.updateActivity(Number(id), body);
      if (res.warnings?.overlaps?.length) {
        setWarning(t('activities.overlapWarning'));
      }
      navigate(`/activities/${res.data.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600 dark:text-gray-400">{label}</span>
      <input
        type={type}
        className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        value={String(form[key])}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
          }))
        }
        {...(type === 'checkbox' ? { checked: !!form[key] } : {})}
      />
    </label>
  );

  return (
    <>
      <PageMeta title={`${t('activities.new')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white/90">
        {isNew ? t('activities.new') : t('common.edit')}
      </h1>
      {warning && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {warning}
        </div>
      )}
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">{t('activities.type')}</span>
          <select
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={form.activity_type_id}
            onChange={(e) => setForm((f) => ({ ...f, activity_type_id: e.target.value }))}
            required
          >
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>{ty.name_en} / {ty.name_lo}</option>
            ))}
          </select>
        </label>
        {field('title_lo', t('activities.titleLo'))}
        {field('title_en', t('activities.titleEn'))}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('start_date', t('activities.startDate'), 'date')}
          {field('end_date', t('activities.endDate'), 'date')}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_all_day}
            onChange={(e) => setForm((f) => ({ ...f, is_all_day: e.target.checked }))}
          />
          {t('activities.allDay')}
        </label>
        {!form.is_all_day && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('start_time', t('activities.startTime'), 'time')}
            {field('end_time', t('activities.endTime'), 'time')}
          </div>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('activities.duration')}: <strong>{(duration / 60).toFixed(1)}h</strong> ({duration} min)
        </p>
        {field('location', t('activities.location'))}
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">{t('activities.description')}</span>
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">
            {t('common.save')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/activities')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}

export function ActivityDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<any>(null);

  const load = () => {
    apiService.getActivity(Number(id)).then((r) => setActivity(r.data)).catch((e) => alert(e.message));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!activity) return <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;

  const title = i18n.language === 'en' && activity.title_en ? activity.title_en : activity.title_lo;
  const outlineBtn =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]';

  return (
    <>
      <PageMeta title={`${title} | TVED`} description={t('app.fullName')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">{title}</h1>
        <div className="flex flex-wrap gap-2">
          {['draft', 'rejected'].includes(activity.status) && (
            <>
              <Link to={`/activities/${id}/edit`} className={outlineBtn}>{t('common.edit')}</Link>
              <button
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm text-white"
                onClick={() => apiService.submitActivity(Number(id)).then(load)}
              >
                {t('common.submit')}
              </button>
            </>
          )}
          <button
            className={outlineBtn}
            onClick={() => apiService.duplicateActivity(Number(id)).then((r: any) => navigate(`/activities/${r.data.id}`))}
          >
            {t('common.duplicate')}
          </button>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
        <p><strong className="text-gray-800 dark:text-white/90">{t('common.status')}:</strong> {activity.status}</p>
        <p><strong className="text-gray-800 dark:text-white/90">{t('activities.type')}:</strong> {activity.type_name_en}</p>
        <p><strong className="text-gray-800 dark:text-white/90">{t('activities.startDate')}:</strong> {String(activity.start_date).slice(0, 10)} → {String(activity.end_date).slice(0, 10)}</p>
        <p><strong className="text-gray-800 dark:text-white/90">{t('activities.duration')}:</strong> {((activity.duration_minutes || 0) / 60).toFixed(1)}h</p>
        <p><strong className="text-gray-800 dark:text-white/90">{t('activities.location')}:</strong> {activity.location || '—'}</p>
        <p className="whitespace-pre-wrap">{activity.description}</p>
        {activity.rejection_reason && (
          <p className="text-error-500"><strong>Rejection:</strong> {activity.rejection_reason}</p>
        )}
      </div>
    </>
  );
}
