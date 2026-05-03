'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/realtime-context';
import { useSip } from '@/lib/webrtc/sip-context';
import { IncomingCallPopup } from '@/components/agent/IncomingCallPopup';
import { tokens } from '@/lib/api/client';
import { ShieldAlert } from 'lucide-react';
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
  User as UserIcon,
  ChevronDown,
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

interface NavSection {
  title?: string;  // titulo del grupo (si no hay → seccion sin header, items sueltos)
  items: NavItem[];
}

// Helper para items planos (compat con la lista vieja)
function flat(items: NavItem[]): NavSection[] {
  return [{ items }];
}

const NAV_BY_ROLE: Record<string, NavSection[]> = {
  super_admin: [
    { items: [
      { href: '/super-admin', label: '🌐 Dashboard SaaS', icon: LayoutDashboard },
      { href: '/super-admin/companies', label: '🏢 Empresas', icon: Building2 },
      { href: '/super-admin/users', label: '👥 Todos los usuarios', icon: Users },
      { href: '/super-admin/plans', label: '💳 Planes', icon: CreditCard },
      { href: '/super-admin/audit', label: '🛡️ Auditoría', icon: ShieldCheck },
      { href: '/super-admin/security', label: '🔒 Seguridad (fail2ban)', icon: ShieldCheck },
      { href: '/super-admin/monitoring', label: '📡 Monitoreo', icon: Activity },
    ] },
    { title: '── Vista Empresa ──', items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/live', label: 'Monitoreo en vivo', icon: Activity },
    ] },
    ...adminCompanySections(),
    { title: '── Supervisor ──', items: [
      { href: '/supervisor', label: 'Supervisor', icon: Activity },
      { href: '/supervisor/calls', label: 'Llamadas', icon: PhoneCall },
    ] },
  ],
  company_admin: [
    { items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/live', label: 'Monitoreo en vivo', icon: Activity },
    ] },
    ...adminCompanySections(),
  ],
  supervisor: flat([
    { href: '/supervisor', label: 'Dashboard en vivo', icon: LayoutDashboard },
    { href: '/supervisor/queues', label: 'Colas', icon: ListTree },
    { href: '/supervisor/agents', label: 'Agentes', icon: HeadphonesIcon },
    { href: '/supervisor/calls', label: 'Llamadas', icon: PhoneCall },
    { href: '/supervisor/recordings', label: 'Grabaciones', icon: FileText },
    { href: '/supervisor/reports', label: 'Reportes', icon: FileText },
    { href: '/supervisor/quality', label: 'Calidad', icon: ClipboardCheck },
  ]),
  agent: flat([
    { href: '/agent/dialer', label: 'Marcador', icon: PhoneOutgoing },
    { href: '/agent', label: 'Reportes', icon: LayoutDashboard },
    { href: '/agent/customers', label: 'Clientes', icon: Users },
  ]),
};

