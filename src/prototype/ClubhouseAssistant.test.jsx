// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClubhouseAssistant from './ClubhouseAssistant.jsx';
import { askAssistant } from '../assistantClient.js';
import { demoAssessmentSummary } from './assistantAssessments.js';
import { createAssistantPractice } from '../assistantPractice.js';
vi.mock('../assistantClient.js', () => ({ askAssistant: vi.fn() }));
vi.mock('../supabaseClient.js', () => ({ supabase: {} }));
vi.mock('../cloudGuidelines.js', () => ({ createCloudGuidelinesRepository: vi.fn(() => ({})) }));
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const account = { user: { id: 'coach' }, loading: false, activeTeamId: 'real-team', teams: [{ id: 'real-team', name: 'Private team', role: 'coach', division: 'Minor B' }] };
const app = (value = account) => <MemoryRouter><ClubhouseAssistant account={value} assessments={{ records: [] }} onClose={() => {}} onAccount={() => {}} /></MemoryRouter>;
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', show], ['close', close]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor); else delete HTMLDialogElement.prototype[name];
  }
});
it.each([undefined, { ...account, loading: true }, { ...account, error: 'offline' }, { ...account, teams: [{ ...account.teams[0], role: 'viewer' }] }])('does not mount private assistant controls without confirmed coach access', (value) => {
  render(<MemoryRouter><ClubhouseAssistant account={value} onClose={() => {}} onAccount={() => {}} /></MemoryRouter>);
  expect(screen.queryByLabelText('Your coaching question')).toBeNull();
  expect(askAssistant).not.toHaveBeenCalled();
});
it('uses real account authorization while sending only aggregated demo assessments', async () => {
  askAssistant.mockImplementation(async (input) => ({ plan: createAssistantPractice(input.practice), method: 'guided-practice', elapsedMs: 5 }));
  render(app());
  fireEvent.click(screen.getByRole('button', { name: 'Practice plan', exact: true }));
  fireEvent.change(screen.getByLabelText('Practice focus'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  await screen.findByText(/Focus selected from the selected player/);
  const [request, options] = askAssistant.mock.calls[0];
  expect(request.teamId).toBe('real-team');
  expect(options.isCloud).toBe(true);
  expect(request.practice.summary).toContainEqual({ skillId: 'hitting', observed: 1, needsPractice: 1 });
  expect(JSON.stringify(request)).not.toMatch(/Mason|Brooks|notes|playerId/);
  expect(screen.getAllByText(/Balance rehearsal/)).toHaveLength(2);
});
it('aborts pending work and clears answers when the authorized team changes', async () => {
  askAssistant.mockResolvedValueOnce({ answer: 'Private first-team answer', method: 'general-chat', elapsedMs: 1 }).mockImplementation((_input, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })));
  const view = render(app());
  const ask = () => { fireEvent.change(screen.getByLabelText('Your coaching question'), { target: { value: 'How can I encourage the team?' } }); fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' })); };
  ask(); await screen.findByText('Private first-team answer'); ask();
  const signal = askAssistant.mock.calls[1][1].signal;
  view.rerender(app({ ...account, activeTeamId: 'other-team', teams: [{ ...account.teams[0], id: 'other-team' }] }));
  await waitFor(() => expect(signal.aborted).toBe(true));
  expect(screen.queryByText('Private first-team answer')).toBeNull();
});
it('preserves broad category meaning, ignores future observations, and does not invent missing ratings', () => {
  const records = [{ id: 'future', playerId: 4, observedOn: '2027-01-01', recordedAt: '2027-01-01T12:00:00Z', ratings: { hitting: 10, throwing: 10, fielding: 10, baserunning: 10 } }];
  const summary = demoAssessmentSummary(records, '4', '2026-10-20');
  expect(summary.find((skill) => skill.skillId === 'hitting').needsPractice).toBe(1);
  expect(demoAssessmentSummary([], '7', '2026-10-20').map((skill) => skill.skillId)).toEqual(['throwing', 'baserunning']);
  expect(demoAssessmentSummary([], 'unknown', '2026-10-20')).toEqual([]);
  expect(createAssistantPractice({ summary }).team.blocks.some((block) => block.id === 'balance')).toBe(true);
});
it('uses the actual roster and saved skill assessments in live mode without sending names or rankings', async () => {
  askAssistant.mockImplementation(async (input) => ({ plan: createAssistantPractice(input.practice), method: 'guided-practice', elapsedMs: 5 }));
  const { createEmptyScoutingData, createEmptyRatings } = await import('../scouting.js');
  const data = { ...createEmptyScoutingData(), players: [{ id: 'real-player', name: 'Private Child', archived: false }, { id: 'archived', name: 'Archived Child', archived: true }], sessions: [{ id: 'session', name: 'Baseline', date: '2026-10-01' }], evaluations: [{ id: 'eval', playerId: 'real-player', sessionId: 'session', authorId: 'coach', createdAt: '2026-10-01T12:00:00Z', ratings: { ...createEmptyRatings(), if_footwork: 3 }, notes: 'Private observation' }] };
  const review = vi.fn();
  render(<MemoryRouter><ClubhouseAssistant account={account} live scoutingData={data} initialMode="practice" initialPlayerId="real-player" onReviewPlan={review} onClose={() => {}} onAccount={() => {}} /></MemoryRouter>);
  expect(screen.getByLabelText('Practice focus').value).toBe('real-player');
  expect(screen.queryByRole('option', { name: 'Archived Child' })).toBeNull();
  expect(screen.queryByRole('option', { name: /Mason/ })).toBeNull();
  expect(screen.getByLabelText('Children at team practice').value).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  await screen.findByText(/Focus selected from the selected player/);
  const request = askAssistant.mock.calls[0][0];
  expect(request.teamId).toBe('real-team');
  expect(request.practice.summary).toContainEqual({ skillId: 'if_footwork', observed: 1, needsPractice: 1 });
  expect(JSON.stringify(request)).not.toMatch(/Private|Child|real-player|notes|rank/);
  expect(review).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review and save to team calendar' }));
  expect(review).toHaveBeenCalledOnce();
});
it('blocks live practice generation while assessment loading or syncing is unresolved, while keeping rules available', async () => {
  render(<MemoryRouter><ClubhouseAssistant account={account} live initialMode="practice" practiceUnavailable="Wait for saved assessments." onClose={() => {}} onAccount={() => {}} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Build practice plan' }).disabled).toBe(true);
  expect(screen.queryByText(/No assessments yet/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  expect(askAssistant).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'League rules' }));
  expect(screen.getByRole('button', { name: 'Ask assistant' }).disabled).toBe(false);
});
