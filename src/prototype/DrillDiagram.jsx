import { useEffect, useId, useState } from "react";
import { Pause, Play, CaretLeft, CaretRight } from "@phosphor-icons/react";
import "./drill-media.css";

const demonstrations = {
  "quiet-glove": {
    kind: "ground",
    labels: ["Ready position", "Receive in front", "Reset in balance"],
  },
  "field-gather": {
    kind: "ground",
    labels: ["Field the roller", "Gather the feet", "Find the target"],
  },
  "read-move": { kind: "move", labels: ["Read the cue", "Move to the cone", "Stop in balance"] },
  "target-throws": {
    kind: "throw",
    labels: ["Find the target", "Set and throw", "Finish and reset"],
  },
  "track-secure": {
    kind: "catch",
    labels: ["Track the toss", "Move into position", "Secure the catch"],
  },
  "turn-track": {
    kind: "move",
    labels: ["Read the cue", "Turn toward the cone", "Face the coach"],
  },
  "outfield-step": {
    kind: "move",
    labels: ["Ready to move", "Choose the cone", "Return under control"],
  },
  "find-cutoff": {
    kind: "throw",
    labels: ["Find the receiver", "Set and throw", "Reset the lane"],
  },
  "soft-bunt": {
    kind: "bunt",
    labels: ["Set the bat", "Meet the ball softly", "Place it toward the target"],
  },
  "balanced-tee": {
    kind: "hit",
    labels: ["Balanced stance", "Controlled swing", "Pause at the finish"],
  },
  "bullpen-reset": {
    kind: "throw",
    labels: ["Calm setup", "Comfortable throw", "Reset before the next rep"],
  },
};

// Original schematic illustrations. A pose sequence teaches the movement;
// it is deliberately distinct from a linked creator's demonstration.
function Figure({ x = 115, y = 35, pose = 0, kind }) {
  const ground = kind === "ground" && pose === 1;
  const swing = kind === "hit" || kind === "bunt";
  const arms =
    kind === "bunt"
      ? "0,34 -6,26 27,26 0,34"
      : ground
        ? "0,34 -17,58 13,58 0,34"
        : swing
          ? pose === 0
            ? "-20,20 0,34 19,20"
            : "0,34 25,30 40,16"
          : kind === "catch"
            ? pose === 2
              ? "-15,27 0,34 15,27"
              : "-20,5 -14,20 0,34 14,20 20,5"
            : kind === "throw"
              ? pose === 0
                ? "-22,12 0,34 25,30"
                : "-22,36 0,34 28,12"
              : "-22,50 0,34 22,50";
  return (
    <g transform={`translate(${x} ${y + (ground ? 9 : 0)})`} className="dm-figure">
      <circle cy="4" r="9" fill="currentColor" stroke="none" />
      <path d="M0 17V53" />
      <polyline points={arms} />
      <path
        d={
          ground
            ? "M0 53L-20 65L-26 88M0 53L23 65L28 88"
            : pose === 1
              ? "M0 53L-18 68L-28 93M0 53L19 74L32 85"
              : "M0 53L-14 74L-18 93M0 53L16 74L20 93"
        }
      />
      {swing && (
        <path
          d={kind === "bunt" ? "M-8 26H60" : pose === 0 ? "M19 20L1 -14" : "M25 30L57 9"}
          stroke="#edc795"
          strokeWidth="7"
        />
      )}
      {ground && <ellipse cx="0" cy="58" rx="13" ry="7" fill="#d4aa76" stroke="none" />}
    </g>
  );
}

