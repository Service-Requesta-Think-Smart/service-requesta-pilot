import { z } from 'zod';
export const categories = [
  { value: 'plumbing', label: 'Plumbing', detail: 'Leaks, pipes & installations' },
  { value: 'electrical', label: 'Electrical work', detail: 'Wiring, power & repairs' },
  { value: 'motor_mechanics', label: 'Motor mechanics', detail: 'Servicing, faults & repairs' },
] as const;
export const requestSchema = z.object({
  category: z.enum(['plumbing', 'electrical', 'motor_mechanics']),
  title: z.string().trim().min(5, 'Give your request a title of at least 5 characters.').max(120),
  description: z.string().trim().min(20, 'Add at least 20 characters about the work.').max(2000),
  area: z.string().trim().min(2, 'Enter your East London suburb.').max(100),
  timing: z.enum(['flexible', 'this_week', 'as_soon_as_possible']),
  key: z.string().uuid(),
});
export function normalizePhone(value: string) {
  const cleaned = value.replace(/[\s()-]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.startsWith('0') ? `+27${cleaned.slice(1)}` : cleaned;
  return z.string().regex(/^\+27[0-9]{9}$/, 'Enter a South African phone number.').parse(normalized);
}
export const consentSchema = z.object({ name: z.string().trim().min(1).max(100), phone: z.string().max(30).nullable().transform(value => normalizePhone(value ?? '')), accepted: z.literal(true) });
export function formatDate(value: string) { return new Intl.DateTimeFormat('en-ZA', { day:'2-digit', month:'short', year:'numeric', timeZone:'Africa/Johannesburg' }).format(new Date(value)); }
export function commissionCents(base: number, bps = 1500) { if (!Number.isSafeInteger(base) || base < 0 || !Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error('Invalid money'); const result = (BigInt(base) * BigInt(bps) + 5000n) / 10000n; if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount too large'); return Number(result); }
