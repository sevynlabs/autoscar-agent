'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // In PWA standalone mode, default "keep me signed in" to ON so the user
  // doesn't have to log in every time they reopen the installed app.
  useEffect(() => {
    if (!detectStandalone()) setRemember(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, remember);
      router.push('/dashboard');
    } catch {
      setError('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white dark:bg-[#0a0a0a]">
      {/* Background accents */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/5 dark:bg-red-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-white/10 rounded-2xl p-8 shadow-xl shadow-red-500/5">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/logo-autoscar.png" alt="Autoscar" className="h-14 object-contain" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Plataforma de Atendimento Automotivo com IA</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-neutral-700 dark:text-neutral-300">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required
                className="h-11 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 placeholder:text-neutral-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-neutral-700 dark:text-neutral-300">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required
                className="h-11 bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 placeholder:text-neutral-400" />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setRemember(v => !v)}
                aria-pressed={remember}
                aria-label="Manter conectado"
                className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                  remember
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-neutral-50 dark:bg-white/5 border-neutral-300 dark:border-white/20 text-transparent'
                }`}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <span onClick={() => setRemember(v => !v)} className="text-sm text-neutral-700 dark:text-neutral-300">
                Manter conectado neste dispositivo
              </span>
            </label>

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-2.5">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white font-medium cursor-pointer transition-colors">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</> : 'Entrar'}
            </Button>
          </form>
          <p className="text-xs text-center text-neutral-400 mt-6">Autoscar Agent v1.0 — SDR com Inteligência Artificial</p>
        </div>
      </div>
    </div>
  );
}
