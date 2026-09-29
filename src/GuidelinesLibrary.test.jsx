// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidelinesLibrary } from './GuidelinesLibrary.jsx';
import corpus from './data/hvll2026.json';
import { parseGuidelineFile, listGuidelineDocuments, saveGuidelineDocument, deleteGuidelineDocument } from './guidelinesStorage.js';

// Keep the UI, corpus, and search engine real. Browser storage and parsing have
// separate tests; these boundaries provide deterministic import outcomes here.
vi.mock('./guidelinesStorage.js', () => ({
  parseGuidelineFile: vi.fn(),
  listGuidelineDocuments: vi.fn(),
  saveGuidelineDocument: vi.fn(),
  deleteGuidelineDocument: vi.fn(),
}));

const browserMethods = [
  [HTMLDialogElement.prototype, 'showModal'],
  [HTMLDialogElement.prototype, 'close'],
  [URL, 'createObjectURL'],
  [URL, 'revokeObjectURL'],
].map(([owner, name]) => [owner, name, Object.getOwnPropertyDescriptor(owner, name)]);

beforeEach(() => {
  vi.resetAllMocks();
  listGuidelineDocuments.mockResolvedValue([]);
  saveGuidelineDocument.mockResolvedValue(undefined);
  deleteGuidelineDocument.mockResolvedValue(undefined);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-guideline-document') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  for (const [owner, name, descriptor] of browserMethods) {
    if (descriptor) Object.defineProperty(owner, name, descriptor);
    else delete owner[name];
  }
});

async function openLibrary(props = {}) {
  const app = render(<div className="coaching-workspace"><GuidelinesLibrary {...props} /></div>);
  await waitFor(() => expect(screen.queryByText('Loading your documents…')).toBeNull());
  return app;
}

function importedDocument() {
  const text = 'Relay readiness begins with naming the target.\n\nPractice the call before the catch, then record the next adjustment.';
  return {
    id: 'local-relay-guide', title: '2027 Field Practice Guide', year: '2027', division: 'Minor B',
    fileName: 'practice-guide.txt', mimeType: 'text/plain', pageCount: 1,
    createdAt: '2026-09-29T16:00:00.000Z', contentHash: 'a'.repeat(64),
    blob: new Blob([text], { type: 'text/plain' }), warnings: [],
    chunks: [{ id: 'local-relay-guide-1', sourceId: 'local-relay-guide', title: 'Relay preparation',
      text, section: '', page: null, divisions: ['Minor B'], year: '2027', category: 'Coaching' }],
  };
}

async function readImport(document) {
  parseGuidelineFile.mockResolvedValueOnce(document);
  fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
  const dialog = screen.getByRole('dialog', { name: 'Add a guideline document' });
  const file = new File([document.chunks[0].text], document.fileName, { type: document.mimeType });
  fireEvent.change(within(dialog).getByLabelText('Document file'), { target: { files: [file] } });
  fireEvent.change(within(dialog).getByLabelText('Document title'), { target: { value: document.title } });
  fireEvent.change(within(dialog).getByLabelText('Year'), { target: { value: document.year } });
  fireEvent.change(within(dialog).getByLabelText('Applies to'), { target: { value: document.division } });
  // jsdom cannot populate the native file control's required-value validity.
  // Submit the populated form directly; actual file selection is browser-tested.
  fireEvent.submit(within(dialog).getByRole('button', { name: 'Read document' }).closest('form'));
  await screen.findByRole('dialog', { name: 'Review your document' });
  return file;
}

function pitchingResult() {
  return screen.getByRole('heading', { name: 'Pitching', exact: true }).closest('button');
}

