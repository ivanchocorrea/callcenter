'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { X, Eye, EyeOff, Building2, Info, UserPlus, Pencil } from 'lucide-react';

interface Props {
  editId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Company {
  id: number;
  display_name?: string;
  displayName?: string;
  slug: string;
}

const ROLES = [
  { slug: 'super_admin', name: 'Super Admin', desc: 'Administra TODO el SaaS y todas las empresas', danger: true },
  { slug: 'company_admin', name: 'Company Admin', desc: 'Administra esta empresa y sus recursos' },
  { slug: 'supervisor', name: 'Supervisor', desc: 'Monitoreo en vivo, reportes y calidad' },
  { slug: 'agent', name: 'Agent', desc: 'Atiende llamadas y gestiona clientes' },
];

export function UserFormModal({ editId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes('super_admin') ?? false;
  const isCompanyAdmin = user?.roles.includes('company_admin') ?? false;
  const isEdit = editId != null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState<string>(user?.company_id ? String(user.company_id) : '');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['agent']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Cargar datos del usuario en modo edición
  useEffect(() => {
    if (!isEdit || !editId) return;
    setLoadingEdit(true);
    api.get(`/users/${editId}`)
      .then(res => {
        const u = unwrap<any>(res);
        setEmail(u.email ?? '');
        setFullName(u.fullName ?? u.full_name ?? '');
        setPhone(u.phone ?? '');
        if (u.companyId ?? u.company_id) setCompanyId(String(u.companyId ?? u.company_id));
        if (Array.isArray(u.roles)) setSelectedRoles(u.roles);
      })
      .catch(e => setError(e?.response?.data?.error?.message ?? 'Error al cargar usuario'))
      .finally(() => setLoadingEdit(false));
  }, [isEdit, editId]);

  // Si es super_admin, cargar todas las empresas para el dropdown
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingCompanies(true);
      api.get('/companies')
        .then(res => {
          const list = unwrap<any[]>(res).map(c => ({
            id: c.id,
            display_name: c.displayName ?? c.display_name,
            slug: c.slug,
          }));
          setCompanies(list);
          if (user?.company_id && !companyId && !isEdit) setCompanyId(String(user.company_id));
        })
        .catch(() => setCompanies([]))
        .finally(() => setLoadingCompanies(false));
    }
  }, [isSuperAdmin, user?.company_id, isEdit]);

  function toggleRole(slug: string) {
    setSelectedRoles(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let p = '';
    for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
    setShowPassword(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      if (!email || !email.includes('@')) return setError('Email inválido');
      if (!password || password.length < 10) return setError('Contraseña mínimo 10 caracteres');
    }
    if (!fullName || fullName.length < 2) return setError('Nombre completo requerido');
    if (selectedRoles.length === 0) return setError('Selecciona al menos un rol');

    const needsCompany = !selectedRoles.includes('super_admin');
    if (needsCompany && !companyId) {
      return setError('Debes asignar el usuario a una empresa');
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: any = {
          full_name: fullName,
          role_slugs: selectedRoles,
        };
        if (phone !== undefined) payload.phone = phone || null;
        await api.patch(`/users/${editId}`, payload);
        if (password) {
          await api.patch(`/users/${editId}/password`, { password });
        }
      } else {
        const payload: any = {
          email,
          password,
          full_name: fullName,
          role_slugs: selectedRoles,
        };
        if (phone) payload.phone = phone;
        if (companyId) payload.company_id = parseInt(companyId, 10);
        await api.post('/users', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Error al guardar usuario';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const showCompanySelector = isSuperAdmin && !isEdit; // en edición no permitimos cambiar de empresa
  const companyHelpText = isSuperAdmin
    ? 'Como super admin, debes elegir a qué empresa pertenece el nuevo usuario.'
    : 'Se asignará automáticamente a tu empresa actual.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEdit ? 'bg-blue-100' : 'bg-emerald-100'}`}>
              {isEdit ? <Pencil className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit ? 'Modifica datos, roles o contraseña.' : 'Crea un usuario y asígnale roles dentro de una empresa.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingEdit ? (
          <div className="px-6 py-12 text-center text-slate-500">Cargando datos del usuario…</div>
        ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {showCompanySelector && (
            <div className="rounded-lg border-2 border-brand-200 bg-brand-50/50 p-4">
              <label className="block text-sm font-semibold text-brand-900 mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Empresa asignada {!selectedRoles.includes('super_admin') && <span className="text-rose-500">*</span>}
              </label>
              {loadingCompanies ? (
                <div className="text-sm text-slate-500">Cargando empresas…</div>
              ) : companies.length === 0 ? (
                <div className="text-sm text-rose-600">⚠️ No hay empresas creadas. Ve a /super-admin/companies y crea una primero.</div>
              ) : (
                <select
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">— Sin empresa (solo válido para super_admin) —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.id}] {c.display_name ?? c.displayName} — {c.slug}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-brand-700 mt-1.5 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" /> {companyHelpText}
              </p>
            </div>
          )}

          {isEdit && companyId && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 flex items-start gap-2">
              <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>Empresa actual: <code className="bg-white px-1 rounded">#{companyId}</code> (no se puede cambiar al editar — crea otro usuario si necesitas reasignar)</div>
            </div>
          )}

          {!showCompanySelector && !isEdit && isCompanyAdmin && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
              <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>El usuario se creará en TU empresa (#{user?.company_id}). No necesitas seleccionar.</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo <span className="text-rose-500">*</span></label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                placeholder="Iván Correa"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email {!isEdit && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required={!isEdit} disabled={isEdit}
                placeholder="usuario@empresa.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              {isEdit && <p className="text-xs text-slate-500 mt-1">El email no se puede cambiar (es el identificador de login)</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isEdit ? 'Nueva contraseña (opcional)' : <>Contraseña <span className="text-rose-500">*</span></>}
              <span className="ml-2 text-xs text-slate-500 font-normal">(mín. 10 caracteres)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required={!isEdit}
                  minLength={isEdit ? undefined : 10}
                  placeholder={isEdit ? 'Dejar vacío = no cambiar' : 'Mínimo 10 caracteres'}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="button" onClick={generatePassword} className="px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-200">
                Generar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (opcional)</label>
            <input
              type="text" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+57 300 000 0000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rol <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedRoles[0] ?? ''}
              onChange={e => setSelectedRoles(e.target.value ? [e.target.value] : [])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value="">— Selecciona un rol —</option>
              {ROLES.filter(r => r.slug !== 'super_admin' || isSuperAdmin).map(r => (
                <option key={r.slug} value={r.slug}>
                  {r.name} {r.danger ? '⚠️' : ''}
                </option>
              ))}
            </select>
            {selectedRoles[0] && (
              <p className="text-xs text-slate-500 mt-1.5">
                {ROLES.find(r => r.slug === selectedRoles[0])?.desc}
              </p>
            )}
          </div>
        </form>
        )}

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSubmit as any} disabled={submitting || loadingEdit} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium shadow-sm">
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}
