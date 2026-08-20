import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import PageMeta from '../../components/common/PageMeta';
import PeriodFilter from '../../components/common/PeriodFilter';
import ActionIcons from '../../components/common/ActionIcons';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  PeriodPreset,
  formatHours,
  resolvePeriod,
} from '../../utils/period';
import {
  PlusIcon,
  TimeIcon,
  CheckCircleIcon,
  TaskIcon,
  GroupIcon,
  PieChartIcon,
} from '../../icons';

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const range0 = resolvePeriod('week');
  const [start, setStart] = useState(range0.start);
  const [end, setEnd] = useState(range0.end);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const chartTheme = useMemo(
    () =>
      ({
        theme: { mode: isDark ? 'dark' : 'light' },
        chart: {
          background: 'transparent',
          foreColor: isDark ? '#98A2B3' : '#667085',
        },
        grid: {
          borderColor: isDark ? '#1D2939' : '#F2F4F7',
        },
        xaxis: {
          labels: { style: { colors: isDark ? '#98A2B3' : '#667085' } },
          axisBorder: { color: isDark ? '#344054' : '#E4E7EC' },
          axisTicks: { color: isDark ? '#344054' : '#E4E7EC' },
        },
        yaxis: {
          labels: { style: { colors: isDark ? '#98A2B3' : '#667085' } },
        },
        legend: {
          labels: { colors: isDark ? '#D0D5DD' : '#344054' },
        },
        tooltip: {
          theme: isDark ? 'dark' : 'light',
        },
      }) as ApexOptions,
    [isDark]
  );

  const load = (s = start, e = end) => {
    setLoading(true);
    apiService
      .getDashboard({ start_date: s, end_date: e })
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onPresetChange = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = resolvePeriod(p);
      setStart(r.start);
      setEnd(r.end);
      load(r.start, r.end);
    }
  };

  const typeChart = useMemo(() => {
    const rows = (stats?.by_type || []).filter((r: any) => r.count > 0);
    const options: ApexOptions = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'donut', fontFamily: 'inherit' },
      labels: rows.map((r: any) =>
        i18n.language?.startsWith('lo') ? r.name_lo || r.name : r.name
      ),
      colors: rows.map((r: any) => r.colour || '#3B82F6'),
      legend: { ...chartTheme.legend, position: 'bottom' },
      dataLabels: {
        enabled: true,
        style: {
          colors: ['#ffffff'],
          fontSize: '12px',
          fontWeight: 600,
        },
        dropShadow: {
          enabled: true,
          top: 1,
          left: 1,
          blur: 2,
          color: '#000',
          opacity: 0.35,
        },
      },
      plotOptions: {
        pie: {
          donut: { size: '65%' },
          dataLabels: {
            offset: 0,
            minAngleToShowLabel: 8,
          },
        },
      },
    };
    return { options, series: rows.map((r: any) => r.count) as number[] };
  }, [stats, i18n.language, chartTheme]);

  const staffBar = useMemo(() => {
    const rows = stats?.staff_summary || [];
    const options: ApexOptions = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '70%' } },
      dataLabels: { enabled: false },
      xaxis: {
        ...chartTheme.xaxis,
        categories: rows.map((r: any) => r.full_name || r.staff_code),
      },
      colors: ['#465FFF'],
    };
    return {
      options,
      series: [{ name: t('common.hours'), data: rows.map((r: any) => +(r.total_minutes / 60).toFixed(1)) }],
    };
  }, [stats, t, chartTheme]);

  const divisionBar = useMemo(() => {
    const rows = stats?.division_summary || [];
    const options: ApexOptions = {
      ...chartTheme,
      chart: { ...chartTheme.chart, type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
      dataLabels: { enabled: false },
      xaxis: {
        ...chartTheme.xaxis,
        categories: rows.map((r: any) =>
          i18n.language?.startsWith('lo') ? r.name_lo : r.name_en
        ),
      },
      colors: ['#10B981'],
    };
    return {
      options,
      series: [{ name: t('common.hours'), data: rows.map((r: any) => +(r.total_minutes / 60).toFixed(1)) }],
    };
  }, [stats, t, i18n.language, chartTheme]);

  const trend = useMemo(() => {
    const rows = stats?.hours_by_day || [];
    const options: ApexOptions = {
      ...chartTheme,
      chart: {
        ...chartTheme.chart,
        type: 'area',
        toolbar: { show: false },
        fontFamily: 'inherit',
        zoom: { enabled: false },
      },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        ...chartTheme.xaxis,
        categories: rows.map((r: any) => String(r.day).slice(5)),
      },
      colors: ['#8B5CF6'],
      fill: { type: 'gradient', gradient: { opacityFrom: isDark ? 0.35 : 0.45, opacityTo: 0.05 } },
    };
    return {
      options,
      series: [{ name: t('common.hours'), data: rows.map((r: any) => +(r.minutes / 60).toFixed(1)) }],
    };
  }, [stats, t, chartTheme, isDark]);

  const cards = [
    {
      label: t('dashboard.myHoursPeriod'),
      value: stats ? formatHours(stats.my_period_minutes) : '—',
      icon: <TimeIcon className="size-5 fill-current" />,
      color: 'text-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400',
    },
    {
      label: t('dashboard.drafts'),
      value: stats?.draft_count ?? '—',
      icon: <TaskIcon className="size-5 fill-current" />,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-400',
    },
    {
      label: t('dashboard.submitted'),
      value: stats?.submitted_count ?? '—',
      icon: <CheckCircleIcon className="size-5 fill-current" />,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-400',
    },
    {
      label: t('dashboard.pendingApprovals'),
      value: stats?.pending_approvals ?? '—',
      icon: <GroupIcon className="size-5 fill-current" />,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-400',
    },
  ];

  return (
    <>
      <PageMeta title={`${t('dashboard.title')} | TVED`} description={t('app.fullName')} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            {t('dashboard.welcome')}
            {user?.full_name ? `, ${user.full_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('app.fullName')}</p>
          {stats?.data_scope && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {stats.role_code} · {stats.data_scope} · {stats.scope_user_count} {t('dashboard.scopeUsers')}
            </p>
          )}
        </div>
        <Link
          to="/activities/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          <PlusIcon className="size-4 fill-current" />
          {t('dashboard.quickAdd')}
        </Link>
      </div>

      <div className="mb-6">
        <PeriodFilter
          preset={preset}
          start={start}
          end={end}
          onPresetChange={onPresetChange}
          onStartChange={setStart}
          onEndChange={setEnd}
          onApply={() => load(start, end)}
        />
      </div>

      {loading && !stats ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <span className={`rounded-lg p-2 ${card.color}`}>{card.icon}</span>
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-4 flex items-center gap-2">
                <PieChartIcon className="size-5 fill-brand-500" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.byType')}</h2>
              </div>
              {typeChart.series.length ? (
                <Chart options={typeChart.options} series={typeChart.series} type="donut" height={300} />
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">—</p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.hoursTrend')}</h2>
              {trend.series[0].data.length ? (
                <Chart options={trend.options} series={trend.series} type="area" height={300} />
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">—</p>
              )}
            </div>
          </div>

          {stats?.is_supervisor && (stats.staff_summary || []).length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.teamHours')}</h2>
                <Chart options={staffBar.options} series={staffBar.series} type="bar" height={Math.max(280, staffBar.series[0].data.length * 36)} />
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.myStaff')}</h2>
                <div className="max-h-[360px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.staff')}</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.hours')}</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.staff_summary.map((row: any) => (
                        <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800 dark:text-white/90">{row.full_name || row.staff_code}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">{row.division_name_en || '—'}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatHours(row.total_minutes)}</td>
                          <td className="px-3 py-2">
                            {row.not_submitted ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{t('dashboard.notSubmitted')}</span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {row.submitted_count}S / {row.approved_count}A
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <ActionIcons
                              viewTo={`/team`}
                              phone={row.phone}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {stats?.is_leadership && (stats.division_summary || []).length > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.divisionHours')}</h2>
              <Chart options={divisionBar.options} series={divisionBar.series} type="bar" height={320} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.division_summary.map((d: any) => (
                  <div key={d.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {i18n.language?.startsWith('lo') ? d.name_lo : d.name_en}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {d.staff_count} {t('common.staff')} · {formatHours(d.total_minutes)}h · {d.activity_count} acts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{t('dashboard.recentActivities')}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.titleLo')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('activities.startDate')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.hours')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recent_activities || []).map((a: any) => (
                    <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 text-gray-800 dark:text-white/90">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: a.type_colour }}
                        />
                        {i18n.language === 'en' && a.title_en ? a.title_en : a.title_lo}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{String(a.start_date).slice(0, 10)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.status}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatHours(a.duration_minutes)}</td>
                      <td className="px-3 py-2">
                        <ActionIcons
                          viewTo={`/activities/${a.id}`}
                          editTo={['draft', 'rejected'].includes(a.status) ? `/activities/${a.id}/edit` : undefined}
                          onDelete={
                            a.status === 'draft'
                              ? () => {
                                  if (confirm(t('common.confirmDelete'))) {
                                    apiService.deleteActivity(a.id).then(() => load());
                                  }
                                }
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {!stats?.recent_activities?.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-400">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