export default function DrillDiagram({ drill, controls = false, active = true }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const uid = useId().replace(/:/g, "");
  const demo = demonstrations[drill.id] || demonstrations["quiet-glove"];
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(media.matches);
      setPlaying(false);
    };
    media?.addEventListener?.("change", change);
    return () => media?.removeEventListener?.("change", change);
  }, []);
  useEffect(() => {
    setFrame(0);
    setPlaying(false);
  }, [drill.id]);
  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % 3), 1200);
    return () => window.clearInterval(timer);
  }, [playing, active, reduced]);
  const step = controls ? frame : 1;
  const moving = demo.kind === "move";
  const hitting = demo.kind === "hit" || demo.kind === "bunt";
  return (
    <div className={`dm-demo ${controls ? "dm-full" : "dm-thumbnail"}`}>
      <svg
        viewBox="0 0 320 170"
        role="img"
        aria-label={`${drill.title}: ${demo.labels[step]}`}
        className="dm-canvas"
      >
        <defs>
          <pattern id={`turf-${uid}`} width="48" height="170" patternUnits="userSpaceOnUse">
            <rect width="24" height="170" fill="#ffffff" opacity=".035" />
          </pattern>
          <marker
            id={`arrow-${uid}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0L6 3L0 6Z" fill="#e9d9b7" />
          </marker>
        </defs>
        <rect width="320" height="170" fill="#2d583d" />
        <rect width="320" height="170" fill={`url(#turf-${uid})`} />
        <path d="M24 139H296" stroke="#e9e9d6" strokeOpacity=".3" />
        {moving ? (
          <>
            {[60, 165, 265].map((x) => (
              <path key={x} d={`M${x - 8} 139l8 -16 8 16Z`} fill="#e3a576" />
            ))}
            <path d="M85 115Q145 70 240 114" className="dm-path" markerEnd={`url(#arrow-${uid})`} />
            <Figure
              x={[90, 170, drill.id === "outfield-step" ? 90 : 240][step]}
              y={39}
              kind="move"
              pose={step}
            />
          </>
        ) : hitting ? (
          <>
            <Figure x={122} y={38} kind={demo.kind} pose={step} />
            {demo.kind === "hit" && (
              <path d="M180 136V91M166 136H194" stroke="#d1baa0" strokeWidth="4" />
            )}
            <circle cx={step === 2 ? 251 : 180} cy={step === 2 ? 69 : 85} r="5" fill="#f9f1de" />
            <path
              d={demo.kind === "bunt" ? "M190 90Q220 119 266 132" : "M190 81Q218 52 266 61"}
              className="dm-path"
              markerEnd={`url(#arrow-${uid})`}
            />
          </>
        ) : demo.kind === "throw" ? (
          <>
            <Figure x={104} y={36} kind="throw" pose={step} />
            <rect
              x="246"
              y="49"
              width="39"
              height="77"
              rx="4"
              fill="none"
              stroke="#c0cdb8"
              strokeWidth="3"
            />
            <circle cx="265" cy="86" r="13" fill="none" stroke="#e3aa77" strokeWidth="3" />
            <path d="M140 55Q205 20 259 80" className="dm-path" markerEnd={`url(#arrow-${uid})`} />
            <circle cx={[82, 180, 264][step]} cy={[49, 43, 86][step]} r="5" fill="#fff5dd" />
          </>
        ) : demo.kind === "catch" ? (
          <>
            <Figure x={[160, 183, 183][step]} y={37} kind="catch" pose={step} />
            <path d="M45 90Q96 -5 176 48" className="dm-path" markerEnd={`url(#arrow-${uid})`} />
            <circle cx={[64, 132, 183][step]} cy={[61, 22, 64][step]} r="5" fill="#fff5dd" />
          </>
        ) : (
          <>
            <Figure
              x={123}
              y={31}
              kind="ground"
              pose={drill.id === "field-gather" ? (step + 1) % 3 : step}
            />
            <path d="M270 130H158" className="dm-path" markerEnd={`url(#arrow-${uid})`} />
            <circle cx={[245, 139, 123][step]} cy={[130, 126, 86][step]} r="5" fill="#fff5dd" />
            <path d="M40 139l9 -16 9 16ZM283 139l9 -16 9 16Z" fill="#e3a576" />
          </>
        )}
      </svg>
      {controls && (
        <>
          <div className="dm-controls">
            <button
              type="button"
              aria-label="Previous demonstration step"
              onClick={() => {
                setPlaying(false);
                setFrame((frame + 2) % 3);
              }}
            >
              <CaretLeft />
            </button>
            <span>
              <strong>{frame + 1} / 3</strong> {demo.labels[frame]}
            </span>
            <button
              type="button"
              aria-label="Next demonstration step"
              onClick={() => {
                setPlaying(false);
                setFrame((frame + 1) % 3);
              }}
            >
              <CaretRight />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause demonstration" : "Play demonstration"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
            </button>
          </div>
          <p className="dm-caption">
            Original movement guide ·{" "}
            {reduced
              ? "Step through, or press play when ready"
              : "Play or step through the movement"}
          </p>
        </>
      )}
    </div>
  );
}
