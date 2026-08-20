import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const controlClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';
export const outlineButtonClass =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]';

/** A labelled control inside a FilterPanel grid. */
export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

/**
 * The filter panel used by the activity, approvals and team pages: a header
 * carrying the active-filter count and the page's actions, over a responsive
 * grid of controls.
 */
export default function FilterPanel({
  activeCount,
  onReset,
  resetDisabled,
  actions,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  resetDisabled?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('common.filters')}
          {activeCount > 0 && (
            <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              {activeCount}
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={outlineButtonClass}
            disabled={resetDisabled}
            onClick={onReset}
          >
            {t('common.reset')}
          </button>
          {actions}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}
