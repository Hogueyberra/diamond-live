import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Baseball,
  ArrowUp,
  ArrowUpRight,
  Flag,
  X,
  House,
  UsersThree,
  CalendarDots,
  ChartLineUp,
  Books,
  CaretDown,
  CheckCircle,
} from "@phosphor-icons/react";
import CoachDesk from "./CoachDesk.jsx";
import PlayersView from "./PlayersView.jsx";
import DevelopmentView from "./DevelopmentView.jsx";
import CalendarView from "./CalendarView.jsx";
import LibraryView from "./LibraryView.jsx";
import { useVideoLibrary } from "./drillResources.js";
import ShareCapture from "./ShareCapture.jsx";
import { usePlayerAssessments } from "./playerAssessments.js";
import RulesAssistant from "./RulesAssistant.jsx";
import "./prototype.css";

const VIEWS = [
  { id: "desk", name: "Coach Desk", icon: House, component: CoachDesk },
  { id: "players", name: "Players", icon: UsersThree, component: PlayersView },
  { id: "calendar", name: "Calendar", icon: CalendarDots, component: CalendarView },
  { id: "development", name: "Development", icon: ChartLineUp, component: DevelopmentView },
  { id: "library", name: "Library", icon: Books, component: LibraryView },
];

function replyTo(question) {
  const q = question.toLowerCase();
  if (/rule|document|library/.test(q))
    return {
      text: "Open the Library to find a drill or inspect a rule reference. The current coaching workspace also has the full searchable HVLL document library, with original passages and page citations.",
      view: "library",
      label: "Open Library",
    };
  if (/player|rating|assess|skill|progress/.test(q))
    return {
      text: "Players puts a sample roster beside each player’s observed skills, development focus, and recent work. Development walks through reviewing an assessment and approving a practice plan. These are sample records, separate from your team.",
      view: "players",
      label: "Review players",
    };
  if (/calendar|schedule|week|event/.test(q))
    return {
      text: "Calendar has a week view and an agenda. Select a session to see the plan and coach coverage. The events in this prototype are sample sessions; your existing team schedule stays in the current workspace.",
      view: "calendar",
      label: "See the calendar",
    };
  if (/practice|drill|develop|plan/.test(q))
    return {
      text: "Development connects an observed skill to a proposed drill and a reviewed practice plan. You can explore the approval flow here. In the current workspace, approved blocks can be assigned to coaches and tracked through completion.",
      view: "development",
      label: "Plan development",
    };
  if (/review|priorit|attention|approve/.test(q))
    return {
      text: "Start with the review queue on Coach Desk. Open a suggestion to inspect the observation and proposed next step before approving or dismissing it. Your choices update this prototype’s queue and activity history for this session.",
      view: "desk",
      label: "Open review queue",
    };
  return {
    text: "I can help you find your way around this prototype: review coaching priorities, explore a player, plan development, check the calendar, or find a drill. This guide uses prepared answers; it is not connected to live AI or private team records.",
    view: "desk",
    label: "Go to Coach Desk",
  };
}

