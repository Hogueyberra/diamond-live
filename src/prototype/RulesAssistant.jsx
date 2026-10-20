import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, BookOpen, X } from "@phosphor-icons/react";
import { lookupRules, RULE_DIVISIONS, RULE_QUESTIONS, RULE_SOURCE } from "./rulesLookup.js";
import "./rules-assistant.css";

export default function RulesAssistant({ onClose }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const transcript = useRef(null);
  const counter = useRef(0);
  const [division, setDivision] = useState("Minor B");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    // Focusing the heading keeps the iPhone keyboard from covering the suggested questions.
    dialog.current.querySelector("h2").focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const container = transcript.current;
    const latest = container?.querySelector(".pr-rules-exchange:last-child");
    if (latest)
      container.scrollTop +=
        latest.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }, [messages]);
  function ask(value) {
    const text = value.trim().slice(0, 500);
    if (!text) return;
    const response = lookupRules(text, division);
    setMessages((current) => [...current, { id: ++counter.current, question: text, ...response }]);
    setQuestion("");
    input.current.blur();
  }
  return (
    <dialog
      ref={dialog}
      className="pr-assistant pr-rules"
      aria-labelledby="pr-rules-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="pr-assistant-heading">
        <span className="pr-assistant-icon">
          <BookOpen size={21} />
        </span>
        <div>
          <h2 id="pr-rules-title" tabIndex={-1}>
            Consult the Rules
          </h2>
          <p>Your umpire’s desk · 2026 HVLL references</p>
        </div>
        <button className="pr-icon-button" aria-label="Close rules chat" onClick={onClose}>
          <X size={21} />
        </button>
      </header>
      <div className="pr-rules-scope">
        <label>
          Division
          <select value={division} onChange={(event) => setDivision(event.target.value)}>
            {RULE_DIVISIONS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <a href={RULE_SOURCE.url} target="_blank" rel="noopener noreferrer">
          Open rulebook <ArrowUpRight size={14} />
        </a>
      </div>
      <div
        ref={transcript}
        className="pr-messages"
        role="log"
        aria-label="Rules conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="pr-rules-welcome">
          <span>LET’S CHECK THE BOOK.</span>
          <h3>What’s the situation, Coach?</h3>
          <p>
            Ask about a rule and I’ll find the original passages, with section and page references.
            Start with your division above.
          </p>
        </div>
        {messages.map((message) => (
          <div className="pr-rules-exchange" key={message.id}>
            <div className="pr-message pr-message--coach">
              <div>
                <p>{message.question}</p>
                <small>{message.division} · 2026</small>
              </div>
            </div>
            <div className="pr-rules-reply">
              <p>{message.text}</p>
              {message.passages.map((passage) => (
                <article className="pr-rule-passage" key={passage.id}>
                  <span className="pr-rule-location">
                    {passage.divisions.join(" · ")} · {passage.section}
                  </span>
                  <h3>{passage.title}</h3>
                  <blockquote>{passage.snippet}</blockquote>
                  <details>
                    <summary>Read full passage</summary>
                    <p>{passage.text}</p>
                  </details>
                  <a href={passage.url} target="_blank" rel="noopener noreferrer">
                    2026 HVLL Bylaws · page {passage.page}
                    <ArrowUpRight size={14} />
                  </a>
                </article>
              ))}
              {message.total > 3 && (
                <p className="pr-rules-more">
                  Showing the first 3 matches. Narrow the question to find a more specific section.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pr-chat-bottom">
        <div className="pr-suggestions" aria-label="Suggested rules questions">
          {RULE_QUESTIONS.map((text, index) => (
            <button key={text} onClick={() => ask(text)}>
              {["Pitching limits", "Batting order", "Playing time"][index]}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
        >
          <label className="pr-sr-only" htmlFor="pr-rule-question">
            Ask a rules question
          </label>
          <input
            id="pr-rule-question"
            ref={input}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about the play or rule…"
            maxLength={500}
          />
          <button type="submit" disabled={!question.trim()} aria-label="Send rules question">
            <ArrowUp size={20} />
          </button>
        </form>
        <p>
          Searches the saved 2026 HVLL rulebook. Other rulebooks and later updates aren’t included.
          General sections may have division-specific conditions.
        </p>
      </div>
    </dialog>
  );
}
