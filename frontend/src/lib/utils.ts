import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Display phone for a lead. Web chat (/atendimento) leads use a synthetic
 * `web:<uuid>` as the routing key, so the real number lives in contactPhone.
 * Returns '' when there's no real number to show.
 */
export function leadPhone(lead: { phone?: string | null; contactPhone?: string | null }): string {
  const c = lead.contactPhone?.trim();
  if (c) return c;
  const p = lead.phone?.trim();
  if (!p || p.startsWith('web:')) return '';
  return p;
}
