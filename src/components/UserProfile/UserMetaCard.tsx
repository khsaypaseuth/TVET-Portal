import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../hooks/useModal';
import { Modal } from '../ui/modal';
import Button from '../ui/button/Button';
import Input from '../form/input/InputField';
import Label from '../form/Label';
import { apiService, User } from '../../services/api';

const editBtn =
  'flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto';

const socialBtn =
  'flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]';

type ProfileForm = {
  first_name_en: string;
  last_name_en: string;
  first_name_lo: string;
  last_name_lo: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  facebook_url: string;
  twitter_url: string;
  linkedin_url: string;
  instagram_url: string;
};

function fromUser(u: User | null): ProfileForm {
  return {
    first_name_en: u?.first_name_en || '',
    last_name_en: u?.last_name_en || '',
    first_name_lo: u?.first_name_lo || '',
    last_name_lo: u?.last_name_lo || '',
    email: u?.email || '',
    phone: u?.phone || '',
    country: u?.country || 'Lao PDR',
    city: u?.city || '',
    facebook_url: u?.facebook_url || '',
    twitter_url: u?.twitter_url || '',
    linkedin_url: u?.linkedin_url || '',
    instagram_url: u?.instagram_url || '',
  };
}

function displayName(u: User | null, lang: string) {
  if (!u) return '—';
  if (lang.startsWith('lo')) {
    const lo = [u.first_name_lo, u.last_name_lo].filter(Boolean).join(' ').trim();
    if (lo) return lo;
  }
  const en = [u.first_name_en, u.last_name_en].filter(Boolean).join(' ').trim();
  return u.full_name || en || u.username;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90 leading-[1.8]">{value || '—'}</p>
    </div>
  );
}

type Props = { user: User | null; onSaved: (u: User) => void };

