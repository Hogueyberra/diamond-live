// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyPractice, MyPracticeGateway } from './MyPractice.jsx';
import { createFamilyDemoRepository } from './familyDemo.js';
vi.mock('./AccountPanel.jsx', () => ({ AccountPanel: ({ account }) => <button onClick={async () => { try { await account.signOut(); } catch (error) { document.querySelector('#account-error').textContent=error.message; } }}>Test sign out</button> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function server(data) {
  const repo = { load: vi.fn(async () => structuredClone(data)), save: vi.fn(async (draft) => { const existing=data.reflections.find((item)=>item.id===draft.id); if(existing) return structuredClone(existing); const result={...draft,createdAt:'2026-10-06T20:00:00Z'}; data.reflections.push(result); return result; }), claim:vi.fn(async()=>{}) };
  return repo;
}
async function open() { const data=await createFamilyDemoRepository().load(); const repo=server(data); render(<MyPractice repository={repo}/>); await screen.findByText(data.plans[0].goal); return {data,repo}; }
function start(outcome='Tried it') { fireEvent.click(screen.getByRole('button',{name:outcome,exact:true})); fireEvent.change(screen.getByLabelText('Tell your coach · optional'),{target:{value:'The sock game was fun.'}}); }
describe('family practice and reflection recovery',()=>{
  it('shows complete home instructions and the easier substitute without private coach data',async()=>{
    const {data}=await open(); expect(screen.getByText(data.plans[0].home.setup)).toBeTruthy();
    expect(screen.getByText(/Try another activity/)).toBeTruthy(); expect(screen.queryByText(/private coach notes/i)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Player view'})); expect(screen.getByText('Ready for a little play?')).toBeTruthy();
  });
  it('saves optional feedback with a stable ID and displays only the household history',async()=>{
    const {data,repo}=await open(); start('Need help');
    fireEvent.change(screen.getByLabelText('How fun was it? · optional'),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('button',{name:'Share with coach'}));
    await screen.findByText(/Reflection shared with your coach/);
    expect(repo.save.mock.calls[0][0]).toMatchObject({teamId:data.plans[0].teamId,planId:data.plans[0].id,version:1,outcome:'needs-help',reflection:'The sock game was fun.',fun:2});
    expect(screen.getByText('Your reflections · 1')).toBeTruthy();
  });
  it('retries the same frozen request after a committed write loses its response',async()=>{
    const {repo,data}=await open(); const save=repo.save.getMockImplementation(); repo.save.mockImplementationOnce(async(draft)=>{await save(draft); throw Object.assign(new Error('Response lost. Keep your draft.'),{code:'NETWORK'});});
    start(); fireEvent.click(screen.getByRole('button',{name:'Share with coach'}));
    await screen.findByRole('button',{name:'Retry sharing'}); expect(screen.getByLabelText('Tell your coach · optional').closest('fieldset').disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Retry sharing'})); await screen.findByText(/Reflection shared/);
    expect(repo.save.mock.calls[1][0]).toEqual(repo.save.mock.calls[0][0]); expect(data.reflections).toHaveLength(1);
  });
  it('keeps a stale reflection while requiring review of the new instructions',async()=>{
    const {repo,data}=await open(); repo.save.mockImplementationOnce(async()=>{data.plans[0].version=2; data.plans[0].home.setup='New approved setup.'; throw Object.assign(new Error('Coach updated this plan.'),{code:'40001'});});
    start(); fireEvent.click(screen.getByRole('button',{name:'Share with coach'}));
    await screen.findByRole('button',{name:'Use current instructions'}); expect(screen.getByLabelText('Tell your coach · optional').value).toBe('The sock game was fun.'); expect(screen.getByText('New approved setup.')).toBeTruthy();
    expect(screen.getByRole('button',{name:'Share with coach'}).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Use current instructions'})); fireEvent.click(screen.getByRole('button',{name:'Share with coach'})); await screen.findByText(/Reflection shared/);
    expect(repo.save.mock.calls[1][0].version).toBe(2); expect(repo.save.mock.calls[1][0].id).not.toBe(repo.save.mock.calls[0][0].id);
  });
  it('clears visible assignments and the open reflection immediately when access is denied',async()=>{
    const {repo,data}=await open(); start(); repo.save.mockRejectedValueOnce(Object.assign(new Error('Guardian access removed'),{code:'42501'}));
    fireEvent.click(screen.getByRole('button',{name:'Share with coach'})); await screen.findByRole('alert');
    await waitFor(()=>expect(screen.queryByText(data.plans[0].goal)).toBeNull()); expect(screen.queryByLabelText('Tell your coach · optional')).toBeNull();
  });
  it('blocks resubmission when a stale plan cannot be refreshed until current instructions arrive',async()=>{
    const {repo,data}=await open(); repo.save.mockRejectedValueOnce(Object.assign(new Error('Coach updated this plan.'),{code:'40001'})); repo.load.mockRejectedValueOnce(new Error('Refresh offline'));
    start(); fireEvent.click(screen.getByRole('button',{name:'Share with coach'}));
    await screen.findByRole('button',{name:'Refresh current instructions'});
    expect(screen.getByRole('button',{name:'Use current instructions'}).disabled).toBe(true); expect(screen.getByRole('button',{name:'Share with coach'}).disabled).toBe(true);
    data.plans[0].version=2; fireEvent.click(screen.getByRole('button',{name:'Refresh current instructions'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Use current instructions'}).disabled).toBe(false));
    expect(screen.getByLabelText('Tell your coach · optional').value).toBe('The sock game was fun.'); expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it('clears a removed child on a live refresh and never shows another household as a fallback',async()=>{
    const {data}=await open(); start(); data.children=[]; data.plans=[]; data.reflections=[];
    await act(async()=>{window.dispatchEvent(new Event('focus'));});
    await screen.findByText('Your family starts here.'); expect(screen.queryByLabelText('Tell your coach · optional')).toBeNull();
  });
  it('keeps stale network reads from replacing a later successful refresh',async()=>{
    const data=await createFamilyDemoRepository().load(); let reject;
    const repo=server(data); repo.load.mockImplementationOnce(()=>new Promise((_,no)=>{reject=no;}));
    render(<MyPractice repository={repo}/>); await waitFor(()=>expect(repo.load).toHaveBeenCalledTimes(1));
    await act(async()=>{window.dispatchEvent(new Event('focus'));}); await screen.findByText(data.plans[0].goal);
    await act(async()=>reject(new Error('Older read failed'))); expect(screen.queryByText('Older read failed')).toBeNull();
  });
  it('does not load family records for signed-out visitors',()=>{
    const repo={load:vi.fn()}; render(<MemoryRouter><MyPracticeGateway account={{user:null,loading:false,teams:[]}} repository={repo}/></MemoryRouter>);
    expect(screen.getByRole('button',{name:'Sign in to My Practice'})).toBeTruthy(); expect(repo.load).not.toHaveBeenCalled();
  });
  it('works without team membership and protects home navigation and sign-out while drafting',async()=>{
    const data=await createFamilyDemoRepository().load(); const repo=server(data); const signOut=vi.fn();
    render(<MemoryRouter><div id="account-error"/><MyPracticeGateway account={{user:{id:'parent',email:'parent@example.com'},teams:[],signOut}} repository={repo}/></MemoryRouter>);
    await screen.findByText(data.plans[0].goal); start(); fireEvent.click(screen.getByRole('button',{name:'Home',exact:true}));
    expect(await screen.findByText(/Finish or discard your open reflection/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'My account'})); fireEvent.click(screen.getByRole('button',{name:'Test sign out'})); await waitFor(()=>expect(signOut).not.toHaveBeenCalled());
  });
  it('removes the previous family’s data immediately on an account change',async()=>{
    const data=await createFamilyDemoRepository().load(); const repo=server(data); const pendingRepo={load:vi.fn(()=>new Promise(()=>{}))};
    const view=(id,repository)=><MemoryRouter><MyPracticeGateway account={{user:{id},teams:[]}} repository={repository}/></MemoryRouter>;
    const result=render(view('first',repo)); await screen.findByText(data.plans[0].goal); start(); result.rerender(view('second',pendingRepo));
    expect(screen.queryByText(data.plans[0].goal)).toBeNull(); expect(screen.queryByLabelText('Tell your coach · optional')).toBeNull();
  });
});
