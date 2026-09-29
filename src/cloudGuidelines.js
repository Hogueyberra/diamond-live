import { MAX_GUIDELINE_BYTES, MAX_GUIDELINE_PAGES, validateDocument } from './guidelinesStorage.js';

const BUCKET = 'diamond-guidelines';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_SECONDS = 60;
const PAGE_SIZE = 100;

function cloudError(error, action) {
  if (error?.code === '23505') return new Error('This file is already in the team library. Check Documents or Removed documents and restore the existing copy.');
  if (['42501', 'PGRST301'].includes(error?.code) || error?.status === 401 || error?.status === 403) return new Error('Your team access has changed. Sign in again or ask the team owner for access.');
  return new Error(`Could not ${action} the shared document. Check your connection and try again. Your browser copy has not been changed.`);
}

function unpack(data) { return Array.isArray(data) ? data[0] : data; }

/** Read a server row without trusting arbitrary object paths or passage shapes. */
export function cloudGuidelineDocument(row, teamId) {
  if (!row || !UUID.test(row.id) || row.team_id !== teamId || row.storage_path !== `${teamId}/${row.id}/original`
    || !['pending', 'ready', 'trashed'].includes(row.status)
    || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 200
    || typeof row.division !== 'string' || !row.division.trim() || row.division.length > 100
    || typeof row.year !== 'string' || (row.year !== '' && !/^\d{4}$/.test(row.year))
    || typeof row.file_name !== 'string' || !row.file_name || row.file_name.length > 255
    || !['application/pdf', 'text/plain', 'text/markdown'].includes(row.mime_type)
    || !Number.isInteger(row.byte_size) || row.byte_size < 1 || row.byte_size > MAX_GUIDELINE_BYTES
    || !Number.isInteger(row.page_count) || row.page_count < 1 || row.page_count > MAX_GUIDELINE_PAGES
    || !/^[a-f0-9]{64}$/.test(row.content_hash ?? '') || !Number.isFinite(Date.parse(row.created_at))
    || !Array.isArray(row.chunks) || !row.chunks.length || row.chunks.length > 15000
    || !Array.isArray(row.warnings) || row.warnings.length > MAX_GUIDELINE_PAGES
    || row.warnings.some((value) => typeof value !== 'string' || value.length > 2000)) {
    throw new Error('A shared document has incomplete metadata. Refresh the library or ask the team owner to review it.');
  }
  const ids = new Set();
  for (const chunk of row.chunks) {
    if (!chunk || typeof chunk.id !== 'string' || !chunk.id.startsWith(`${row.id}:chunk:`) || ids.has(chunk.id)
      || chunk.sourceId !== row.id || typeof chunk.title !== 'string' || !chunk.title.trim() || chunk.title.length > 200
      || typeof chunk.text !== 'string' || !chunk.text.trim() || chunk.text.length > MAX_GUIDELINE_BYTES
      || typeof chunk.section !== 'string' || chunk.section.length > 300 || chunk.year !== row.year
      || !Array.isArray(chunk.divisions) || !chunk.divisions.length || chunk.divisions.length > 20
      || chunk.divisions.some((value) => typeof value !== 'string' || !value.trim() || value.length > 100)
      || (chunk.page !== null && (!Number.isInteger(chunk.page) || chunk.page < 1 || chunk.page > row.page_count))) {
      throw new Error('A shared document has incomplete source passages. Refresh the library or ask the team owner to review it.');
    }
    ids.add(chunk.id);
  }
  return {
    id: row.id, title: row.title, year: row.year, division: row.division,
    fileName: row.file_name, mimeType: row.mime_type, byteSize: row.byte_size,
    contentHash: row.content_hash, pageCount: row.page_count, chunks: row.chunks,
    warnings: row.warnings, createdAt: row.created_at, storagePath: row.storage_path,
    status: row.status, shared: true,
  };
}

