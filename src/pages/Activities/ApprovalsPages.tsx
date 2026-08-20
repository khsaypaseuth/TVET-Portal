import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import ActionIcons from '../../components/common/ActionIcons';
import FilterPanel, { Field, controlClass, outlineButtonClass } from '../../components/common/FilterPanel';
import Pager from '../../components/common/Pager';
import type { ActivityListMeta } from '../../services/api';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircleIcon, CloseLineIcon, DownloadIcon } from '../../icons';
import { formatHours } from '../../utils/period';

const thCls = 'px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400';
const tdCls = 'px-4 py-3 text-gray-700 dark:text-gray-300';
const tableWrap =
  'overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

/** Triggers a browser download for a fetched blob. */
async function saveBlob(promise: Promise<{ blob: Blob; filename: string }>) {
  const { blob, filename } = await promise;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Debounces a search box so typing doesn't fire a request per keystroke. */
function useDebounced(value: string, apply: (v: string) => void, delay = 350) {
  useEffect(() => {
    const timer = setTimeout(() => apply(value), delay);
    return () => clearTimeout(timer);
  }, [value]);
}

const EMPTY_APPROVAL_FILTERS = {
  q: '',
  activity_type_id: '',
  user_id: '',
  division_id: '',
  start_date: '',
  end_date: '',
};

export function ApprovalsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ActivityListMeta | null>(null);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [filters, setFilters] = useState({ ...EMPTY_APPROVAL_FILTERS });
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const scope = user?.data_scope || 'own';
  const canFilterDivision = scope === 'department' || scope === 'assigned_divisions';

  const queryParams = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    lang: i18n.language,
  };

  const load = () => {
    setLoading(true);
    apiService
      .getApprovals({ ...queryParams, limit, page })
      .then((r) => {
        setRows(r.data);
        setMeta(r.meta ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiService.getActivityTypes().then((r) => setTypes(r.data)).catch(console.error);
    apiService.getMyTeam().then((r) => setTeam(r.data)).catch(console.error);
    if (canFilterDivision) {
      apiService.getDivisions().then((r) => setDivisions(r.data)).catch(console.error);
    }
  }, [canFilterDivision]);

  useDebounced(search, (v) => setFilters((f) => (f.q === v ? f : { ...f, q: v })));

  useEffect(() => {
    load();
    // Selections refer to rows that may no longer be listed.
    setSelected([]);
  }, [JSON.stringify(filters), limit, page]);

  // A filter change invalidates the current page number.
  const setFilter = (key: keyof typeof EMPTY_APPROVAL_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const activeCount = Object.values(filters).filter((v) => v !== '').length;

  const onExport = async () => {
    setExporting(true);
    try {
      await saveBlob(apiService.downloadApprovalsExcel(queryParams));
    } catch (e: any) {
      alert(e.message || t('common.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <>
      <PageMeta title={`${t('sidebar.approvals')} | TVED`} description={t('app.fullName')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">{t('sidebar.approvals')}</h1>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={!selected.length}
          onClick={() => apiService.bulkApprove(selected).then(() => { setSelected([]); load(); })}
        >
          <CheckCircleIcon className="size-4 fill-current" />
          {t('common.approve')} ({selected.length})
        </button>
      </div>

      <FilterPanel
        activeCount={activeCount}
        resetDisabled={activeCount === 0 && search === ''}
        onReset={() => {
          setSearch('');
          setFilters({ ...EMPTY_APPROVAL_FILTERS });
          setPage(1);
        }}
        actions={
          <button type="button" className={outlineButtonClass} disabled={exporting} onClick={onExport}>
            <DownloadIcon className="size-4 fill-current" />
            {exporting ? t('common.exporting') : t('common.exportExcel')}
          </button>
        }
      >
        <Field label={t('common.search')} wide>
          <input
            type="search"
            className={`w-full ${controlClass}`}
            placeholder={t('common.searchActivities')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label={t('activities.type')}>
          <select
            className={`w-full ${controlClass}`}
            value={filters.activity_type_id}
            onChange={(e) => setFilter('activity_type_id', e.target.value)}
          >
            <option value="">{t('common.allTypes')}</option>
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>{i18n.language === 'lo' ? ty.name_lo : ty.name_en}</option>
            ))}
          </select>
        </Field>
        <Field label={t('common.staff')}>
          <select
            className={`w-full ${controlClass}`}
            value={filters.user_id}
            onChange={(e) => setFilter('user_id', e.target.value)}
          >
            <option value="">{t('common.allStaff')}</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} ({member.staff_code})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.from')}>
          <input
            type="date"
            className={`w-full ${controlClass}`}
            value={filters.start_date}
            max={filters.end_date || undefined}
            onChange={(e) => setFilter('start_date', e.target.value)}
          />
        </Field>
        <Field label={t('common.to')}>
          <input
            type="date"
            className={`w-full ${controlClass}`}
            value={filters.end_date}
            min={filters.start_date || undefined}
            onChange={(e) => setFilter('end_date', e.target.value)}
          />
        </Field>
        {canFilterDivision && (
          <Field label={t('common.division')}>
            <select
              className={`w-full ${controlClass}`}
              value={filters.division_id}
              onChange={(e) => setFilter('division_id', e.target.value)}
            >
              <option value="">{t('common.allDivisions')}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{i18n.language === 'lo' ? d.name_lo : d.name_en}</option>
              ))}
            </select>
          </Field>
        )}
      </FilterPanel>

      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th className={thCls}>{t('common.staff')}</th>
              <th className={thCls}>{t('activities.type')}</th>
              <th className={thCls}>{t('activities.titleLo')}</th>
              <th className={thCls}>{t('activities.startDate')}</th>
              <th className={thCls}>{t('activities.duration')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>{t('common.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-gray-400" colSpan={7}>{t('common.noRecords')}</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, row.id] : s.filter((id) => id !== row.id)))
                      }
                    />
                  </td>
                  <td className={tdCls}>{row.owner_name}</td>
                  <td className={tdCls}>{i18n.language === 'lo' ? row.type_name_lo : row.type_name_en}</td>
                  <td className={`${tdCls} leading-[1.8]`}>
                    {i18n.language === 'en' && row.title_en ? row.title_en : row.title_lo}
                  </td>
                  <td className={tdCls}>{String(row.start_date).slice(0, 10)}</td>
                  <td className={tdCls}>{formatHours(row.duration_minutes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActionIcons viewTo={`/activities/${row.id}`} />
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50 dark:border-gray-700 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                        title={t('common.approve')}
                        onClick={() => apiService.approveActivity(row.id).then(load)}
                      >
                        <CheckCircleIcon className="size-4 fill-current" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-rose-600 hover:bg-rose-50 dark:border-gray-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        title={t('common.reject')}
                        onClick={() => {
                          const reason = prompt(t('common.reject'));
                          if (reason) apiService.rejectActivity(row.id, reason).then(load);
                        }}
                      >
                        <CloseLineIcon className="size-4 fill-current" />
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

const EMPTY_TEAM_FILTERS = {
  q: '',
  division_id: '',
  start_date: '',
  end_date: '',
  not_submitted: '',
};

export function MyTeamPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ActivityListMeta | null>(null);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [filters, setFilters] = useState({ ...EMPTY_TEAM_FILTERS });
  const [search, setSearch] = useState('');
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const scope = user?.data_scope || 'own';
  const canFilterDivision = scope === 'department' || scope === 'assigned_divisions';

  const queryParams = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    lang: i18n.language,
  };

  useEffect(() => {
    if (canFilterDivision) {
      apiService.getDivisions().then((r) => setDivisions(r.data)).catch(console.error);
    }
  }, [canFilterDivision]);

  useDebounced(search, (v) => setFilters((f) => (f.q === v ? f : { ...f, q: v })));

  useEffect(() => {
    setLoading(true);
    apiService
      .getMyTeam({ ...queryParams, limit, page })
      .then((r) => {
        setRows(r.data);
        setPeriod(r.period ?? null);
        setMeta(r.meta ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters), limit, page]);

  const setFilter = (key: keyof typeof EMPTY_TEAM_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const activeCount = Object.values(filters).filter((v) => v !== '').length;

  const onExport = async () => {
    setExporting(true);
    try {
      await saveBlob(apiService.downloadTeamExcel(queryParams));
    } catch (e: any) {
      alert(e.message || t('common.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageMeta title={`${t('sidebar.myTeam')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white/90">{t('sidebar.myTeam')}</h1>

      <FilterPanel
        activeCount={activeCount}
        resetDisabled={activeCount === 0 && search === ''}
        onReset={() => {
          setSearch('');
          setFilters({ ...EMPTY_TEAM_FILTERS });
          setPage(1);
        }}
        actions={
          <button type="button" className={outlineButtonClass} disabled={exporting} onClick={onExport}>
            <DownloadIcon className="size-4 fill-current" />
            {exporting ? t('common.exporting') : t('common.exportExcel')}
          </button>
        }
      >
        <Field label={t('common.search')} wide>
          <input
            type="search"
            className={`w-full ${controlClass}`}
            placeholder={`${t('common.fullName')} / ${t('common.code')} / ${t('common.phone')}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label={t('common.from')}>
          <input
            type="date"
            className={`w-full ${controlClass}`}
            value={filters.start_date}
            max={filters.end_date || undefined}
            onChange={(e) => setFilter('start_date', e.target.value)}
          />
        </Field>
        <Field label={t('common.to')}>
          <input
            type="date"
            className={`w-full ${controlClass}`}
            value={filters.end_date}
            min={filters.start_date || undefined}
            onChange={(e) => setFilter('end_date', e.target.value)}
          />
        </Field>
        {canFilterDivision && (
          <Field label={t('common.division')}>
            <select
              className={`w-full ${controlClass}`}
              value={filters.division_id}
              onChange={(e) => setFilter('division_id', e.target.value)}
            >
              <option value="">{t('common.allDivisions')}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{i18n.language === 'lo' ? d.name_lo : d.name_en}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t('common.status')}>
          <label className="flex items-center gap-2 py-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={filters.not_submitted === '1'}
              onChange={(e) => setFilter('not_submitted', e.target.checked ? '1' : '')}
            />
            {t('common.notSubmittedOnly')}
          </label>
        </Field>
      </FilterPanel>

      {period && (
        <p className="mb-3 text-sm text-gray-400">
          {period.start} → {period.end}
        </p>
      )}

      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.02]">
            <tr>
              <th className={thCls}>{t('common.staff')}</th>
              <th className={thCls}>{t('common.phone')}</th>
              <th className={thCls}>{t('dashboard.submitted')}</th>
              <th className={thCls}>{t('dashboard.approved')}</th>
              <th className={thCls}>{t('common.hours')}</th>
              <th className={thCls}>{t('common.status')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>{t('common.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-gray-400" colSpan={7}>{t('common.noRecords')}</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 dark:text-white/90">{row.full_name || row.staff_code}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {(i18n.language === 'lo' ? row.division_name_lo : row.division_name_en) || '—'}
                    </div>
                  </td>
                  <td className={tdCls}>{row.phone || '—'}</td>
                  <td className={tdCls}>{row.submitted_count}</td>
                  <td className={tdCls}>{row.approved_count}</td>
                  <td className={tdCls}>{formatHours(row.total_minutes)}</td>
                  <td className="px-4 py-3">
                    {row.not_submitted ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        {t('dashboard.notSubmitted')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ActionIcons viewTo={`/activities?user_id=${row.id}`} phone={row.phone} />
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
