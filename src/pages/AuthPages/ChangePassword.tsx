import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiService.changePassword(user?.must_change_password ? null : current, next);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageMeta title={`${t('auth.changePassword')} | TVED`} description={t('app.fullName')} />
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="mb-4 text-xl font-bold">{t('auth.changePassword')}</h1>
        {error && <p className="mb-3 text-sm text-error-500">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          {!user?.must_change_password && (
            <input
              type="password"
              className="w-full rounded-lg border px-3 py-2"
              placeholder={t('auth.currentPassword')}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
          <input
            type="password"
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('auth.newPassword')}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={6}
          />
          <button className="w-full rounded-lg bg-brand-500 py-2 text-white">{t('common.save')}</button>
        </form>
      </div>
    </>
  );
}
