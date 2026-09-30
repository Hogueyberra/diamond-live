import { describe, expect, it, vi } from 'vitest';
import { createCloudGuidelinesRepository, cloudGuidelineDocument } from './cloudGuidelines.js';
import { parseGuidelineFile } from './guidelinesStorage.js';

const teamId = '10000000-0000-4000-a000-000000000001';
const userId = '20000000-0000-4000-a000-000000000002';
const docId = '30000000-0000-4000-a000-000000000003';
const file = () => parseGuidelineFile(new File(['Coaches confirm each player has a safe throwing partner.'], 'practice.txt'), { title: 'Practice notes', year: '2026', division: 'Minor B' });
function row(payload = {}, status = 'ready') {
  const id = payload.id ?? docId;
  return { id, team_id: teamId, created_by: userId, title: payload.title ?? 'Practice notes',
    year: payload.year ?? '2026', division: payload.division ?? 'Minor B', file_name: payload.fileName ?? 'practice.txt',
    mime_type: payload.mimeType ?? 'text/plain', byte_size: payload.byteSize ?? 55, content_hash: payload.contentHash ?? 'a'.repeat(64),
    page_count: payload.pageCount ?? 1, warnings: payload.warnings ?? [], status,
    created_at: '2026-09-29T12:00:00Z', storage_path: `${teamId}/${id}/original`,
    chunks: payload.chunks ?? [{ id: `${id}:chunk:1`, sourceId: id, title: 'Practice notes',
      text: 'Coaches confirm each player has a safe throwing partner.', section: '', year: '2026', divisions: ['Minor B'], page: null }],
  };
}

function fixture() {
  let reserved;
  const reads = [];
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const range = vi.fn().mockResolvedValue({ data: [row()], error: null });
  const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://project.supabase.co/storage/v1/object/sign/private?token=abc' }, error: null });
  const storageFrom = vi.fn(() => ({ upload, createSignedUrl }));
  const from = vi.fn((table) => {
    const query = { table, filters: [] };
    reads.push(query);
    const chain = {
      select: vi.fn((selection) => { query.selection = selection; return chain; }),
      eq: vi.fn((key, value) => { query.filters.push([key, value]); return chain; }),
      order: vi.fn(() => chain), range, maybeSingle: single,
    };
    return chain;
  });
  const rpc = vi.fn(async (name, args) => {
    if (name === 'reserve_guideline_document') { reserved = row(args.p_document, 'pending'); return { data: reserved }; }
    if (name === 'finalize_guideline_document') return { data: { ...reserved, status: 'ready' } };
    return { data: row({}, name.startsWith('trash') ? 'trashed' : 'ready') };
  });
  const client = { from, rpc, storage: { from: storageFrom } };
  const repo = createCloudGuidelinesRepository({ client, teamId, userId, canWrite: true, label: 'Angels' });
  return { repo, client, reads, single, range, upload, createSignedUrl, storageFrom, rpc };
}

describe('authenticated guidelines repository', () => {
  it('reserves metadata, uploads private bytes, then publishes ready searchable passages with new team IDs', async () => {
    const { repo, rpc, upload, storageFrom } = fixture();
    const doc = await file();
    const saved = await repo.save(doc);
    const reserve = rpc.mock.calls[0];
    expect(reserve[0]).toBe('reserve_guideline_document');
    expect(reserve[1].p_team_id).toBe(teamId);
    expect(reserve[1].p_document).not.toHaveProperty('blob');
    expect(saved.id).not.toBe(doc.id);
    expect(saved.chunks[0].sourceId).toBe(saved.id);
    expect(saved.chunks[0].id).toBe(`${saved.id}:chunk:1`);
    expect(saved).not.toHaveProperty('blob');
    expect(saved.status).toBe('ready');
    expect(storageFrom).toHaveBeenCalledWith('diamond-guidelines');
    expect(upload).toHaveBeenCalledExactlyOnceWith(`${teamId}/${saved.id}/original`, doc.blob, { contentType: 'text/plain', upsert: true });
    expect(rpc.mock.calls[1]).toEqual(['finalize_guideline_document', { p_document_id: saved.id }]);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]);
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
  });

  it('does not mark a failed upload ready and retries the same reservation without changing the local document', async () => {
    const { repo, rpc, upload } = fixture();
    upload.mockResolvedValueOnce({ error: { message: 'offline' } });
    const doc = await file();
    const originalId = doc.id;
    await expect(repo.save(doc)).rejects.toThrow('Could not upload');
    expect(rpc).toHaveBeenCalledTimes(1);
    const saved = await repo.save(doc);
    expect(rpc.mock.calls[0][1].p_document.id).toBe(rpc.mock.calls[1][1].p_document.id);
    expect(saved.status).toBe('ready');
    expect(doc.id).toBe(originalId);
    expect(doc.chunks[0].sourceId).toBe(originalId);
    expect(await doc.blob.text()).toContain('safe throwing partner');
  });

  it('can resume an own pending upload after reload but does not overwrite a ready or another coach’s document', async () => {
    const { repo, single, rpc } = fixture();
    single.mockResolvedValueOnce({ data: { id: docId, status: 'pending', created_by: userId } });
    await repo.save(await file());
    expect(rpc.mock.calls[0][1].p_document.id).toBe(docId);
    single.mockResolvedValueOnce({ data: { id: docId, status: 'ready', created_by: userId } });
    await expect(repo.save(await file())).rejects.toThrow('already in the team library');
    single.mockResolvedValueOnce({ data: { id: docId, status: 'pending', created_by: 'other-user' } });
    await expect(repo.save(await file())).rejects.toThrow('Another coach');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('uses team/status filters for lists and rejects rows from another team or with a forged object path', async () => {
    const { repo, reads, range } = fixture();
    expect((await repo.list())[0].shared).toBe(true);
    expect(reads[0].filters).toEqual([['team_id', teamId], ['status', 'ready']]);
    expect(range).toHaveBeenCalledWith(0, 99);
    expect(() => cloudGuidelineDocument({ ...row(), team_id: 'other-team' }, teamId)).toThrow('incomplete metadata');
    expect(() => cloudGuidelineDocument({ ...row(), storage_path: 'other-team/secret/original' }, teamId)).toThrow('incomplete metadata');
    expect(() => cloudGuidelineDocument({ ...row(), chunks: [{ ...row().chunks[0], sourceId: 'other-id' }] }, teamId)).toThrow('incomplete source passages');
  });

  it('prevents viewer writes before any storage or RPC request', async () => {
    const { client, rpc, upload } = fixture();
    const repo = createCloudGuidelinesRepository({ client, teamId, userId, canWrite: false });
    const doc = await file();
    for (const action of [() => repo.save(doc), () => repo.remove(docId), () => repo.restore(docId), () => repo.listTrash()]) {
      await expect(action()).rejects.toThrow('Only the team owner and coaches');
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('uses recoverable trash RPCs and only requests a short-lived link for an available team document', async () => {
    const { repo, rpc, createSignedUrl } = fixture();
    await repo.remove(docId);
    await repo.restore(docId);
    expect(rpc.mock.calls).toEqual([
      ['trash_guideline_document', { p_document_id: docId }],
      ['restore_guideline_document', { p_document_id: docId }],
    ]);
    const doc = cloudGuidelineDocument(row(), teamId);
    expect(await repo.getOriginalUrl(doc)).toContain('/object/sign/');
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith(`${teamId}/${docId}/original`, 60);
    await expect(repo.getOriginalUrl({ ...doc, status: 'trashed' })).rejects.toThrow('available document');
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
});
