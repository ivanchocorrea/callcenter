'use client';

import { AppShell } from '@/components/shared/AppShell';
import { Settings, Building2, Globe, Mail, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Configuración</h2>
          <p className="text-slate-500 mt-1">Ajustes generales de tu empresa.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Empresa</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Nombre</dt><dd className="text-slate-900">—</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Slug</dt><dd className="text-slate-900">—</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">País</dt><dd className="text-slate-900">—</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Zona horaria</dt><dd className="text-slate-900">UTC</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Horario de atención</h3>
            </div>
            <p className="text-sm text-slate-600">Define cuándo está abierto tu Call Center. Fuera de horario, las llamadas pueden ir a un audio o buzón.</p>
            <button className="mt-3 text-sm text-brand-600 font-medium hover:text-brand-700">Configurar horario →</button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Emails transaccionales</h3>
            </div>
            <p className="text-sm text-slate-600">Configura SMTP para enviar invitaciones, recordatorios y reportes por email.</p>
            <button className="mt-3 text-sm text-brand-600 font-medium hover:text-brand-700">Configurar SMTP →</button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-slate-900">Seguridad</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">2FA obligatorio</dt><dd className="text-slate-900">No</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Política de password</dt><dd className="text-slate-900">12 caracteres mín.</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Sesión máx.</dt><dd className="text-slate-900">7 días</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
