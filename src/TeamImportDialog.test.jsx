// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TeamImportDialog } from './TeamImportDialog.jsx';

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

function start(props = {}) {
  const onImport = vi.fn(async () => true); const onClose = vi.fn();
  const rendered = render(<TeamImportDialog kind="roster" onImport={onImport} onClose={onClose} {...props} />);
  return { onImport, onClose, ...rendered };
}
function preview(text) {
  fireEvent.change(screen.getByLabelText('Player names or roster data'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
}
it('only saves reviewed valid rows after explicit confirmation, skipping duplicate players', async () => {
  const { onImport, onClose } = start({ existingRecords: [{ name: 'Alex Example' }] });
  preview('Alex Example\nJordan Example');
  expect(onImport).not.toHaveBeenCalled();
  expect(screen.getByText('1 duplicates skipped')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onImport).toHaveBeenCalledOnce();
  expect(onImport.mock.calls[0][0]).toEqual([expect.objectContaining({ name: 'Jordan Example', age: null })]);
});
it('blocks import until invalid rows are corrected', () => {
  const { onImport } = start();
  preview('Name,Age\nAlex,3\nJordan,8');
  expect(screen.getByRole('button', { name: 'Import 1 players' }).disabled).toBe(true);
  expect(onImport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit data' }));
  expect(screen.getByLabelText('Player names or roster data').value).toContain('Alex,3');
});
it('preserves the preview on save failure and prevents double submission', async () => {
  let rejectSave; const onImport = vi.fn(() => new Promise((_, reject) => { rejectSave = reject; }));
  const { onClose } = start({ onImport });
  preview('Alex Example');
  fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
  fireEvent.click(screen.getByRole('button', { name: 'Importing…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(onImport).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  rejectSave(new Error('Another coach saved first. Refresh the roster and retry.'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Import 1 players' }).disabled).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
});
it('rechecks duplicates when the current roster changes while the preview is open', () => {
  const { rerender, onImport, onClose } = start(); preview('Alex Example');
  rerender(<TeamImportDialog kind="roster" onImport={onImport} onClose={onClose} existingRecords={[{ name: 'Alex Example' }]} />);
  expect(screen.getByText('1 duplicates skipped')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Import 0 players' }).disabled).toBe(true);
});
it('protects pasted data from accidental close and exposes real templates and source instructions', () => {
  const { onClose } = start(); preview('Alex Example');
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.getByText('Discard this import preview?')).toBeTruthy(); expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep reviewing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit data' }));
  expect(screen.getByRole('link', { name: 'Download CSV template' }).getAttribute('download')).toBe('diamond-live-roster-template.csv');
  expect(screen.getByText(/one-time copy/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard import' }));
  expect(onClose).toHaveBeenCalledOnce();
});
it('exposes recovery after a failed submission and allows closing without claiming the team is unchanged', async () => {
  const onImport = vi.fn(async () => { throw new Error('Offline. Draft retained.'); });
  const { rerender, onClose } = start({ onImport });
  preview('Alex Example');
  fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
  await screen.findByText('Offline. Draft retained.');
  const retry = vi.fn();
  rerender(<TeamImportDialog kind="roster" onImport={onImport} onClose={onClose} canImport={false} recovery={<button onClick={retry}>Retry pending save</button>} />);
  expect(screen.getByRole('button', { name: 'Import 1 players' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Edit data' }).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Retry pending save' }));
  expect(retry).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.getByText(/may be in an unsynced team draft/)).toBeTruthy();
  expect(screen.queryByText('Your team has not been changed.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(onClose).toHaveBeenCalledOnce();
});
