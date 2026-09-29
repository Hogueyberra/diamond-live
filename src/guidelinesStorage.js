export const GUIDELINES_DB_NAME = "diamond-live-private-guidelines";
export const MAX_GUIDELINE_BYTES = 20 * 1024 * 1024;
export const MAX_GUIDELINE_PAGES = 150;
const STORE = "documents";

function storageError(error, action = "save") {
  if (error?.name === "QuotaExceededError") return new Error("Browser storage is full. This document was not saved. Remove an unused document or free up browser storage and try again.");
  if (error?.name === "ConstraintError") return new Error("This document is already in your private library. Open the existing copy or remove it before uploading it again.");
  return new Error(`Private browser storage could not ${action} your guidelines. Your existing documents have not been changed. Check that browser storage is enabled and try again.`);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      if (!globalThis.indexedDB) throw new Error("IndexedDB is unavailable");
      request = globalThis.indexedDB.open(GUIDELINES_DB_NAME, 1);
    } catch (error) { reject(storageError(error, "open")); return; }
    let rejected = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("contentHash", "contentHash", { unique: true });
    };
    request.onerror = () => reject(storageError(request.error, "open"));
    request.onblocked = () => {
      rejected = true;
      reject(new Error("The guidelines library is open in another tab. Close other Diamond Live tabs and try again."));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function boundedString(value, maximum, required = false) {
  return typeof value === "string" && value.length <= maximum && (!required || value.trim().length > 0);
}

export function validateDocument(doc) {
  if (!doc || !boundedString(doc.id, 160, true) || !boundedString(doc.title, 200, true)
    || !boundedString(doc.fileName, 255, true) || !boundedString(doc.division, 100, true)
    || !boundedString(doc.year, 4) || (doc.year !== "" && !/^\d{4}$/.test(doc.year))
    || !["application/pdf", "text/plain", "text/markdown"].includes(doc.mimeType)
    || !Number.isInteger(doc.pageCount) || doc.pageCount < 1 || doc.pageCount > MAX_GUIDELINE_PAGES
    || !boundedString(doc.createdAt, 40, true) || !Number.isFinite(Date.parse(doc.createdAt))
    || !(doc.blob instanceof Blob) || doc.blob.size < 1 || doc.blob.size > MAX_GUIDELINE_BYTES
    || !/^[a-f0-9]{64}$/.test(doc.contentHash ?? "")
    || !Array.isArray(doc.chunks) || !doc.chunks.length || doc.chunks.length > 15000
    || !Array.isArray(doc.warnings) || doc.warnings.length > MAX_GUIDELINE_PAGES
    || doc.warnings.some((warning) => !boundedString(warning, 2000, true))) {
    throw new Error("This guidelines document is incomplete or damaged. The original saved documents have not been changed.");
  }
  const ids = new Set();
  for (const chunk of doc.chunks) {
    if (!chunk || !boundedString(chunk.id, 200, true) || ids.has(chunk.id) || chunk.sourceId !== doc.id
      || !boundedString(chunk.title, 200, true) || !boundedString(chunk.text, MAX_GUIDELINE_BYTES, true)
      || !boundedString(chunk.section, 300) || chunk.year !== doc.year
      || !Array.isArray(chunk.divisions) || !chunk.divisions.length || chunk.divisions.length > 20
      || chunk.divisions.some((division) => !boundedString(division, 100, true))
      || (chunk.page !== null && (!Number.isInteger(chunk.page) || chunk.page < 1 || chunk.page > doc.pageCount))) {
      throw new Error("This guidelines document has damaged source passages. The original saved documents have not been changed.");
    }
    ids.add(chunk.id);
  }
}

async function transaction(mode, operation, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx;
    let result;
    let failure;
    try {
      tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { failure = request.error; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(storageError(failure || tx.error, action)); };
      tx.onerror = () => { failure ||= tx.error; };
    } catch (error) {
      try { tx?.abort(); } catch { /* The transaction may already have ended. */ }
      db.close();
      reject(storageError(error, action));
    }
  });
}

export async function listGuidelineDocuments() {
  const documents = await transaction("readonly", (store) => store.getAll(), "read");
  documents.forEach(validateDocument);
  return documents.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function saveGuidelineDocument(document) {
  validateDocument(document);
  await transaction("readwrite", (store) => store.add(document), "save");
  return document;
}

export async function deleteGuidelineDocument(id) {
  if (!boundedString(id, 160, true)) throw new Error("Choose a valid guidelines document to remove.");
  await transaction("readwrite", (store) => store.delete(id), "remove");
}

function readBytes(file) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("This file could not be read. Select the file again and retry."));
    reader.readAsArrayBuffer(file);
  });
}