function CoachAssistant({ onClose, onNavigate }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const bottom = useRef(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 0,
      from: "guide",
      text: "Good afternoon, Coach. Let’s make the next practice count. What would you like to explore?",
    },
  ]);
  const counter = useRef(0);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    input.current.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [messages]);
  const ask = (text) => {
    const value = text.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      { id: ++counter.current, from: "coach", text: value },
      { id: ++counter.current, from: "guide", ...replyTo(value) },
    ]);
    setQuestion("");
    input.current.focus();
  };
  return (
    <dialog
      ref={dialog}
      className="pr-assistant"
      aria-labelledby="pr-assistant-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="pr-assistant-heading">
        <span className="pr-assistant-icon">
          <Flag size={21} />
        </span>
        <div>
          <h2 id="pr-assistant-title">Coach’s assistant</h2>
          <p>Prototype guide · prepared answers</p>
        </div>
        <button className="pr-icon-button" aria-label="Close assistant" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="pr-messages" role="log" aria-label="Conversation">
        {messages.map((message) => (
          <div className={`pr-message pr-message--${message.from}`} key={message.id}>
            {message.from === "guide" && <Flag size={18} aria-hidden="true" />}
            <div>
              <p>{message.text}</p>
              {message.view && (
                <button
                  onClick={() => {
                    onNavigate(message.view);
                    onClose();
                  }}
                >
                  {message.label}
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="pr-chat-bottom">
        <div className="pr-suggestions">
          {["What needs my review?", "Help me plan practice", "Where are the rules?"].map(
            (text) => (
              <button key={text} onClick={() => ask(text)}>
                {text}
              </button>
            ),
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
        >
          <label className="pr-sr-only" htmlFor="pr-question">
            Ask the prototype guide
          </label>
          <input
            id="pr-question"
            ref={input}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this workspace…"
            maxLength={500}
          />
          <button type="submit" disabled={!question.trim()} aria-label="Send message">
            <ArrowUp size={20} />
          </button>
        </form>
        <p>Sample workspace. No messages are sent to families.</p>
      </div>
    </dialog>
  );
}

export default function Prototype() {
  const videoLibrary = useVideoLibrary();
  const assessments = usePlayerAssessments();
  const [params, setParams] = useSearchParams();
  const capturing = params.get("capture") === "1";
  const active = VIEWS.some((view) => view.id === params.get("view")) ? params.get("view") : "desk";
  const [assistantMode, setAssistantMode] = useState(null);
  const [visited, setVisited] = useState(() => new Set([active]));
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [playerSelectionVersion, setPlayerSelectionVersion] = useState(0);
  const [teamMenu, setTeamMenu] = useState(false);
  const main = useRef(null);
  const navigate = (view, playerId) => {
    if (!VIEWS.some((item) => item.id === view)) return;
    if (playerId != null) {
      setSelectedPlayerId(playerId);
      setPlayerSelectionVersion((version) => version + 1);
    }
    setVisited((current) => new Set([...current, view]));
    setParams(view === "desk" ? {} : { view });
    setTeamMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const previous = document.title;
    document.title = "Diamond Live · Coach Desk prototype";
    return () => {
      document.title = previous;
    };
  }, []);
  return (
    <>
      {capturing && (
        <ShareCapture
          library={videoLibrary}
          onBack={() => navigate("desk")}
          onOpenInbox={(showAll = false) => {
            setVisited((current) => new Set([...current, "library"]));
            setParams({ view: "library", section: showAll ? "video-links" : "inbox" });
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        />
      )}
      <div
        className="pr-app"
        style={capturing ? { display: "none" } : undefined}
        aria-hidden={capturing || undefined}
      >
        <a className="pr-skip" href="#prototype-main">
          Skip to workspace
        </a>
        <header className="pr-header">
          <button
            className="pr-brand"
            onClick={() => navigate("desk")}
            aria-label="Diamond Live Coach Desk"
          >
            <span className="pr-brand-mark">
              <Baseball size={26} weight="duotone" />
            </span>
            <span>
              <strong>Diamond Live</strong>
              <small>A little more purpose. Every practice.</small>
            </span>
          </button>
          <nav className="pr-navigation" aria-label="Prototype workspace">
            {VIEWS.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                aria-current={active === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={17} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="pr-header-actions">
            <span className="pr-demo-badge">
              <span />
              Interactive prototype
            </span>
            <button
              className="pr-assistant-trigger"
              aria-label="Coach’s assistant"
              onClick={() => setAssistantMode("coach")}
            >
              <Flag size={17} />
              <span>Coach’s assistant</span>
            </button>
            <button
              className="pr-avatar"
              aria-label="Open workspace menu"
              aria-expanded={teamMenu}
              onClick={() => setTeamMenu(!teamMenu)}
            >
              NC
            </button>
          </div>
          {teamMenu && (
            <div className="pr-workspace-menu">
              <strong>Coach’s sample workspace</strong>
              <p>Explore with fictional team data.</p>
              <Link to="/sign-in">Sign in to your team<ArrowUpRight size={15} /></Link>
              <Link to="/preview">
                Open current coaching workspace
                <ArrowUpRight size={15} />
              </Link>
              <Link to="/demo">
                Open scoring demo
                <ArrowUpRight size={15} />
              </Link>
              <button onClick={() => setTeamMenu(false)}>Close menu</button>
            </div>
          )}
        </header>
        <div className="pr-context">
          <span>
            <Baseball size={15} />
            <strong>Angels</strong>
            <span className="pr-context-divider">/</span>Minor B
            <span className="pr-season">Fall development</span>
          </span>
          <span>
            <CheckCircle size={14} />
            Sample team<span className="pr-context-divider">·</span>
            {videoLibrary.persistent
              ? "Video links saved in this browser"
              : "Session only · storage unavailable"}
          </span>
        </div>
        <main id="prototype-main" ref={main} tabIndex={-1}>
          {VIEWS.filter(({ id }) => visited.has(id) || active === id).map(
            ({ id, component: Component }) => (
              <div
                key={id}
                style={active !== id ? { display: "none" } : undefined}
                aria-hidden={active !== id || undefined}
              >
                <Component
                  onNavigate={navigate}
                  selectedPlayerId={selectedPlayerId}
                  playerSelectionVersion={playerSelectionVersion}
                  onOpenAssistant={() => setAssistantMode("coach")}
                  onOpenRules={() => setAssistantMode("rules")}
                  videoLibrary={videoLibrary}
                  assessments={assessments}
                  librarySection={params.get("section")}
                  active={active === id && !capturing}
                />
              </div>
            ),
          )}
        </main>
        <footer className="pr-footer">
          <span>
            <Baseball size={14} />
            Built around the coach. Focused on the player.
          </span>
          <Link to="/preview">
            Current workspace
            <ArrowUpRight size={14} />
          </Link>
        </footer>
        {assistantMode === "coach" && !capturing && (
          <CoachAssistant onClose={() => setAssistantMode(null)} onNavigate={navigate} />
        )}
        {assistantMode === "rules" && !capturing && (
          <RulesAssistant onClose={() => setAssistantMode(null)} />
        )}
      </div>
    </>
  );
}
