// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPanel } from './AccountPanel.jsx';

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete HTMLDialogElement.prototype[name];
  }
});

function makeAccount(overrides = {}) {
  return {
    configured: true, configError: '', loading: false, user: null, profile: null, teams: [], activeTeamId: null,
    setActiveTeamId: vi.fn().mockResolvedValue(undefined), requestCode: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi.fn().mockResolvedValue(undefined), saveProfile: vi.fn().mockResolvedValue(undefined),
    createTeam: vi.fn().mockResolvedValue(undefined), joinTeam: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined), createInvite: vi.fn().mockResolvedValue({ code: 'COACH-ABCD', expiresAt: '2026-10-02T23:00:00Z' }),
    listMembers: vi.fn().mockResolvedValue([]), listInvites: vi.fn().mockResolvedValue([]),
    removeMember: vi.fn().mockResolvedValue(undefined), revokeInvite: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
const signedIn = { user: { id: 'owner-1', email: 'coach@example.com' }, profile: { display_name: 'Coach Nick' } };
const ownerTeam = { id: 'angels-real', name: 'Angels', league: 'HVLL', division: 'Minor B', season: 'Spring 2027', seasonId: 'season-1', role: 'owner' };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('account panel', () => {
  it('explains unavailable account setup without offering a fake sign-in action', () => {
    const account = makeAccount({ configured: false });
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Account setup in progress' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull();
    expect(account.requestCode).not.toHaveBeenCalled();
  });

  it('requests an email code, accepts eight digits, and preserves the code when verification fails', async () => {
    const account = makeAccount({ verifyCode: vi.fn().mockRejectedValueOnce(new Error('That code has expired.')).mockResolvedValue(undefined) });
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    change('Email address', 'coach@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await screen.findByLabelText('Email sign-in code');
    expect(account.requestCode).toHaveBeenCalledWith('coach@example.com');
    change('Email sign-in code', '1234 5678');
    fireEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await screen.findByText('That code has expired.');
    expect(screen.getByLabelText('Email sign-in code').value).toBe('12345678');
    expect(account.verifyCode).toHaveBeenCalledWith('coach@example.com', '12345678');
    fireEvent.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await screen.findByText('Signed in. Your profile and teams are loading.');
    expect(account.verifyCode).toHaveBeenCalledTimes(2);
  });

  it('keeps an edited profile after a server error and does not close when sign-out is rejected', async () => {
    const account = makeAccount({ ...signedIn, saveProfile: vi.fn().mockRejectedValue(new Error('Connection interrupted.')), signOut: vi.fn().mockRejectedValue(new Error('Wait for your changes to finish saving.')) });
    const onClose = vi.fn();
    render(<AccountPanel account={account} onClose={onClose} />);
    change('Your name', '  Coach Nicholas  ');
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await screen.findByText('Connection interrupted.');
    expect(account.saveProfile).toHaveBeenCalledWith('Coach Nicholas');
    expect(screen.getByLabelText('Your name').value).toBe('  Coach Nicholas  ');
    expect(screen.getByLabelText('Account email').readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByText('Wait for your changes to finish saving.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('creates a real team with the selected division and season, then joins using an invitation', async () => {
    const account = makeAccount(signedIn);
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teams', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Create a team' }));
    change('Team name', ' Angels '); change('League', 'Huntington Valley Little League');
    change('Team division', 'Minor B'); change('Season', 'Spring 2027');
    fireEvent.click(screen.getByRole('button', { name: 'Create shared team' }));
    await screen.findByText('Angels is ready. You are the team owner.');
    expect(account.createTeam).toHaveBeenCalledWith({ name: 'Angels', league: 'Huntington Valley Little League', division: 'Minor B', season: 'Spring 2027' });
    fireEvent.click(screen.getByRole('button', { name: 'Join with a code' }));
    change('Team invitation code', ' invite-123 ');
    fireEvent.click(screen.getByRole('button', { name: 'Join team', exact: true }));
    await screen.findByText('You joined the team.');
    expect(account.joinTeam).toHaveBeenCalledWith('invite-123');
  });

  it('preserves team drafts and rejected active-team changes', async () => {
    const account = makeAccount({ ...signedIn, teams: [ownerTeam, { ...ownerTeam, id: 'seals-real', name: 'Seals' }], activeTeamId: ownerTeam.id, setActiveTeamId: vi.fn().mockRejectedValue(new Error('Current changes must finish saving.')), createTeam: vi.fn().mockRejectedValue(new Error('Could not create the team.')) });
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teams', exact: true }));
    change('Active team', 'seals-real');
    await screen.findByText('Current changes must finish saving.');
    expect(screen.getByLabelText('Active team').value).toBe('angels-real');
    fireEvent.click(screen.getByRole('button', { name: 'Create a team' }));
    change('Team name', 'New Angels'); change('League', 'HVLL'); change('Season', 'Spring 2027');
    fireEvent.click(screen.getByRole('button', { name: 'Create shared team' }));
    await screen.findByText('Could not create the team.');
    expect(screen.getByLabelText('Team name').value).toBe('New Angels');
    expect(screen.getByLabelText('Season').value).toBe('Spring 2027');
  });

  it('limits access controls to owners and explains that viewers can read coaching records', () => {
    const account = makeAccount({ ...signedIn, teams: [{ ...ownerTeam, role: 'viewer' }], activeTeamId: ownerTeam.id });
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Team access' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Teams', exact: true }));
    expect(screen.getByText('You can read this team’s shared schedules, coaching records, and guidelines.')).toBeTruthy();
    expect(account.listMembers).not.toHaveBeenCalled();
  });

  it('creates a viewer invitation and requires confirmation before revoking codes or removing members', async () => {
    const account = makeAccount({ ...signedIn, teams: [ownerTeam], activeTeamId: ownerTeam.id,
      listMembers: vi.fn().mockResolvedValue([{ userId: 'owner-1', displayName: 'Coach Nick', role: 'owner' }, { userId: 'coach-2', displayName: 'Coach Ava', role: 'coach' }]),
      listInvites: vi.fn().mockResolvedValue([{ id: 'invite-1', role: 'viewer', expiresAt: '2026-10-02T23:00:00Z' }]),
    });
    render(<AccountPanel account={account} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Team access' }));
    await screen.findByText('Coach Ava');
    expect(screen.queryByRole('button', { name: 'Remove access for Coach Nick' })).toBeNull();
    change('Invitation access', 'viewer');
    fireEvent.click(screen.getByRole('button', { name: 'Create invitation code' }));
    const created = await screen.findByRole('complementary', { name: 'New invitation code' });
    expect(within(created).getByText('COACH-ABCD')).toBeTruthy();
    expect(account.createInvite).toHaveBeenCalledWith('viewer');
    await waitFor(() => expect(screen.queryByText('Loading team access…')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Remove access for Coach Ava' }));
    expect(account.removeMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await screen.findByText('Coach Ava no longer has access to this team.');
    expect(account.removeMember).toHaveBeenCalledWith('coach-2');
    await screen.findByRole('button', { name: /Revoke viewer invitation/ });
    fireEvent.click(screen.getByRole('button', { name: /Revoke viewer invitation/ }));
    expect(account.revokeInvite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    await screen.findByText('Invitation revoked.');
    expect(account.revokeInvite).toHaveBeenCalledWith('invite-1');
  });

  it('ignores stale member responses when the active team changes', async () => {
    let finishOldRequest;
    const oldMembers = new Promise((resolve) => { finishOldRequest = resolve; });
    const account = makeAccount({ ...signedIn, teams: [ownerTeam, { ...ownerTeam, id: 'seals-real', name: 'Seals' }], activeTeamId: ownerTeam.id,
      listMembers: vi.fn().mockReturnValueOnce(oldMembers).mockResolvedValue([{ userId: 'seals-coach', displayName: 'Seals coach', role: 'coach' }]),
    });
    const app = render(<AccountPanel account={account} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Team access' }));
    app.rerender(<AccountPanel account={{ ...account, activeTeamId: 'seals-real' }} onClose={vi.fn()} />);
    await screen.findByText('Seals coach');
    finishOldRequest([{ userId: 'angels-coach', displayName: 'Old Angels coach', role: 'coach' }]);
    await waitFor(() => expect(screen.queryByText('Old Angels coach')).toBeNull());
    expect(screen.getByText('Seals coach')).toBeTruthy();
  });
});
