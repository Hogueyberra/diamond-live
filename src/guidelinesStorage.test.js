import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GUIDELINES_DB_NAME, MAX_GUIDELINE_BYTES, parseGuidelineFile, listGuidelineDocuments, saveGuidelineDocument, deleteGuidelineDocument } from "./guidelinesStorage.js";

const pdfMock = vi.hoisted(() => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist", () => pdfMock);
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/assets/test-pdf-worker.mjs" }));

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  pdfMock.getDocument.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function file(text = "Players may practice fielding before the game.", name = "team-rules.txt") {
  return new File([text], name, { type: "text/plain" });
}

function pdfDocument(pages) {
  const cleanup = vi.fn();
  const destroy = vi.fn().mockResolvedValue(undefined);
  const getPage = vi.fn(async (page) => ({ getTextContent: async () => ({ items: [{ str: pages[page - 1], hasEOL: true }] }), cleanup }));
  pdfMock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: pages.length, getPage }), destroy });
  return { cleanup, destroy, getPage };
}

describe("local guidelines import", () => {
  it("preserves file bytes, title, year, division and original text without network requests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const source = file("# Practice\n\nNo throwing before warmup.\n", "guidelines.md");
    const progress = vi.fn();
    const doc = await parseGuidelineFile(source, { title: "Angels guidelines", division: "Minor B", year: 2026 }, progress);
    expect(doc.title).toBe("Angels guidelines");
    expect(doc.year).toBe("2026");
    expect(doc.mimeType).toBe("text/markdown");
    expect(await doc.blob.text()).toBe(await source.text());
    expect(doc.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.chunks[0]).toMatchObject({ sourceId: doc.id, page: null, text: "# Practice\n\nNo throwing before warmup.\n", divisions: ["Minor B"] });
    expect(progress).toHaveBeenCalledWith({ page: 1, total: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains every character when splitting a long text document", async () => {
    const original = "Detailed fielding practice and guidelines.\n\n".repeat(250);
    const doc = await parseGuidelineFile(file(original));
    expect(doc.chunks.length).toBeGreaterThan(1);
    expect(doc.chunks.map((chunk) => chunk.text).join("")).toBe(original);
    expect(new Set(doc.chunks.map((chunk) => chunk.id)).size).toBe(doc.chunks.length);
  });

  it("rejects unsupported, empty, oversized, binary, non-UTF8 and falsely named PDF files", async () => {
    await expect(parseGuidelineFile(file("rules", "rules.docx"))).rejects.toThrow("PDF, plain-text");
    await expect(parseGuidelineFile(file(""))).rejects.toThrow("empty");
    await expect(parseGuidelineFile(file("   \n"))).rejects.toThrow("no searchable text");
    await expect(parseGuidelineFile(new File([new Uint8Array(MAX_GUIDELINE_BYTES + 1)], "large.txt"))).rejects.toThrow("20 MB");
    await expect(parseGuidelineFile(file("text\u0000binary"))).rejects.toThrow("binary");
    await expect(parseGuidelineFile(new File([new Uint8Array([0xff, 0xfe])], "bad.txt"))).rejects.toThrow("UTF-8");
    await expect(parseGuidelineFile(file("not a pdf", "fake.pdf"))).rejects.toThrow("does not appear to be a PDF");
    expect(pdfMock.getDocument).not.toHaveBeenCalled();
  });

  it("rejects invalid metadata before parsing or saving", async () => {
    await expect(parseGuidelineFile(file(), { title: " ", year: "2026" })).rejects.toThrow("title");
    await expect(parseGuidelineFile(file(), { title: "x".repeat(201) })).rejects.toThrow("title");
    await expect(parseGuidelineFile(file(), { year: "next year" })).rejects.toThrow("four-digit");
    await expect(parseGuidelineFile(file(), { division: "" })).rejects.toThrow("division");
    expect(await listGuidelineDocuments()).toEqual([]);
  });

  it("extracts PDF page numbers, warns about image-only pages and closes its worker", async () => {
    const worker = pdfDocument(["Continuous batting order applies to all players.", "", "Pitching rules include rest requirements."]);
    const progress = vi.fn();
    const doc = await parseGuidelineFile(file("%PDF-1.7\nfake bytes for mocked reader", "rules.pdf"), {}, progress);
    expect(doc.pageCount).toBe(3);
    expect(doc.chunks.map((chunk) => chunk.page)).toEqual([1, 3]);
    expect(doc.warnings[0]).toContain("Pages 2");
    expect(progress).toHaveBeenCalledTimes(3);
    expect(pdfMock.GlobalWorkerOptions.workerSrc).toBe("/assets/test-pdf-worker.mjs");
    expect(pdfMock.getDocument.mock.calls[0][0]).toMatchObject({ isEvalSupported: false, useWorkerFetch: false });
    expect(worker.cleanup).toHaveBeenCalledTimes(3);
    expect(worker.destroy).toHaveBeenCalledOnce();
  });

  it("explains scanned PDFs and always releases the worker", async () => {
    const worker = pdfDocument(["", "2"]);
    await expect(parseGuidelineFile(file("%PDF-1.7", "scan.pdf"))).rejects.toThrow("OCR-processed");
    expect(worker.destroy).toHaveBeenCalledOnce();
  });

  it("rejects excessive page counts before reading pages", async () => {
    const worker = pdfDocument(Array(151).fill("Some guidelines apply to the team."));
    await expect(parseGuidelineFile(file("%PDF-1.7", "too-long.pdf"))).rejects.toThrow("150 pages");
    expect(worker.getPage).not.toHaveBeenCalled();
    expect(worker.destroy).toHaveBeenCalledOnce();
  });

  it("gives clear password errors and still destroys the loader", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    pdfMock.getDocument.mockImplementation(() => ({ promise: Promise.reject(Object.assign(new Error("Password required"), { name: "PasswordException" })), destroy }));
    await expect(parseGuidelineFile(file("%PDF-1.7", "locked.pdf"))).rejects.toThrow("password protected");
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe("private guidelines persistence", () => {
  it("saves blob and searchable passages together, reloads and deletes the document", async () => {
    const doc = await parseGuidelineFile(file());
    expect(await saveGuidelineDocument(doc)).toBe(doc);
    const [saved] = await listGuidelineDocuments();
    expect(saved.chunks).toEqual(doc.chunks);
    expect(await saved.blob.text()).toBe(await doc.blob.text());
    await deleteGuidelineDocument(doc.id);
    expect(await listGuidelineDocuments()).toEqual([]);
  });

  it("rejects duplicate bytes or IDs without replacing or deleting the original", async () => {
    const doc = await parseGuidelineFile(file());
    await saveGuidelineDocument(doc);
    const duplicate = await parseGuidelineFile(file(), { title: "Different label" });
    await expect(saveGuidelineDocument(duplicate)).rejects.toThrow("already in your private library");
    await expect(saveGuidelineDocument({ ...doc, title: "Overwrite attempt" })).rejects.toThrow("already in your private library");
    const saved = await listGuidelineDocuments();
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe(doc.title);
  });

  it("rejects damaged source chunks before opening a write transaction", async () => {
    const doc = await parseGuidelineFile(file());
    await saveGuidelineDocument(doc);
    await expect(saveGuidelineDocument({ ...doc, chunks: [{ ...doc.chunks[0], sourceId: "wrong-document" }] })).rejects.toThrow("damaged source passages");
    expect(await listGuidelineDocuments()).toHaveLength(1);
  });

  it("does not report success or retain a partial save if a transaction aborts after the add request", async () => {
    const original = await parseGuidelineFile(file());
    await saveGuidelineDocument(original);
    const added = await parseGuidelineFile(file("New private coaching guidance."));
    const actualAdd = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementationOnce(function (value) {
      const request = actualAdd.call(this, value);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    });
    await expect(saveGuidelineDocument(added)).rejects.toThrow("could not save");
    expect((await listGuidelineDocuments()).map((doc) => doc.id)).toEqual([original.id]);
  });

  it("reports quota failures and leaves the existing document intact", async () => {
    const original = await parseGuidelineFile(file());
    await saveGuidelineDocument(original);
    const added = await parseGuidelineFile(file("Additional guidelines."));
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementationOnce(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    await expect(saveGuidelineDocument(added)).rejects.toThrow("Browser storage is full");
    expect((await listGuidelineDocuments()).map((doc) => doc.id)).toEqual([original.id]);
  });

  it("reports unavailable storage without a successful-save result", async () => {
    const doc = await parseGuidelineFile(file());
    vi.stubGlobal("indexedDB", undefined);
    await expect(saveGuidelineDocument(doc)).rejects.toThrow("storage could not open");
    await expect(listGuidelineDocuments()).rejects.toThrow("existing documents have not been changed");
  });

  it("detects malformed stored records instead of silently losing them", async () => {
    await listGuidelineDocuments();
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(GUIDELINES_DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("documents", "readwrite");
        tx.objectStore("documents").add({ id: "damaged", title: "Corrupted record" });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
    await expect(listGuidelineDocuments()).rejects.toThrow("incomplete or damaged");
  });
});
