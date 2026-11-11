import { describe, expect, it, vi } from 'vitest';
import { createFamilyRepository } from './familyRepository.js';
import { createFamilyDemoRepository } from './familyDemo.js';
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft={id:uid(1),teamId:uid(2),planId:uid(3),version:1,outcome:'needs-help',reflection:'Try the easier game.',fun:2};
describe('family RPC repository', () => {
  it('loads with no caller-selected child or team arguments',async()=>{
    const data=await createFamilyDemoRepository().load(); const rpc=vi.fn().mockResolvedValue({data});
    expect(await createFamilyRepository({rpc}).load()).toEqual(data); expect(rpc).toHaveBeenCalledWith('load_my_practice',undefined);
  });
  it('binds the exact reflection request without adding an author',async()=>{
    const saved={...draft,createdAt:'2026-10-06T20:00:00Z'}; const rpc=vi.fn().mockResolvedValue({data:saved});
    expect(await createFamilyRepository({rpc}).save(draft)).toEqual(saved); expect(rpc).toHaveBeenCalledWith('save_family_reflection',{p_data:draft});
  });
  it('refuses an unverified save response',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:{...draft,teamId:uid(8),createdAt:'2026-10-06T20:00:00Z'}});
    await expect(createFamilyRepository({rpc}).save(draft)).rejects.toThrow(/verified/);
  });
  it.each(['42501','40001'])('preserves backend error %s for recovery',async(code)=>{
    const rpc=vi.fn().mockResolvedValue({error:{code,message:'Access or version changed'}});
    await expect(createFamilyRepository({rpc}).save(draft)).rejects.toMatchObject({code});
  });
  it('labels network failures without losing the draft',async()=>{
    const rpc=vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(createFamilyRepository({rpc}).save(draft)).rejects.toMatchObject({code:'NETWORK'});
  });
  it('only accepts complete family codes and sends the email-bound RPC',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:null}); const repo=createFamilyRepository({rpc});
    expect(()=>repo.claim('bad')).toThrow(); expect(rpc).not.toHaveBeenCalled();
    await repo.claim('a'.repeat(64)); expect(rpc).toHaveBeenCalledWith('claim_guardian_invite',{p_code:'a'.repeat(64)});
  });
  it('binds coach feedback to the requested team',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{...draft,createdAt:'2026-10-06T20:00:00Z'}]});
    await expect(createFamilyRepository({rpc}).feedback(uid(8))).rejects.toThrow(/another team/);
  });
});
