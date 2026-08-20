import { useTranslation } from 'react-i18next';
import { controlClass } from './FilterPanel';

export const PAGE_SIZES = [20, 50, 100];

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
}

const pagerButton =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]';

/**
 * Rows-per-page selector, record count and Previous/Next, shared by every
 * paginated table. Page state lives in the parent; this only reports changes.
 */
export default function Pager({
  page,
  limit,
  meta,
  rowCount,
  loading,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  meta: PageMeta | null;
  rowCount: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const { t } = useTranslation();
  const total = meta?.total ?? rowCount;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = total === 0 ? 0 : from + rowCount - 1;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {t('common.rowsPerPage')}
          <select
            className={controlClass}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('common.showingRange', { from, to, total })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={pagerButton}
          disabled={loading || page <= 1}
          onClick={() => onPageChange(Math.max(page - 1, 1))}
        >
          {t('common.previous')}
        </button>
        <span className="px-2 text-sm text-gray-600 dark:text-gray-400">
          {t('common.page', { page, pages: meta?.pages ?? 1 })}
        </span>
        <button
          type="button"
          className={pagerButton}
          disabled={loading || !(meta?.has_next ?? false)}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
