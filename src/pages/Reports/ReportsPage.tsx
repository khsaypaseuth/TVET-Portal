import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import PeriodFilter from '../../components/common/PeriodFilter';
import ActionIcons from '../../components/common/ActionIcons';
import FilterPanel, { Field, controlClass } from '../../components/common/FilterPanel';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { PeriodPreset, formatHours, resolvePeriod } from '../../utils/period';
import { DownloadIcon, FileIcon } from '../../icons';

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const [type, setType] = useState('individual');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const initial = resolvePeriod('month');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [extra, setExtra] = useState({
    q: '',
    activity_type_ids: '',
    statuses: '',
    user_ids: '',
    division_ids: '',
  });
  const [types, setTypes] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);

  const scope = user?.data_scope || 'own';
  const canFilterStaff = scope !== 'own';
  const canFilterDivision = scope === 'department' || scope === 'assigned_divisions';

  // Only non-empty filters are sent, so an untouched control never narrows a report.
  const activeExtra = useMemo(
    () => Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== '')) as Record<string, string>,
    [extra]
  );

  const params = useMemo(
    () => ({
      start_date: start,
      end_date: end,
      scope: type === 'individual' ? 'me' : type === 'department' ? 'department' : 'division',
      ...activeExtra,
    }),
    [start, end, type, activeExtra]
  );

  const run = (override?: { start?: string; end?: string; reportType?: string }) => {
    const s = override?.start ?? start;
    const e = override?.end ?? end;
    const reportType = override?.reportType ?? type;
    const query = {
      start_date: s,
      end_date: e,
      scope:
        reportType === 'individual'
          ? 'me'
          : reportType === 'department'
            ? 'department'
            : 'division',
      ...activeExtra,
    };
    setLoading(true);
    apiService
      .getReport(reportType, query)
      .then((r) => setData(r.data))
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    run();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiService.getActivityTypes().then((r) => setTypes(r.data)).catch(console.error);
    if (canFilterStaff) {
      apiService.getMyTeam().then((r) => setTeam(r.data)).catch(console.error);
    }
    if (canFilterDivision) {
      apiService.getDivisions().then((r) => setDivisions(r.data)).catch(console.error);
    }
  }, [canFilterStaff, canFilterDivision]);

  // Typing shouldn't re-run the report on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setExtra((f) => (f.q === search ? f : { ...f, q: search })), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExtra]);

  const onPresetChange = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = resolvePeriod(p);
      setStart(r.start);
      setEnd(r.end);
      run({ start: r.start, end: r.end });
    }
  };

  const onTypeChange = (next: string) => {
    setType(next);
    run({ reportType: next });
  };

  const download = async (format: 'excel' | 'pdf') => {
    try {
      const reportType = type === 'meetings' && format === 'pdf' ? 'individual' : type;
      const blob = await apiService.downloadReport(reportType, format, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tved-${type}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const rows: any[] = data?.rows || [];
  const columns = rows.length
    ? Object.keys(rows[0]).filter((k) => !['participants', 'description'].includes(k)).slice(0, 8)
    : [];

  return (
    <>
      <PageMeta title={`${t('reports.title')} | TVED`} description={t('app.fullName')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">{t('reports.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download('excel')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <DownloadIcon className="size-4 fill-current" />
            {t('reports.excel')}
          </button>
          <button
            type="button"
            onClick={() => download('pdf')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            <FileIcon className="size-4 fill-current" />
            {t('reports.pdf')}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <PeriodFilter
          preset={preset}
          start={start}
          end={end}
          onPresetChange={onPresetChange}
          onStartChange={setStart}
          onEndChange={setEnd}
          onApply={() => run()}
        />
      </div>

      <FilterPanel
        activeCount={Object.keys(activeExtra).length}
        resetDisabled={Object.keys(activeExtra).length === 0 && search === ''}
        onReset={() => {
          setSearch('');
          setExtra({ q: '', activity_type_ids: '', statuses: '', user_ids: '', division_ids: '' });
        }}
      >
        <Field label={t('reports.title')}>
          <select
            className={`w-full ${controlClass}`}
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="individual">{t('reports.individual')}</option>
            <option value="division">{t('reports.division')}</option>
            <option value="department">{t('reports.department')}</option>
            <option value="meetings">{t('reports.meetings')}</option>
            <option value="compliance">{t('reports.compliance')}</option>
          </select>
        </Field>

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
            value={extra.activity_type_ids}
            onChange={(e) => setExtra((f) => ({ ...f, activity_type_ids: e.target.value }))}
          >
            <option value="">{t('common.allTypes')}</option>
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>{i18n.language === 'lo' ? ty.name_lo : ty.name_en}</option>
            ))}
          </select>
        </Field>

        <Field label={t('common.status')}>
          <select
            className={`w-full ${controlClass}`}
            value={extra.statuses}
            onChange={(e) => setExtra((f) => ({ ...f, statuses: e.target.value }))}
          >
            <option value="">{t('common.allStatuses')}</option>
            {['draft', 'submitted', 'approved', 'rejected'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        {canFilterStaff && (
          <Field label={t('common.staff')}>
            <select
              className={`w-full ${controlClass}`}
              value={extra.user_ids}
              onChange={(e) => setExtra((f) => ({ ...f, user_ids: e.target.value }))}
            >
              <option value="">{t('common.allStaff')}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({member.staff_code})
                </option>
              ))}
            </select>
          </Field>
        )}

        {canFilterDivision && (
          <Field label={t('common.division')}>
            <select
              className={`w-full ${controlClass}`}
              value={extra.division_ids}
              onChange={(e) => setExtra((f) => ({ ...f, division_ids: e.target.value }))}
            >
              <option value="">{t('common.allDivisions')}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{i18n.language === 'lo' ? d.name_lo : d.name_en}</option>
              ))}
            </select>
          </Field>
        )}
      </FilterPanel>

      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {t('common.results', { count: (data?.rows || []).length })}
      </p>

      {data?.total_hours !== undefined && (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          {t('common.hours')}: <strong>{data.total_hours}</strong>
          <span className="ml-3 text-gray-400">
            ({start} → {end})
          </span>
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="border-t border-gray-100 dark:border-gray-800">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {c.includes('minute')
                        ? formatHours(row[c])
                        : c.includes('date')
                          ? String(row[c] ?? '').slice(0, 10)
                          : i18n.language?.startsWith('lo') && row[c.replace('_en', '_lo')]
                            ? String(row[c.replace('_en', '_lo')])
                            : String(row[c] ?? '—')}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {row.id && type === 'individual' ? (
                      <ActionIcons viewTo={`/activities/${row.id}`} />
                    ) : row.user_id ? (
                      <Link to="/team" className="text-xs text-brand-500 hover:underline dark:text-brand-400">
                        {t('common.view')}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={Math.max(columns.length, 1) + 1} className="px-3 py-8 text-center text-gray-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
