// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachAssistant } from './CoachAssistant.jsx';
import { askAssistant } from './assistantClient.js';
vi.mock('./assistantClient.js', () => ({ askAssistant: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const team = { id: 'team-test', division: 'Minor B' };
function open() { return render(<StrictMode><CoachAssistant team={team} scoutingData={null} isCloud /></StrictMode>); }
function ask(question) {
  fireEvent.change(screen.getByLabelText('Your rules question'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
}
function pending(_input, { signal }) {
  return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
}
describe('assistant request lifecycle', () => {
  it('keeps the previous answer when cancelling the next request', async () => {
    askAssistant.mockResolvedValueOnce({ answer: 'A fourth inning is not allowed.', sources: [], method: 'verified-rule', elapsedMs: 2 }).mockImplementationOnce(pending);
    open(); ask('Can our pitcher pitch a fourth inning?');
    await screen.findByText('A fourth inning is not allowed.');
    ask('What about a courtesy runner?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    expect(screen.getByText('A fourth inning is not allowed.')).toBeTruthy();
    expect(screen.getByLabelText('Your rules question').value).toBe('What about a courtesy runner?');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('aborts when leaving the team and never displays a late response', async () => {
    askAssistant.mockImplementation(pending);
    const view = open(); ask('What about a courtesy runner?');
    const signal = askAssistant.mock.calls[0][1].signal;
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('sends only the constrained practice fields without a name or ranking', async () => {
    askAssistant.mockRejectedValueOnce(new Error('Test connection unavailable'));
    open(); fireEvent.click(screen.getByRole('button', { name: 'Practice plan' }));
    fireEvent.change(screen.getByLabelText('Team minutes'), { target: { value: '23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
    await screen.findByRole('alert');
    expect(askAssistant.mock.calls[0][0].practice).toEqual({ age: 8, players: 8, coaches: 2, teamMinutes: 23, homeMinutes: 10, summary: [], individual: false });
  });
});
