// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentWorkspace } from './DevelopmentWorkspace.jsx';
import { useDevelopment } from './useDevelopment.js';
import { createEmptyDevelopmentData } from './development.js';
import { DEMO_SCOUTING_AUTHOR_ID } from './scouting.js';
import { downloadText } from './RankingReview.jsx';
vi.mock('./RankingReview.jsx', () => ({ downloadText: vi.fn() }));
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open');}});
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for(const [name,descriptor] of [['showModal',originalShowModal],['close',originalClose]]) {
    if(descriptor) Object.defineProperty(HTMLDialogElement.prototype,name,descriptor); else delete HTMLDialogElement.prototype[name];
  }
});
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const team = { id:uid(1),seasonId:'test-season',name:'Synthetic team',role:'owner' };
const player = {id:uid(2),name:'Synthetic player',age:7,archived:false};
function server() {
  let record={data:createEmptyDevelopmentData(),revision:0,updatedAt:null}; let mutation=null;
  return { load:vi.fn(async()=>structuredClone(record)),
    save:vi.fn(async(revision,data,id)=>{
      if(mutation===id) return structuredClone(record);
      if(record.revision!==revision) throw Object.assign(new Error('Another coach saved first.'),{code:'CONFLICT'});
      record={data:structuredClone(data),revision:record.revision+1,updatedAt:'2026-10-02T18:00:00Z'}; mutation=id;
      return structuredClone(record);
    }), inspect:()=>structuredClone(record) };
}
function Harness({repository,scopeTeam=team,author=DEMO_SCOUTING_AUTHOR_ID,...props}) {
  const store=useDevelopment({repository,scopeKey:scopeTeam.id,authorId:author});
  return <DevelopmentWorkspace store={store} team={scopeTeam} players={[player]} authorId={author} {...props}/>;
}
const change=(label,value)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
async function open(repository,props={}) {
  const rendered=render(<Harness repository={repository} {...props}/>);
  await screen.findByRole('button',{name:'Create development plan'}); return rendered;
}
async function start() {
  fireEvent.click(screen.getByRole('button',{name:'Create development plan'}));
  change('Player',player.id); change('Player goal · included on the home card','Gather my feet in balance.');
  change('Practice drill','field-gather'); change('Home challenge','field-gather');
  change('Private coach notes · excluded from home cards','PRIVATE assessment context');
}
async function save() {
  fireEvent.click(screen.getByRole('button',{name:'Save development plan',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
}
describe('coach development workflow with real scoped synchronization',()=>{
  it('shows family-submitted reflections separately without adding coach reviews or changing the plan',async()=>{
    const repository=server(); const familyRepository={feedback:vi.fn().mockResolvedValue([]),access:vi.fn()};
    await open(repository,{familyRepository,isManager:true}); await start(); await save();
    const before=repository.inspect(); const plan=before.data.plans[0];
    familyRepository.feedback.mockResolvedValue([{id:uid(888),teamId:team.id,planId:plan.id,version:1,outcome:'needs-help',reflection:'Please show the easier game.',fun:2,createdAt:'2026-10-06T20:00:00Z'}]);
    fireEvent.click(screen.getByRole('button',{name:'Refresh family reflections'})); await screen.findByText('Please show the easier game.');
    expect(screen.getByText('Family submitted: Need help')).toBeTruthy(); expect(repository.inspect()).toEqual(before);
    expect(screen.getByRole('button',{name:'Manage family access'})).toBeTruthy(); expect(familyRepository.access).not.toHaveBeenCalled();
  });
  it('lets assistants review family feedback while keeping invitations owner-only',async()=>{
    const repository=server(); const familyRepository={feedback:vi.fn().mockResolvedValue([]),access:vi.fn()};
    await open(repository,{familyRepository,isManager:false}); await waitFor(()=>expect(familyRepository.feedback).toHaveBeenCalledWith(team.id));
    expect(screen.queryByRole('button',{name:'Manage family access'})).toBeNull(); expect(familyRepository.access).not.toHaveBeenCalled();
  });
  it('creates, customizes, versions, follows up and closes a plan while retaining its approved instructions',async()=>{
    const repository=server(); const onPlanPractice=vi.fn(); await open(repository,{isManager:true,onPlanPractice}); await start();
    change('Optional follow-up date','2026-10-09'); change('Home setup','Use two socks on clear grass.'); await save();
    const original=repository.inspect().data.plans[0];
    expect(original.versions[0].home.setup).toBe('Use two socks on clear grass.');
    fireEvent.click(screen.getByRole('button',{name:'Download approved home card'}));
    expect(downloadText).toHaveBeenCalledWith('diamond-live-home-challenge.txt',expect.stringContaining('Use two socks on clear grass.'));
    expect(downloadText.mock.calls[0][1]).not.toContain('PRIVATE');
    fireEvent.click(screen.getByRole('button',{name:'Review practice drill'})); expect(onPlanPractice).toHaveBeenCalledWith(player.id,original.versions[0].practice);
    fireEvent.click(screen.getByRole('button',{name:'Edit plan'})); change('Player goal · included on the home card','Finish in a balanced ready position.'); change('Home setup','Use a single soft ball.');
    fireEvent.click(screen.getByRole('button',{name:'Save new plan version'})); await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(repository.inspect().data.plans[0].versions[0]).toEqual(original.versions[0]);
    expect(repository.inspect().data.plans[0].versions[1].home.setup).toBe('Use a single soft ball.');
    fireEvent.click(screen.getByRole('button',{name:'Record follow-up'})); change('Follow-up outcome','needs-help'); change('Player or family reflection · optional','Asked for an easier game.'); change('Coach observations · optional','Will try a slower roll.');
    fireEvent.click(screen.getByRole('button',{name:'Save follow-up'})); await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(repository.inspect().data.reviews[0]).toMatchObject({version:2,outcome:'needs-help',reflection:'Asked for an easier game.',createdBy:DEMO_SCOUTING_AUTHOR_ID});
    fireEvent.click(screen.getByRole('button',{name:'Close plan'})); await screen.findByText(/Plan closed. Its instructions/);
    expect(repository.inspect().data.plans[0].versions.map(v=>v.status)).toEqual(['active','active','closed']);
    change('Plan status','closed'); expect(screen.getByRole('heading',{name:'Finish in a balanced ready position.'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Edit plan'})).toBeNull(); expect(screen.getByText('Family reported: needs help')).toBeTruthy();
  });
  it('keeps the failed form and exposes recovery inside its modal, retrying the same mutation exactly once',async()=>{
    const repository=server(); const write=repository.save.getMockImplementation();
    repository.save.mockImplementationOnce(async(...args)=>{await write(...args);throw new Error('Acknowledgment lost.');});
    await open(repository); await start(); fireEvent.click(screen.getByRole('button',{name:'Save development plan',exact:true}));
    const dialog=screen.getByRole('dialog'); await within(dialog).findByText('Acknowledgment lost.');
    expect(screen.getByLabelText('Player goal · included on the home card').value).toBe('Gather my feet in balance.');
    expect(screen.getByLabelText('Home challenge').matches(':disabled')).toBe(true);
    expect(within(dialog).getByRole('button',{name:'Retry plan save'}).matches(':disabled')).toBe(false);
    const close=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(close); expect(close.defaultPrevented).toBe(true);
    fireEvent.click(within(dialog).getByRole('button',{name:'Retry plan save'})); await screen.findByText('Development changes saved.');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(repository.inspect().data.plans).toHaveLength(1);
    expect(repository.save.mock.calls[0][2]).toBe(repository.save.mock.calls[1][2]);
  });
  it('retains a stale open form when a background refresh discovers another coach’s saved plan',async()=>{
    const repository=server(); await open(repository); await start(); await save();
    fireEvent.click(screen.getByRole('button',{name:'Edit plan'})); change('Player goal · included on the home card','Unsaved local goal.');
    const remote=repository.inspect(); remote.data.plans[0].versions.push({...structuredClone(remote.data.plans[0].versions[0]),version:2,goal:'Another coach’s current goal.'});
    await repository.save(remote.revision,remote.data,uid(999));
    await act(async()=>{window.dispatchEvent(new Event('focus'));});
    fireEvent.click(screen.getByRole('button',{name:'Save new plan version'})); await screen.findByText(/Another coach updated development plans while your form was open/);
    expect(screen.getByLabelText('Player goal · included on the home card').value).toBe('Unsaved local goal.');
    expect(repository.inspect().data.plans[0].versions).toHaveLength(2); expect(repository.save).toHaveBeenCalledTimes(2);
  });
  it('clears private plans and form content when coach access is revoked',async()=>{
    const repository=server(); const pending=vi.fn(); await open(repository,{onPendingChange:pending}); await start(); await save();
    fireEvent.click(screen.getByRole('button',{name:'Edit plan'})); change('Private coach notes · excluded from home cards','Unsaved private notes');
    expect(pending).toHaveBeenLastCalledWith(true);
    repository.load.mockRejectedValue(Object.assign(new Error('Permission denied'),{code:'42501'}));
    await act(async()=>{window.dispatchEvent(new Event('focus'));}); await screen.findByText(/Coach access is required/);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByText('Gather my feet in balance.')).toBeNull(); expect(screen.queryByDisplayValue('Unsaved private notes')).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(false);
  });
  it('rejects an age-ineligible library request and excludes another player’s approved practice blocks',async()=>{
    const repository=server(); const request={key:uid(10),playerId:player.id,homeDrillId:'command-team-shield'};
    await open(repository,{request,activities:[{id:uid(20),teamId:team.id,seasonId:team.seasonId,eventId:uid(30),playerId:uid(40),title:'Other player block'}],events:[{id:uid(30),type:'practice',status:'scheduled'}]});
    await screen.findByRole('dialog'); change('Player goal · included on the home card','Synthetic age check.');
    expect(screen.queryByRole('option',{name:'Other player block'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Save development plan',exact:true})); await screen.findByText(/ages 8–12/); expect(repository.save).not.toHaveBeenCalled();
  });
  it('removes the old private workspace immediately during a team/account change and ignores its late load',async()=>{
    const repository=server(); const rendered=await open(repository); await start(); await save();
    let resolve; const other={load:vi.fn(()=>new Promise(r=>{resolve=r;})),save:vi.fn()};
    rendered.rerender(<Harness repository={other} scopeTeam={{...team,id:uid(88)}} author={uid(89)}/>);
    expect(screen.queryByText('Gather my feet in balance.')).toBeNull();
    await act(async()=>resolve({data:createEmptyDevelopmentData(),revision:0,updatedAt:null}));
    await screen.findByRole('button',{name:'Create development plan'}); expect(screen.queryByText('Gather my feet in balance.')).toBeNull();
  });
});
