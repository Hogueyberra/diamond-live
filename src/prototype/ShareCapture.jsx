import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Baseball,
  CheckCircle,
  LinkSimple,
  Tray,
} from "@phosphor-icons/react";
import { parseVideoLink } from "./drillResources.js";
import { readSharedLink } from "./shareCapture.js";
import "./share-capture.css";

export default function ShareCapture({ library, onOpenInbox, onBack }) {
  const location = useLocation();
  const incoming = useMemo(() => {
    try {
      return { ...readSharedLink(location), error: "" };
    } catch (error) {
      return { url: "", title: "", error: error.message };
    }
  }, [location.hash, location.search]);
  return (
    <CaptureForm
      key={`${location.search}${location.hash}`}
      incoming={incoming}
      library={library}
      onOpenInbox={onOpenInbox}
      onBack={onBack}
    />
  );
}

function CaptureForm({ incoming, library, onOpenInbox, onBack }) {
  const [url, setUrl] = useState(incoming.url);
  const [error, setError] = useState(incoming.error);
  const [saved, setSaved] = useState(null);
  let preview;
  try {
    preview = parseVideoLink(url);
  } catch {
    preview = null;
  }
  function save(event) {
    event.preventDefault();
    try {
      setSaved(library.capture(url, incoming.title));
      setError("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <div className="pr-app sc-page">
      <header className="sc-brand">
        <Baseball size={29} />
        <span>
          Diamond Live<small>A good find. A better practice.</small>
        </span>
      </header>
      <main className="sc-card">
        {saved ? (
          <>
            <span className="sc-emblem">
              <CheckCircle size={34} />
            </span>
            <span className="sc-eyebrow">DRILL INBOX</span>
            <h1>
              {saved.duplicate
                ? "Already in your library."
                : saved.persistent
                  ? "Saved for your next practice."
                  : "Kept for this session."}
            </h1>
            <p>
              {saved.duplicate
                ? "You already have this link. Your existing notes and review are intact."
                : "Add a skill, coaching notes, and a companion lesson whenever you’re ready."}
            </p>
            <div className="sc-source">
              <LinkSimple size={21} />
              <div>
                <strong>{saved.item.title}</strong>
                <span>{new URL(saved.item.url).hostname}</span>
              </div>
            </div>
            <p className={saved.persistent ? "sc-storage" : "sc-warning"} role="status">
              {saved.persistent
                ? "Saved in this browser. You can return to the video now."
                : "Browser storage is unavailable. Keep this page open; this link will not survive a reload."}
            </p>
            <button className="sc-primary" onClick={() => onOpenInbox(Boolean(saved.item.drillId))}>
              {saved.item.drillId ? "Open video library" : "Open Drill Inbox"}{" "}
              <ArrowRight size={19} />
            </button>
            <button
              className="sc-secondary"
              onClick={() => {
                setUrl("");
                setSaved(null);
              }}
            >
              Save another link
            </button>
          </>
        ) : (
          <>
            <span className="sc-emblem">
              <Tray size={34} />
            </span>
            <span className="sc-eyebrow">SAVE NOW. COACH LATER.</span>
            <h1>One good drill, kept.</h1>
            <p>Drop the link in your Drill Inbox. Organize it when you have a moment.</p>
            <form onSubmit={save}>
              <label htmlFor="sc-url">Video or post link</label>
              <textarea
                id="sc-url"
                rows={3}
                required
                value={url}
                maxLength={2000}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Paste a YouTube, Instagram, TikTok, or other HTTPS link"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError("");
                }}
              />
              {preview && (
                <div className="sc-source">
                  <LinkSimple size={21} />
                  <div>
                    <strong>{preview.platform} link</strong>
                    <span>{new URL(preview.url).hostname}</span>
                  </div>
                </div>
              )}
              {error && (
                <p className="sc-warning" role="alert">
                  {error}
                </p>
              )}
              <button className="sc-primary" disabled={!url.trim()} type="submit">
                Save to Drill Inbox <ArrowRight size={19} />
              </button>
            </form>
            <p className="sc-storage">
              No title or skill required. Saved on this browser only; it won’t appear on your
              computer automatically.
            </p>
          </>
        )}
        <button className="sc-back" onClick={onBack}>
          <ArrowLeft size={15} /> Back to clubhouse
        </button>
      </main>
      <footer className="sc-footer">Prototype · Links stay on the creator’s platform</footer>
    </div>
  );
}
