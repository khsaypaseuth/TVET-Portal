import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageBreadcrumb from '../components/common/PageBreadCrumb';
import UserMetaCard, {
  UserInfoCard,
  UserAddressCard,
} from '../components/UserProfile/UserMetaCard';
import PageMeta from '../components/common/PageMeta';
import { useAuth } from '../context/AuthContext';
import { User } from '../services/api';

export default function UserProfiles() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(user);

  useEffect(() => {
    setProfile(user);
  }, [user]);

  useEffect(() => {
    refreshUser().catch(console.error);
  }, []);

  const onSaved = async (u: User) => {
    setProfile(u);
    await refreshUser();
  };

  return (
    <>
      <PageMeta title={`${t('profile.title')} | TVED`} description={t('app.fullName')} />
      <PageBreadcrumb pageTitle={t('profile.title')} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          {t('profile.title')}
        </h3>
        <div className="space-y-6">
          <UserMetaCard user={profile} onSaved={onSaved} />
          <UserInfoCard user={profile} onSaved={onSaved} />
          <UserAddressCard user={profile} onSaved={onSaved} />
        </div>
      </div>
    </>
  );
}
