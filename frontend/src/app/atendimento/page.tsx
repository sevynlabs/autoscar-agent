'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCheck, Phone, Send, Video } from 'lucide-react';

interface ChatMessage {
  role: 'lead' | 'agent';
  content: string;
  ts: number;
}

interface WebchatConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  brandColor: string;
  avatarUrl: string | null;
  welcome: string | null;
  vehicleUrl: string | null;
}

function storageKey(codigo: string | null, carro: string | null) {
  return `autoscar_webchat_session::${codigo ?? ''}::${carro ?? ''}`;
}

function AtendimentoChat() {
  const params = useSearchParams();
  const codigo = params.get('codigo');
  const carro = params.get('carro') ?? params.get('url');

  const [config, setConfig] = useState<WebchatConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expect, setExpect] = useState<'name' | 'phone' | 'text'>('text');

  const sessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentTyping, scrollToBottom]);

  // Boot: load branding, resume or start a session.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const qs = new URLSearchParams();
        if (carro) qs.set('carro', carro);
        if (codigo) qs.set('codigo', codigo);

        const cfgRes = await fetch(`/api/webchat/config?${qs.toString()}`);
        const cfg: WebchatConfig = await cfgRes.json();
        if (cancelled) return;
        setConfig(cfg);

        if (!cfg.enabled) {
          setError('O atendimento online está indisponível no momento. Tente novamente mais tarde.');
          setBooting(false);
          return;
        }

        const key = storageKey(codigo, carro);
        const existing = typeof window !== 'undefined' ? localStorage.getItem(key) : null;

        if (existing) {
          sessionRef.current = existing;
          const histRes = await fetch(
            `/api/webchat/history?sessionId=${encodeURIComponent(existing)}`,
          );
          const hist = await histRes.json();
          if (cancelled) return;
          if (Array.isArray(hist.messages) && hist.messages.length > 0) {
            setMessages(
              hist.messages.map((m: { role: 'lead' | 'agent'; content: string }) => ({
                ...m,
                ts: Date.now(),
              })),
            );
            if (hist.expect) setExpect(hist.expect);
            setBooting(false);
            return;
          }
        }

        // Fresh session — backend runs the Typebot-style opener.
        setAgentTyping(true);
        const sesRes = await fetch('/api/webchat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carro: carro ?? undefined, codigo: codigo ?? undefined }),
        });
        const ses = await sesRes.json();
        if (cancelled) return;

        if (!sesRes.ok) {
          setError(ses?.error ?? 'Não foi possível iniciar o atendimento.');
          setBooting(false);
          setAgentTyping(false);
          return;
        }

        sessionRef.current = ses.sessionId;
        if (typeof window !== 'undefined') localStorage.setItem(key, ses.sessionId);

        const opener: ChatMessage[] = (ses.messages ?? []).map(
          (m: { role: 'lead' | 'agent'; content: string }) => ({ ...m, ts: Date.now() }),
        );
        setAgentTyping(false);
        setMessages(
          opener.length > 0
            ? opener
            : cfg.welcome
              ? [{ role: 'agent', content: cfg.welcome, ts: Date.now() }]
              : [],
        );
        if (ses.expect) setExpect(ses.expect);
        setBooting(false);
      } catch {
        if (cancelled) return;
        setError('Não foi possível conectar ao atendimento. Verifique sua conexão.');
        setBooting(false);
        setAgentTyping(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [carro, codigo]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionRef.current) return;

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'lead', content: text, ts: Date.now() }]);
    setAgentTyping(true);

    try {
      const res = await fetch('/api/webchat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionRef.current, message: text, field: expect }),
      });
      const data = await res.json();
      setAgentTyping(false);
      if (data?.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'agent', content: String(data.reply), ts: Date.now() },
        ]);
      }
      setExpect(data?.expect ?? 'text');
    } catch {
      setAgentTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: 'Ops, não consegui enviar agora. Pode tentar de novo? 😊',
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, expect]);

  const brand = config?.brandColor ?? '#075E54';
  const title = config?.title ?? 'Autoscar';
  const subtitle = agentTyping ? 'digitando…' : config?.subtitle ?? 'online';
  const initials = title
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-[#e5ddd5]">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-3 py-2.5 text-white shadow-md pt-[max(0.625rem,env(safe-area-inset-top))]"
        style={{ backgroundColor: brand }}
      >
        <ArrowLeft className="h-5 w-5 shrink-0 opacity-90" />
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/25">
          {config?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.avatarUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
              {initials || 'AC'}
            </span>
          )}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{title}</p>
          <p className="truncate text-xs leading-tight text-white/80">{subtitle}</p>
        </div>
        <Video className="h-5 w-5 opacity-90" />
        <Phone className="h-5 w-5 opacity-90" />
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 py-4"
        style={{
          backgroundColor: '#e5ddd5',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M0 0h20v20H0zM20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          <div className="mx-auto mb-3 rounded-lg bg-[#fcf4cb] px-3 py-1 text-center text-[11px] text-neutral-600 shadow-sm">
            🔒 As mensagens são protegidas. Atendimento Autoscar.
          </div>

          {config?.vehicleUrl && (
            <a
              href={config.vehicleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mb-2 rounded-lg bg-white/90 px-3 py-1.5 text-center text-[12px] font-medium text-neutral-700 shadow-sm hover:bg-white"
            >
              🚗 Veículo do anúncio · toque para ver as fotos
            </a>
          )}

          {error && (
            <div className="mx-auto my-8 max-w-sm rounded-lg bg-white px-4 py-3 text-center text-sm text-neutral-600 shadow">
              {error}
            </div>
          )}

          {booting && !error && (
            <div className="mx-auto my-8 text-sm text-neutral-500">Conectando…</div>
          )}

          {messages.map((m, i) => {
            const mine = m.role === 'lead';
            return (
              <div
                key={i}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-[14.5px] leading-snug shadow-sm ${
                    mine
                      ? 'rounded-tr-none bg-[#d9fdd3] text-neutral-800'
                      : 'rounded-tl-none bg-white text-neutral-800'
                  }`}
                >
                  {m.content}
                  <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-neutral-500">
                    {new Date(m.ts).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {mine && <CheckCheck className="h-3 w-3 text-sky-500" />}
                  </span>
                </div>
              </div>
            );
          })}

          {agentTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Contextual field hint */}
      {!booting && !error && (expect === 'name' || expect === 'phone') && (
        <div className="bg-[#f0f0f0] px-3 pt-2">
          <div
            className="mx-auto flex max-w-2xl items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600 shadow-sm"
          >
            <span>{expect === 'name' ? '✏️' : '📱'}</span>
            <span>
              {expect === 'name'
                ? 'Digite seu nome e toque em enviar'
                : 'Digite seu WhatsApp com DDD e toque em enviar'}
            </span>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 bg-[#f0f0f0] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 items-center rounded-full bg-white px-4 py-2 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            inputMode={expect === 'phone' ? 'tel' : 'text'}
            autoFocus={expect === 'name' || expect === 'phone'}
            placeholder={
              booting
                ? 'Conectando…'
                : expect === 'name'
                  ? 'Seu nome…'
                  : expect === 'phone'
                    ? 'Ex.: 31 99999-9999'
                    : 'Mensagem'
            }
            disabled={booting || !!error}
            className="max-h-28 flex-1 resize-none bg-transparent text-[15px] text-neutral-800 outline-none placeholder:text-neutral-400 disabled:opacity-60"
          />
        </div>
        <button
          onClick={send}
          disabled={!input.trim() || sending || booting || !!error}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: brand }}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#e5ddd5] text-sm text-neutral-500">
          Carregando atendimento…
        </div>
      }
    >
      <AtendimentoChat />
    </Suspense>
  );
}
