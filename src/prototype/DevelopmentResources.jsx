import { ArrowUpRight, Check, Plus } from "@phosphor-icons/react";
import { PRACTICE_DRILLS } from "../practicePlanning.js";
import { LessonGuide } from "./VideoLibrary.jsx";

const lessonForPlayer = {
  12: "field-gather",
  4: "balanced-tee",
  22: "outfield-step",
  18: "target-throws",
};

export default function DevelopmentResources({
  player,
  library,
  attached = [],
  onAttach,
  locked,
  onNavigate,
  active,
}) {
  const lesson = PRACTICE_DRILLS.find((drill) => drill.id === lessonForPlayer[player.id]);
  if (!lesson)
    return (
      <div className="lv-development">
        <h3>Build the lesson after observing.</h3>
        <p>Record this skill first, then choose a demonstration and coaching cue.</p>
        <button className="lv-secondary" onClick={() => onNavigate("library")}>
          Explore the Library <ArrowUpRight />
        </button>
      </div>
    );
  const matches = library.resources.filter((item) => item.drillId === lesson.id);
  const selected = matches.filter((item) => item.reviewed && attached.includes(item.id));
  return (
    <div className="lv-development">
      <span className="pp-eyebrow">SHOW THE SKILL</span>
      <h3>A lesson to build on.</h3>
      <p>
        {lesson.title} · Matched to {player.focus.toLowerCase()}.
      </p>
      <details>
        <summary>Open the visual lesson guide</summary>
        <LessonGuide key={lesson.id} drill={lesson} active={active} />
        <a className="pcl-source" href={lesson.sourceUrl} target="_blank" rel="noopener noreferrer">
          Original skill reference <ArrowUpRight />
        </a>
      </details>
      <h3>From your video library</h3>
      <p>
        Matched by the skill you chose when saving. Review each source before adding it to this
        player’s lesson.
      </p>
      {matches.map((item) => (
        <div className="lv-match" key={item.id}>
          <strong>{item.title}</strong>
          <small>
            {item.platform} · {item.creator || "Creator not entered"}
          </small>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Watch demonstration <ArrowUpRight size={14} />
          </a>
          {item.notes && <p>{item.notes}</p>}
          {item.reviewed ? (
            <button className="lv-secondary" disabled={locked} onClick={() => onAttach(item.id)}>
              {attached.includes(item.id) ? <Check size={14} /> : <Plus size={14} />}
              {attached.includes(item.id) ? "Remove from lesson" : "Add to lesson"}
            </button>
          ) : (
            <small>Needs coach review in the Library before attaching.</small>
          )}
        </div>
      ))}
      {!matches.length && (
        <p>
          No saved video matches this skill yet. Find a demonstration, then save its link in the
          Library.
        </p>
      )}
      {selected.length > 0 && (
        <p role="status">
          {selected.length} reviewed {selected.length === 1 ? "video" : "videos"} attached to{" "}
          {player.name.split(" ")[0]}’s lesson.
        </p>
      )}
      <div className="lv-detail-actions">
        <a
          className="lv-secondary"
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`youth baseball ${lesson.title} drill`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Find on YouTube <ArrowUpRight size={14} />
        </a>
        <button className="lv-text" onClick={() => onNavigate("library")}>
          Open Library
        </button>
      </div>
    </div>
  );
}
