'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, MessageSquare, Settings, Webhook, Users, LogOut, Car, Bot, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/crm', label: 'CRM', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/settings/pipeline', label: 'Pipeline', icon: Settings },
  { href: '/settings/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/admin/users', label: 'Usuários', icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const visibleItems = navItems.filter(item =>
    !('adminOnly' in item && item.adminOnly) || user?.role === 'admin'
  );

  return (
    <aside className="w-60 bg-white dark:bg-[#0f0f0f] flex flex-col h-full border-r border-neutral-200 dark:border-white/[0.06]">
      {/* Logo */}
      <div className="p-5 border-b border-neutral-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <Car className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-white">Autoscar</h1>
            <p className="text-[11px] text-neutral-400">Agent SDR</p>
          </div>
        </div>
      </div>

      {/* AI Status */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/10">
          <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-xs text-green-700 dark:text-green-400 font-medium">IA Ativa</span>
          <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold px-3 mb-2">Menu</p>
        {visibleItems.map(item => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-medium border border-red-200 dark:border-red-500/20'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.04] hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}>
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
              {item.href === '/inbox' && (
                <Badge className="ml-auto bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] px-1.5 py-0 h-5 border-0">AI</Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div className="p-3 border-t border-neutral-200 dark:border-white/[0.06] space-y-2">
        <button onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.04] w-full transition-colors cursor-pointer">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
        </button>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-sm font-bold text-red-600 dark:text-red-400">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{user.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">{user.role}</p>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
