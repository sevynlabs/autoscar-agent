'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fully public, standalone pages (no auth, no sidebar/app chrome).
  const isPublicPage =
    pathname === '/login' ||
    pathname?.startsWith('/atendimento') ||
    pathname?.startsWith('/passo1');

  useEffect(() => {
    if (!isLoading && !user && !isPublicPage) {
      router.replace('/login');
    }
  }, [user, isLoading, isPublicPage, router]);

  // Close mobile drawer on route change (only when pathname actually changes)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  if (!user) return null;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0f0f0f]/90 backdrop-blur border-b border-neutral-200 dark:border-white/[0.06] h-14 flex items-center px-3 gap-3 pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="h-9 w-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/favicon-autoscar.png" alt="Autoscar" className="h-6 w-6" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">Autoscar CRM</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[260px] shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