describe('guidelines library', () => {
  it('changes the division-specific pitching result while keeping general league references', async () => {
    await openLibrary();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search guidelines' }), { target: { value: 'pitching' } });
    expect(pitchingResult().textContent).toContain('Minor B');
    expect(pitchingResult().textContent).toContain('Section X.K');
    expect(screen.getByRole('heading', { name: 'Scorebooks and Pitch Count Logbooks' }).closest('button').textContent).toContain('All divisions');

    fireEvent.change(screen.getByRole('combobox', { name: 'Division' }), { target: { value: 'Minor A' } });
    expect(pitchingResult().textContent).toContain('Minor A');
    expect(pitchingResult().textContent).toContain('Section IX.K');
    expect(screen.queryByText(/Section X\.K · p\. 27/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Scorebooks and Pitch Count Logbooks' }).closest('button').textContent).toContain('All divisions');
  });

  it('opens the exact Minor B pitching text, including exceptions, with the official page-27 citation', async () => {
    await openLibrary();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search guidelines' }), { target: { value: 'pitching innings' } });
    fireEvent.click(pitchingResult());
    const dialog = screen.getByRole('dialog', { name: 'Pitching' });
    const passage = corpus.chunks.find((chunk) => chunk.id === 'hvll-2026-section-x-k');
    expect(dialog.querySelector('.gl-original').textContent).toBe(passage.text);
    expect(dialog.textContent).toContain('No player may pitch more than 3 innings per game or more than 6 innings per week during the regular season.');
    expect(dialog.textContent).toContain('During the Division Championship Tournament, there will be no limit to the number of innings a player may pitch in a week or a day.');
    expect(dialog.textContent).toContain('All LLRB regulations regarding pitch counts and days of rest always apply.');
    expect(within(dialog).getByText('Minor B')).toBeTruthy();
    expect(within(dialog).getByText(/Section X\.K · page 27/)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Open original document' }).getAttribute('href'))
      .toBe('https://dt5602vnjxv0c.cloudfront.net/portals/20562/docs/2026/2026%20hvll%20bylaws.pdf#page=27');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Search guidelines' }).value).toBe('pitching innings');
  });

  it('recovers from no results and resets the selected document, year, and division', async () => {
    await openLibrary();
    fireEvent.change(screen.getByRole('combobox', { name: 'Division' }), { target: { value: 'Minor A' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Document' }), { target: { value: 'hvll-2026' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2026' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search guidelines' }), { target: { value: 'interplanetary teleportation' } });
    expect(screen.getByRole('heading', { name: 'No matching references' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('0 references found');
    fireEvent.click(screen.getByRole('button', { name: 'Browse all guidelines' }));
    expect(screen.getByRole('searchbox', { name: 'Search guidelines' }).value).toBe('');
    for (const name of ['Division', 'Document', 'Year']) expect(screen.getByRole('combobox', { name }).value).toBe('all');
    expect(screen.queryByRole('heading', { name: 'No matching references' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Proof of Residency or School Attendance' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('combobox', { name: 'Division' }).value).toBe('Minor B');
  });

  it('requires text review before saving an import, then searches it after a reload', async () => {
    const document = importedDocument();
    const stored = [];
    listGuidelineDocuments.mockImplementation(async () => [...stored]);
    saveGuidelineDocument.mockImplementation(async (item) => { stored.push(item); });
    const app = await openLibrary();
    const file = await readImport(document);
    const dialog = screen.getByRole('dialog', { name: 'Review your document' });
    expect(parseGuidelineFile).toHaveBeenCalledWith(file, { title: document.title, year: '2027', division: 'Minor B' }, expect.any(Function));
    expect(dialog.querySelector('.gl-import-preview').textContent).toBe(document.chunks[0].text);
    expect(saveGuidelineDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: document.title })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to library' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saveGuidelineDocument).toHaveBeenCalledExactlyOnceWith(document);
    expect(screen.getByText(`${document.title} is ready to search. This import is saved only in this browser.`)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Document' }).value).toBe(document.id);
    expect(screen.getByRole('heading', { name: 'Relay preparation' })).toBeTruthy();

    app.unmount();
    await openLibrary();
    fireEvent.change(screen.getByRole('combobox', { name: 'Document' }), { target: { value: document.id } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search guidelines' }), { target: { value: 'relay readiness' } });
    fireEvent.click(screen.getByRole('heading', { name: 'Relay preparation' }).closest('button'));
    const restored = screen.getByRole('dialog', { name: 'Relay preparation' });
    expect(restored.querySelector('.gl-original').textContent).toBe(document.chunks[0].text);
    expect(within(restored).getByRole('link', { name: 'Open original document' }).getAttribute('href')).toBe('blob:local-guideline-document');
  });

  it('keeps a failed save in review without adding the document or claiming success, and allows retry', async () => {
    const document = importedDocument();
    saveGuidelineDocument.mockRejectedValueOnce(new Error('Browser storage is full. This document was not saved.'));
    await openLibrary();
    await readImport(document);
    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));
    expect((await screen.findByRole('alert')).textContent).toContain('This document was not saved.');
    const dialog = screen.getByRole('dialog', { name: 'Review your document' });
    expect(dialog.querySelector('.gl-import-preview').textContent).toBe(document.chunks[0].text);
    expect(screen.queryByRole('option', { name: document.title })).toBeNull();
    expect(screen.queryByText(/is ready to search/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Relay preparation' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Add to library' }).disabled).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to library' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(parseGuidelineFile).toHaveBeenCalledTimes(1);
    expect(saveGuidelineDocument.mock.calls).toEqual([[document], [document]]);
    expect(screen.getByRole('heading', { name: 'Relay preparation' })).toBeTruthy();
  });

  it('reports an unreadable document and keeps its details available without offering to save', async () => {
    parseGuidelineFile.mockRejectedValueOnce(new Error('This PDF has no selectable text.'));
    await openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a guideline document' });
    fireEvent.change(within(dialog).getByLabelText('Document file'), { target: { files: [new File(['scan'], 'scanned-rules.pdf', { type: 'application/pdf' })] } });
    fireEvent.change(within(dialog).getByLabelText('Document title'), { target: { value: 'Scanned supplement' } });
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Read document' }).closest('form'));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('This PDF has no selectable text.');
    expect(within(dialog).getByLabelText('Document title').value).toBe('Scanned supplement');
    expect(within(dialog).getByRole('button', { name: 'Read document' }).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Add to library' })).toBeNull();
    expect(saveGuidelineDocument).not.toHaveBeenCalled();
  });

  it('protects the included source and requires confirmation before removing a local import', async () => {
    const document = importedDocument();
    listGuidelineDocuments.mockResolvedValue([document]);
    await openLibrary();
    fireEvent.change(screen.getByRole('combobox', { name: 'Document' }), { target: { value: document.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Documents 2' }));
    const dialog = screen.getByRole('dialog', { name: 'Your guideline documents' });
    const included = within(dialog).getByRole('heading', { name: corpus.source.title }).closest('article');
    expect(within(included).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(within(included).getByRole('link', { name: 'Open original document' }).getAttribute('href')).toBe(corpus.source.url);
    const local = within(dialog).getByRole('heading', { name: document.title }).closest('article');
    fireEvent.click(within(local).getByRole('button', { name: 'Remove' }));
    expect(deleteGuidelineDocument).not.toHaveBeenCalled();
    fireEvent.click(within(local).getByRole('button', { name: 'Keep document' }));
    expect(within(local).queryByText('Remove this import?')).toBeNull();
    fireEvent.click(within(local).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(local).getByRole('button', { name: 'Remove from this browser' }));
    await waitFor(() => expect(within(dialog).queryByRole('heading', { name: document.title })).toBeNull());
    expect(deleteGuidelineDocument).toHaveBeenCalledExactlyOnceWith(document.id);
    expect(within(dialog).getByRole('heading', { name: corpus.source.title })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('combobox', { name: 'Document' }).value).toBe('all');
    expect(screen.queryByRole('option', { name: document.title })).toBeNull();
    expect(screen.getByText('Document removed from this browser.')).toBeTruthy();
  });

  it('keeps the official bylaws searchable when local documents cannot load', async () => {
    listGuidelineDocuments.mockRejectedValueOnce(new Error('Private browser storage could not read your guidelines.'));
    await openLibrary();
    expect(screen.getByRole('alert').textContent).toContain('The included HVLL bylaws are still searchable.');
    expect(screen.getByRole('button', { name: 'Add document' }).disabled).toBe(true);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search guidelines' }), { target: { value: 'pitching' } });
    fireEvent.click(pitchingResult());
    expect(screen.getByRole('dialog', { name: 'Pitching' }).textContent).toContain('Section X.K · page 27');
    expect(saveGuidelineDocument).not.toHaveBeenCalled();
  });
});
