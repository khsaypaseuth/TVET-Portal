import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import ActionIcons from '../../components/common/ActionIcons';
import { Modal } from '../../components/ui/modal';
import { apiService } from '../../services/api';
import { PlusIcon } from '../../icons';

type Mode = 'view' | 'edit' | null;

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30';
const thCls = 'px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400';
const tdCls = 'px-3 py-2 text-gray-700 dark:text-gray-300';
const pageTitleCls = 'mb-6 text-2xl font-bold text-gray-800 dark:text-white/90';
const cardCls =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';
const outlineBtnCls =
  'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]';
const modalTitleCls = 'mb-4 text-lg font-semibold text-gray-800 dark:text-white/90';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 py-2 text-sm last:border-0 dark:border-gray-800">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="col-span-2 font-medium text-gray-800 dark:text-white/90">{value || '—'}</dd>
    </div>
  );
}

export function UsersAdminPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [form, setForm] = useState({
    username: '', email: '', password: '', staff_code: '', full_name: '', phone: '',
    role_id: '', division_id: '', position_id: '', supervisor_id: '',
  });
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [editForm, setEditForm] = useState<any>({});

  const load = async () => {
    const [u, r, d, p] = await Promise.all([
      apiService.getUsers(),
      apiService.getRoles(),
      apiService.getDivisions(),
      apiService.getPositions(),
    ]);
    setUsers(u.data);
    setRoles(r.data);
    setDivisions(d.data);
    setPositions(p.data);
    if (r.data[0]) {
      setForm((f) => ({
        ...f,
        role_id: String(r.data.find((x: any) => x.code === 'tech')?.id || r.data[0].id),
      }));
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const closeModal = () => {
    setMode(null);
    setSelected(null);
  };

  const openView = (u: any) => {
    setSelected(u);
    setMode('view');
  };

  const openEdit = (u: any) => {
    setSelected(u);
    setEditForm({
      full_name: u.full_name || '',
      email: u.email || '',
      staff_code: u.staff_code || '',
      phone: u.phone || '',
      role_id: String(u.role_id || ''),
      division_id: u.division_id ? String(u.division_id) : '',
      position_id: u.position_id ? String(u.position_id) : '',
      supervisor_id: u.supervisor_id ? String(u.supervisor_id) : '',
      is_active: u.is_active !== false,
      password: '',
    });
    setMode('edit');
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createUser({
        ...form,
        role_id: Number(form.role_id),
        division_id: form.division_id ? Number(form.division_id) : null,
        position_id: form.position_id ? Number(form.position_id) : null,
        supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
      });
      setForm((f) => ({
        ...f,
        username: '',
        email: '',
        password: '',
        staff_code: '',
        full_name: '',
        phone: '',
      }));
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiService.updateUser(selected.id, {
        full_name: editForm.full_name,
        email: editForm.email,
        staff_code: editForm.staff_code,
        phone: editForm.phone || null,
        role_id: editForm.role_id ? Number(editForm.role_id) : null,
        division_id: editForm.division_id ? Number(editForm.division_id) : null,
        position_id: editForm.position_id ? Number(editForm.position_id) : null,
        supervisor_id: editForm.supervisor_id ? Number(editForm.supervisor_id) : null,
        is_active: editForm.is_active,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      closeModal();
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const onDelete = (u: any) => {
    if (!confirm(t('common.confirmDelete'))) return;
    apiService.deactivateUser(u.id).then(load).catch((err) => alert(err.message));
  };

  return (
    <>
      <PageMeta title={`${t('sidebar.users')} | TVED`} description={t('app.fullName')} />
      <h1 className={pageTitleCls}>{t('sidebar.users')}</h1>
      <form onSubmit={onCreate} className={`mb-8 grid grid-cols-1 gap-3 p-4 md:grid-cols-3 ${cardCls}`}>
        {(['username', 'staff_code', 'email', 'password', 'full_name', 'phone'] as const).map((k) => (
          <input
            key={k}
            required={['username', 'email', 'password'].includes(k)}
            type={k === 'password' ? 'password' : 'text'}
            placeholder={k === 'phone' ? t('common.phone') : k}
            className={inputCls}
            value={form[k]}
            onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
          />
        ))}
        <select className={inputCls} value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name_en}</option>
          ))}
        </select>
        <select className={inputCls} value={form.division_id} onChange={(e) => setForm((f) => ({ ...f, division_id: e.target.value }))}>
          <option value="">{t('common.division')}</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>{d.name_en}</option>
          ))}
        </select>
        <select className={inputCls} value={form.position_id} onChange={(e) => setForm((f) => ({ ...f, position_id: e.target.value }))}>
          <option value="">{t('common.position')}</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>{p.name_en}</option>
          ))}
        </select>
        <select className={inputCls} value={form.supervisor_id} onChange={(e) => setForm((f) => ({ ...f, supervisor_id: e.target.value }))}>
          <option value="">{t('common.supervisor')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
          ))}
        </select>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white">
          <PlusIcon className="size-4 fill-current" />
          {t('common.create')}
        </button>
      </form>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={thCls}>{t('common.fullName')}</th>
              <th className={thCls}>{t('common.staff')}</th>
              <th className={thCls}>{t('common.phone')}</th>
              <th className={thCls}>{t('common.role')}</th>
              <th className={thCls}>{t('common.division')}</th>
              <th className={thCls}>{t('common.active')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className={tdCls}>{u.full_name || u.username}</td>
                <td className={tdCls}>{u.staff_code}</td>
                <td className={tdCls}>{u.phone || '—'}</td>
                <td className={tdCls}>{u.role_code || u.role}</td>
                <td className={tdCls}>{u.division_name_en || '—'}</td>
                <td className={tdCls}>{u.is_active ? t('common.yes') : t('common.no')}</td>
                <td className={tdCls}>
                  <ActionIcons
                    phone={u.phone}
                    onView={() => openView(u)}
                    onEdit={() => openEdit(u)}
                    onDelete={u.role_code !== 'super_admin' ? () => onDelete(u) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={mode === 'view' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.details')}</h3>
        {selected && (
          <dl>
            <DetailRow label={t('common.fullName')} value={selected.full_name || selected.username} />
            <DetailRow label={t('common.staff')} value={selected.staff_code} />
            <DetailRow label={t('common.email')} value={selected.email} />
            <DetailRow label={t('common.phone')} value={selected.phone} />
            <DetailRow label={t('common.role')} value={selected.role_code || selected.role} />
            <DetailRow label={t('common.division')} value={selected.division_name_en} />
            <DetailRow label={t('common.position')} value={selected.position_code} />
            <DetailRow label={t('common.active')} value={selected.is_active ? t('common.yes') : t('common.no')} />
          </dl>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={outlineBtnCls} onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
            onClick={() => selected && openEdit(selected)}
          >
            {t('common.edit')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={mode === 'edit' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.edit')}</h3>
        <form onSubmit={onSaveEdit} className="grid gap-3">
          {([
            ['full_name', t('common.fullName')],
            ['staff_code', t('common.staff')],
            ['email', t('common.email')],
            ['phone', t('common.phone')],
            ['password', t('common.password')],
          ] as const).map(([k, label]) => (
            <label key={k} className="block text-sm">
              <span className="mb-1 block text-gray-500 dark:text-gray-400">{label}</span>
              <input
                className={inputCls}
                type={k === 'password' ? 'password' : 'text'}
                value={editForm[k] || ''}
                onChange={(e) => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                required={k !== 'password' && k !== 'phone'}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.role')}</span>
            <select className={inputCls} value={editForm.role_id} onChange={(e) => setEditForm((f: any) => ({ ...f, role_id: e.target.value }))}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name_en}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.division')}</span>
            <select className={inputCls} value={editForm.division_id} onChange={(e) => setEditForm((f: any) => ({ ...f, division_id: e.target.value }))}>
              <option value="">—</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name_en}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.position')}</span>
            <select className={inputCls} value={editForm.position_id} onChange={(e) => setEditForm((f: any) => ({ ...f, position_id: e.target.value }))}>
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name_en}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!editForm.is_active}
              onChange={(e) => setEditForm((f: any) => ({ ...f, is_active: e.target.checked }))}
            />
            {t('common.active')}
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className={outlineBtnCls} onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DivisionsAdminPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', name_lo: '', name_en: '' });
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [editForm, setEditForm] = useState({ name_lo: '', name_en: '', sort_order: '0' });

  const load = () => apiService.getDivisions().then((r) => setRows(r.data));
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const closeModal = () => {
    setMode(null);
    setSelected(null);
  };

  const openView = (d: any) => {
    setSelected(d);
    setMode('view');
  };

  const openEdit = (d: any) => {
    setSelected(d);
    setEditForm({
      name_lo: d.name_lo || '',
      name_en: d.name_en || '',
      sort_order: String(d.sort_order ?? 0),
    });
    setMode('edit');
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiService.updateDivision(selected.id, {
        name_lo: editForm.name_lo,
        name_en: editForm.name_en,
        sort_order: Number(editForm.sort_order) || 0,
      });
      closeModal();
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const onDelete = (d: any) => {
    if (!confirm(t('common.confirmDelete'))) return;
    apiService.deactivateDivision(d.id).then(load).catch((err) => alert(err.message));
  };

  return (
    <>
      <PageMeta title={`${t('sidebar.divisions')} | TVED`} description={t('app.fullName')} />
      <h1 className={pageTitleCls}>{t('sidebar.divisions')}</h1>
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiService.createDivision(form);
            setForm({ code: '', name_lo: '', name_en: '' });
            await load();
          } catch (err: any) {
            alert(err.message);
          }
        }}
      >
        <input className={inputCls + ' max-w-[140px]'} placeholder={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className={inputCls + ' max-w-[200px]'} placeholder={t('common.nameLo')} value={form.name_lo} onChange={(e) => setForm({ ...form, name_lo: e.target.value })} required />
        <input className={inputCls + ' max-w-[200px]'} placeholder={t('common.nameEn')} value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white">
          <PlusIcon className="size-4 fill-current" />
          {t('common.create')}
        </button>
      </form>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={thCls}>{t('common.code')}</th>
              <th className={thCls}>{t('common.nameLo')}</th>
              <th className={thCls}>{t('common.nameEn')}</th>
              <th className={thCls}>{t('common.active')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className={tdCls}>{d.code}</td>
                <td className={`${tdCls} leading-[1.8]`}>{d.name_lo}</td>
                <td className={tdCls}>{d.name_en}</td>
                <td className={tdCls}>{d.is_active !== false ? t('common.yes') : t('common.no')}</td>
                <td className={tdCls}>
                  <ActionIcons
                    onView={() => openView(d)}
                    onEdit={() => openEdit(d)}
                    onDelete={() => onDelete(d)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={mode === 'view' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.details')}</h3>
        {selected && (
          <dl>
            <DetailRow label={t('common.code')} value={selected.code} />
            <DetailRow label={t('common.nameLo')} value={selected.name_lo} />
            <DetailRow label={t('common.nameEn')} value={selected.name_en} />
            <DetailRow label={t('common.rank')} value={selected.sort_order} />
            <DetailRow label={t('common.active')} value={selected.is_active !== false ? t('common.yes') : t('common.no')} />
          </dl>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={outlineBtnCls} onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button type="button" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white" onClick={() => selected && openEdit(selected)}>
            {t('common.edit')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={mode === 'edit' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.edit')}</h3>
        <form onSubmit={onSaveEdit} className="grid gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.code')}</span>
            <input className={inputCls} value={selected?.code || ''} disabled />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.nameLo')}</span>
            <input className={inputCls} value={editForm.name_lo} onChange={(e) => setEditForm({ ...editForm, name_lo: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.nameEn')}</span>
            <input className={inputCls} value={editForm.name_en} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.rank')}</span>
            <input className={inputCls} type="number" value={editForm.sort_order} onChange={(e) => setEditForm({ ...editForm, sort_order: e.target.value })} />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className={outlineBtnCls} onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PositionsAdminPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', name_lo: '', name_en: '', rank_level: '5' });
  const [selected, setSelected] = useState<any | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [editForm, setEditForm] = useState({ name_lo: '', name_en: '', rank_level: '5' });

  const load = () => apiService.getPositions().then((r) => setRows(r.data));
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const closeModal = () => {
    setMode(null);
    setSelected(null);
  };

  const openView = (p: any) => {
    setSelected(p);
    setMode('view');
  };

  const openEdit = (p: any) => {
    setSelected(p);
    setEditForm({
      name_lo: p.name_lo || '',
      name_en: p.name_en || '',
      rank_level: String(p.rank_level ?? 5),
    });
    setMode('edit');
  };

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiService.updatePosition(selected.id, {
        name_lo: editForm.name_lo,
        name_en: editForm.name_en,
        rank_level: Number(editForm.rank_level),
      });
      closeModal();
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const onDelete = (p: any) => {
    if (!confirm(t('common.confirmDelete'))) return;
    apiService.deactivatePosition(p.id).then(load).catch((err) => alert(err.message));
  };

  return (
    <>
      <PageMeta title={`${t('sidebar.positions')} | TVED`} description={t('app.fullName')} />
      <h1 className={pageTitleCls}>{t('sidebar.positions')}</h1>
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiService.createPosition({
              ...form,
              rank_level: Number(form.rank_level),
            });
            setForm({ code: '', name_lo: '', name_en: '', rank_level: '5' });
            await load();
          } catch (err: any) {
            alert(err.message);
          }
        }}
      >
        <input className={inputCls + ' max-w-[120px]'} placeholder={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className={inputCls + ' max-w-[180px]'} placeholder={t('common.nameLo')} value={form.name_lo} onChange={(e) => setForm({ ...form, name_lo: e.target.value })} required />
        <input className={inputCls + ' max-w-[180px]'} placeholder={t('common.nameEn')} value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
        <input className={inputCls + ' max-w-[100px]'} type="number" placeholder={t('common.rank')} value={form.rank_level} onChange={(e) => setForm({ ...form, rank_level: e.target.value })} required />
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-white">
          <PlusIcon className="size-4 fill-current" />
          {t('common.create')}
        </button>
      </form>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={thCls}>{t('common.code')}</th>
              <th className={thCls}>{t('common.nameLo')}</th>
              <th className={thCls}>{t('common.nameEn')}</th>
              <th className={thCls}>{t('common.rank')}</th>
              <th className={thCls}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className={tdCls}>{p.code}</td>
                <td className={`${tdCls} leading-[1.8]`}>{p.name_lo}</td>
                <td className={tdCls}>{p.name_en}</td>
                <td className={tdCls}>{p.rank_level}</td>
                <td className={tdCls}>
                  <ActionIcons
                    onView={() => openView(p)}
                    onEdit={() => openEdit(p)}
                    onDelete={() => onDelete(p)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={mode === 'view' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.details')}</h3>
        {selected && (
          <dl>
            <DetailRow label={t('common.code')} value={selected.code} />
            <DetailRow label={t('common.nameLo')} value={selected.name_lo} />
            <DetailRow label={t('common.nameEn')} value={selected.name_en} />
            <DetailRow label={t('common.rank')} value={selected.rank_level} />
          </dl>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={outlineBtnCls} onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button type="button" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white" onClick={() => selected && openEdit(selected)}>
            {t('common.edit')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={mode === 'edit' && !!selected} onClose={closeModal} className="m-4 max-w-lg p-6">
        <h3 className={modalTitleCls}>{t('common.edit')}</h3>
        <form onSubmit={onSaveEdit} className="grid gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.code')}</span>
            <input className={inputCls} value={selected?.code || ''} disabled />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.nameLo')}</span>
            <input className={inputCls} value={editForm.name_lo} onChange={(e) => setEditForm({ ...editForm, name_lo: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.nameEn')}</span>
            <input className={inputCls} value={editForm.name_en} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-500 dark:text-gray-400">{t('common.rank')}</span>
            <input className={inputCls} type="number" value={editForm.rank_level} onChange={(e) => setEditForm({ ...editForm, rank_level: e.target.value })} required />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className={outlineBtnCls} onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AuditLogPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    apiService.getAuditLogs().then((r) => setRows(r.data)).catch(console.error);
  }, []);
  return (
    <>
      <PageMeta title={`${t('sidebar.auditLog')} | TVED`} description={t('app.fullName')} />
      <h1 className={pageTitleCls}>{t('sidebar.auditLog')}</h1>
      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className={thCls}>When</th>
              <th className={thCls}>Actor</th>
              <th className={thCls}>Action</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className={tdCls}>{new Date(r.created_at).toLocaleString()}</td>
                <td className={tdCls}>{r.actor_name || r.user_id}</td>
                <td className={tdCls}>{r.action}</td>
                <td className={tdCls}>{r.auditable_type}</td>
                <td className={tdCls}>{r.auditable_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
