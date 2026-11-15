import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import * as s from './schema';

// Database functions own every rule; these wrappers validate input and translate errors into plain messages.
function friendly(error: { message: string } | null, fallback: string): void {
  if (!error) return;
  const known = ['Confirm both','newer quote','expired','already','Only the','Invalid job transition','not open','cannot','required','Describe','Give','Limit of','Choose','Complete the identity','Add a','available only after','no longer','stage','Quote amounts','Check the quote'];
  console.error('[marketplace]', error.message);
  throw new Error(known.some(k => error.message.includes(k)) ? error.message : fallback);
}

export const getMyAccount = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const [roles, consent, provider, flags] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('consents').select('privacy_version').eq('user_id', userId).maybeSingle(),
    supabase.from('provider_profiles').select('business_name,category,area,availability,qualification_summary,application_status,identity_status,trade_status,review_note,reviewed_at').eq('user_id', userId).maybeSingle(),
    supabase.from('feature_flags').select('name,enabled'),
  ]);
  if (roles.error || consent.error || provider.error || flags.error) throw new Error('Your account could not be loaded.');
  return { roles: (roles.data ?? []).map(r => r.role), consent: !!consent.data, provider: provider.data, bookingsOpen: (flags.data ?? []).some(f => f.name === 'public_bookings' && f.enabled) };
});

export const chooseProviderPath = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { error } = await context.supabase.rpc('select_account_type', { p_account_type: 'provider' });
  friendly(error, 'Your account type could not be changed.'); return { ok: true };
});

export const submitApplication = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.applicationSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('submit_provider_application', { p_business_name: data.businessName, p_category: data.category, p_area: data.area, p_availability: data.availability, p_qualification_summary: data.qualificationSummary, p_accept_privacy: data.acceptPrivacy });
  friendly(error, 'Your application could not be saved.'); return { ok: true };
});

export const getProviderJobs = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const reqs = await supabase.from('service_requests').select('id,category,title,description,area,timing,status,created_at').eq('is_demo', false).neq('customer_id', userId).order('created_at', { ascending: false }).limit(50);
  if (reqs.error) throw new Error('Your request inbox could not be loaded.');
  const ids = (reqs.data ?? []).map(r => r.id);
  const quotes = ids.length ? await supabase.from('quotes').select('*').in('request_id', ids).order('version', { ascending: false }) : { data: [], error: null };
  if (quotes.error) throw new Error('Quotes could not be loaded.');
  return { requests: reqs.data ?? [], quotes: quotes.data ?? [] };
});

export const respondToRequest = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.respondSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('marketplace_respond_to_request', { p_request_id: data.requestId, p_decision: data.decision });
  friendly(error, 'Your response could not be saved.'); return { ok: true };
});

export const submitQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.quoteSchema.parse(i)).handler(async ({ data, context }) => {
  const { data: id, error } = await context.supabase.rpc('marketplace_submit_quote', { p_request_id: data.requestId, p_scope: data.scope, p_callout_cents: data.calloutCents, p_labour_cents: data.labourCents, p_parts_cents: data.partsCents, p_parts_is_estimate: data.partsIsEstimate, p_assumptions: data.assumptions, p_timing: data.timing });
  friendly(error, 'Your quote could not be sent.'); return { id };
});

export const advanceJob = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.advanceSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('marketplace_advance_job', { p_request_id: data.requestId, p_to: data.to });
  friendly(error, 'The job could not be updated.'); return { ok: true };
});

export const getProviderContact = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.idSchema.parse(i)).handler(async ({ data, context }) => {
  const { data: rows, error } = await context.supabase.rpc('marketplace_get_provider_contact', { p_request_id: data.requestId });
  friendly(error, 'Contact details are not available.'); return rows?.[0] ?? null;
});

export const getJobForCustomer = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.idSchema.parse(i)).handler(async ({ data, context }) => {
  const { supabase, userId } = context;
  const [quotes, approved, confirmations] = await Promise.all([
    supabase.from('quotes').select('*').eq('request_id', data.requestId).order('version', { ascending: false }),
    supabase.from('approved_quotes').select('snapshot,approved_at').eq('request_id', data.requestId).maybeSingle(),
    supabase.from('completion_confirmations').select('user_id,confirmed_at').eq('request_id', data.requestId),
  ]);
  if (quotes.error || approved.error || confirmations.error) throw new Error('Job details could not be loaded.');
  return { quotes: quotes.data ?? [], approved: approved.data, confirmedByMe: (confirmations.data ?? []).some(c => c.user_id === userId), confirmations: (confirmations.data ?? []).length };
});

export const approveQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.approveSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('marketplace_approve_quote', { p_request_id: data.requestId, p_quote_id: data.quoteId, p_scope_confirmed: data.scopeConfirmed, p_price_confirmed: data.priceConfirmed });
  friendly(error, 'The quote could not be approved.'); return { ok: true };
});

export const confirmCompletion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.idSchema.parse(i)).handler(async ({ data, context }) => {
  const { data: result, error } = await context.supabase.rpc('marketplace_confirm_completion', { p_request_id: data.requestId });
  friendly(error, 'Completion could not be confirmed.'); return { result };
});

export const cancelJob = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.cancelSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('marketplace_cancel_job', { p_request_id: data.requestId, p_reason: data.reason });
  friendly(error, 'The job could not be cancelled.'); return { ok: true };
});

export const openDispute = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.reasonSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('marketplace_open_dispute', { p_request_id: data.requestId, p_reason: data.reason });
  friendly(error, 'The dispute could not be opened.'); return { ok: true };
});

export const openSupportCase = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.supportSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('open_support_case', { p_request_id: data.requestId as string, p_kind: data.kind, p_description: data.description });
  friendly(error, 'Your support case could not be opened.'); return { ok: true };
});

export const getMySupportCases = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('support_cases').select('id,kind,status,description,resolution_note,created_at,resolved_at,request_id').eq('opened_by', context.userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error('Support cases could not be loaded.'); return data ?? [];
});

// ---- Admin (database functions re-check the admin role on every call) ----
export const getAdminQueue = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!isAdmin) return { isAdmin: false as const, applications: [], cases: [], audit: [] };
  const [apps, cases, audit] = await Promise.all([
    supabase.from('provider_profiles').select('user_id,business_name,category,area,availability,qualification_summary,application_status,identity_status,trade_status,submitted_at,review_note').order('submitted_at', { ascending: false }).limit(50),
    supabase.from('support_cases').select('id,kind,status,description,request_id,created_at,resolution_note').order('created_at', { ascending: false }).limit(50),
    supabase.from('audit_events').select('id,action,entity_id,created_at,details').order('created_at', { ascending: false }).limit(30),
  ]);
  if (apps.error || cases.error || audit.error) throw new Error('The admin queue could not be loaded.');
  return { isAdmin: true as const, applications: apps.data ?? [], cases: cases.data ?? [], audit: audit.data ?? [] };
});

export const reviewApplication = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.reviewSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('review_provider_application', { p_provider_id: data.providerId, p_decision: data.decision, p_identity_status: data.identityStatus, p_trade_status: data.tradeStatus, p_note: data.note });
  friendly(error, 'The review could not be recorded.'); return { ok: true };
});

export const resolveCase = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => s.resolveSchema.parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('admin_resolve_support_case', { p_case_id: data.caseId, p_note: data.note, p_dispute_outcome: data.outcome as string });
  friendly(error, 'The case could not be resolved.'); return { ok: true };
});
