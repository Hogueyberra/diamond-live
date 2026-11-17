// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianAccessPanel } from './GuardianAccessPanel.jsx';
beforeEach(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open');}});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const team={id:'00000000-0000-4000-8000-000000000001',name:'Synthetic Angels'};
const player={id:'00000000-0000-4000-8000-000000000002',name:'Alex Example',archived:false};
function repository(){return {access:vi.fn().mockResolvedValue({links:[],invites:[]}),invite:vi.fn().mockResolvedValue({id:'invite',code:'a'.repeat(64),expiresAt:'2026-10-13T20:00:00Z'}),revoke:vi.fn().mockResolvedValue(null)};}
async function open(repo){render(<GuardianAccessPanel repository={repo} team={team} players={[player,{...player,id:'archived',name:'Archived player',archived:true}]} onClose={vi.fn()}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Create family invitation'}).closest('fieldset').disabled).toBe(false));}
describe('owner guardian invitations',()=>{
  it('creates an email-bound invitation for one active player and gives explicit sharing instructions',async()=>{
    const repo=repository();await open(repo);expect(screen.queryByRole('option',{name:'Archived player'})).toBeNull();
    fireEvent.change(screen.getByLabelText('Player to link'),{target:{value:player.id}});fireEvent.change(screen.getByLabelText('Guardian email'),{target:{value:'parent@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Create family invitation'}));
    await screen.findByLabelText('New family invitation');expect(repo.invite).toHaveBeenCalledWith(team.id,player.id,'parent@example.com');expect(screen.getByText(/No invitation email is sent/)).toBeTruthy();
  });
  it('requires confirmation before revoking a linked guardian and refreshes after success',async()=>{
    const repo=repository();repo.access.mockResolvedValueOnce({links:[{id:'link',playerId:player.id,guardianEmail:'parent@example.com',displayName:'Adult'}],invites:[]});await open(repo);
    fireEvent.click(screen.getByRole('button',{name:/Remove link for/}));expect(repo.revoke).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));
    await screen.findByText('Family access removed.');expect(repo.revoke).toHaveBeenCalledWith(team.id,'link','link');expect(repo.access).toHaveBeenCalledTimes(2);
  });
  it('shows a failed read as an error and blocks new invites until the list is checked',async()=>{
    const repo=repository();repo.access.mockRejectedValueOnce(new Error('Access list unavailable'));render(<GuardianAccessPanel repository={repo} team={team} players={[player]} onClose={vi.fn()}/>);
    await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Create family invitation'}).closest('fieldset').disabled).toBe(true);expect(screen.queryByText('No linked guardians yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Refresh family access'}));await screen.findByText('No linked guardians yet.');
  });
  it('clears displayed links and the newly returned code on an authorization failure',async()=>{
    const repo=repository();await open(repo);fireEvent.change(screen.getByLabelText('Player to link'),{target:{value:player.id}});fireEvent.change(screen.getByLabelText('Guardian email'),{target:{value:'parent@example.com'}});fireEvent.click(screen.getByRole('button',{name:'Create family invitation'}));await screen.findByLabelText('New family invitation');
    repo.access.mockRejectedValueOnce(Object.assign(new Error('Owner access removed'),{code:'42501'}));fireEvent.click(screen.getByRole('button',{name:'Refresh family access'}));await screen.findByText('Owner access removed');expect(screen.queryByLabelText('New family invitation')).toBeNull();
  });
});
