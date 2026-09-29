// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidelinesLibrary } from './GuidelinesLibrary.jsx';
import { listGuidelineDocuments, deleteGuidelineDocument } from './guidelinesStorage.js';

vi.mock('./guidelinesStorage.js', () => ({
  listGuidelineDocuments: vi.fn(), saveGuidelineDocument: vi.fn(),
  deleteGuidelineDocument: vi.fn(), parseGuidelineFile: vi.fn(),
}));

const privateDocument = () => ({
  id: 'private-training', title: 'Angels Practice Guide', year: '2026', division: 'Minor B',
  fileName: 'practice.txt', mimeType: 'text/plain', pageCount: 1,
  contentHash: 'a'.repeat(64), createdAt: '2026-09-29T12:00:00Z', warnings: [],
  blob: new Blob(['Relay readiness']),
  chunks: [{ id: 'private-training:chunk:1', sourceId: 'private-training', title: 'Relay readiness',
    text: 'Call the target before releasing the relay throw.', year: '2026', divisions: ['Minor B'], page: null, section: '' }],
});
const sharedDocument = () => {
  const doc = privateDocument();
  return { ...doc, blob: undefined, shared: true, id: 'cloud-training',
    chunks: doc.chunks.map((chunk) => ({ ...chunk, id: 'cloud-training:chunk:1', sourceId: 'cloud-training' })) };
};
const makeRepository = (overrides = {}) => ({
  scopeKey: 'angels:user-1', label: 'Angels', canWrite: true,
  list: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(sharedDocument()),
  remove: vi.fn().mockResolvedValue(undefined), listTrash: vi.fn().mockResolvedValue([]),
  restore: vi.fn().mockResolvedValue(sharedDocument()),
  getOriginalUrl: vi.fn().mockResolvedValue('https://storage.example/private?token=short-lived'),
  ...overrides,
});
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

beforeEach(() => {
  vi.resetAllMocks();
  listGuidelineDocuments.mockResolvedValue([privateDocument()]);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function open(repo) {
  const app = render(<GuidelinesLibrary repository={repo} />);
  await waitFor(() => expect(screen.queryByText('Loading your documents…')).toBeNull());
  return app;
}
async function chooseBrowserDocument() {
  fireEvent.click(screen.getByRole('button', { name: 'Documents 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add from this browser' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review before sharing' }));
  return screen.getByRole('dialog', { name: 'Review your document' });
}

describe('shared guideline library', () => {
  it('requires an explicit review and share action for a private browser import; retries retain it', async () => {
    const repo = makeRepository();
    repo.save.mockRejectedValueOnce(new Error('Upload failed. Try again.')).mockResolvedValueOnce(sharedDocument());
    await open(repo);
    expect(listGuidelineDocuments).not.toHaveBeenCalled();
    const dialog = await chooseBrowserDocument();
    expect(dialog.textContent).toContain('uploads the original file and extracted text');
    expect(dialog.textContent).toContain('Your browser copy will stay here.');
    expect(repo.save).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share with team' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Upload failed');
    expect(screen.queryByRole('option', { name: 'Angels Practice Guide' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share with team' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('combobox', { name: 'Document' }).value).toBe('cloud-training');
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(deleteGuidelineDocument).not.toHaveBeenCalled();
    expect(screen.getByText(/Sign in to this team on another device/)).toBeTruthy();
  });

  it('lets a viewer read documents but shows no shared mutation controls or eagerly fetched links', async () => {
    const repo = makeRepository({ canWrite: false, list: vi.fn().mockResolvedValue([sharedDocument()]) });
    await open(repo);
    expect(screen.queryByRole('button', { name: 'Add document' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Documents 2' }));
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add from this browser' })).toBeNull();
    expect(repo.getOriginalUrl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Get original document' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Open original document' }).some((link) => link.getAttribute('href')?.includes('short-lived'))).toBe(true));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('isolates results and drafts when the account or team changes, even when an old load finishes late', async () => {
    const oldLoad = deferred();
    const first = makeRepository({ list: vi.fn().mockReturnValue(oldLoad.promise) });
    const second = makeRepository({ scopeKey: 'rays:user-2', label: 'Rays' });
    const app = render(<GuidelinesLibrary repository={first} />);
    app.rerender(<GuidelinesLibrary repository={second} />);
    await waitFor(() => expect(screen.queryByText('Loading your documents…')).toBeNull());
    await act(async () => { oldLoad.resolve([sharedDocument()]); });
    expect(screen.queryByRole('option', { name: 'Angels Practice Guide' })).toBeNull();
    expect(screen.getByText('Shared with Rays')).toBeTruthy();
    const dialog = await chooseBrowserDocument();
    expect(dialog).toBeTruthy();
    app.rerender(<GuidelinesLibrary repository={makeRepository({ scopeKey: 'angels:user-3' })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share with team' })).toBeNull();
  });

  it('refreshes remote documents on focus without closing an unsaved form', async () => {
    const repo = makeRepository();
    await open(repo);
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    fireEvent.change(screen.getByLabelText('Document title'), { target: { value: 'Unfinished notes' } });
    repo.list.mockResolvedValue([sharedDocument()]);
    fireEvent(window, new Event('focus'));
    await screen.findByRole('option', { name: 'Angels Practice Guide' });
    expect(screen.getByLabelText('Document title').value).toBe('Unfinished notes');
    expect(screen.getByRole('dialog', { name: 'Add a guideline document' })).toBeTruthy();
  });

  it('confirms team removal and restores the original entry from removed documents', async () => {
    const doc = sharedDocument();
    const repo = makeRepository({ list: vi.fn().mockResolvedValue([doc]), listTrash: vi.fn().mockResolvedValue([{ ...doc, status: 'trashed' }]) });
    await open(repo);
    fireEvent.click(screen.getByRole('button', { name: 'Documents 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(repo.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from team library' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: doc.title })).toBeNull());
    expect(repo.remove).toHaveBeenCalledExactlyOnceWith(doc.id);
    fireEvent.click(screen.getByRole('button', { name: 'Removed documents' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore document' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: doc.title })).toBeNull());
    expect(repo.restore).toHaveBeenCalledExactlyOnceWith(doc.id);
    expect(screen.getByRole('option', { name: doc.title })).toBeTruthy();
  });
});
