// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticePlanner } from './PracticePlanner.jsx';
import { createDemoScoutingData } from './scouting.js';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const event = { id: 'practice', teamId: 'team', seasonId: 'season', date: '2026-10-01', startTime: '16:30', endTime: '17:30' };
const block = { id: 'block', eventId: event.id, title: 'Warm-up', objective: 'Get moving', measure: 'Ready to practice', minutes: 10, completed: false };
const staff = [{ userId: 'manager', displayName: 'Manager', role: 'owner' }, { userId: 'assistant', displayName: 'Assistant', role: 'coach' }];
function Harness({ initialEvent = event, initialActivities = [], onSave = vi.fn(), ...props }) {
  const [savedEvent, setEvent] = useState(initialEvent); const [activities, setActivities] = useState(initialActivities);
  return <PracticePlanner event={savedEvent} activities={activities} members={staff} currentUserId="manager" currentUserName="Manager" isManager onChange={async (next, nextEvent) => { await onSave(next, nextEvent); setActivities(next); setEvent(nextEvent); }} {...props} />;
}

describe('PracticePlanner', () => {
  it('requires coach approval, explains shared player names, and adds a timed individual drill without scores', async () => {
    const data = createDemoScoutingData(); const save = vi.fn();
    render(<Harness scoutingData={data} initialPlayerId={data.players[0].id} onSave={save} />);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review this drill' }));
    const form = screen.getByRole('form', { name: 'Review and approve drill' });
    expect(within(form).getByText(/name and drill become visible to team members/)).toBeTruthy();
    fireEvent.click(within(form).getByRole('button', { name: 'Approve & add to practice' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const activity = save.mock.calls[0][0][0];
    expect(activity.playerId).toBe(data.players[0].id); expect(activity).not.toHaveProperty('reason'); expect(activity).not.toHaveProperty('ratings');
    expect(screen.getByText('4:30 PM–4:38 PM')).toBeTruthy();
  });
  it('prevents overflow and the release of a legacy overflowing plan', () => {
    render(<Harness initialActivities={[{ ...block, minutes: 65 }]} />);
    expect(screen.getByRole('button', { name: 'Open coach sign-up' }).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('5 minutes past');
  });
  it('supports manager first pick, release, and reassignment', async () => {
    const save = vi.fn(); render(<Harness initialActivities={[block]} onSave={save} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Coach for Warm-up' }), { target: { value: 'manager' } });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0][0].assignedCoachId).toBe('manager');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open coach sign-up' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Open coach sign-up' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][1].planStatus).toBe('released');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause coach sign-up' }).disabled).toBe(false));
    fireEvent.change(screen.getByRole('combobox', { name: 'Coach for Warm-up' }), { target: { value: 'assistant' } });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls[2][0][0].assignedCoachId).toBe('assistant');
  });
  it('lets an assistant claim an open released block, but cannot expose plan editing', async () => {
    const save = vi.fn(); render(<Harness initialEvent={{ ...event, planStatus: 'released' }} initialActivities={[block]} currentUserId="assistant" currentUserName="Assistant" isManager={false} onSave={save} />);
    expect(screen.queryByRole('button', { name: 'Add a custom block' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Coach for Warm-up' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'I’ll run this drill' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0][0].assignedCoachId).toBe('assistant');
    expect(screen.getByRole('button', { name: 'Give up my block' })).toBeTruthy();
  });
  it('does not offer assistant claims during manager planning or controls to viewers', () => {
    const { rerender } = render(<PracticePlanner event={event} activities={[block]} currentUserId="assistant" isManager={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'I’ll run this drill' })).toBeNull();
    rerender(<PracticePlanner event={{ ...event, planStatus: 'released' }} activities={[block]} canCoach={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull(); expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.queryByRole('button')).toBeNull();
  });
  it('reorders/removes blocks and preserves instructions and outcomes', async () => {
    const save = vi.fn(); render(<Harness initialActivities={[block, { ...block, id: 'block2', title: 'Water break', minutes: 3, setup: 'Meet at the shaded bench.', steps: ['Drink water.', 'Check in with a coach.'], outcome: 'Everyone ready' }]} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Water break earlier' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].map((item) => item.id)).toEqual(['block2', 'block']);
    expect(save.mock.calls[0][0][0].steps).toEqual(['Drink water.', 'Check in with a coach.']);
    expect(screen.getByLabelText('Outcome for Water break').value).toBe('Everyone ready');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Warm-up' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Warm-up' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2)); expect(save.mock.calls[1][0]).toHaveLength(1);
  });
  it('reports a failed save without replacing the existing plan', async () => {
    render(<Harness initialActivities={[block]} onSave={vi.fn().mockRejectedValue(new Error('Another coach updated this plan. Refresh before retrying.'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Warm-up' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Another coach updated'));
    expect(screen.getByRole('heading', { name: 'Warm-up' })).toBeTruthy();
  });
});


it('keeps an unsaved outcome across a remote refresh and reports pending review drafts', async () => {
  const pending = vi.fn(); const save = vi.fn().mockRejectedValue(new Error('Refresh before saving.'));
  const props = { event, activities: [block], currentUserId: 'manager', isManager: true, onChange: save, onPendingChange: pending };
  const { rerender } = render(<PracticePlanner {...props} />);
  fireEvent.change(screen.getByLabelText('Outcome for Warm-up'), { target: { value: 'My unsaved observation' } });
  await waitFor(() => expect(pending).toHaveBeenLastCalledWith(true));
  rerender(<PracticePlanner {...props} activities={[{ ...block, outcome: 'Another coach saved this' }]} />);
  expect(screen.getByLabelText('Outcome for Warm-up').value).toBe('My unsaved observation');
  fireEvent.blur(screen.getByLabelText('Outcome for Warm-up'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Refresh before saving'));
  expect(screen.getByLabelText('Outcome for Warm-up').value).toBe('My unsaved observation');
  expect(pending).toHaveBeenLastCalledWith(true);
});

it('makes a review explicitly discardable and guards replacing it with another drill', async () => {
  const pending = vi.fn(); render(<Harness onPendingChange={pending} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add a custom block' }));
  await waitFor(() => expect(pending).toHaveBeenLastCalledWith(true));
  fireEvent.change(screen.getByLabelText('Drill name'), { target: { value: 'Work in progress' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add a custom block' }));
  expect(screen.getByRole('alert').textContent).toContain('Finish or cancel');
  expect(screen.getByLabelText('Drill name').value).toBe('Work in progress');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }));
  await waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
});
