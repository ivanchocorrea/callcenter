'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/realtime-context';
import { useSip } from '@/lib/webrtc/sip-context';
import { IncomingCallPopup } from '@/components/agent/IncomingCallPopup';
import {
  LayoutDashboard,
  PhoneIncoming,
  PhoneOutgoing,
  Users,
  Building2,
  ShieldCheck,
  HeadphonesIcon,
  ListTree,
  PhoneCall,
  Mic,
  FileText,
  Webhook,
  MessageSquare,
  Bot,
  Wrench,
  Workflow,
  CreditCard,
  Activity,
  LogOut,
  Settings,
  Megaphone,
  ClipboardCheck,
  Database,
  KeyRound,
  HardDrive,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  permission?: string;
  role?: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  super_admin: [
    { href: '/super-admin', label: '🌐 Dashboard SaaS', icon: LayoutDashboard },
    { href: '/super-admin/companies', label: '🏢 Empresas', icon: Building2 },
    { href: '/super-admin/plans', label: '💳 Planes', icon: CreditCard },
    { href: '/super-admin/audit', label: '🛡️ Auditoría', icon: ShieldCheck },
    { href: '/super-admin/monitoring', label: '📡 Monitoreo', icon: Activity },
    // ── Acceso a vistas de empresa (para configurar/probar) ──
    { href: '/admin', label: '── Vista Empresa ──', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Usuarios', icon: Users },
    { href: '/admin/agents', label: 'Agentes', icon: HeadphonesIcon },
    { href: '/admin/sip-trunks', label: 'Troncales SIP', icon: PhoneCall },
    { href: '/admin/queues', label: 'Colas', icon: ListTree },
    { href: '/admin/schedules', label: 'Horarios', icon: Activity },
    { href: '/admin/ivr', label: 'IVR', icon: Mic },
    { href: '/admin/ai-providers', label: 'Proveedores IA', icon: KeyRound },
    { href: '/admin/ai-bots', label: 'Bots IA', icon: Bot },
    { href: '/admin/ai-prompts', label: 'Prompts IA', icon: Wrench },
    { href: '/admin/customers', label: 'Clientes / CRM', icon: Users },
    { href: '/admin/imports', label: 'Importar', icon: Database },
    { href: '/admin/dnc', label: 'Lista DNC', icon: ShieldCheck },
    { href: '/admin/dispositions', label: 'Tipificaciones', icon: ClipboardCheck },
    { href: '/admin/campaigns', label: 'Campañas', icon: Megaphone },
    { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
    { href: '/admin/sms-providers', label: 'Proveedores SMS', icon: KeyRound },
    { href: '/admin/sms', label: 'Enviar SMS', icon: MessageSquare },
    { href: '/admin/storage-providers', label: 'Almacenamiento', icon: HardDrive },
    { href: '/admin/automations', label: 'Automatizaciones', icon: Workflow },
    { href: '/admin/recordings', label: 'Grabaciones', icon: FileText },
    { href: '/admin/reports', label: 'Reportes', icon: FileText },
    { href: '/admin/quality', label: 'Calidad', icon: ClipboardCheck },
    { href: '/admin/billing', label: 'Facturación', icon: CreditCard },
    { href: '/admin/maintenance', label: 'Mantenimiento', icon: Wrench },
    { href: '/admin/settings', label: 'Configuración', icon: Settings },
    // ── Vista supervisor también ──
    { href: '/supervisor', label: '── Supervisor ──', icon: Activity },
    { href: '/supervisor/calls', label: 'Llamadas', icon: PhoneCall },
  ],
  company_admin: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Usuarios', icon: Users },
    { href: '/admin/agents', label: 'Agentes', icon: HeadphonesIcon },
    { href: '/admin/sip-trunks', label: 'Troncales SIP', icon: PhoneCall },
    { href: '/admin/queues', label: 'Colas', icon: ListTree },
    { href: '/admin/schedules', label: 'Horarios', icon: Activity },
    { href: '/admin/ivr', label: 'IVR', icon: Mic },
    { href: '/admin/ai-providers', label: 'Proveedores IA', icon: KeyRound },
    { href: '/admin/ai-bots', label: 'Bots IA', icon: Bot },
    { href: '/admin/ai-prompts', label: 'Prompts IA', icon: Wrench },
    { href: '/admin/customers', label: 'Clientes / CRM', icon: Users },
    { href: '/admin/imports', label: 'Importar', icon: Database },
    { href: '/admin/dnc', label: 'Lista DNC', icon: ShieldCheck },
    { href: '/admin/dispositions', label: 'Tipificaciones', icon: ClipboardCheck },
    { href: '/admin/campaigns', label: 'Campañas', icon: Megaphone },
    { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
    { href: '/admin/sms-providers', label: 'Proveedores SMS', icon: KeyRound },
    { href: '/admin/sms', label: 'Enviar SMS', icon: MessageSquare },
    { href: '/admin/automations', label: 'Automatizaciones', icon: Workflow },
    { href: '/admin/storage-providers', label: 'Almacenamiento', icon: HardDrive },
    { href: '/admin/recordings', label: 'Grabaciones', icon: FileText },
    { href: '/admin/reports', label: 'Reportes', icon: FileText },
    { href: '/admin/quality', label: 'Calidad', icon: ClipboardCheck },
    { href: '/admin/billing', label: 'Facturación', icon: CreditCard },
    { href: '/admin/maintenance', label: 'Mantenimiento', icon: Wrench },
    { href: '/admin/settings', label: 'Configuración', icon: Settings },
  ],
  supervisor: [
    { href: '/supervisor', label: 'Dashboard en vivo', icon: LayoutDashboard },
    { href: '/supervisor/queues', label: 'Colas', icon: ListTree },
    { href: '/supervisor/agents', label: 'Agentes', icon: HeadphonesIcon },
    { href: '/supervisor/calls', label: 'Llamadas', icon: PhoneCall },
    { href: '/supervisor/recordings', label: 'Grabaciones', icon: FileText },
    { href: '/supervisor/reports', label: 'Reportes', icon: FileText },
    { href: '/supervisor/quality', label: 'Calidad', icon: ClipboardCheck },
  ],
  agent: [
    { href: '/agent', label: 'Mi escritorio', icon: LayoutDashboard },
    { href: '/agent/dialer', label: 'Marcador', icon: PhoneOutgoing },
    { href: '/agent/incoming-call', label: 'Llamada entrante', icon: PhoneIncoming },
    { href: '/agent/customers', label: 'Clientes', icon: Users },
    { href: '/agent/history', label: 'Mi historial', icon: FileText },
  ],
};

function pickPrimaryRole(roles: string[]): keyof typeof NAV_BY_ROLE {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('company_admin')) return 'company_admin';
  if (roles.includes('supervisor')) return 'supervisor';
  return 'agent';
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const realtime = useRealtime();
  const sip = useSip();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Iniciar SIP automáticamente para agentes
  useEffect(() => {
    if (!user) return;
    if (user.roles.includes('agent') && sip.state === 'idle') {
      void sip.start();
    }
  }, [user, sip]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>;
  }

  const role = pickPrimaryRole(user.roles);
  const items = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-brand-500/20"><HeadphonesIcon className="w-5 h-5 text-brand-300" /></div>
          <div>
            <div className="font-semibold text-sm">Call Center NODOE</div>
            <div className="text-xs text-slate-400">{role.replace('_', ' ')}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-0.5">
          {items.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3 space-y-2">
          <div className="px-2">
            <div className="text-sm font-medium truncate">{user.full_name || user.email}</div>
            <div className="text-xs text-slate-400 truncate">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-slate-900">{titleFromPath(pathname)}</h1>
          <div className="flex items-center gap-3 text-xs">
            {role === 'agent' && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
                sip.state === 'registered' ? 'bg-emerald-100 text-emerald-700' :
                sip.state === 'connecting' ? 'bg-amber-100 text-amber-700' :
                sip.state === 'failed' ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`} title={sip.error ?? ''}>
                ● SIP {sip.state}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
              realtime.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              ● {realtime.connected ? 'realtime' : 'offline'}
            </span>
            <span className="text-slate-500">
              {user.company_id ? `Empresa #${user.company_id}` : 'Sin empresa'}
            </span>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
      <IncomingCallPopup />
    </div>
  );
}

function titleFromPath(p: string): string {
  const last = p.split('/').filter(Boolean).pop() ?? 'Inicio';
  return last
    .replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}
