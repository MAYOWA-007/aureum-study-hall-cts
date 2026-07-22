"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BaseQuestion, Domain, domainMeta, questions, researchSources } from "./question-bank";

type AnswerValue = number | number[] | string | string[] | null;
type Screen = "start" | "exam" | "results";
type Mode = "exam" | "study";
type SessionSize = 20 | 60 | 115 | 300;
type SessionDuty = "all" | Domain;
type AttemptSummary = {
  id: string;
  completedAt: string;
  mode: Mode;
  questions: number;
  answered: number;
  correct: number;
  percent: number;
  duty: SessionDuty;
};

const STORAGE_KEY = "aureum-study-hall-cts-session-v1";
const HISTORY_KEY = "aureum-study-hall-cts-history-v1";
const TOTAL_QUESTIONS = questions.length;
const OFFICIAL_EXAM_QUESTIONS = 115;
const OFFICIAL_EXAM_SECONDS = 150 * 60;
const SESSION_SIZES: SessionSize[] = [20, 60, 115, 300];
const DUTY_WEIGHTS: Record<Domain, number> = { A: 0.35, B: 0.30, C: 0.15, D: 0.20 };
const letters = "ABCDE";
const standardQuestionIds = questions.map((question) => question.id);
const questionById = new Map(questions.map((question) => [question.id, question]));

function shuffledIds(source: number[]) {
  const ids = [...source];
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]];
  }
  return ids;
}

function validQuestionOrder(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= questions.length
    && new Set(value).size === value.length
    && value.every((id) => typeof id === "number" && questionById.has(id));
}

function examSeconds(questionCount: number) {
  return Math.round((OFFICIAL_EXAM_SECONDS / OFFICIAL_EXAM_QUESTIONS) * questionCount);
}

function buildQuestionOrder(requested: SessionSize, duty: SessionDuty, shouldShuffle: boolean) {
  if (duty !== "all") {
    const candidates = questions.filter((question) => question.domain === duty).map((question) => question.id);
    const source = shouldShuffle ? shuffledIds(candidates) : candidates;
    return source.slice(0, Math.min(requested, source.length));
  }

  if (requested >= TOTAL_QUESTIONS) return shouldShuffle ? shuffledIds(standardQuestionIds) : [...standardQuestionIds];

  const domains = Object.keys(DUTY_WEIGHTS) as Domain[];
  const allocations = domains.map((domain) => ({
    domain,
    count: Math.floor(requested * DUTY_WEIGHTS[domain]),
    remainder: requested * DUTY_WEIGHTS[domain] % 1,
  }));
  let unassigned = requested - allocations.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocations].sort((a, b) => b.remainder - a.remainder)) {
    if (unassigned <= 0) break;
    item.count += 1;
    unassigned -= 1;
  }

  const selected = allocations.flatMap(({ domain, count }) => {
    const candidates = questions.filter((question) => question.domain === domain).map((question) => question.id);
    return (shouldShuffle ? shuffledIds(candidates) : candidates).slice(0, count);
  });
  return shouldShuffle ? shuffledIds(selected) : selected.sort((a, b) => a - b);
}

