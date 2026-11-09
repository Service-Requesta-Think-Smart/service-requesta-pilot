import { describe, expect, it } from 'vitest';
import { requestSchema, consentSchema, normalizePhone, commissionCents } from '@/features/customer/schema';
const request = { category:'plumbing',title:'Repair kitchen tap',description:'The kitchen tap leaks from its base.',area:'Beacon Bay',timing:'flexible',key:'cc917c0d-7829-4331-a7a8-0cde00990bdc' };
describe('Pilot rules', () => {
  it('accepts only the three pilot categories', () => {
    for(const category of ['plumbing','electrical','motor_mechanics']) expect(requestSchema.parse({...request,category}).category).toBe(category);
    expect(requestSchema.safeParse({...request,category:'cleaning'}).success).toBe(false);
  });
  it('requires affirmative privacy consent', () => {
    expect(consentSchema.safeParse({name:'Demo customer',phone:'',accepted:false}).success).toBe(false);
    expect(consentSchema.parse({name:'Demo customer',phone:null,accepted:true}).accepted).toBe(true);
  });
  it('normalises local South African phone numbers to +27', () => {
    expect(normalizePhone('082 123 4567')).toBe('+27821234567');
    expect(()=>normalizePhone('+1 555 123 4567')).toThrow();
  });
  it('rejects inadequate job details', () => {
    expect(requestSchema.safeParse({...request,description:'Short'}).success).toBe(false);
  });
  it('calculates illustrative R1000 at 15% as R150 in cents', () => {
    expect(commissionCents(100000,1500)).toBe(15000);
    expect(()=>commissionCents(-100)).toThrow();
  });
});