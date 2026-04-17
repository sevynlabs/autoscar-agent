'use client';

import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  const isIPadOS = nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS] = useState(() => (typeof window !== 'undefined' ? isIOSDevice() : false));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', onBip);

    if (isIOS) {
      const timer = setTimeout(() => setShow(true), 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBip);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, [isIOS]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setShow(false);
    else dismiss();
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[60]">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center">
              <img src="/favicon-autoscar.png" alt="Autoscar" className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Instalar Autoscar CRM</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Acesso rápido direto do seu celular, em tela cheia.
              </p>
            </div>
            <button onClick={dismiss} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS ? (
            <div className="mt-3 space-y-2 text-[12px] text-neutral-600 dark:text-neutral-400">
              <p className="flex items-center gap-1.5">
                <span>1. Toque em</span>
                <Share className="h-3.5 w-3.5 text-blue-500 inline" />
                <span>Compartilhar</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span>2. Toque em</span>
                <Plus className="h-3.5 w-3.5 inline" />
                <span>Adicionar à Tela de Início</span>
              </p>
            </div>
          ) : (
            <button
              onClick={install}
              disabled={!deferred}
              className="mt-3 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar app
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
