import { useTranslation } from 'react-i18next';
import { PeriodPreset } from '../../utils/period';

type Props = {
  preset: PeriodPreset;
  start: string;
  end: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply?: () => void;
};

export default function PeriodFilter({
  preset,
  start,
  end,
  onPresetChange,
  onStartChange,
  onEndChange,
  onApply,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap gap-2">
        {([
          ['week', t('common.thisWeek')],
          ['month', t('common.thisMonth')],
          ['custom', t('common.customRange')],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPresetChange(key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              preset === key
                ? 'bg-brand-500 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset !== 'custom' ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {start} → {end}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="period-from">
            {t('common.from')}
          </label>
          <input
            id="period-from"
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => onStartChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="period-to">
            {t('common.to')}
          </label>
          <input
            id="period-to"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => onEndChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              {t('common.filter')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