/** Every operation uses the signed-in user's client; storage and SQL enforce membership. */
export function createCloudGuidelinesRepository({ client, teamId, userId, canWrite, label = 'your team' }) {
  if (!client || !UUID.test(teamId) || !UUID.test(userId)) throw new Error('A signed-in team is required to open shared guidelines.');
  const reservations = new WeakMap();
  const assertWrite = () => { if (!canWrite) throw new Error('Only the team owner and coaches can change shared guidelines.'); };
  const documentFrom = (data) => cloudGuidelineDocument(unpack(data), teamId);
  async function rpc(name, args, action) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw cloudError(error, action);
    return documentFrom(data);
  }
  async function listStatus(status) {
    const documents = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.from('guideline_documents').select('*')
        .eq('team_id', teamId).eq('status', status).order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw cloudError(error, 'load');
      if (!Array.isArray(data)) throw new Error('The shared library returned an unreadable response. Refresh and try again.');
      documents.push(...data.map((row) => cloudGuidelineDocument(row, teamId)));
      if (data.length < PAGE_SIZE) return documents;
    }
  }
  return {
    scopeKey: `team-guidelines:${userId}:${teamId}`, label, canWrite: Boolean(canWrite),
    list: () => listStatus('ready'),
    async listTrash() { assertWrite(); return listStatus('trashed'); },
    async save(document) {
      assertWrite();
      validateDocument(document);
      let id = reservations.get(document);
      if (!id) {
        // Resume an interrupted upload even after a page reload, without replacing a ready file.
        const { data, error } = await client.from('guideline_documents').select('id,status,created_by')
          .eq('team_id', teamId).eq('content_hash', document.contentHash).maybeSingle();
        if (error) throw cloudError(error, 'check');
        if (data && data.status !== 'pending') throw cloudError({ code: '23505' }, 'save');
        if (data && data.created_by !== userId) throw new Error('Another coach has started uploading this file. Ask them to finish that upload.');
        id = data?.id ?? globalThis.crypto.randomUUID();
        if (!UUID.test(id)) throw new Error('The shared document identifier could not be read. Refresh and try again.');
        reservations.set(document, id);
      }
      const payload = {
        id, title: document.title, year: document.year, division: document.division,
        fileName: document.fileName, mimeType: document.mimeType, byteSize: document.blob.size,
        contentHash: document.contentHash, pageCount: document.pageCount, warnings: document.warnings,
        chunks: document.chunks.map((chunk, index) => ({ ...chunk, id: `${id}:chunk:${index + 1}`, sourceId: id })),
      };
      const reserved = await rpc('reserve_guideline_document', { p_team_id: teamId, p_document: payload }, 'reserve');
      if (reserved.id !== id) throw new Error('The document reservation did not match this upload. Refresh and try again.');
      if (reserved.status === 'ready') return reserved;
      if (reserved.status !== 'pending') throw cloudError({ code: '23505' }, 'save');
      const { error } = await client.storage.from(BUCKET).upload(reserved.storagePath, document.blob, { contentType: document.mimeType, upsert: true });
      if (error) throw cloudError(error, 'upload');
      const saved = await rpc('finalize_guideline_document', { p_document_id: id }, 'finish saving');
      if (saved.status !== 'ready') throw new Error('The upload has not finished. Keep this document open and try saving again.');
      return saved;
    },
    async remove(id) { assertWrite(); return rpc('trash_guideline_document', { p_document_id: id }, 'remove'); },
    async restore(id) { assertWrite(); return rpc('restore_guideline_document', { p_document_id: id }, 'restore'); },
    async getOriginalUrl(document) {
      if (!UUID.test(document?.id) || document.storagePath !== `${teamId}/${document.id}/original` || document.status !== 'ready') throw new Error('Choose an available document in this team library.');
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(document.storagePath, LINK_SECONDS);
      if (error) throw cloudError(error, 'open');
      if (!data?.signedUrl || !/^https:\/\//.test(data.signedUrl)) throw new Error('The original document link is unavailable. Try again.');
      return data.signedUrl;
    },
  };
}