// Secciones agrupadas para admin de empresa (compartido entre super_admin y company_admin).
function adminCompanySections(): NavSection[] {
  return [
    { title: 'Configuración', items: [
      { href: '/admin/sip-trunks', label: 'Troncales SIP', icon: PhoneCall },
      { href: '/admin/asterisk', label: 'Asterisk', icon: PhoneCall },
      { href: '/admin/test-calls', label: 'Pruebas de llamada', icon: Activity },
      { href: '/admin/queues', label: 'Colas', icon: ListTree },
      { href: '/admin/schedules', label: 'Horarios', icon: Activity },
      { href: '/admin/ivr', label: 'IVR', icon: Mic },
      { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/admin/dnc', label: 'Lista DNC', icon: ShieldCheck },
    ] },
    { title: 'IA', items: [
      { href: '/admin/ai-providers', label: 'Proveedores IA', icon: KeyRound },
      { href: '/admin/ai-bots', label: 'Bots IA', icon: Bot },
      { href: '/admin/ai-prompts', label: 'Prompts IA', icon: Wrench },
    ] },
    { title: 'Mensajería', items: [
      { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquare },
      { href: '/admin/sms-providers', label: 'Proveedores SMS', icon: KeyRound },
      { href: '/admin/sms', label: 'Enviar SMS', icon: MessageSquare },
      { href: '/admin/automations', label: 'Automatizaciones', icon: Workflow },
    ] },
    { title: 'Reportes', items: [
      { href: '/admin/reports', label: 'Reportes', icon: FileText },
      { href: '/admin/recordings', label: 'Grabaciones', icon: FileText },
      { href: '/admin/storage-providers', label: 'Almacenamiento', icon: HardDrive },
    ] },
    { title: 'CRM', items: [
      { href: '/admin/customers', label: 'Clientes / CRM', icon: Users },
      { href: '/admin/imports', label: 'Importar clientes', icon: Database },
      { href: '/admin/campaigns', label: 'Campañas', icon: Megaphone },
    ] },
    { title: 'Marca', items: [
      { href: '/admin/settings', label: 'Configuración', icon: Settings },
    ] },
    { title: 'Usuarios', items: [
      { href: '/admin/users', label: 'Usuarios', icon: Users },
      { href: '/admin/agents', label: 'Agentes', icon: HeadphonesIcon },
      { href: '/admin/dispositions', label: 'Tipificaciones', icon: ClipboardCheck },
      { href: '/admin/quality', label: 'Calidad', icon: ClipboardCheck },
    ] },
    { title: 'Cuenta', items: [
      { href: '/admin/billing', label: 'Facturación', icon: CreditCard },
      { href: '/admin/maintenance', label: 'Mantenimiento', icon: Wrench },
    ] },
  ];
}

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
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    setImpersonating(tokens.isImpersonating());
  }, [user]);

  function endImpersonation() {
    if (typeof window === 'undefined') return;
    sessionStorage.clear();
    window.close(); // intenta cerrar la pestaña
    // Si window.close no funciona (no fue abierta por script), redirige
    setTimeout(() => { window.location.href = 'about:blank'; }, 200);
  }

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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {impersonating && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 flex items-center justify-between shadow-md z-20">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="w-4 h-4" />
            <span>
              Modo impersonation activo — viendo como <strong>{user?.email}</strong>
              {user?.company_id ? ` (Empresa #${user.company_id})` : ''}
            </span>
          </div>
          <button
            onClick={endImpersonation}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold backdrop-blur-sm transition"
          >
            Salir de impersonation
          </button>
        </div>
      )}
    <div className="flex flex-1 min-h-0">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-brand-500/20"><HeadphonesIcon className="w-5 h-5 text-brand-300" /></div>
          <div>
            <div className="font-semibold text-sm">Call Center NODOE</div>
            <div className="text-xs text-slate-400">{role.replace('_', ' ')}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-3">
          {/* Item activo = el href MAS LARGO que matchea la ruta actual
              (entre TODOS los items de TODAS las secciones). Asi 2 items
              de secciones distintas no se marcan a la vez. */}
          {(() => {
            const allItems = items.flatMap(s => s.items);
            const matching = allItems.filter(it => pathname === it.href || pathname.startsWith(it.href + '/'));
            const activeHref = matching.length > 0
              ? matching.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href
              : null;
            return items.map((section, sIdx) => (
              <div key={section.title ?? `s-${sIdx}`}>
                {section.title && (
                  <div className="px-3 mb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const active = item.href === activeHref;
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
                </div>
              </div>
            ));
          })()}
        </nav>
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
            <UserMenu user={user} role={role} onLogout={logout} />
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
      <IncomingCallPopup />
    </div>
    </div>
  );
}

function titleFromPath(p: string): string {
  const last = p.split('/').filter(Boolean).pop() ?? 'Inicio';
  return last
    .replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

function UserMenu({ user, role, onLogout }: { user: { full_name?: string; email: string }; role: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const name = user.full_name || user.email;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
      >
        <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
          {initial}
        </span>
        <span className="text-sm font-medium text-slate-700 max-w-[140px] truncate">{name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          {/* Click outside cierra el menu */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{role.replace('_', ' ')}</div>
            </div>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
