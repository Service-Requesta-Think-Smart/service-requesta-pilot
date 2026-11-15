import { z } from 'zod';
const uuid = z.string().uuid();
/** Parse a rand amount typed by a person ("1 250,50" or "1250.5") into integer cents. */
export function randToCents(value: string): number {
  const cleaned = value.replace(/[\sR]/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) throw new Error('Enter an amount in rand, e.g. 150 or 150.50');
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}
export const quoteSchema = z.object({
  requestId: uuid,
  scope: z.string().trim().min(20, 'Describe the scope in at least 20 characters.').max(3000),
  calloutCents: z.number().int().min(0), labourCents: z.number().int().min(0), partsCents: z.number().int().min(0),
  partsIsEstimate: z.boolean(),
  assumptions: z.string().trim().min(3, 'List at least one assumption.').max(2000),
  timing: z.string().trim().min(3, 'Give the expected timing.').max(300),
}).refine(q => q.calloutCents + q.labourCents + q.partsCents > 0, 'The quote total must be more than R0.');
export const quoteTotalCents = (q: { calloutCents: number; labourCents: number; partsCents: number }) => q.calloutCents + q.labourCents + q.partsCents;
export const idSchema = z.object({ requestId: uuid });
export const respondSchema = z.object({ requestId: uuid, decision: z.enum(['accepted', 'declined']) });
export const approveSchema = z.object({ requestId: uuid, quoteId: uuid, scopeConfirmed: z.literal(true), priceConfirmed: z.literal(true) });
export const advanceSchema = z.object({ requestId: uuid, to: z.enum(['in_progress', 'awaiting_completion']) });
export const reasonSchema = z.object({ requestId: uuid, reason: z.string().trim().min(20, 'Describe the issue in at least 20 characters.').max(3000) });
export const cancelSchema = z.object({ requestId: uuid, reason: z.string().trim().min(5, 'Give a reason.').max(1000) });
export const supportKinds = [['workmanship','Poor workmanship'],['safety','Unsafe behaviour'],['false_profile','False profile'],['payment','Payment disagreement'],['fraud','Suspected fraud'],['cancellation','Cancellation or refund'],['privacy','Privacy concern']] as const;
export const supportSchema = z.object({ requestId: uuid.nullable(), kind: z.enum(['false_profile','workmanship','safety','payment','completion','commission','cancellation','fraud','privacy']), description: z.string().trim().min(20, 'Describe the issue in at least 20 characters.').max(3000) });
export const applicationSchema = z.object({ businessName: z.string().trim().min(2).max(120), category: z.enum(['plumbing','electrical','motor_mechanics']), area: z.string().trim().min(2).max(100), availability: z.string().trim().min(2).max(500), qualificationSummary: z.string().trim().min(10, 'Describe training or experience in at least 10 characters.').max(1200), acceptPrivacy: z.literal(true) });
export const reviewSchema = z.object({ providerId: uuid, decision: z.enum(['approved','rejected']), identityStatus: z.enum(['not_checked','pending','checked']), tradeStatus: z.enum(['not_checked','pending','reviewed']), note: z.string().trim().min(3, 'Add a review note.').max(1000) })
  .refine(r => r.decision === 'rejected' || (r.identityStatus === 'checked' && r.tradeStatus === 'reviewed'), 'Both the identity check and trade-evidence review must be complete before approval.');
export const resolveSchema = z.object({ caseId: uuid, note: z.string().trim().min(5, 'Add a resolution reason.').max(2000), outcome: z.enum(['resume','cancel']).nullable() });
export const rand = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
export const statusLabel: Record<string, string> = { submitted:'Waiting for a provider', accepted:'Provider accepted', quoted:'Quote ready to review', approved:'Quote approved', in_progress:'Work in progress', awaiting_completion:'Awaiting completion checks', completed:'Completed', disputed:'Paused – dispute open', cancelled:'Cancelled' };