function sameArray(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isCorrect(question: BaseQuestion, response: AnswerValue) {
  if (response === null || response === undefined) return false;
  if (question.type === "numeric") {
    const value = Number(response);
    return Number.isFinite(value) && Math.abs(value - (question.numericAnswer ?? 0)) <= (question.tolerance ?? 0);
  }
  if (question.type === "order") return Array.isArray(response) && sameArray(response, question.steps ?? []);
  if (question.type === "multi") {
    return Array.isArray(response) && sameArray([...response].sort(), [...((question.answer as number[]) ?? [])].sort());
  }
  return response === question.answer;
}

function answered(question: BaseQuestion, response: AnswerValue) {
  if (question.type === "order") return Array.isArray(response) && response.length > 0;
  if (question.type === "multi") return Array.isArray(response) && response.length > 0;
  return response !== null && response !== undefined && response !== "";
}

function shuffledSteps(question: BaseQuestion) {
  const steps = [...(question.steps ?? [])];
  if (steps.length < 2) return steps;
  const shift = (question.id % (steps.length - 1)) + 1;
  return [...steps.slice(shift), ...steps.slice(0, shift)].reverse();
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function responseLabel(question: BaseQuestion, response: AnswerValue) {
  if (response === null || response === undefined || response === "") return "No response";
  if (question.type === "order" && Array.isArray(response)) return response.join(" → ");
  if (question.type === "multi" && Array.isArray(response)) return response.map((n) => question.choices?.[Number(n)]).join("; ");
  if (question.type === "numeric") return `${response} ${question.unit ?? ""}`.trim();
  if ((question.type === "single" || question.type === "connect") && typeof response !== "object") {
    return question.choices?.[Number(response)] ?? String(response);
  }
  if (question.type === "hotspot") return question.hotspots?.find((spot) => spot.id === response)?.label ?? String(response);
  return String(response);
}

function correctLabel(question: BaseQuestion) {
  if (question.type === "numeric") return `${question.numericAnswer} ${question.unit ?? ""}`.trim();
  if (question.type === "order") return question.steps?.join(" → ") ?? "";
  if (question.type === "multi") return ((question.answer as number[]) ?? []).map((n) => question.choices?.[n]).join("; ");
  if (question.type === "hotspot") return question.hotspots?.find((spot) => spot.id === question.answer)?.label ?? "";
  return question.choices?.[Number(question.answer)] ?? "";
}

function choiceRationale(question: BaseQuestion, index: number) {
  const correct = question.type === "multi"
    ? ((question.answer as number[]) ?? []).includes(index)
    : Number(question.answer) === index;
  const auditedRationale = question.rationales?.[index];
  if (auditedRationale) return `${correct ? "Correct" : "Incorrect"} — ${auditedRationale}`;
  if (correct) return `Correct — ${question.explanation}`;
  return `Incorrect — “${question.choices?.[index] ?? "This option"}” does not fit the condition in the prompt; the guide-supported response is “${correctLabel(question)}.”`;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mode, setMode] = useState<Mode>("exam");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [checked, setChecked] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(examSeconds(OFFICIAL_EXAM_QUESTIONS));
  const [hasSaved, setHasSaved] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "missed" | Domain>("missed");
  const [controlHeld, setControlHeld] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(true);
  const [questionIds, setQuestionIds] = useState<number[]>(standardQuestionIds);
  const [railOpen, setRailOpen] = useState(true);
  const [jumpValue, setJumpValue] = useState("");
  const [sessionSize, setSessionSize] = useState<SessionSize>(115);
  const [sessionDuty, setSessionDuty] = useState<SessionDuty>("all");
  const [attemptStartedAt, setAttemptStartedAt] = useState("");
  const [history, setHistory] = useState<AttemptSummary[]>([]);

  const orderedQuestions = useMemo(() => questionIds.map((id) => questionById.get(id)).filter((item): item is BaseQuestion => Boolean(item)), [questionIds]);
  const question = orderedQuestions[currentIndex] ?? questions[0];
  const response = answers[question.id] ?? null;
  const theme = Math.floor(currentIndex / 10) % 2 === 0 ? "emerald" : "crimson";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validQuestionOrder(parsed.questionIds)) setHasSaved(true);
      }
      const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
      if (Array.isArray(savedHistory)) setHistory(savedHistory.slice(0, 12));
    } catch {}
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(true); };
    const up = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(false); };
    const clear = () => setControlHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, []);

  useEffect(() => {
    if (screen !== "exam") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, currentIndex, answers, flagged, checked, timeLeft, shuffleOn, questionIds, sessionSize, sessionDuty, attemptStartedAt }));
  }, [screen, mode, currentIndex, answers, flagged, checked, timeLeft, shuffleOn, questionIds, sessionSize, sessionDuty, attemptStartedAt]);

  useEffect(() => {
    if (screen !== "exam" || mode !== "exam") return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setScreen("results");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, mode]);

  useEffect(() => {
    if (screen !== "exam" || question.type !== "order" || answers[question.id]) return;
    setAnswers((value) => ({ ...value, [question.id]: shuffledSteps(question) }));
  }, [screen, question, answers]);

  const setResponse = useCallback((value: AnswerValue) => {
    setAnswers((all) => ({ ...all, [question.id]: value }));
    setChecked((all) => all.filter((id) => id !== question.id));
  }, [question.id]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNavigator(false);
        setShowSubmit(false);
        setShowSources(false);
        return;
      }
      if (screen !== "exam" || showNavigator || showSubmit || showSources || !/^[1-5]$/.test(event.key)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const index = Number(event.key) - 1;
      if (question.type === "single" && question.choices?.[index]) setResponse(index);
      if (question.type === "connect" && question.choices?.[index]) setResponse(String(index));
      if (question.type === "hotspot" && question.hotspots?.[index]) setResponse(question.hotspots[index].id);
      if (question.type === "multi" && question.choices?.[index]) {
        const selected = (response as number[]) ?? [];
        setResponse(selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index]);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [screen, showNavigator, showSubmit, showSources, question, response, setResponse]);

  const sessionAnsweredCount = useMemo(() => orderedQuestions.filter((q) => answered(q, answers[q.id])).length, [orderedQuestions, answers]);
  const score = useMemo(() => orderedQuestions.filter((q) => isCorrect(q, answers[q.id])).length, [orderedQuestions, answers]);

  useEffect(() => {
    if (screen !== "results" || !attemptStartedAt || orderedQuestions.length === 0) return;
    const summary: AttemptSummary = {
      id: attemptStartedAt,
      completedAt: new Date().toISOString(),
      mode,
      questions: orderedQuestions.length,
      answered: sessionAnsweredCount,
      correct: score,
      percent: Math.round((score / orderedQuestions.length) * 100),
      duty: sessionDuty,
    };
    setHistory((current) => {
      if (current.some((attempt) => attempt.id === summary.id)) return current;
      const next = [summary, ...current].slice(0, 12);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    localStorage.removeItem(STORAGE_KEY);
    setHasSaved(false);
  }, [screen, attemptStartedAt, mode, orderedQuestions, sessionAnsweredCount, score, sessionDuty]);

  function start(selectedMode: Mode, forcedOrder?: number[]) {
    const nextOrder = forcedOrder?.length
      ? (shuffleOn ? shuffledIds(forcedOrder) : forcedOrder)
      : buildQuestionOrder(sessionSize, sessionDuty, shuffleOn);
    setMode(selectedMode);
    setScreen("exam");
    setCurrentIndex(0);
    setQuestionIds(nextOrder);
    setAnswers({});
    setFlagged([]);
    setChecked([]);
    setTimeLeft(examSeconds(nextOrder.length));
    setHasSaved(false);
    setAttemptStartedAt(new Date().toISOString());
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function resume() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      setMode(saved.mode ?? "exam");
      setCurrentIndex(saved.currentIndex ?? 0);
      setAnswers(saved.answers ?? {});
      setFlagged(saved.flagged ?? []);
      setChecked(saved.checked ?? []);
      setTimeLeft(saved.timeLeft ?? examSeconds(validQuestionOrder(saved.questionIds) ? saved.questionIds.length : OFFICIAL_EXAM_QUESTIONS));
      const restoredOrder = validQuestionOrder(saved.questionIds) ? saved.questionIds : [...standardQuestionIds];
      setQuestionIds(restoredOrder);
      setShuffleOn(Boolean(saved.shuffleOn));
      setSessionSize(SESSION_SIZES.includes(saved.sessionSize) ? saved.sessionSize : 115);
      setSessionDuty(["all", "A", "B", "C", "D"].includes(saved.sessionDuty) ? saved.sessionDuty : "all");
      setAttemptStartedAt(saved.attemptStartedAt ?? new Date().toISOString());
      setScreen("exam");
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      start("exam");
    }
  }

  function toggleFlag() {
    setFlagged((all) => all.includes(question.id) ? all.filter((id) => id !== question.id) : [...all, question.id]);
  }

  function goToQuestion(index: number) {
    setCurrentIndex(Math.max(0, Math.min(orderedQuestions.length - 1, index)));
    setJumpValue("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const position = Number(jumpValue);
    if (Number.isInteger(position) && position >= 1 && position <= orderedQuestions.length) goToQuestion(position - 1);
  }

  function moveStep(index: number, direction: -1 | 1) {
    const order = [...((response as string[]) ?? shuffledSteps(question))];
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setResponse(order);
  }

  function submit() {
    setShowSubmit(false);
    setScreen("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function practiceMissed() {
    const missedIds = orderedQuestions.filter((item) => !isCorrect(item, answers[item.id])).map((item) => item.id);
    if (!missedIds.length) return;
    setSessionDuty("all");
    start("study", missedIds);
  }

  function downloadResults() {
    const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = orderedQuestions.map((item, index) => [
      index + 1,
      item.id,
      item.domain,
      item.task,
      item.topic,
      answered(item, answers[item.id]) ? responseLabel(item, answers[item.id]) : "Unanswered",
      correctLabel(item),
      isCorrect(item, answers[item.id]) ? "Correct" : "Review",
      item.source,
    ].map(escapeCell).join(","));
    const csv = ["Position,Question ID,Duty,Task,Topic,Your response,Best answer,Result,Source", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aureum-cts-study-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printResults() {
    document.querySelectorAll<HTMLDetailsElement>("details.review-item").forEach((item) => { item.open = true; });
    window.setTimeout(() => window.print(), 50);
  }

  const selectedQuestionCount = sessionDuty === "all"
    ? sessionSize
    : Math.min(sessionSize, questions.filter((item) => item.domain === sessionDuty).length);
  const latestAttempt = history[0];
  const bestAttempt = history.length ? Math.max(...history.map((attempt) => attempt.percent)) : null;
  const sessionTotal = orderedQuestions.length;

  if (screen === "start") {
    return (
      <main className="landing emerald-theme">
        <section className="hero-shell">
          <div className="hero-kicker"><img className="seal" src="./favicon-512.png" alt="" /> Aureum Study Hall</div>
          <div className="hero-grid">
            <div>
              <p className="eyebrow">CTS® practice • {TOTAL_QUESTIONS}-question mastery bank</p>
              <h1>Build the judgment<br />behind the signal.</h1>
              <p className="lede">Free, independent practice grounded in the third-edition CTS Exam Guide and calibrated to the current four-duty outline. Your work stays on this device.</p>
              <div className="session-builder" aria-label="Build a practice session">
                <div className="builder-heading"><span>01</span><div><b>Choose your session</b><small>Start small, simulate the official pace, or work the complete bank.</small></div></div>
                <div className="size-options">
                  {SESSION_SIZES.map((size) => <button key={size} className={sessionSize === size ? "active" : ""} onClick={() => setSessionSize(size)}><b>{size}</b><small>{size === 20 ? "Quick drill" : size === 60 ? "Deep practice" : size === 115 ? "Exam simulation" : "Full mastery"}</small></button>)}
                </div>
                <label className="duty-select"><span>Coverage</span><select value={sessionDuty} onChange={(event) => setSessionDuty(event.target.value as SessionDuty)}><option value="all">All four duties — blueprint balanced</option>{(Object.keys(domainMeta) as Domain[]).map((domain) => <option value={domain} key={domain}>Duty {domain} — {domainMeta[domain].name}</option>)}</select></label>
                <div className="session-preview"><b>{selectedQuestionCount} questions</b><span>{formatTime(examSeconds(selectedQuestionCount))} timed pace</span><span>{sessionDuty === "all" ? "Blueprint balanced" : `Focused on duty ${sessionDuty}`}</span></div>
              </div>
              <div className="hero-actions">
                <button className="primary-btn" onClick={() => start("exam")}>Begin timed session <span>→</span></button>
                <button className="secondary-btn" onClick={() => start("study")}>Open study mode</button>
                {hasSaved && <button className="text-btn" onClick={resume}>Resume saved session</button>}
              </div>
              <button className={`shuffle-toggle ${shuffleOn ? "active" : ""}`} role="switch" aria-checked={shuffleOn} onClick={() => setShuffleOn((value) => !value)}>
                <span aria-hidden="true">⇄</span>
                <span><b>Shuffle this session</b><small>{shuffleOn ? "On — a fresh, balanced order will be created." : "Off — questions follow source-bank order."}</small></span>
                <i aria-hidden="true"><em /></i>
              </button>
            </div>
            <aside className="exam-card">
              <div className="card-flourish">MM</div>
              <p className="eyebrow">Inside the assessment</p>
              <div className="big-stat">{TOTAL_QUESTIONS}</div>
              <p className="stat-label">source-grounded questions</p>
              <div className="format-grid">
                <span><b>229</b> choice</span><span><b>27</b> hotspots</span><span><b>27</b> connections</span><span><b>10</b> sequences</span><span><b>5</b> numeric</span><span><b>2</b> multi-select</span>
              </div>
              <div className="rule" />
              <p className="fine-print">The 115-question simulation uses the official 150-minute pace. Shorter and longer sessions scale proportionally. Progress saves only in this browser.</p>
            </aside>
          </div>
          <div className="duty-strip">
            {(Object.keys(domainMeta) as Domain[]).map((domain) => <div key={domain}><span>{domain}</span><b>{domainMeta[domain].weight}</b><small>{domainMeta[domain].name}</small></div>)}
          </div>
        </section>
        <section className="local-progress" aria-label="Local study progress">
          <div><p className="eyebrow">Private by design</p><h2>Your local study record</h2><p>No account, analytics, or cloud sync. Attempt history and resume data stay in this browser.</p></div>
          <div className="progress-stats">
            <span><small>Completed</small><strong>{history.length}</strong><em>saved attempts</em></span>
            <span><small>Best score</small><strong>{bestAttempt === null ? "—" : `${bestAttempt}%`}</strong><em>{bestAttempt === null ? "Complete a session" : "on this device"}</em></span>
            <span><small>Latest</small><strong>{latestAttempt ? `${latestAttempt.percent}%` : "—"}</strong><em>{latestAttempt ? `${latestAttempt.correct}/${latestAttempt.questions} correct` : "No result yet"}</em></span>
          </div>
        </section>
        <section className="integrity-note">
          <div>
            <p className="eyebrow">Built for honest preparation</p>
            <h2>Official concepts. Original practice.</h2>
          </div>
          <p>AVIXA states that the live CTS exam uses four response alternatives and one best answer. The diagrams, connections, ordering, numeric, and multi-select items here are custom learning interactions—not actual or leaked exam questions. No practice tool can guarantee a pass or predict a live exam.</p>
          <button className="source-link" onClick={() => setShowSources(true)}>Review research sources ↗</button>
        </section>
        {showSources && <SourcesModal onClose={() => setShowSources(false)} />}
      </main>
    );
  }

  if (screen === "results") {
    const percent = Math.round((score / sessionTotal) * 100);
    const attemptedAccuracy = sessionAnsweredCount ? Math.round((score / sessionAnsweredCount) * 100) : 0;
    const incorrectAnswered = Math.max(0, sessionAnsweredCount - score);
    const rating = percent >= 90 ? "Excellent" : percent >= 80 ? "Strong" : percent >= 70 ? "Developing" : percent >= 60 ? "Foundational" : "Needs focused review";
    const taskResults = Array.from(new Set(orderedQuestions.map((q) => q.task))).map((task) => {
      const set = orderedQuestions.filter((q) => q.task === task);
      const correct = set.filter((q) => isCorrect(q, answers[q.id])).length;
      const attempted = set.filter((q) => answered(q, answers[q.id])).length;
      return { task, correct, attempted, total: set.length, percent: Math.round((correct / set.length) * 100) };
    });
    const filtered = orderedQuestions.filter((q) => reviewFilter === "all" ? true : reviewFilter === "missed" ? !isCorrect(q, answers[q.id]) : q.domain === reviewFilter);
    return (
      <main className="results-page emerald-theme">
        <header className="results-hero">
          <button className="brand-button" onClick={() => setScreen("start")}><img className="seal small" src="./favicon-512.png" alt="" /> Aureum Study Hall</button>
          <button className="secondary-btn compact" onClick={() => setShowSources(true)}>Sources</button>
          <div className="score-ring" style={{ "--score": `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}%</strong><span>{score} / {sessionTotal}</span></div></div>
          <p className="eyebrow">Assessment complete</p>
          <h1>{percent >= 80 ? "Strong command." : percent >= 70 ? "Building consistency." : "Your next study map is ready."}</h1>
          <p className="lede">Review the evidence behind every response, then retake with a clean slate when you are ready.</p>
        </header>
        <section className="results-body">
          <div className="report-overview" aria-label="Attempt report summary">
            <div><small>Session rating</small><strong>{rating}</strong><span>{percent}% across this {sessionTotal}-question session</span></div>
            <div><small>Answered accuracy</small><strong>{attemptedAccuracy}%</strong><span>{score} correct from {sessionAnsweredCount} answered</span></div>
            <div><small>Answer status</small><strong>{sessionAnsweredCount}/{sessionTotal}</strong><span>{incorrectAnswered} incorrect · {sessionTotal - sessionAnsweredCount} unanswered · {flagged.length} flagged</span></div>
            <div><small>Attempt mode</small><strong>{mode === "exam" ? "Timed" : "Study"}</strong><span>The same complete review is provided in either mode</span></div>
          </div>
          <div className="report-section-title"><p className="eyebrow">Performance report</p><h2>Results by duty</h2><p>Overall scoring treats unanswered questions as incorrect. Answered accuracy isolates the questions you attempted.</p></div>
          <div className="domain-results">
            {(Object.keys(domainMeta) as Domain[]).map((domain) => {
              const set = orderedQuestions.filter((q) => q.domain === domain);
              if (!set.length) return null;
              const correct = set.filter((q) => isCorrect(q, answers[q.id])).length;
              const pct = Math.round(correct / set.length * 100);
              return <div className="domain-row" key={domain}><span className="domain-badge">{domain}</span><div><b>{domainMeta[domain].name}</b><small>{correct} of {set.length} correct</small></div><div className="bar"><i style={{ width: `${pct}%` }} /></div><strong>{pct}%</strong></div>;
            })}
          </div>
          <div className="report-section-title"><p className="eyebrow">Diagnostic detail</p><h2>Results by task</h2><p>Use this view to find the exact workflow areas that deserve another pass.</p></div>
          <div className="task-results">
            {taskResults.map((item) => <div className="task-row" key={item.task}><div><b>{item.task}</b><small>{item.correct} correct · {item.attempted} answered · {item.total} total</small></div><div className="bar"><i style={{ width: `${item.percent}%` }} /></div><strong>{item.percent}%</strong></div>)}
          </div>
          <div className="review-head">
            <div><p className="eyebrow">Detailed evidence review</p><h2>Question-by-question</h2><p>Open any row for your response, the best answer, teaching explanation, study takeaway, and choice-by-choice reasoning.</p></div>
            <div className="filter-chips">
              {(["missed", "all", "A", "B", "C", "D"] as const).map((filter) => <button key={filter} className={reviewFilter === filter ? "active" : ""} onClick={() => setReviewFilter(filter)}>{filter === "missed" ? "Missed" : filter === "all" ? "All" : `Duty ${filter}`}</button>)}
            </div>
          </div>
          <div className="review-list">
            {filtered.map((q) => {
              const correct = isCorrect(q, answers[q.id]);
              return <details className={`review-item ${correct ? "right" : "wrong"}`} key={q.id}><summary><span>{correct ? "✓" : "×"}</span><b>{String(q.id).padStart(3, "0")}</b><p>{q.prompt.replace(/ Select the correct labeled region in the diagram\.| Draw the connection from the prompt node to the best destination\./g, "")}</p><small>{q.topic}</small></summary><div className="review-content"><div><small>Your response</small><p>{responseLabel(q, answers[q.id])}</p></div><div><small>Best answer</small><p>{correctLabel(q)}</p></div><div className="explanation"><small>Why</small><p>{q.explanation}</p><cite>{q.source}</cite></div><div className="study-takeaway"><small>Study takeaway</small><p>{q.studyNote ?? q.explanation}</p></div>{q.rationales?.length ? <div className="choice-review"><small>Choice-by-choice reasoning</small><ol>{q.rationales.map((rationale, index) => <li key={index}><b>{letters[index]}. {q.choices?.[index]}</b><p>{rationale}</p></li>)}</ol></div> : q.interactionRationale ? <div className="choice-review"><small>Interaction reasoning</small><p>{q.interactionRationale}</p></div> : null}</div></details>;
            })}
          </div>
          <div className="results-actions">
            {score < sessionTotal && <button className="primary-btn" onClick={practiceMissed}>Practice {sessionTotal - score} review items</button>}
            <button className="secondary-btn" onClick={() => start("exam", questionIds)}>Retake this session</button>
            <button className="secondary-btn" onClick={downloadResults}>Download CSV report</button>
            <button className="secondary-btn" onClick={printResults}>Print / save PDF</button>
            <button className="text-btn results-home" onClick={() => setScreen("start")}>Build another session</button>
          </div>
        </section>
        {showSources && <SourcesModal onClose={() => setShowSources(false)} />}
      </main>
    );
  }

  const isChecked = checked.includes(question.id);
  const correctNow = isCorrect(question, response);
  const progress = ((currentIndex + 1) / orderedQuestions.length) * 100;

  return (
    <main className={`exam-page ${theme}-theme`}>
      <header className="exam-header">
        <button className="brand-button" onClick={() => setScreen("start")}><img className="seal small" src="./favicon-512.png" alt="" /><span>Aureum Study Hall</span></button>
        <div className="header-progress"><span style={{ width: `${progress}%` }} /><b>{currentIndex + 1}</b><small>of {sessionTotal}</small>{shuffleOn && <em>Shuffled</em>}</div>
        <div className="header-tools">
          {mode === "exam" && <div className={`timer ${timeLeft < 900 ? "urgent" : ""}`}><span>Time</span><b>{formatTime(timeLeft)}</b></div>}
          <button className="icon-btn" onClick={() => setShowSources(true)} aria-label="Open sources">⌁</button>
          <button className="navigator-btn" onClick={() => setShowNavigator(true)}>Navigator <b>{sessionAnsweredCount}/{sessionTotal}</b></button>
        </div>
      </header>

      <div className={`exam-layout ${railOpen ? "" : "rail-closed"}`}>
        <aside className="question-meta">
          <div className="rail-head"><b>Question rail</b><button onClick={() => setRailOpen(false)} aria-label="Close question rail">×</button></div>
          <span className="domain-badge large">{question.domain}</span>
          <p className="eyebrow">Duty {question.domain}</p>
          <h3>{domainMeta[question.domain].name}</h3>
          <div className="meta-rule" />
          <small>Task</small><p>{question.task}</p>
          <small>Topic</small><p>{question.topic}</p>
          <small>Format</small><p>{question.type === "single" ? "Single best answer" : question.type === "multi" ? "Select all that apply" : question.type === "hotspot" ? "Diagram hotspot" : question.type === "connect" ? "Connection task" : question.type === "order" ? "Sequencing task" : "Numeric entry"}</p>
          <div className="rail-navigator">
            <small>Jump to position</small>
            <form onSubmit={submitJump}><input aria-label="Question position" type="number" min="1" max={sessionTotal} value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} placeholder={`1–${sessionTotal}`} /><button type="submit">Go</button></form>
            <div className="rail-list-head"><b>Current order</b><span>{shuffleOn ? "Shuffled" : "Standard"}</span></div>
            <p className="rail-click-hint">Click any question to move around</p>
            <div className="rail-question-list" aria-label="Current question order">
              {orderedQuestions.map((item, index) => <button key={item.id} className={`${currentIndex === index ? "current" : ""} ${answered(item, answers[item.id]) ? "done" : ""} ${flagged.includes(item.id) ? "flag" : ""}`} onClick={() => goToQuestion(index)}><b>{index + 1}</b><span>Q{item.id} · {item.domain}</span></button>)}
            </div>
            <button className="rail-end" onClick={() => setShowSubmit(true)}><small>Finished for now?</small><b>End test &amp; see full report</b></button>
          </div>
        </aside>

        <section className="question-stage">
          {!railOpen && <button className="rail-reopen" onClick={() => setRailOpen(true)}><small>Click here to</small><span>Open question rail →</span></button>}
          <div className="question-number"><span>{String(currentIndex + 1).padStart(3, "0")}</span><button className={flagged.includes(question.id) ? "flagged" : ""} onClick={toggleFlag}>{flagged.includes(question.id) ? "◆ Flagged" : "◇ Flag for review"}</button></div>
          <h1>{question.prompt}</h1>
          <div className={`hint-key ${controlHeld ? "active" : ""}`}><kbd>Ctrl</kbd><span>{controlHeld ? "Rationale lens active" : "Hold Control for rationales · press 1–4 to answer choice items"}</span></div>
          <QuestionInput question={question} response={response} setResponse={setResponse} moveStep={moveStep} controlHeld={controlHeld} />
          {mode === "study" && isChecked && (
            <div className={`feedback ${correctNow ? "correct" : "incorrect"}`}>
              <b>{correctNow ? "Correct." : "Not quite."}</b>
              {!correctNow && <p><strong>Best answer:</strong> {correctLabel(question)}</p>}
              <p>{question.studyNote ?? question.explanation}</p><cite>{question.source}</cite>
            </div>
          )}
          <footer className="question-actions">
            <button className="secondary-btn compact" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}>← Previous</button>
            {mode === "study" && <button className="check-btn" disabled={!answered(question, response)} onClick={() => setChecked((all) => all.includes(question.id) ? all : [...all, question.id])}>Check answer</button>}
            {currentIndex < orderedQuestions.length - 1 ? <button className="primary-btn compact" onClick={() => goToQuestion(currentIndex + 1)}>Next question →</button> : <button className="primary-btn compact" onClick={() => setShowSubmit(true)}>Submit all</button>}
          </footer>
        </section>
      </div>

      <div className="bottom-rail"><button onClick={() => setShowNavigator(true)}><span style={{ width: `${sessionAnsweredCount / sessionTotal * 100}%` }} />Answered {sessionAnsweredCount} · Flagged {flagged.length} · Open {sessionTotal - sessionAnsweredCount}</button></div>
      {showNavigator && <Navigator orderedQuestions={orderedQuestions} current={currentIndex} answers={answers} flagged={flagged} onChoose={(index) => { goToQuestion(index); setShowNavigator(false); }} onClose={() => setShowNavigator(false)} onSubmit={() => { setShowNavigator(false); setShowSubmit(true); }} />}
      {showSubmit && <SubmitModal total={sessionTotal} answeredCount={sessionAnsweredCount} flagged={flagged.length} onCancel={() => setShowSubmit(false)} onSubmit={submit} />}
      {showSources && <SourcesModal onClose={() => setShowSources(false)} />}
    </main>
  );
}

function QuestionInput({ question, response, setResponse, moveStep, controlHeld }: { question: BaseQuestion; response: AnswerValue; setResponse: (value: AnswerValue) => void; moveStep: (index: number, direction: -1 | 1) => void; controlHeld: boolean }) {
  if (question.type === "single") return <div className={`choice-list ${controlHeld ? "hints-on" : ""}`}>{question.choices?.map((choice, index) => <button key={index} className={response === index ? "selected" : ""} aria-pressed={response === index} onClick={() => setResponse(index)}><span>{letters[index]}</span><p>{choice}</p><i /><em className="hint-bubble">{choiceRationale(question, index)}</em></button>)}</div>;
  if (question.type === "multi") {
    const selected = (response as number[]) ?? [];
    return <div className={`choice-list multi-list ${controlHeld ? "hints-on" : ""}`}>{question.choices?.map((choice, index) => <button key={index} className={selected.includes(index) ? "selected" : ""} aria-pressed={selected.includes(index)} onClick={() => setResponse(selected.includes(index) ? selected.filter((n) => n !== index) : [...selected, index])}><span>{selected.includes(index) ? "✓" : letters[index]}</span><p>{choice}</p><i /><em className="hint-bubble">{choiceRationale(question, index)}</em></button>)}</div>;
  }
  if (question.type === "numeric") return <div className={`numeric-entry ${controlHeld ? "hints-on" : ""}`}><label>Enter your answer</label><div><input inputMode="decimal" type="number" step="any" value={typeof response === "string" ? response : ""} onChange={(event) => setResponse(event.target.value)} autoFocus /><span>{question.unit}</span></div><small>Use numbers only. A reasonable rounding tolerance is accepted where appropriate.</small><em className="interaction-rationale">{question.interactionRationale}</em></div>;
  if (question.type === "order") {
    const order = (response as string[]) ?? shuffledSteps(question);
    return <div className={`order-task ${controlHeld ? "hints-on" : ""}`}><p className="interaction-hint">Use the arrow controls to arrange the steps from first to last.</p>{order.map((step, index) => <div className="order-row" key={step}><span>{index + 1}</span><p>{step}</p><div><button aria-label="Move up" disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button aria-label="Move down" disabled={index === order.length - 1} onClick={() => moveStep(index, 1)}>↓</button></div></div>)}<em className="interaction-rationale">{question.interactionRationale}</em></div>;
  }
  if (question.type === "hotspot") return <div className={`hotspot-wrap ${controlHeld ? "hints-on" : ""}`}><p className="interaction-hint">Click one region. The selected area will hold a gold marker.</p><div className="diagram-board"><div className="diagram-grid" />{question.hotspots?.map((spot, index) => <button key={spot.id} className={`hotspot ${response === spot.id ? "selected" : ""}`} aria-pressed={response === spot.id} style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }} onClick={() => setResponse(spot.id)}><b>{letters[index]}</b><span>{spot.label}</span><em className="hint-bubble">{choiceRationale(question, index)}</em></button>)}</div></div>;
  if (question.type === "connect") {
    const selected = typeof response === "string" ? Number(response) : -1;
    const targetY = selected >= 0 ? ((selected + 0.5) / (question.choices?.length ?? 4)) * 100 : 50;
    return <div className={`connect-task ${controlHeld ? "hints-on" : ""}`}><p className="interaction-hint">Click a destination to draw the connection.</p><div className="connection-board"><svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">{selected >= 0 && <line x1="27" y1="50" x2="73" y2={targetY} />}</svg><div className="source-node"><small>Prompt</small><b>Best match</b><i /></div><div className="target-list">{question.choices?.map((choice, index) => <button key={index} className={selected === index ? "selected" : ""} aria-pressed={selected === index} onClick={() => setResponse(String(index))}><i /><span>{letters[index]}</span><p>{choice}</p><em className="hint-bubble">{choiceRationale(question, index)}</em></button>)}</div></div></div>;
  }
  return null;
}

function Navigator({ orderedQuestions, current, answers, flagged, onChoose, onClose, onSubmit }: { orderedQuestions: BaseQuestion[]; current: number; answers: Record<number, AnswerValue>; flagged: number[]; onChoose: (index: number) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="modal-backdrop"><section className="navigator-panel" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="eyebrow">Session navigator</p><h2>{orderedQuestions.length} questions</h2></div><button onClick={onClose} aria-label="Close navigator">×</button></div><div className="legend"><span><i className="done" />Answered</span><span><i className="flag" />Flagged</span><span><i />Open</span></div><div className="question-grid">{orderedQuestions.map((q, index) => <button key={q.id} className={`${answered(q, answers[q.id]) ? "done" : ""} ${flagged.includes(q.id) ? "flag" : ""} ${current === index ? "current" : ""}`} onClick={() => onChoose(index)} aria-label={`Position ${index + 1}, source question ${q.id}`}>{q.id}</button>)}</div><div className="navigator-footer"><button className="secondary-btn compact" onClick={onClose}>Return to question</button><button className="primary-btn compact" onClick={onSubmit}>End session</button></div></section></div>;
}

function SubmitModal({ total, answeredCount, flagged, onCancel, onSubmit }: { total: number; answeredCount: number; flagged: number; onCancel: () => void; onSubmit: () => void }) {
  return <div className="modal-backdrop"><section className="submit-modal" role="dialog" aria-modal="true"><span className="seal">A</span><p className="eyebrow">Ready to score?</p><h2>End this {total}-question session</h2><p>You answered <b>{answeredCount}</b>, left <b>{total - answeredCount}</b> open, and flagged <b>{flagged}</b> for review. You will still receive a complete study report.</p><div><button className="secondary-btn" onClick={onCancel}>Keep working</button><button className="primary-btn" onClick={onSubmit}>End and score</button></div></section></div>;
}

function SourcesModal({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop"><section className="sources-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="eyebrow">Research ledger</p><h2>Primary confirmation sources</h2></div><button onClick={onClose} aria-label="Close sources">×</button></div><p className="source-intro">The original practice bank was developed from the CTS Certified Technology Specialist Exam Guide, Third Edition, then checked against the current official outline and primary technical sources below. Citations identify the learning basis; the copyrighted guide itself is not included.</p><div className="source-list">{researchSources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>{String(index + 1).padStart(2, "0")}</span><p>{source.label}</p><b>↗</b></a>)}</div><p className="fine-print">Independent study material. Not affiliated with, sponsored by, or endorsed by AVIXA. CTS® and AVIXA® are marks of AVIXA, Inc. No live exam questions are included.</p></section></div>;
}
