import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle,
  LinkSimple,
  Plus,
  PencilSimple,
  X,
} from "@phosphor-icons/react";
import { PRACTICE_DRILLS } from "../practicePlanning.js";
import { categoryForDrill } from "./drillResources.js";
import DrillDiagram from "./DrillDiagram.jsx";
import IPhoneShareSetup from "./IPhoneShareSetup.jsx";
import { Link } from "react-router";
import "./drill-media.css";

const blank = {
  title: "",
  url: "",
  creator: "",
  drillId: "balanced-tee",
  notes: "",
  reviewed: false,
};

export function LessonGuide({ drill, active = true }) {
  return (
    <div className="lv-lesson">
      <DrillDiagram drill={drill} controls active={active} />
      <h3>Set up · {drill.minutes} minutes</h3>
      <p>{drill.setup}</p>
      <h3>Bring to the station</h3>
      <p>{drill.equipment}</p>
      <h3>Teach it in three steps</h3>
      <ol>
        {drill.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="lv-cue">
        <strong>One cue</strong>
        <p>{drill.coachingCue}</p>
      </div>
      <h3>Look for progress</h3>
      <p>{drill.measure}</p>
      <h3>Before the first rep</h3>
      <p>{drill.safetyNote}</p>
    </div>
  );
}

export default function VideoLibrary({
  library,
  query = "",
  active = true,
  initialFilter = "All",
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState(initialFilter);
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dialog = useRef(null);
  const details = useRef(null);
  const selected = library.resources.find((item) => item.id === selectedId);
  const drill = PRACTICE_DRILLS.find((item) => item.id === selected?.drillId);
  const resources = library.resources.filter((item) => {
    const activity = PRACTICE_DRILLS.find((d) => d.id === item.drillId);
    return (
      (filter === "All" || categoryForDrill(activity) === filter) &&
      `${item.title} ${item.creator} ${item.platform} ${item.notes} ${activity?.title || ""} ${activity?.objective || ""} ${categoryForDrill(activity)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  function edit(item = blank) {
    setForm({ ...item });
    setError("");
    dialog.current.showModal();
  }
  function save(event) {
    event.preventDefault();
    try {
      const item = library.save(form);
      setSelectedId(item.id);
      setMessage(`${item.title} saved to your video library.`);
      dialog.current.close();
    } catch (err) {
      setError(err.message);
    }
  }
  function select(id) {
    setSelectedId(id);
    if (window.matchMedia?.("(max-width:760px)").matches)
      requestAnimationFrame(() =>
        details.current?.scrollIntoView?.({ block: "start", behavior: "instant" }),
      );
  }
  return (
    <div className="lv-library">
      <div className="pcl-library-caption">
        <div>
          <h2>Great coaching is worth keeping.</h2>
          <p>
            YouTube, Instagram, TikTok, or any public HTTPS link. Add your context and build a
            lesson.
          </p>
        </div>
        <div className="lv-capture-actions">
          <IPhoneShareSetup />
          <Link className="lv-secondary" to="/prototype?capture=1">
            <Plus size={17} /> Quick save
          </Link>
          <button className="lv-primary" onClick={() => edit()}>
            <Plus size={17} /> Save video link
          </button>
        </div>
      </div>
      <div className="lv-library-status">
        <div className="pcl-filters">
          {["Inbox", "All", "Infield", "Outfield", "Hitting", "Throwing"].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === "Inbox" &&
                ` (${library.resources.filter((resource) => !resource.drillId).length})`}
            </button>
          ))}
        </div>
        <span>
          {library.persistent
            ? "Saved on this browser · prototype library"
            : "Session only · browser storage unavailable"}
        </span>
      </div>
      <div role="status" className="lv-status">
        {message}
      </div>
      <div className="lv-layout">
        <div className="lv-resource-grid">
          {resources.map((item) => {
            const activity = PRACTICE_DRILLS.find((d) => d.id === item.drillId);
            return (
              <article
                key={item.id}
                className={`lv-resource ${selectedId === item.id ? "lv-selected" : ""}`}
              >
                <button
                  className="lv-resource-cover"
                  aria-label={`Open lesson for ${item.title}`}
                  onClick={() => select(item.id)}
                >
                  <span className={`lv-platform lv-platform-${item.platform.toLowerCase()}`}>
                    <LinkSimple size={17} />
                    {item.platform}
                  </span>
                  <strong>{item.title}</strong>
                  <span>
                    {item.creator || "Creator not entered"} <ArrowUpRight size={17} />
                  </span>
                </button>
                <div className="lv-resource-body">
                  <span>
                    {activity
                      ? `${categoryForDrill(activity)} · ${activity.minutes} min guide`
                      : "Drill Inbox · organize later"}
                  </span>
                  <h3>{activity?.title || "A good find, waiting for a plan."}</h3>
                  <p>
                    {item.notes ||
                      activity?.objective ||
                      "Choose a skill and add a coaching note when you’re ready."}
                  </p>
                  <div className="lv-resource-footer">
                    <span className={item.reviewed ? "lv-reviewed" : ""}>
                      {item.reviewed ? "Coach reviewed" : "Needs review"}
                    </span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      Open source <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
          {!resources.length && (
            <div className="lv-empty">
              <LinkSimple size={36} />
              <h3>
                {library.resources.length
                  ? "No links match this search."
                  : "Turn a good find into a great lesson."}
              </h3>
              <p>
                {library.resources.length
                  ? "Try another skill, creator, or platform."
                  : "Save a demonstration, connect it to a skill, and add the coaching details you want to remember."}
              </p>
              {library.resources.length ? (
                <button className="lv-secondary" onClick={() => setFilter("All")}>
                  Show every skill
                </button>
              ) : (
                <button className="lv-primary" onClick={() => edit()}>
                  <Plus /> Save your first link
                </button>
              )}
              <small>
                Links open on the creator’s platform. Preview images and transcripts are not
                imported.
              </small>
            </div>
          )}
        </div>
        <aside ref={details} className="pcl-detail lv-detail">
          {selected ? (
            <>
              <div className="pcl-detail-heading">
                <span className="pcl-eyebrow">YOUR LESSON GUIDE</span>
                <button aria-label="Close video lesson" onClick={() => setSelectedId(null)}>
                  <X size={18} />
                </button>
              </div>
              <h2>{selected.title}</h2>
              <a className="lv-watch" href={selected.url} target="_blank" rel="noopener noreferrer">
                Watch on {selected.platform === "Web" ? "original site" : selected.platform}{" "}
                <ArrowUpRight />
              </a>
              <p>
                {selected.creator ? `Saved creator: ${selected.creator}` : "Creator not entered"} ·{" "}
                {selected.reviewed ? "Coach reviewed" : "Needs coach review"}
              </p>
              {selected.notes && (
                <div className="lv-cue">
                  <strong>Your coaching notes</strong>
                  <p>{selected.notes}</p>
                </div>
              )}
              <div className="lv-detail-actions">
                <button className="lv-secondary" onClick={() => edit(selected)}>
                  <PencilSimple /> Edit link
                </button>
                <button
                  className="lv-text"
                  onClick={() => {
                    library.remove(selected.id);
                    setSelectedId(null);
                    setMessage("Link removed from this prototype library.");
                  }}
                >
                  Remove link
                </button>
              </div>
              {drill ? (
                <>
                  <h3>Companion lesson: {drill.title}</h3>
                  <p>
                    Our original guide for this skill. Review the linked video separately and adapt
                    the lesson to your players.
                  </p>
                  <LessonGuide key={drill.id} drill={drill} active={active} />
                </>
              ) : (
                <div className="lv-inbox-note">
                  <strong>Saved now. Ready to organize later.</strong>
                  <p>
                    Choose the skill this video teaches to connect it to an original lesson guide
                    and matching development plans.
                  </p>
                  <button className="lv-secondary" onClick={() => edit(selected)}>
                    Organize this link
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="pcl-eyebrow">FROM A LINK TO A LESSON</span>
              <h2>Watch. Adapt. Practice.</h2>
              <ol className="lv-how">
                <li>
                  <strong>Keep the source</strong>
                  <p>Save a link and credit the creator.</p>
                </li>
                <li>
                  <strong>Give it a purpose</strong>
                  <p>Choose a skill and write the cue you want the player to remember.</p>
                </li>
                <li>
                  <strong>Bring it to Development</strong>
                  <p>
                    Reviewed links appear beside matching player focuses, ready to attach to a
                    proposal.
                  </p>
                </li>
              </ol>
              <div className="lv-cue">
                <CheckCircle size={24} />
                <p>
                  You decide whether the demonstration fits your player’s age, ability, and
                  equipment.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
      <dialog ref={dialog} className="lv-dialog" aria-labelledby="lv-form-title">
        <form onSubmit={save}>
          <div className="pcl-detail-heading">
            <span className="pcl-eyebrow">YOUR COACHING LIBRARY</span>
            <button
              type="button"
              aria-label="Close save video"
              onClick={() => dialog.current.close()}
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="lv-form-title">
            {form.id ? "Edit this coaching resource." : "A good drill starts with a good find."}
          </h2>
          <p>Save the original link, then give it a place in your coaching library.</p>
          <label>
            Video or post link
            <input
              autoFocus
              type="url"
              required
              maxLength={2000}
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value, reviewed: false })}
            />
          </label>
          <div className="lv-form-row">
            <label>
              Resource title
              <input
                required
                maxLength={120}
                placeholder="e.g. A simple tee setup"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Creator / coach
              <input
                maxLength={100}
                placeholder="Give the creator credit"
                value={form.creator}
                onChange={(e) => setForm({ ...form, creator: e.target.value })}
              />
            </label>
          </div>
          <label>
            Companion skill & lesson
            <select
              value={form.drillId}
              onChange={(e) => setForm({ ...form, drillId: e.target.value, reviewed: false })}
            >
              <option value="">Drill Inbox — choose a skill later</option>
              {PCT_OPTIONS.map(({ id, label }) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Coaching notes
            <textarea
              rows={3}
              maxLength={1500}
              placeholder="Useful timestamp, equipment, age adaptations, and one cue to teach…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label className="lv-checkbox">
            <input
              type="checkbox"
              checked={form.reviewed}
              disabled={!form.drillId}
              onChange={(e) => setForm({ ...form, reviewed: e.target.checked })}
            />
            <span>I watched this and reviewed its fit for our players.</span>
          </label>
          {!form.drillId && (
            <p className="sc-storage">
              Choose a companion skill before marking this resource reviewed.
            </p>
          )}
          {error && (
            <p className="lv-error" role="alert">
              {error}
            </p>
          )}
          <div className="lv-form-footer">
            <small>Stored in this browser. No video is downloaded.</small>
            <button type="submit" className="lv-primary">
              Save to library <Plus size={17} />
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
const PCT_OPTIONS = PRACTICE_DRILLS.map((drill) => ({
  id: drill.id,
  label: `${categoryForDrill(drill)} · ${drill.title}`,
}));
