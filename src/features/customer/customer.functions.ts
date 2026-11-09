import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { requestSchema, consentSchema } from './schema';
export const getCustomerData = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const [consent, profile, requests] = await Promise.all([
    supabase.from('consents').select('privacy_version').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('display_name,phone').eq('id', userId).maybeSingle(),
    supabase.from('service_requests').select('*').eq('customer_id', userId).order('created_at', { ascending:false }),
  ]);
  if (consent.error || profile.error || requests.error) throw new Error('Your requests could not be loaded. Please try again.');
  return { consent: !!consent.data, profile:profile.data, requests:requests.data ?? [] };
});
export const acceptPrivacy = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator((input:unknown) => consentSchema.parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc('accept_pilot_privacy', { p_name:data.name, ...(data.phone ? { p_phone:data.phone } : {}) });
  if(result.error) throw new Error('Consent could not be saved. Please try again.');
  return { saved:true };
});
export const createRequest = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator((input:unknown) => requestSchema.parse(input)).handler(async ({ data, context }) => {
  const { data:id, error } = await context.supabase.rpc('create_service_request', { p_category:data.category, p_title:data.title, p_description:data.description, p_area:data.area, p_timing:data.timing, p_key:data.key });
  if(error) throw new Error(error.message.includes('5 requests') ? 'You can save up to 5 requests per hour. Please try later.' : 'Your request could not be saved. Check your consent and try again.');
  return id;
});
export const cancelRequest = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator((input:unknown) => z.object({ id:z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc('cancel_service_request', { p_id:data.id });
  if(result.error) throw new Error('This request cannot be cancelled. Refresh and try again.');
  return { cancelled:true };
});
export const getRequestEvents = createServerFn({ method:'GET' }).middleware([requireSupabaseAuth]).inputValidator((input:unknown) => z.object({ id:z.string().uuid() }).parse(input)).handler(async ({data,context}) => {
  const {data:events,error} = await context.supabase.from('request_events').select('id,status,note,created_at').eq('request_id',data.id).order('created_at');
  if(error) throw new Error('Request history could not be loaded.');
  return events;
});
