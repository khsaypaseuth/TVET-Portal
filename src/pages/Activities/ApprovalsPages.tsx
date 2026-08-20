import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import ActionIcons from '../../components/common/ActionIcons';
import { apiService } from '../../services/api';
import { CheckCircleIcon, CloseLineIcon } from '../../icons';
import { formatHours } from '../../utils/period';

const thCls = 'px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400';
const tdCls = 'px-4 py-3 text-gray-700 dark:text-gray-300';
const tableWrap =
  'overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

export function ApprovalsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  const load = () => apiService.getApprovals().then((r) => setRows(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageMeta title={`${t('sidebar.approvals')} | TVED`} description={t('app.fullName')} />
      <div className="mb-6 flex items-center justify-between">
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
      <div className={tableWrap}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3"></th>
              <th className={thCls}>{t('common.staff')}</th>
              <th className={thCls}>{t('activities.titleLo')}</th>
              <th className={thCls}>{t('activities.startDate')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
                <td className={`${tdCls} leading-[1.8]`}>{row.title_lo}</td>
                <td className={tdCls}>{String(row.start_date).slice(0, 10)}</td>
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
                        const reason = prompt('Rejection reason');
                        if (reason) apiService.rejectActivity(row.id, reason).then(load);
                      }}
                    >
                      <CloseLineIcon className="size-4 fill-current" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MyTeamPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    apiService.getMyTeam().then((r) => setRows(r.data)).catch(console.error);
  }, []);

  return (
    <>
      <PageMeta title={`${t('sidebar.myTeam')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white/90">{t('sidebar.myTeam')}</h1>
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
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 dark:text-white/90">{row.full_name || row.staff_code}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{row.division_name_en || '—'}</div>
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
                  <ActionIcons viewTo="/activities" phone={row.phone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
