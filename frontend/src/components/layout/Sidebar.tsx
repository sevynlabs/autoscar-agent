'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Settings, BarChart3, Users, Webhook, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';

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

  const visibleItems = navItems.filter(item =>
    !('adminOnly' in item && item.adminOnly) || user?.role === 'admin'
  );

  return (
    <aside className="w-56 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">Autoscar</h1>
        <p className="text-xs text-muted-foreground">CRM Automotivo</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {visibleItems.map(item => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="p-3 border-t">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <Button variant="ghost" size="sm" className="w-full mt-2 justify-start" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      )}
    </aside>
  );
}
