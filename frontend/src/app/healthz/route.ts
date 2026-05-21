// Lightweight liveness probe for the frontend container. Lives outside /api
// (which is proxied to the backend), so it answers from Next directly without
// rendering React — used by the Docker healthcheck in docker-compose.
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
  });
}
