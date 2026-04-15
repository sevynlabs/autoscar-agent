import prisma from './prisma.js';

const INTERVAL_MS = 4 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export function startDbKeepalive() {
  if (timer) return;

  const ping = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      console.log(
        JSON.stringify({
          level: 'warn',
          msg: '[db-keepalive] ping failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  timer = setInterval(ping, INTERVAL_MS);
  if (timer.unref) timer.unref();

  ping();
}

export function stopDbKeepalive() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