export default function UserMetaCard({ user, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const { isOpen, openModal, closeModal } = useModal();
  const [form, setForm] = useState<ProfileForm>(fromUser(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(fromUser(user));
  }, [isOpen, user]);

  const set = (key: keyof ProfileForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiService.updateProfile(form);
      onSaved(res.data);
      closeModal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const location = [user?.city, user?.country].filter(Boolean).join(', ');
  const title =
    (i18n.language?.startsWith('lo')
      ? user?.position_name_lo || user?.role_name_lo
      : user?.position_name_en || user?.role_name_en) ||
    user?.role_code ||
    '—';

  const socials = [
    { url: user?.facebook_url, label: 'Facebook', path: 'M11.6666 11.2503H13.7499L14.5833 7.91699H11.6666V6.25033C11.6666 5.39251 11.6666 4.58366 13.3333 4.58366H14.5833V1.78374C14.3118 1.7477 13.2858 1.66699 12.2023 1.66699C9.94025 1.66699 8.33325 3.04771 8.33325 5.58342V7.91699H5.83325V11.2503H8.33325V18.3337H11.6666V11.2503Z' },
    { url: user?.twitter_url, label: 'X', path: 'M15.1708 1.875H17.9274L11.9049 8.75833L18.9899 18.125H13.4424L9.09742 12.4442L4.12578 18.125H1.36745L7.80912 10.7625L1.01245 1.875H6.70078L10.6283 7.0675L15.1708 1.875ZM14.2033 16.475H15.7308L5.87078 3.43833H4.23162L14.2033 16.475Z' },
    { url: user?.linkedin_url, label: 'LinkedIn', path: 'M5.78381 4.16645C5.78351 4.84504 5.37181 5.45569 4.74286 5.71045C4.11391 5.96521 3.39331 5.81321 2.92083 5.32613C2.44836 4.83904 2.31837 4.11413 2.59216 3.49323C2.86596 2.87233 3.48886 2.47942 4.16715 2.49978C5.06804 2.52682 5.78422 3.26515 5.78381 4.16645ZM5.83381 7.06645H2.50048V17.4998H5.83381V7.06645ZM11.1005 7.06645H7.78381V17.4998H11.0672V12.0248C11.0672 8.97475 15.0422 8.69142 15.0422 12.0248V17.4998H18.3338V10.8914C18.3338 5.74978 12.4505 5.94145 11.0672 8.46642L11.1005 7.06645Z' },
    { url: user?.instagram_url, label: 'Instagram', path: 'M10.8567 1.66699C11.7946 1.66854 12.2698 1.67351 12.6805 1.68573L12.8422 1.69102C13.0291 1.69766 13.2134 1.70599 13.4357 1.71641C14.3224 1.75738 14.9273 1.89766 15.4586 2.10391C16.0078 2.31572 16.4717 2.60183 16.9349 3.06503C17.3974 3.52822 17.6836 3.99349 17.8961 4.54141C18.1016 5.07197 18.2419 5.67753 18.2836 6.56433C18.2935 6.78655 18.3015 6.97088 18.3081 7.15775L18.3133 7.31949C18.3255 7.73011 18.3311 8.20543 18.3328 9.1433L18.3335 9.76463C18.3336 9.84055 18.3336 9.91888 18.3336 9.99972L18.3335 10.2348L18.333 10.8562C18.3314 11.794 18.3265 12.2694 18.3142 12.68L18.3089 12.8417C18.3023 13.0286 18.294 13.213 18.2836 13.4351C18.2426 14.322 18.1016 14.9268 17.8961 15.458C17.6842 16.0074 17.3974 16.4713 16.9349 16.9345C16.4717 17.397 16.0057 17.6831 15.4586 17.8955C14.9273 18.1011 14.3224 18.2414 13.4357 18.2831C13.2134 18.293 13.0291 18.3011 12.8422 18.3076L12.6805 18.3128C12.2698 18.3251 11.7946 18.3306 10.8567 18.3324L10.2353 18.333C10.1594 18.333 10.0811 18.333 10.0002 18.333H9.76516L9.14375 18.3325C8.20591 18.331 7.7306 18.326 7.31997 18.3137L7.15824 18.3085C6.97136 18.3018 6.78703 18.2935 6.56481 18.2831C5.67801 18.2421 5.07384 18.1011 4.5419 17.8955C3.99328 17.6838 3.5287 17.397 3.06551 16.9345C2.60231 16.4713 2.3169 16.0053 2.1044 15.458C1.89815 14.9268 1.75856 14.322 1.7169 13.4351C1.707 13.213 1.69892 13.0286 1.69238 12.8417L1.68714 12.68C1.67495 12.2694 1.66939 11.794 1.66759 10.8562L1.66748 9.1433C1.66903 8.20543 1.67399 7.73011 1.68621 7.31949L1.69151 7.15775C1.69815 6.97088 1.70648 6.78655 1.7169 6.56433C1.75786 5.67683 1.89815 5.07266 2.1044 4.54141C2.3162 3.9928 2.60231 3.52822 3.06551 3.06503C3.5287 2.60183 3.99398 2.31641 4.5419 2.10391C5.07315 1.89766 5.67731 1.75808 6.56481 1.71641C6.78703 1.70652 6.97136 1.69844 7.15824 1.6919L7.31997 1.68666C7.7306 1.67446 8.20591 1.6689 9.14375 1.6671L10.8567 1.66699ZM10.0002 5.83308C7.69781 5.83308 5.83356 7.69935 5.83356 9.99972C5.83356 12.3021 7.69984 14.1664 10.0002 14.1664C12.3027 14.1664 14.1669 12.3001 14.1669 9.99972C14.1669 7.69732 12.3006 5.83308 10.0002 5.83308ZM10.0002 7.49974C11.381 7.49974 12.5002 8.61863 12.5002 9.99972C12.5002 11.3805 11.3813 12.4997 10.0002 12.4997C8.6195 12.4997 7.50023 11.3809 7.50023 9.99972C7.50023 8.61897 8.61908 7.49974 10.0002 7.49974ZM14.3752 4.58308C13.8008 4.58308 13.3336 5.04967 13.3336 5.62403C13.3336 6.19841 13.8002 6.66572 14.3752 6.66572C14.9496 6.66572 15.4169 6.19913 15.4169 5.62403C15.4169 5.04967 14.9488 4.58236 14.3752 4.58308Z' },
  ].filter((s) => s.url);

  return (
    <>
      <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
              <img
                src={user?.avatar_path || '/images/user/owner.jpg'}
                alt={displayName(user, i18n.language)}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-center text-lg font-semibold text-gray-800 dark:text-white/90 xl:text-left leading-[1.8]">
                {displayName(user, i18n.language)}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                {location && (
                  <>
                    <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{location}</p>
                  </>
                )}
              </div>
            </div>
            <div className="order-2 flex grow items-center gap-2 xl:order-3 xl:justify-end">
              {socials.map((s) => (
                <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" className={socialBtn} title={s.label}>
                  <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d={s.path} fill="currentColor" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          <button type="button" onClick={openModal} className={editBtn}>
            {t('profile.edit')}
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <form onSubmit={onSave} className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{t('profile.editPersonal')}</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">{t('profile.editHint')}</p>
          </div>
          <div className="custom-scrollbar max-h-[450px] overflow-y-auto px-2 pb-3">
            <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">{t('profile.socialLinks')}</h5>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              {([
                ['facebook_url', t('profile.facebook')],
                ['twitter_url', t('profile.twitter')],
                ['linkedin_url', t('profile.linkedin')],
                ['instagram_url', t('profile.instagram')],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="url" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="https://" />
                </div>
              ))}
            </div>
            <h5 className="mb-5 mt-7 text-lg font-medium text-gray-800 dark:text-white/90">{t('profile.personalInfo')}</h5>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div>
                <Label>{t('profile.firstNameEn')}</Label>
                <Input value={form.first_name_en} onChange={(e) => set('first_name_en', e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.lastNameEn')}</Label>
                <Input value={form.last_name_en} onChange={(e) => set('last_name_en', e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.firstNameLo')}</Label>
                <Input value={form.first_name_lo} onChange={(e) => set('first_name_lo', e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.lastNameLo')}</Label>
                <Input value={form.last_name_lo} onChange={(e) => set('last_name_lo', e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.email')}</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.phone')}</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
            <Button size="sm" variant="outline" type="button" onClick={closeModal}>{t('profile.close')}</Button>
            <Button size="sm" type="submit" disabled={saving}>{t('profile.save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function UserInfoCard({ user, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const { isOpen, openModal, closeModal } = useModal();
  const [form, setForm] = useState<ProfileForm>(fromUser(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(fromUser(user));
  }, [isOpen, user]);

  const set = (key: keyof ProfileForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiService.updateProfile(form);
      onSaved(res.data);
      closeModal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const role =
    i18n.language?.startsWith('lo')
      ? user?.role_name_lo || user?.role_code
      : user?.role_name_en || user?.role_code;
  const position =
    i18n.language?.startsWith('lo')
      ? user?.position_name_lo || user?.position_code
      : user?.position_name_en || user?.position_code;
  const division =
    i18n.language?.startsWith('lo')
      ? user?.division_name_lo || user?.division_code
      : user?.division_name_en || user?.division_code;

  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">{t('profile.personalInfo')}</h4>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <Field label={t('profile.firstNameEn')} value={user?.first_name_en} />
            <Field label={t('profile.lastNameEn')} value={user?.last_name_en} />
            <Field label={t('profile.firstNameLo')} value={user?.first_name_lo} />
            <Field label={t('profile.lastNameLo')} value={user?.last_name_lo} />
            <Field label={t('profile.email')} value={user?.email} />
            <Field label={t('profile.phone')} value={user?.phone} />
            <Field label={t('profile.staffCode')} value={user?.staff_code} />
            <Field label={t('profile.role')} value={role} />
            <Field label={t('profile.position')} value={position} />
            <Field label={t('profile.division')} value={division} />
          </div>
        </div>
        <button type="button" onClick={openModal} className={editBtn}>{t('profile.edit')}</button>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <form onSubmit={onSave} className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{t('profile.editPersonal')}</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">{t('profile.editHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-2 lg:grid-cols-2">
            <div>
              <Label>{t('profile.firstNameEn')}</Label>
              <Input value={form.first_name_en} onChange={(e) => set('first_name_en', e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.lastNameEn')}</Label>
              <Input value={form.last_name_en} onChange={(e) => set('last_name_en', e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.firstNameLo')}</Label>
              <Input value={form.first_name_lo} onChange={(e) => set('first_name_lo', e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.lastNameLo')}</Label>
              <Input value={form.last_name_lo} onChange={(e) => set('last_name_lo', e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.email')}</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label>{t('profile.phone')}</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
            <Button size="sm" variant="outline" type="button" onClick={closeModal}>{t('profile.close')}</Button>
            <Button size="sm" type="submit" disabled={saving}>{t('profile.save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function UserAddressCard({ user, onSaved }: Props) {
  const { t } = useTranslation();
  const { isOpen, openModal, closeModal } = useModal();
  const [form, setForm] = useState(fromUser(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(fromUser(user));
  }, [isOpen, user]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiService.updateProfile({
        ...fromUser(user),
        country: form.country,
        city: form.city,
      });
      onSaved(res.data);
      closeModal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">{t('profile.address')}</h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <Field label={t('profile.country')} value={user?.country} />
              <Field label={t('profile.city')} value={user?.city} />
              <Field label={t('profile.staffCode')} value={user?.staff_code} />
            </div>
          </div>
          <button type="button" onClick={openModal} className={editBtn}>{t('profile.edit')}</button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <form onSubmit={onSave} className="relative w-full overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{t('profile.editAddress')}</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">{t('profile.editHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-2 lg:grid-cols-2">
            <div>
              <Label>{t('profile.country')}</Label>
              <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <Label>{t('profile.city')}</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>{t('profile.staffCode')}</Label>
              <Input value={user?.staff_code || ''} disabled />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
            <Button size="sm" variant="outline" type="button" onClick={closeModal}>{t('profile.close')}</Button>
            <Button size="sm" type="submit" disabled={saving}>{t('profile.save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