function textChunks(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 2400, text.length);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n\n", end);
      const space = text.lastIndexOf(" ", end);
      if (paragraph > start + 800) end = paragraph + 2;
      else if (space > start + 800) end = space + 1;
    }
    const passage = text.slice(start, end);
    if (passage.trim()) chunks.push({ text: passage, page: null });
    start = end;
  }
  return chunks;
}

async function extractPdf(buffer, onProgress) {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer.slice(0)), isEvalSupported: false, useWorkerFetch: false,
    disableFontFace: true, useSystemFonts: true,
  });
  let pdf;
  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_GUIDELINE_PAGES) throw new Error(`Use a PDF with ${MAX_GUIDELINE_PAGES} pages or fewer. This file has ${pdf.numPages} pages.`);
    const passages = [];
    const emptyPages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.filter((item) => typeof item.str === "string")
        .map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("").trim();
      if (text.replace(/\s/g, "").length >= 12) passages.push({ text, page: pageNumber });
      else emptyPages.push(pageNumber);
      page.cleanup();
      onProgress?.({ page: pageNumber, total: pdf.numPages });
    }
    if (!passages.length) throw new Error("This PDF has no searchable text. It may be a scanned document. Use a text-based PDF or export an OCR-processed copy before uploading.");
    return { passages, pageCount: pdf.numPages, warnings: emptyPages.length
      ? [`Pages ${emptyPages.join(", ")} have little or no searchable text. Scanned or image-only content on those pages is not searchable; check the original PDF.`] : [] };
  } catch (error) {
    if (error?.name === "PasswordException") throw new Error("This PDF is password protected. Upload an unlocked copy that you are permitted to use.");
    if (error?.name === "InvalidPDFException") throw new Error("This file could not be read as a PDF. Try exporting a fresh PDF copy.");
    throw error;
  } finally {
    await loadingTask.destroy();
  }
}

/** Parse locally. This function never uploads a file or sends document text to a service. */
export async function parseGuidelineFile(file, metadata = {}, onProgress) {
  if (!(file instanceof Blob) || !boundedString(file.name, 255, true)) throw new Error("Select a PDF, .txt, or .md file to add.");
  if (!file.size) throw new Error("This file is empty. Choose a document that contains guidelines.");
  if (file.size > MAX_GUIDELINE_BYTES) throw new Error("Choose a file smaller than 20 MB.");
  const extension = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (!["pdf", "txt", "md"].includes(extension)) throw new Error("Use a PDF, plain-text (.txt), or Markdown (.md) file.");
  const title = String(metadata.title ?? file.name.replace(/\.[^.]+$/, "")).trim();
  const division = String(metadata.division ?? "All divisions").trim();
  const year = String(metadata.year ?? "").trim();
  if (!boundedString(title, 200, true)) throw new Error("Give this document a title of 1–200 characters.");
  if (!boundedString(division, 100, true)) throw new Error("Choose a division or All divisions (up to 100 characters).");
  if (year !== "" && !/^\d{4}$/.test(year)) throw new Error("Use a four-digit year, or leave the year blank.");
  const buffer = await readBytes(file);
  if (!globalThis.crypto?.subtle) throw new Error("Private file import requires a secure browser page (HTTPS). Open the published Diamond Live link and try again.");
  const contentHash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", buffer)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let extraction;
  if (extension === "pdf") {
    if (!new TextDecoder().decode(buffer.slice(0, 1024)).includes("%PDF-")) throw new Error("This file does not appear to be a PDF. Choose the original PDF or a fresh exported copy.");
    extraction = await extractPdf(buffer, onProgress);
  } else {
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { throw new Error("This text file is not UTF-8. Save it as UTF-8 plain text or Markdown and try again."); }
    if (text.includes("\u0000")) throw new Error("This file contains binary content. Choose a PDF or a UTF-8 text file.");
    if (!text.trim()) throw new Error("This file has no searchable text. Choose a document that contains guidelines.");
    extraction = { passages: textChunks(text), pageCount: 1, warnings: [] };
    onProgress?.({ page: 1, total: 1 });
  }
  const id = `private-${globalThis.crypto.randomUUID()}`;
  const doc = {
    id, title, year, division, fileName: file.name,
    mimeType: extension === "pdf" ? "application/pdf" : extension === "md" ? "text/markdown" : "text/plain",
    blob: new Blob([buffer], { type: extension === "pdf" ? "application/pdf" : extension === "md" ? "text/markdown" : "text/plain" }),
    contentHash, pageCount: extraction.pageCount, createdAt: new Date().toISOString(), warnings: extraction.warnings,
    chunks: extraction.passages.map((passage, index) => ({
      id: `${id}:chunk:${index + 1}`, sourceId: id, title, text: passage.text,
      section: "", page: passage.page, divisions: [division], year,
    })),
  };
  validateDocument(doc);
  return doc;
}
