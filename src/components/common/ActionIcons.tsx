import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EyeIcon, PencilIcon, TrashBinIcon, WhatsappIcon } from '../../icons';
import { whatsappUrl } from '../../utils/period';

type Props = {
  viewTo?: string;
  editTo?: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  phone?: string | null;
  className?: string;
};

const btn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5';

export default function ActionIcons({
  viewTo,
  editTo,
  onView,
  onEdit,
  onDelete,
  phone,
  className = '',
}: Props) {
  const { t } = useTranslation();
  const wa = whatsappUrl(phone);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {onView ? (
        <button
          type="button"
          className={btn}
          title={t('common.view')}
          aria-label={t('common.view')}
          onClick={onView}
        >
          <EyeIcon className="size-4 fill-current" />
        </button>
      ) : (
        viewTo && (
          <Link to={viewTo} className={btn} title={t('common.view')} aria-label={t('common.view')}>
            <EyeIcon className="size-4 fill-current" />
          </Link>
        )
      )}
      {onEdit ? (
        <button
          type="button"
          className={btn}
          title={t('common.edit')}
          aria-label={t('common.edit')}
          onClick={onEdit}
        >
          <PencilIcon className="size-4 fill-current" />
        </button>
      ) : (
        editTo && (
          <Link to={editTo} className={btn} title={t('common.edit')} aria-label={t('common.edit')}>
            <PencilIcon className="size-4 fill-current" />
          </Link>
        )
      )}
      {onDelete && (
        <button
          type="button"
          className={`${btn} hover:text-error-500`}
          title={t('common.delete')}
          aria-label={t('common.delete')}
          onClick={onDelete}
        >
          <TrashBinIcon className="size-4 fill-current" />
        </button>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300`}
          title={t('common.whatsapp')}
          aria-label={t('common.whatsapp')}
        >
          <WhatsappIcon className="size-4 fill-current" />
        </a>
      )}
    </div>
  );
}
