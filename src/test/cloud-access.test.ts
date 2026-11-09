import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
const token=process.env['PILOT_TEST_TOKEN'];
const url=process.env['PILOT_TEST_URL'];
const key=process.env['PILOT_TEST_KEY'];
const uid=process.env['PILOT_TEST_UID'];
// Opt-in live tests use the requesting user's approved session, never a service key.
const suite = token && url && key && uid ? describe : describe.skip;
suite('Live pilot access rules',()=>{
 function client(authenticated=true){return createClient(url ?? '',key ?? '',{auth:{persistSession:false,autoRefreshToken:false},global:{headers:authenticated?{Authorization:`Bearer ${token}`}:{}}});}
 it('anonymous users cannot read customer requests',async()=>{
  const result=await client(false).from('service_requests').select('id');expect(result.data ?? []).toEqual([]);
 });
 it('customers can read only their own persisted requests',async()=>{
  const result=await client().from('service_requests').select('customer_id,is_demo');expect(result.error).toBeNull();expect(result.data?.length).toBeGreaterThan(0);for(const row of result.data ?? []){expect(row.customer_id).toBe(uid);expect(row.is_demo).toBe(true);}
 });
 it('customers cannot read another account profile',async()=>{
  const result=await client().from('profiles').select('id').eq('id','11111111-1111-4111-8111-111111111111');expect(result.error).toBeNull();expect(result.data).toEqual([]);
 });
 it('customers cannot self-assign admin',async()=>{
  const result=await client().from('user_roles').insert({user_id:uid,role:'admin'});expect(result.error).not.toBeNull();
 });
 it('customers cannot bypass request mutation rules',async()=>{
  const c=client();
  const before=await c.from('service_requests').select('id,status').eq('customer_id',uid).order('id');
  expect(before.error).toBeNull();expect(before.data?.length).toBeGreaterThan(0);
  await c.from('service_requests').update({status:'completed'}).eq('customer_id',uid);
  const after=await c.from('service_requests').select('id,status').eq('customer_id',uid).order('id');
  expect(after.error).toBeNull();expect(after.data).toEqual(before.data);
 });
 it('unknown request cancellation is rejected server-side',async()=>{
  const result=await client().rpc('cancel_service_request',{p_id:'11111111-1111-4111-8111-111111111111'});expect(result.error).not.toBeNull();
 });
 it('server rejects a fourth service category',async()=>{
  const result=await client().rpc('create_service_request',{p_category:'cleaning',p_title:'Demonstration invalid category',p_description:'Demonstration security test must not create a request.',p_area:'Beacon Bay',p_timing:'flexible',p_key:crypto.randomUUID()});expect(result.error).not.toBeNull();
 });
 it('customers cannot forge consent timestamps',async()=>{
  const result=await client().from('consents').insert({user_id:uid,privacy_version:'pilot-privacy-v1',accepted_at:'2000-01-01T00:00:00Z'});expect(result.error).not.toBeNull();
 });
 it('all five launch gates are explicitly off',async()=>{
  const result=await client().from('feature_flags').select('name,enabled');expect(result.error).toBeNull();expect(result.data).toHaveLength(5);for(const row of result.data ?? [])expect(row.enabled).toBe(false);
 });
 it('request creation is idempotent and cancellation has one outcome',async()=>{
  const c=client();const args={p_category:'electrical',p_title:'Demonstration idempotency check',p_description:'Demonstration only; no provider is contacted for this verification.',p_area:'Beacon Bay',p_timing:'flexible',p_key:crypto.randomUUID()};
  const first=await c.rpc('create_service_request',args);expect(first.error).toBeNull();expect(first.data).toBeTypeOf('string');
  const second=await c.rpc('create_service_request',args);expect(second.error).toBeNull();expect(second.data).toBe(first.data);
  const cancel=await c.rpc('cancel_service_request',{p_id:first.data});expect(cancel.error).toBeNull();
  const repeated=await c.rpc('cancel_service_request',{p_id:first.data});expect(repeated.error).not.toBeNull();
 });
});
