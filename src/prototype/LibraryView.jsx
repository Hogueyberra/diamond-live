import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  MagnifyingGlass,
  BookOpen,
  FileText,
  ArrowUpRight,
  Plus,
  Check,
  X,
  Clock,
  ArrowRight,
} from "@phosphor-icons/react";
import { PRACTICE_DRILLS } from "../practicePlanning.js";
import { COACHING_RULES } from "../coachingRules.js";
import DrillDiagram from "./DrillDiagram.jsx";
import VideoLibrary from "./VideoLibrary.jsx";
import "./calendar-library.css";

const category = (drill) =>
  drill.skillId.startsWith("if_")
    ? "Infield"
    : drill.skillId.startsWith("of_")
      ? "Outfield"
      : drill.skillId.startsWith("hit_")
        ? "Hitting"
        : "Throwing";
export default function LibraryView({ onNavigate, videoLibrary, active = true, librarySection }) {
  const detailRef = useRef(null);
  function showDrill(drill) {
    setSelected(drill);
    if (window.matchMedia?.("(max-width: 760px)").matches) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView?.({
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        }),
      );
    }
  }
  const [tab, setTab] = useState(
    ["inbox", "video-links"].includes(librarySection) ? "Video links" : "Drills",
  );
  useEffect(() => {
    if (["inbox", "video-links"].includes(librarySection)) setTab("Video links");
  }, [librarySection]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [added, setAdded] = useState([]);
  const drills = PRACTICE_DRILLS.filter(
    (drill) =>
      (filter === "All" || category(drill) === filter) &&
      `${drill.title} ${drill.objective} ${drill.equipment} ${drill.coachingCue} ${category(drill)}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const rules = COACHING_RULES.filter((rule) =>
    `${rule.title} ${rule.summary} ${rule.division} ${rule.section}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  function add(drill) {
    setAdded((current) => (current.includes(drill.id) ? current : [...current, drill.id]));
  }
  return (
    <section className="pcl-view">
      <div className="pcl-heading">
        <div>
          <span className="pcl-eyebrow">GOOD COACHING, WITH A STARTING POINT</span>
          <h1>Your next great practice.</h1>
          <p>Useful drills. Clear references. More time on the field.</p>
        </div>
        <div className="pcl-heading-stat">
          <strong>{PRACTICE_DRILLS.length}</strong>
          <span>
            purposeful drills
            <br />
            ready to explore
          </span>
        </div>
      </div>
      <div className="pcl-library-top">
        <div className="pcl-tabs" aria-label="Library sections">
          {["Drills", "Video links", "Rules", "Documents"].map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              aria-pressed={tab === item}
              onClick={() => {
                setTab(item);
                setSelected(null);
                setQuery("");
              }}
            >
              {item}
              {item === "Drills" && <span>{PRACTICE_DRILLS.length}</span>}
            </button>
          ))}
        </div>
        <label className="pcl-search">
          <MagnifyingGlass size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab.toLowerCase()}…`}
            aria-label={`Search ${tab.toLowerCase()}`}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
      </div>
      {tab === "Drills" && (
        <>
          <div className="lv-invite">
            <div>
              <strong>A demonstration makes the drill click.</strong>
              <p>Explore the movement guides below, or bring a great video into your library.</p>
            </div>
            <button className="lv-primary" onClick={() => setTab("Video links")}>
              <Plus size={16} /> Save a video link
            </button>
          </div>
          <div className="pcl-library-caption">
            <div>
              <h2>Small skills. Lasting confidence.</h2>
              <p>Original beginner activities, with linked Little League references.</p>
            </div>
            <div className="pcl-filters">
              {["All", "Infield", "Outfield", "Hitting", "Throwing"].map((item) => (
                <button
                  key={item}
                  aria-pressed={filter === item}
                  className={filter === item ? "active" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="pcl-library-layout">
            <div>
              <div className="pcl-drill-grid">
                {drills.map((drill) => {
                  const cat = category(drill);
                  return (
                    <article className="pcl-drill" key={drill.id}>
                      <button
                        className={`pcl-drill-art pcl-art-${cat.toLowerCase()}`}
                        onClick={() => showDrill(drill)}
                        aria-label={`View ${drill.title}`}
                      >
                        <span className="pcl-art-category">{cat}</span>
                        <DrillDiagram drill={drill} />
                        <span className="pcl-art-time">
                          <Clock size={12} />
                          {drill.minutes} min
                        </span>
                      </button>
                      <div className="pcl-drill-copy">
                        <button className="pcl-text-button" onClick={() => showDrill(drill)}>
                          <h3>{drill.title}</h3>
                        </button>
                        <p>{drill.objective}</p>
                        <div className="pcl-drill-bottom">
                          <span>Beginner friendly</span>
                          <button
                            aria-label={`${added.includes(drill.id) ? "Added" : "Add"} ${drill.title} to practice draft`}
                            onClick={() => add(drill)}
                          >
                            {added.includes(drill.id) ? <Check size={16} /> : <Plus size={16} />}{" "}
                            {added.includes(drill.id) ? "Added" : "Add"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {drills.length === 0 && (
                <div className="pcl-empty">
                  <MagnifyingGlass size={32} />
                  <h3>No drills found.</h3>
                  <p>Try another skill or clear your filters.</p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilter("All");
                    }}
                  >
                    Show all drills
                  </button>
                </div>
              )}
            </div>
            <aside ref={detailRef} className="pcl-detail pcl-library-detail">
              {selected ? (
                <>
                  <div className="pcl-detail-heading">
                    <span className="pcl-eyebrow">
                      {category(selected)} · {selected.minutes} MINUTES
                    </span>
                    <button aria-label="Close drill details" onClick={() => setSelected(null)}>
                      <X size={18} />
                    </button>
                  </div>
                  <h2>{selected.title}</h2>
                  <p>{selected.objective}</p>
                  <DrillDiagram key={selected.id} drill={selected} controls active={active} />
                  <h3>Set the scene</h3>
                  <p>{selected.setup}</p>
                  <h3>What to bring</h3>
                  <p>{selected.equipment}</p>
                  <h3>Run the drill</h3>
                  <ol className="pcl-blocks">
                    {selected.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="pcl-coaching-cue">
                    <span className="pcl-eyebrow">ONE CUE TO REMEMBER</span>
                    <p>“{selected.coachingCue}”</p>
                  </div>
                  <h3>Keep it safe</h3>
                  <p>{selected.safetyNote}</p>
                  <a
                    className="pcl-source"
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Little League reference
                    <ArrowUpRight size={16} />
                  </a>
                  <button className="pcl-primary" onClick={() => add(selected)}>
                    {added.includes(selected.id) ? <Check size={18} /> : <Plus size={18} />}{" "}
                    {added.includes(selected.id) ? "In practice draft" : "Add to practice draft"}
                  </button>
                </>
              ) : (
                <>
                  <span className="pcl-eyebrow">THE PRACTICE BENCH</span>
                  <h2>A plan with purpose.</h2>
                  <p>Choose a drill to see the setup, coaching cues, and source behind it.</p>
                  <div className="pcl-coaching-cue">
                    <BookOpen size={28} weight="duotone" />
                    <h3>Teach one thing well.</h3>
                    <p>Short, focused blocks give players room to try, reset, and try again.</p>
                  </div>
                </>
              )}
              <div className="pcl-divider" />
              <h3>
                Practice draft <span className="pcl-count">{added.length}</span>
              </h3>
              <div aria-live="polite">
                {added.length ? (
                  <>
                    <ul className="pcl-draft-list">
                      {added.map((id) => {
                        const drill = PRACTICE_DRILLS.find((d) => d.id === id);
                        return (
                          <li key={id}>
                            <span>
                              {drill.title}
                              <small>{drill.minutes} minutes</small>
                            </span>
                            <button
                              aria-label={`Remove ${drill.title}`}
                              onClick={() => setAdded(added.filter((item) => item !== id))}
                            >
                              <X size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="pcl-muted">
                      {added.reduce(
                        (total, id) =>
                          total + (PRACTICE_DRILLS.find((drill) => drill.id === id)?.minutes ?? 0),
                        0,
                      )}{" "}
                      minutes selected · local preview
                    </p>
                  </>
                ) : (
                  <p className="pcl-muted">Add a few drills to sketch out your next session.</p>
                )}
              </div>
              <small className="pcl-muted">
                Draft stays in this view only. Open the coaching workspace to create a saved plan.
              </small>
              <Link className="pcl-source" to="/preview">
                Open coaching workspace
                <ArrowUpRight size={16} />
              </Link>
            </aside>
          </div>
        </>
      )}
      {tab === "Video links" && (
        <VideoLibrary
          library={videoLibrary}
          query={query}
          active={active}
          initialFilter={librarySection === "inbox" ? "Inbox" : "All"}
        />
      )}
      {tab === "Rules" && (
        <div className="pcl-rules">
          <div className="pcl-library-caption">
            <div>
              <h2>Know the rule. Find the source.</h2>
              <p>Existing Minor B references · 2026 HVLL Bylaws · coach review pending.</p>
            </div>
          </div>
          {rules.map((rule) => (
            <article className="pcl-rule-card" key={rule.id}>
              <BookOpen size={27} weight="duotone" />
              <div>
                <span className="pcl-eyebrow">
                  {rule.division} · {rule.section}
                </span>
                <h3>{rule.title}</h3>
                <p>{rule.summary}</p>
                <span className="pcl-muted">{rule.verification}</span>
              </div>
              <a href={rule.sourceUrl} target="_blank" rel="noreferrer">
                Page {rule.page}
                <ArrowUpRight size={17} />
              </a>
            </article>
          ))}
          {!rules.length && (
            <div className="pcl-empty">
              <h3>No matching rule references.</h3>
              <p>Try “pitching,” “batting,” or “playing time.”</p>
            </div>
          )}
        </div>
      )}
      {tab === "Documents" && (
        <div className="pcl-documents">
          {"2026 HVLL Bylaws Minor B league rules"
            .toLowerCase()
            .includes(query.toLowerCase().trim()) ? (
            <article className="pcl-document-card">
              <FileText size={46} weight="duotone" />
              <span className="pcl-eyebrow">EXTERNAL REFERENCE · PDF</span>
              <h2>2026 HVLL Bylaws</h2>
              <p>
                The source document behind the Minor B rule references. Opens the original hosted
                PDF.
              </p>
              <a
                className="pcl-source"
                href={COACHING_RULES[0].sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Read source document
                <ArrowUpRight size={17} />
              </a>
            </article>
          ) : (
            <div className="pcl-empty">
              <h3>No documents match your search.</h3>
            </div>
          )}
          <div className="pcl-document-note">
            <BookOpen size={28} />
            <h3>Your team's knowledge, together.</h3>
            <p>
              This prototype shows an existing public reference. Manage team documents in the
              coaching workspace.
            </p>
            <Link to="/preview" className="pcl-source">
              Open existing workspace
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
