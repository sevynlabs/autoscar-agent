'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';

interface BridgeConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  brandColor: string;
  avatarUrl: string | null;
  vehicleUrl: string | null;
  whatsappNumber: string | null;
}

function buildPrefill(vehicleUrl: string | null, codigo: string | null) {
  if (vehicleUrl) {
    return `Olá! Vi o anúncio e tenho interesse neste veículo: ${vehicleUrl}`;
  }
  if (codigo) {
    return `Olá! Vi o anúncio (cód. ${codigo}) e quero mais informações.`;
  }
  return 'Olá! Vi o anúncio e quero mais informações.';
}

function Passo1() {
  const params = useSearchParams();
  const codigo = params.get('codigo');
  const carro = params.get('carro') ?? params.get('url');

  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const qs = new URLSearchParams();
        if (carro) qs.set('carro', carro);
        if (codigo) qs.set('codigo', codigo);

        const res = await fetch(`/api/webchat/config?${qs.toString()}`);
        const cfg: BridgeConfig = await res.json();
        if (cancelled) return;
        setConfig(cfg);
        if (!cfg.whatsappNumber) {
          setError('O atendimento está indisponível no momento. Tente novamente em instantes.');
        }
      } catch {
        if (cancelled) return;
        setError('Não foi possível conectar. Verifique sua conexão e tente de novo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [carro, codigo]);

  const brand = config?.brandColor?.trim() || '#075E54';
  const title = config?.title?.trim() || 'Autoscar';

  const waLink = useMemo(() => {
    if (!config?.whatsappNumber) return null;
    const text = encodeURIComponent(buildPrefill(config.vehicleUrl, codigo));
    return `https://wa.me/${config.whatsappNumber}?text=${text}`;
  }, [config?.whatsappNumber, config?.vehicleUrl, codigo]);

  const initials = title
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${brand}14 0%, #f5f5f4 55%, #f5f5f4 100%)`,
      }}
    >
      <main className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-black/5">
        {/* Brand mark */}
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-white"
          style={{ backgroundColor: brand }}
        >
          {config?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.avatarUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold">{initials || 'AC'}</span>
          )}
        </div>

        <h1 className="mt-5 text-[22px] font-bold leading-tight text-neutral-900">
          Falta só um passo
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
          Continue seu atendimento com a equipe da{' '}
          <span className="font-semibold text-neutral-800">{title}</span> direto no WhatsApp. É
          rápido e sem compromisso.
        </p>

        {config?.vehicleUrl && (
          <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-2.5 text-[13px] font-medium text-neutral-600 ring-1 ring-black/5">
            🚗 Sobre o veículo do anúncio
          </div>
        )}

        {/* CTA */}
        {loading ? (
          <div className="mt-7 h-[52px] w-full animate-pulse rounded-full bg-neutral-100" />
        ) : error ? (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        ) : (
          <a
            href={waLink ?? '#'}
            className="mt-7 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
            style={{ backgroundColor: '#25D366' }}
          >
            <MessageCircle className="h-5 w-5" fill="currentColor" />
            Continuar no WhatsApp
          </a>
        )}

        {/* Trust row */}
        <ul className="mt-6 space-y-2 text-left text-[13px] text-neutral-500">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: brand }} />
            Resposta rápida de um atendente
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: brand }} />
            Sem custo e sem compromisso
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: brand }} />
            Seus dados ficam protegidos
          </li>
        </ul>
      </main>

      <p className="mt-6 text-center text-[12px] text-neutral-400">
        Atendimento {title}
      </p>
    </div>
  );
}

export default function Passo1Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f5f4] text-sm text-neutral-500">
          Carregando…
        </div>
      }
    >
      <Passo1 />
    </Suspense>
  );
}
