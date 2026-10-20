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
