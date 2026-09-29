// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScoutingWorkspace } from './ScoutingWorkspace.jsx';
import { createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID, SCOUTING_SKILLS } from './scouting.js';

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor); else delete HTMLDialogElement.prototype[name];
  }
});
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const team = { id: uid(10), name: 'Test Angels', role: 'coach' };
const player = { id: uid(1), name: 'Private Test Player', number: '12', age: 8, positions: 'Infield', notes: '', archived: false, draftStatus: 'available' };
const baseline = { id: uid(20), name: 'Baseline assessment', date: '2026-09-05' };
function fixture({ rated = false } = {}) {
  const data = { ...createEmptyScoutingData(), players: [player], sessions: [baseline] };
  if (rated) data.evaluations = [{ id: uid(100), playerId: player.id, sessionId: baseline.id, authorId: DEMO_SCOUTING_AUTHOR_ID, authorName: 'Test Coach', createdAt: '2026-09-05T18:00:00.000Z', ratings: Object.fromEntries(SCOUTING_SKILLS.map((skill) => [skill.id, 5])), notes: 'Observed in a controlled drill.' }];
  return data;
}
function server(data = fixture()) {
  let record = { data: structuredClone(data), revision: 1, updatedAt: '2026-09-05T18:00:00.000Z' }; let mutation = null;
  return {
    load: vi.fn(async () => structuredClone(record)),
    save: vi.fn(async (expectedRevision, next, mutationId) => {
      if (mutation === mutationId) return structuredClone(record);
      if (record.revision !== expectedRevision) throw Object.assign(new Error('Another coach saved first.'), { code: 'CONFLICT' });
      record = { data: structuredClone(next), revision: record.revision + 1, updatedAt: '2026-09-29T18:00:00.000Z' }; mutation = mutationId;
      return structuredClone(record);
    }),
    inspect: () => structuredClone(record),
  };
}
async function openPlayer(repository, props = {}) {
  render(<ScoutingWorkspace team={team} repository={repository} authorId={DEMO_SCOUTING_AUTHOR_ID} authorName="Test Coach" {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /Private Test Player/ }));
  return screen.getByRole('heading', { name: player.name });
}
const openEvaluation = () => { fireEvent.click(screen.getByRole('button', { name: 'Evaluate player' })); return screen.getByRole('dialog'); };
const rate = (skill = 'Infield Glove fielding', value = 6) => fireEvent.click(screen.getByRole('button', { name: `Rate ${skill} ${value} out of 10`, exact: true }));
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function saveEvaluation() {
  fireEvent.click(screen.getByRole('button', { name: 'Save evaluation', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('scouting workspace with the real synchronization hook', () => {
  it('saves partial skills without manufacturing an overall score, retains earlier submissions, and separates dated assessments', async () => {
    const repository = server(); await openPlayer(repository); openEvaluation();
    rate('Infield Glove fielding', 6); change('Observation / conditions (optional)', 'Five slow grounders on grass.'); await saveEvaluation();
    expect(screen.getByRole('meter', { name: 'Infield Glove fielding' }).getAttribute('aria-valuenow')).toBe('6');
    expect(screen.getByRole('img', { name: 'Infield Footwork · Not observed' }).hasAttribute('aria-valuenow')).toBe(false);
    expect(screen.getByLabelText('Overall: not fully observed')).toBeTruthy();
    let saved = repository.inspect().data; expect(saved.evaluations).toHaveLength(1); expect(saved.evaluations[0].ratings.hit_swing).toBeNull();
    const first = structuredClone(saved.evaluations[0]);

    openEvaluation(); expect(screen.getByRole('button', { name: 'Rate Infield Glove fielding 6 out of 10' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Next skill' })); rate('Infield Footwork', 7); await saveEvaluation();
    saved = repository.inspect().data; expect(saved.evaluations).toHaveLength(2); expect(saved.evaluations[0]).toEqual(first); expect(saved.evaluations[1].ratings).toMatchObject({ if_glove: 6, if_footwork: 7, hit_swing: null });
    expect(screen.getByText('2/10 skills observed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'New assessment' }));
    change('Assessment name', 'October check-in'); change('Assessment date', '2026-10-03'); fireEvent.click(screen.getByRole('button', { name: 'Create assessment' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByText('0/10 skills observed')).toBeTruthy();
    openEvaluation(); change('Skill to evaluate', '9'); rate('Hitting Swing mechanics', 8); await saveEvaluation();
    const history = screen.getByRole('heading', { name: 'Progress over time' }).closest('section');
    expect(within(history).getAllByRole('listitem')).toHaveLength(2); expect(within(history).getByText('Baseline assessment')).toBeTruthy(); expect(within(history).getByText('October check-in')).toBeTruthy();
    saved = repository.inspect().data; expect(saved.evaluations).toHaveLength(3); expect(saved.evaluations[2].sessionId).not.toBe(baseline.id); expect(saved.evaluations[2].ratings).toMatchObject({ if_glove: null, hit_swing: 8 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Assessment', exact: true }), { target: { value: baseline.id } });
    expect(screen.getByText('2/10 skills observed')).toBeTruthy(); expect(screen.getByRole('meter', { name: 'Infield Footwork' }).getAttribute('aria-valuenow')).toBe('7');
  });

  it('creates a skill goal and records practice separately without changing the player’s rating', async () => {
    const repository = server(fixture({ rated: true })); await openPlayer(repository);
    expect(screen.getByLabelText('Overall: 5.0 out of 10')).toBeTruthy(); const original = repository.inspect().data.evaluations;
    const infield = screen.getByRole('heading', { name: 'Infield', exact: true }).closest('article'); fireEvent.click(within(infield).getAllByRole('button', { name: 'Set a goal' })[0]);
    expect(screen.getByLabelText('Goal / drill name').value).toBe('Quiet glove grounders'); change('Goal / drill name', 'Ready glove on every grounder'); change('Target score', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Create goal' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Log practice' })); await screen.findByText('1 practice session logged');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close goal' }).disabled).toBe(false)); fireEvent.click(screen.getByRole('button', { name: 'Close goal' })); await screen.findByText('Closed by coach');
    const saved = repository.inspect().data; expect(saved.goals[0]).toMatchObject({ skillId: 'if_glove', target: 6, sessionsCompleted: 1, closed: true }); expect(saved.evaluations).toEqual(original); expect(screen.getByLabelText('Overall: 5.0 out of 10')).toBeTruthy();
  });

  it('keeps the form after an unknown save outcome and retries the original mutation without duplicating the evaluation', async () => {
    const repository = server(); const write = repository.save.getMockImplementation();
    repository.save.mockImplementationOnce(async (...args) => { await write(...args); throw new Error('Acknowledgment lost.'); });
    await openPlayer(repository); openEvaluation(); rate('Infield Glove fielding', 6); change('Observation / conditions (optional)', 'Keep this private draft.');
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation', exact: true }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retry save' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save evaluation', exact: true }).disabled).toBe(true); expect(screen.getByLabelText('Observation / conditions (optional)').value).toBe('Keep this private draft.');
    expect(screen.getByLabelText('Observation / conditions (optional)').matches(':disabled')).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Skill to evaluate' }).matches(':disabled')).toBe(true);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retry save' }).matches(':disabled')).toBe(false);
    expect(screen.queryByText('Evaluation saved. The assessment scores are updated.')).toBeNull(); expect(repository.inspect().data.evaluations).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retry save' })); await screen.findByText('Changes saved.');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(repository.save.mock.calls[0][2]).toBe(repository.save.mock.calls[1][2]); expect(repository.inspect().data.evaluations).toHaveLength(1);
  });

  it('starts the next player from the acknowledged revision so sequential evaluations can be saved', async () => {
    const data = fixture(); data.players.push({ ...player, id: uid(2), name: 'Zed Test Player', number: '13' });
    const repository = server(data); await openPlayer(repository); openEvaluation(); rate('Infield Glove fielding', 6);
    fireEvent.click(screen.getByRole('button', { name: 'Save & next player' }));
    await screen.findByRole('dialog', { name: 'Evaluate Zed Test Player' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rate Infield Glove fielding 7 out of 10' }).disabled).toBe(false));
    rate('Infield Glove fielding', 7); await saveEvaluation();
    expect(repository.inspect().data.evaluations.map((entry) => [entry.playerId, entry.ratings.if_glove])).toEqual([[player.id, 6], [uid(2), 7]]);
  });

  it('preserves a remote player update when a stale local form is submitted after background refresh', async () => {
    const repository = server(); const pending = vi.fn(); await openPlayer(repository, { onPendingChange: pending });
    fireEvent.click(screen.getByRole('button', { name: 'Edit player' })); change('Coach notes (optional)', 'Unsaved local fielding note.');
    expect(pending).toHaveBeenLastCalledWith(true);
    const remote = repository.inspect(); remote.data.players[0].notes = 'Another coach’s newer observation.'; await repository.save(remote.revision, remote.data, uid(777));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.getByLabelText('Coach notes (optional)').value).toBe('Unsaved local fielding note.');
    fireEvent.click(screen.getByRole('button', { name: 'Save player' })); await screen.findByText(/Another coach updated this assessment while your form was open/);
    expect(repository.save).toHaveBeenCalledTimes(1); expect(repository.inspect().data.players[0].notes).toBe('Another coach’s newer observation.');
    expect(screen.getByLabelText('Coach notes (optional)').value).toBe('Unsaved local fielding note.');
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' })); fireEvent.click(screen.getByRole('button', { name: 'Discard form changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit player' })); expect(screen.getByLabelText('Coach notes (optional)').value).toBe('Another coach’s newer observation.');
  });

  it('asks before discarding an edited form and leaves the stored evaluation untouched', async () => {
    const repository = server(); await openPlayer(repository); openEvaluation(); rate();
    const close = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(close); expect(close.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' })); expect(screen.getByText('You have an unsaved form. Keep editing or discard these form changes.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByRole('button', { name: 'Rate Infield Glove fielding 6 out of 10' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' })); fireEvent.click(screen.getByRole('button', { name: 'Discard form changes' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(repository.save).not.toHaveBeenCalled();
    openEvaluation(); expect(screen.getByRole('button', { name: 'Not observed · leave unrated' }).getAttribute('aria-pressed')).toBe('true'); expect(screen.getByLabelText('Observation / conditions (optional)').value).toBe('');
  });

  it('removes private player and form content when coach access is revoked and keeps it hidden after a denied refresh', async () => {
    const repository = server(); await openPlayer(repository); openEvaluation(); rate(); change('Observation / conditions (optional)', 'Private unsaved observation.');
    repository.load.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: '42501' }));
    await act(async () => { window.dispatchEvent(new Event('focus')); }); await screen.findByText(/Coach access is required/);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByText(player.name)).toBeNull(); expect(screen.queryByDisplayValue('Private unsaved observation.')).toBeNull(); expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByText(player.name)).toBeNull(); expect(repository.save).not.toHaveBeenCalled();
  });
});
