import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Baseball,
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
import ClubhouseAssistant from "./ClubhouseAssistant.jsx";
import { AccountPanel } from "../AccountPanel.jsx";
import "./prototype.css";

const VIEWS = [
  { id: "desk", name: "Coach Desk", icon: House, component: CoachDesk },
  { id: "players", name: "Players", icon: UsersThree, component: PlayersView },
  { id: "calendar", name: "Calendar", icon: CalendarDots, component: CalendarView },
  { id: "development", name: "Development", icon: ChartLineUp, component: DevelopmentView },
  { id: "library", name: "Library", icon: Books, component: LibraryView },
];

export default function Prototype({ account }) {
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountName = account?.profile?.display_name || "Coach";
  const initials = account?.user ? accountName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "DC";
  const openAccount = () => { setAssistantMode(null); setTeamMenu(false); setAccountOpen(true); };
  useEffect(() => { setAssistantMode(null); }, [account?.user?.id, account?.activeTeamId]);
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
    document.title = "Diamond Live · Coach Desk";
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
          <nav className="pr-navigation" aria-label="Clubhouse navigation">
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
              Demo clubhouse
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
              {initials}
            </button>
          </div>
          {teamMenu && (
            <div className="pr-workspace-menu">
              <strong>{account?.user ? accountName : "Demo coach"}</strong>
              <p>Angels demo · Sample team data</p>
              {account?.user ? <button onClick={openAccount}>Your account and teams</button> : <Link to="/sign-in">Sign in to your team<ArrowUpRight size={15} /></Link>}
              <Link to="/workspace">
                Shared team records
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
          <span>Angels demo · Your clubhouse preview</span>
        </footer>
        {assistantMode === "coach" && !capturing && (
          <ClubhouseAssistant account={account} assessments={assessments} onClose={() => setAssistantMode(null)} onAccount={openAccount} />
        )}
        {accountOpen && account && <div className="pr-account-host"><AccountPanel key={account.user?.id ?? "guest"} account={account} onClose={() => setAccountOpen(false)} /></div>}
        {assistantMode === "rules" && !capturing && (
          <RulesAssistant onClose={() => setAssistantMode(null)} />
        )}
      </div>
    </>
  );
}
