"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { allQuestions, BaseQuestion, Domain, domainMeta, EXAM_ORDER, ExamConfig, examConfigs, ExamId, finalCramQuestions, questions, researchSources } from "./question-bank";
import { NarrationPlayer } from "./narration-player";
import { rationaleNarrationClips, requestNarrationClip } from "./narration";

type AnswerValue = number | number[] | string | string[] | null;
type Screen = "start" | "exam" | "results";
type Mode = "exam" | "study";
type SessionSize = 20 | 60 | 75 | 115 | 300;
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
  examId?: ExamId;
};

const STORAGE_KEY = "aureum-study-hall-cts-session-v1";
const HISTORY_KEY = "aureum-study-hall-cts-history-v1";
const TOTAL_QUESTIONS = questions.length;
const OFFICIAL_EXAM_QUESTIONS = 115;
const OFFICIAL_EXAM_SECONDS = 150 * 60;
const SESSION_SIZES: SessionSize[] = [20, 60, 75, 115, 300];
const DUTY_WEIGHTS: Record<"A" | "B" | "C" | "D", number> = { A: 0.35, B: 0.30, C: 0.15, D: 0.20 };
const letters = "ABCDE";
const standardQuestionIds = questions.map((question) => question.id);
const finalCramQuestionIds = finalCramQuestions.map((question) => question.id);
const questionById = new Map(allQuestions.map((question) => [question.id, question]));

function seedToNumber(seed: string) {
  let value = 2166136261;
  for (const character of seed) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed: string) {
  let value = seedToNumber(seed);
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function newSessionSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0").toUpperCase();
}

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function shuffledIds(source: number[], random = Math.random) {
  const ids = [...source];
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]];
  }
  return ids;
}

function validQuestionOrder(value: unknown, lookup: Map<number, BaseQuestion> = questionById, maxLen = allQuestions.length): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= maxLen
    && new Set(value).size === value.length
    && value.every((id) => typeof id === "number" && lookup.has(id));
}

function examSeconds(questionCount: number) {
  return Math.round((OFFICIAL_EXAM_SECONDS / OFFICIAL_EXAM_QUESTIONS) * questionCount);
}

function diversifiedQuestionIds(candidates: BaseQuestion[], count: number, shouldShuffle: boolean, random: () => number) {
  const topicGroups = new Map<string, number[]>();
  for (const question of candidates) {
    const key = `${question.topic} ${correctLabel(question)}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    topicGroups.set(key, [...(topicGroups.get(key) ?? []), question.id]);
  }
  let groups = [...topicGroups.values()].map((ids) => shouldShuffle ? shuffledIds(ids, random) : ids);
  if (shouldShuffle) groups = shuffledIds(groups.map((_, index) => index), random).map((index) => groups[index]);
  const selected: number[] = [];
  for (let round = 0; selected.length < count && groups.some((group) => round < group.length); round += 1) {
    for (const group of groups) {
      if (round < group.length) selected.push(group[round]);
      if (selected.length === count) break;
    }
  }
  return selected;
}

function buildQuestionOrder(requested: SessionSize, duty: SessionDuty, shouldShuffle: boolean, mode: Mode, seed: string, examConfig: ExamConfig = examConfigs.cts) {
  const random = seededRandom(seed);
  const examStandardIds = examConfig.questions.map((question) => question.id);
  const examFinalCramIds = examConfig.finalCramQuestions.map((question) => question.id);
  if (requested === 75) return shouldShuffle ? shuffledIds(examFinalCramIds, random) : [...examFinalCramIds];

  const sourceQuestions = mode === "exam"
    ? examConfig.questions.filter((question) => question.type === "single")
    : examConfig.questions;

  if (duty !== "all") {
    const candidates = sourceQuestions.filter((question) => question.domain === duty);
    const count = Math.min(requested, candidates.length);
    const selected = diversifiedQuestionIds(candidates, count, shouldShuffle, random);
    return shouldShuffle ? shuffledIds(selected, random) : selected;
  }

  if (requested >= examConfig.questions.length) return shouldShuffle ? shuffledIds(examStandardIds, random) : [...examStandardIds];

  const domains = examConfig.domains;
  const allocations = domains.map((domain) => {
    const weight = examConfig.domainMeta[domain]?.weightNum ?? (DUTY_WEIGHTS[domain as "A" | "B" | "C" | "D"] ?? 0.25);
    return {
      domain,
      count: Math.floor(requested * weight),
      remainder: (requested * weight) % 1,
    };
  });
  let unassigned = requested - allocations.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocations].sort((a, b) => b.remainder - a.remainder)) {
    if (unassigned <= 0) break;
    item.count += 1;
    unassigned -= 1;
  }

  const selected = allocations.flatMap(({ domain, count }) => {
    const candidates = sourceQuestions.filter((question) => question.domain === domain);
    return diversifiedQuestionIds(candidates, count, shouldShuffle, random);
  });
  return shouldShuffle ? shuffledIds(selected, random) : selected.sort((a, b) => a - b);
}

function visiblePrompt(question: BaseQuestion) {
  return question.prompt
    .replace(/\s*Select the correct labeled region in the diagram\.\s*$/i, "")
    .replace(/\s*Draw the connection from the prompt node to the best destination\.\s*$/i, "")
    .trim();
}

function questionStyle(question: BaseQuestion) {
  if (question.type === "single") return "Single best answer";
  if (question.type === "multi") return "Multiple-answer study activity";
  if (question.type === "hotspot") return "Labeled-choice study activity";
  if (question.type === "connect") return "Matching study activity";
  if (question.type === "order") return "Sequencing study activity";
  return "Calculation study activity";
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
    : question.type === "hotspot"
      ? question.hotspots?.[index]?.id === question.answer
      : Number(question.answer) === index;
  const auditedRationale = question.rationales?.[index];
  if (auditedRationale) {
    const normalized = auditedRationale.replace(/^(Correct|Incorrect)\s*[:—-]\s*/i, "");
    return `${correct ? "Correct" : "Incorrect"} — ${normalized}`;
  }
  if (correct) return `Correct — ${question.explanation}`;
  const label = question.type === "hotspot" ? question.hotspots?.[index]?.label : question.choices?.[index];
  return `Incorrect — “${label ?? "This option"}” does not fit the condition in the prompt; the guide-supported response is “${correctLabel(question)}.”`;
}

function useModalDialog(onClose: () => void) {
  const panelRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const getFocusable = () => panel
      ? Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      : [];

    const initialTarget = getFocusable()[0] ?? panel;
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const onBackdropMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  }, []);

  return { panelRef, onBackdropMouseDown };
}

const LONG_PRESS_MS = 520;
const MATRIX_GLYPHS = "01<>/\\[]{}#*+=-";

function MatrixSwapText({ option, hint, active, as = "p" }: { option: string; hint: string; active: boolean; as?: "p" | "span" }) {
  const [displayText, setDisplayText] = useState(option);

  useEffect(() => {
    if (!active) {
      setDisplayText(option);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplayText(hint);
      return;
    }

    let frame = 0;
    const totalFrames = 13;
    const timer = window.setInterval(() => {
      frame += 1;
      const revealed = Math.ceil((frame / totalFrames) * hint.length);
      setDisplayText(Array.from(hint, (character, index) => {
        if (character === " " || index < revealed) return character;
        return MATRIX_GLYPHS[(index + frame) % MATRIX_GLYPHS.length];
      }).join(""));
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 28);

    return () => window.clearInterval(timer);
  }, [active, hint, option]);

  const className = `option-copy ${active ? "matrix-copy" : ""}`;
  if (as === "span") return <span className={className} aria-hidden="true">{displayText}</span>;
  return <p className={className} aria-hidden="true">{displayText}</p>;
}

function useLongPressHint(onReveal?: () => void) {
  const [hintActive, setHintActive] = useState(false);
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const coarsePointer = event.pointerType === "touch" || event.pointerType === "pen" || window.matchMedia("(pointer: coarse)").matches;
    if (!coarsePointer) return;

    clearTimer();
    suppressClickRef.current = false;
    originRef.current = { x: event.clientX, y: event.clientY };
    setPressing(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    timerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setHintActive(true);
      onReveal?.();
      if ("vibrate" in navigator) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  }, [clearTimer, onReveal]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pressing) return;
    const distance = Math.hypot(event.clientX - originRef.current.x, event.clientY - originRef.current.y);
    if (distance <= 14) return;
    clearTimer();
    setPressing(false);
    setHintActive(false);
  }, [clearTimer, pressing]);

  const finishPress = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    clearTimer();
    setPressing(false);
    setHintActive(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  }, [clearTimer]);

  const onClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, select: () => void) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    select();
  }, []);

  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (hintActive || window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
  }, [hintActive]);

  return { hintActive, pressing, onPointerDown, onPointerMove, finishPress, onClick, onContextMenu };
}

function ChoiceOption({ label, option, hint, selected, forcedHint = false, onSelect, onHint }: { label: string; option: string; hint: string; selected: boolean; forcedHint?: boolean; onSelect: () => void; onHint?: () => void }) {
  const press = useLongPressHint(onHint);
  const hintVisible = press.hintActive || forcedHint;
  return (
    <button
      className={`${selected ? "selected" : ""} ${press.pressing ? "press-arming" : ""} ${hintVisible ? "matrix-active" : ""}`}
      aria-pressed={selected}
      aria-expanded={hintVisible}
      aria-label={hintVisible ? `Answer help: ${hint}` : `Option ${label}: ${option}`}
      data-hint-active={hintVisible ? "true" : "false"}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.finishPress}
      onPointerCancel={press.finishPress}
      onLostPointerCapture={press.finishPress}
      onContextMenu={press.onContextMenu}
      onClick={(event) => press.onClick(event, onSelect)}
    >
      <span>{label}</span>
      <MatrixSwapText option={option} hint={hint} active={hintVisible} />
      <i aria-hidden="true" />
      <em className="hint-bubble">{hint}</em>
      <small className="hold-meter" aria-hidden="true" />
    </button>
  );
}

function HotspotOption({ label, option, hint, selected, forcedHint = false, onSelect, onHint }: { label: string; option: string; hint: string; selected: boolean; forcedHint?: boolean; onSelect: () => void; onHint?: () => void }) {
  const press = useLongPressHint(onHint);
  const hintVisible = press.hintActive || forcedHint;
  return (
    <button
      className={`hotspot ${selected ? "selected" : ""} ${press.pressing ? "press-arming" : ""} ${hintVisible ? "matrix-active" : ""}`}
      aria-pressed={selected}
      aria-expanded={hintVisible}
      aria-label={hintVisible ? `Answer help: ${hint}` : `Choice ${label}: ${option}`}
      data-hint-active={hintVisible ? "true" : "false"}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.finishPress}
      onPointerCancel={press.finishPress}
      onLostPointerCapture={press.finishPress}
      onContextMenu={press.onContextMenu}
      onClick={(event) => press.onClick(event, onSelect)}
    >
      <b>{label}</b>
      <MatrixSwapText option={option} hint={hint} active={hintVisible} as="span" />
      <em className="hint-bubble">{hint}</em>
      <small className="hold-meter" aria-hidden="true" />
    </button>
  );
}

function ConnectionOption({ label, option, hint, selected, forcedHint = false, onSelect, onHint }: { label: string; option: string; hint: string; selected: boolean; forcedHint?: boolean; onSelect: () => void; onHint?: () => void }) {
  const press = useLongPressHint(onHint);
  const hintVisible = press.hintActive || forcedHint;
  return (
    <button
      className={`${selected ? "selected" : ""} ${press.pressing ? "press-arming" : ""} ${hintVisible ? "matrix-active" : ""}`}
      aria-pressed={selected}
      aria-expanded={hintVisible}
      aria-label={hintVisible ? `Hint: ${hint}` : `Destination ${label}: ${option}`}
      data-hint-active={hintVisible ? "true" : "false"}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.finishPress}
      onPointerCancel={press.finishPress}
      onLostPointerCapture={press.finishPress}
      onContextMenu={press.onContextMenu}
      onClick={(event) => press.onClick(event, onSelect)}
    >
      <i aria-hidden="true" />
      <span>{label}</span>
      <MatrixSwapText option={option} hint={hint} active={hintVisible} />
      <em className="hint-bubble">{hint}</em>
      <small className="hold-meter" aria-hidden="true" />
    </button>
  );
}

export default function Home() {
  const [selectedExam, setSelectedExam] = useState<ExamId>("cts");
  const activeExam = examConfigs[selectedExam];
  const activeStorageKey = selectedExam === "cts" ? STORAGE_KEY : activeExam.storageKey;
  const activeHistoryKey = selectedExam === "cts" ? HISTORY_KEY : activeExam.historyKey;
  const activeQuestionById = useMemo(() => new Map(activeExam.allQuestions.map((item) => [item.id, item])), [activeExam]);
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
  const [hintLens, setHintLens] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(true);
  const [questionIds, setQuestionIds] = useState<number[]>(standardQuestionIds);
  const [railOpen, setRailOpen] = useState(true);
  const [jumpValue, setJumpValue] = useState("");
  const [sessionSize, setSessionSize] = useState<SessionSize>(115);
  const [sessionDuty, setSessionDuty] = useState<SessionDuty>("all");
  const [sessionSeed, setSessionSeed] = useState("");
  const [attemptStartedAt, setAttemptStartedAt] = useState("");
  const [history, setHistory] = useState<AttemptSummary[]>([]);

  const orderedQuestions = useMemo(() => questionIds.map((id) => activeQuestionById.get(id)).filter((item): item is BaseQuestion => Boolean(item)), [questionIds, activeQuestionById]);
  const question = orderedQuestions[currentIndex] ?? activeExam.questions[0] ?? questions[0];
  const response = answers[question.id] ?? null;

  useEffect(() => {
    document.title = `Aureum Study Hall — ${activeExam.code} Practice`;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", activeExam.themeColorHex);
  }, [activeExam]);

  useEffect(() => {
    if (screen !== "start") return;
    setHasSaved(false);
    setHistory([]);
    try {
      const saved = localStorage.getItem(activeStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validQuestionOrder(parsed.questionIds, activeQuestionById, activeExam.allQuestions.length)) setHasSaved(true);
      }
      const savedHistory = JSON.parse(localStorage.getItem(activeHistoryKey) ?? "[]");
      if (Array.isArray(savedHistory)) setHistory(savedHistory.slice(0, 12));
    } catch {}
  }, [screen, activeStorageKey, activeHistoryKey, activeQuestionById, activeExam.allQuestions.length]);

  function selectExam(nextExam: ExamId) {
    setSelectedExam(nextExam);
    const nextConfig = examConfigs[nextExam];
    setQuestionIds(nextConfig.questions.map((item) => item.id));
    if (sessionDuty !== "all" && !nextConfig.domains.includes(sessionDuty)) {
      setSessionDuty("all");
    }
    setReviewFilter("missed");
  }

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(true); };
    const up = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(false); };
    const clear = () => {
      setControlHeld(false);
      setHintLens(false);
    };
    const clearWhenHidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (screen !== "exam") return;
    safeSetStorage(activeStorageKey, JSON.stringify({ examId: selectedExam, mode, currentIndex, answers, flagged, checked, timeLeft, shuffleOn, questionIds, sessionSize, sessionDuty, sessionSeed, attemptStartedAt }));
    setHasSaved(true);
  }, [screen, activeStorageKey, selectedExam, mode, currentIndex, answers, flagged, checked, timeLeft, shuffleOn, questionIds, sessionSize, sessionDuty, sessionSeed, attemptStartedAt]);

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
        setHintLens(false);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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
      examId: selectedExam,
    };
    setHistory((current) => {
      if (current.some((attempt) => attempt.id === summary.id)) return current;
      const next = [summary, ...current].slice(0, 12);
      safeSetStorage(activeHistoryKey, JSON.stringify(next));
      return next;
    });
    safeRemoveStorage(activeStorageKey);
    setHasSaved(false);
  }, [screen, attemptStartedAt, mode, orderedQuestions, sessionAnsweredCount, score, sessionDuty, selectedExam, activeHistoryKey, activeStorageKey]);

  function start(selectedMode: Mode, forcedOrder?: number[]) {
    const nextSeed = forcedOrder?.length && sessionSeed ? sessionSeed : newSessionSeed();
    const nextOrder = forcedOrder?.length
      ? [...forcedOrder]
      : buildQuestionOrder(sessionSize, sessionDuty, shuffleOn, selectedMode, nextSeed, activeExam);
    setMode(selectedMode);
    setScreen("exam");
    setCurrentIndex(0);
    setQuestionIds(nextOrder);
    setAnswers({});
    setFlagged([]);
    setChecked([]);
    setControlHeld(false);
    setHintLens(false);
    setTimeLeft(examSeconds(nextOrder.length));
    setHasSaved(false);
    setSessionSeed(nextSeed);
    setAttemptStartedAt(new Date().toISOString());
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function resume() {
    try {
      const saved = JSON.parse(localStorage.getItem(activeStorageKey) ?? "{}");
      const validSavedOrder = validQuestionOrder(saved.questionIds, activeQuestionById, activeExam.allQuestions.length);
      const restoredOrder = validSavedOrder ? saved.questionIds : activeExam.questions.map((item) => item.id);
      const safeIndex = Math.max(0, Math.min(restoredOrder.length - 1, Number(saved.currentIndex) || 0));
      setMode(saved.mode === "study" ? "study" : "exam");
      setCurrentIndex(safeIndex);
      setAnswers(saved.answers && typeof saved.answers === "object" && !Array.isArray(saved.answers) ? saved.answers : {});
      setFlagged(Array.isArray(saved.flagged) ? saved.flagged : []);
      setChecked(Array.isArray(saved.checked) ? saved.checked : []);
      setTimeLeft(typeof saved.timeLeft === "number" && saved.timeLeft > 0 ? saved.timeLeft : examSeconds(validSavedOrder ? saved.questionIds.length : OFFICIAL_EXAM_QUESTIONS));
      setQuestionIds(restoredOrder);
      setShuffleOn(Boolean(saved.shuffleOn));
      setSessionSize(SESSION_SIZES.includes(saved.sessionSize) ? saved.sessionSize : 115);
      setSessionDuty(["all", ...activeExam.domains].includes(saved.sessionDuty) ? saved.sessionDuty : "all");
      setSessionSeed(typeof saved.sessionSeed === "string" ? saved.sessionSeed : newSessionSeed());
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
    setControlHeld(false);
    setHintLens(false);
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
    const csv = ["Position,Question ID,Exam area,Task,Topic,Your response,Best answer,Result,Source", ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aureum-${selectedExam}-study-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printResults() {
    document.querySelectorAll<HTMLDetailsElement>("details.review-item").forEach((item) => { item.open = true; });
    window.setTimeout(() => window.print(), 50);
  }

  const activeTotalQuestions = selectedExam === "cts" ? TOTAL_QUESTIONS : activeExam.questions.length;
  const activeCramCount = selectedExam === "cts" ? finalCramQuestions.length : activeExam.finalCramQuestions.length;
  const selectedQuestionCount = sessionSize === 75
    ? activeCramCount
    : sessionDuty === "all"
      ? sessionSize
      : Math.min(sessionSize, activeExam.questions.filter((item) => item.domain === sessionDuty && (sessionSize === 300 || item.type === "single")).length);
  const latestAttempt = history[0];
  const bestAttempt = history.length ? Math.max(...history.map((attempt) => attempt.percent)) : null;
  const sessionTotal = orderedQuestions.length;
  const formatCounts = useMemo(() => {
    const bank = activeExam.questions;
    return {
      single: bank.filter((item) => item.type === "single").length,
      hotspot: bank.filter((item) => item.type === "hotspot").length,
      connect: bank.filter((item) => item.type === "connect").length,
      order: bank.filter((item) => item.type === "order").length,
      numeric: bank.filter((item) => item.type === "numeric").length,
      multi: bank.filter((item) => item.type === "multi").length,
    };
  }, [activeExam]);

  if (screen === "start") {
    return (
      <main className={`landing ${activeExam.themeClass}`}>
        <a className="skip-link" href="#main-content">Skip to session builder</a>
        <section className="hero-shell">
          <div className="hero-top-bar">
            <div className="hero-kicker"><img className="seal" src="./favicon-512.png" alt="" /> Aureum Study Hall</div>
            <div className="exam-switcher" role="group" aria-label="Select certification exam">
              {EXAM_ORDER.map((examId) => {
                const item = examConfigs[examId];
                const isSelected = selectedExam === examId;
                return (
                  <button
                    key={examId}
                    type="button"
                    className={isSelected ? "active" : ""}
                    aria-pressed={isSelected}
                    onClick={() => selectExam(examId)}
                  >
                    <b><i className={`swatch-${examId}`} aria-hidden="true" />{item.code}®</b>
                    <small>{item.specialty}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hero-grid" id="main-content" tabIndex={-1}>
            <div>
              <p className="eyebrow">{activeExam.code}® practice • {activeTotalQuestions}-question mastery bank</p>
              <h1>{activeExam.heroHeadline[0]}<br />{activeExam.heroHeadline[1]}</h1>
              <p className="lede">{activeExam.heroLede}</p>
              <div className="session-builder" aria-label="Build a practice session">
                <div className="builder-heading"><span aria-hidden="true">01</span><div><b>Choose your session</b><small>Start small, use the curated final review, simulate the official pace, or work the complete bank.</small></div></div>
                <div className="size-options" role="group" aria-label="Session question count">
                  {SESSION_SIZES.map((size) => <button type="button" key={size} className={sessionSize === size ? "active" : ""} aria-pressed={sessionSize === size} onClick={() => setSessionSize(size)}><b>{size}</b><small>{size === 20 ? "Quick drill" : size === 60 ? "Deep practice" : size === 75 ? "Final cram" : size === 115 ? "Exam simulation" : "Full bank study"}</small></button>)}
                </div>
                <label className="duty-select"><span>Coverage</span><select disabled={sessionSize === 75} value={sessionSize === 75 ? "all" : sessionDuty} onChange={(event) => setSessionDuty(event.target.value as SessionDuty)}><option value="all">{sessionSize === 75 ? "Curated high-yield final review" : activeExam.coverageAllLabel}</option>{activeExam.domains.map((domain) => <option value={domain} key={domain}>Exam area {domain} — {activeExam.domainMeta[domain]?.name ?? domainMeta[domain as "A" | "B" | "C" | "D"]?.name}</option>)}</select></label>
                <div className="session-preview" aria-live="polite"><b>{selectedQuestionCount} questions</b><span>{sessionSize === 300 ? "Untimed complete study" : `${formatTime(examSeconds(selectedQuestionCount))} timed pace`}</span><span>{sessionSize === 75 ? "75 newly edited single-best-answer questions" : sessionDuty === "all" ? "Blueprint balanced" : `Focused on exam area ${sessionDuty}`}</span></div>
              </div>
              <div className="hero-actions">
                <button type="button" className="primary-btn" onClick={() => start(sessionSize === 300 ? "study" : "exam")}>{sessionSize === 300 ? "Begin full-bank study" : "Begin timed session"} <span aria-hidden="true">→</span></button>
                <button type="button" className="secondary-btn" onClick={() => start("study")}>Open study mode</button>
                {hasSaved && <button type="button" className="text-btn" onClick={resume}>Resume saved session</button>}
              </div>
              <button type="button" className={`shuffle-toggle ${shuffleOn ? "active" : ""}`} role="switch" aria-checked={shuffleOn} onClick={() => setShuffleOn((value) => !value)}>
                <span aria-hidden="true">⇄</span>
                <span><b>Shuffle this session</b><small>{shuffleOn ? "On — a fresh, reproducible order will be created without duplicate question IDs." : "Off — questions follow the curated order."}</small></span>
                <i aria-hidden="true"><em /></i>
              </button>
            </div>
            <aside className="exam-card" aria-label={`${activeExam.code} question bank summary`}>
              <div className="card-flourish" aria-hidden="true">{activeExam.cardFlourish}</div>
              <p className="eyebrow">{activeExam.cardEyebrow}</p>
              <div className="big-stat">{activeTotalQuestions}</div>
              <p className="stat-label">source-grounded mastery questions</p>
              <p className="cram-stat"><b>+{activeCramCount}</b> newly edited Final Cram questions</p>
              <div className="format-grid">
                <span><b>{formatCounts.single}</b> choice</span><span><b>{formatCounts.hotspot}</b> hotspots</span><span><b>{formatCounts.connect}</b> connections</span><span><b>{formatCounts.order}</b> sequences</span><span><b>{formatCounts.numeric}</b> numeric</span><span><b>{formatCounts.multi}</b> multi-select</span>
              </div>
              <div className="rule" />
              <p className="fine-print">{activeExam.cardFinePrint}</p>
            </aside>
          </div>
          <div className={`duty-strip ${activeExam.domains.length > 4 ? "six-cols" : ""}`}>
            {activeExam.domains.map((domain) => <div key={domain}><span>{domain}</span><b>{activeExam.domainMeta[domain]?.weight}</b><small>{activeExam.domainMeta[domain]?.name}</small></div>)}
          </div>
        </section>
        <section className="local-progress" aria-label="Local study progress">
          <div><p className="eyebrow">Private by design</p><h2>Your local {activeExam.code} study record</h2><p>No account, analytics, or cloud sync. Attempt history and resume data stay in this browser.</p></div>
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
          <p>{activeExam.integrityNote || "AVIXA states that the live CTS exam uses four response alternatives and one best answer. Timed practice now follows that response format."}</p>
          <button type="button" className="source-link" onClick={() => setShowSources(true)}>Review research sources ↗</button>
        </section>
        <NarrationPlayer context="landing" examId={selectedExam} />
        {showSources && <SourcesModal exam={activeExam} onClose={() => setShowSources(false)} />}
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
      <main className={`results-page ${activeExam.themeClass}`}>
        <a className="skip-link" href="#main-content">Skip to results summary</a>
        <header className="results-hero">
          <button type="button" className="brand-button" onClick={() => setScreen("start")}><img className="seal small" src="./favicon-512.png" alt="" /> Aureum Study Hall <em className="header-exam-badge">{activeExam.code}</em></button>
          <button type="button" className="secondary-btn compact" onClick={() => setShowSources(true)}>Sources</button>
          <div className="score-ring" style={{ "--score": `${percent * 3.6}deg` } as React.CSSProperties} aria-label={`Overall score ${percent} percent, ${score} of ${sessionTotal} correct`}><div><strong>{percent}%</strong><span>{score} / {sessionTotal}</span></div></div>
          <p className="eyebrow">{activeExam.code} assessment complete</p>
          <h1>{percent >= 80 ? "Strong command." : percent >= 70 ? "Building consistency." : "Your next study map is ready."}</h1>
          <p className="lede">Review the evidence behind every response, then retake with a clean slate when you are ready.</p>
        </header>
        <section className="results-body" id="main-content" tabIndex={-1}>
          <div className="report-overview" aria-label="Attempt report summary">
            <div><small>Session rating</small><strong>{rating}</strong><span>{percent}% across this {sessionTotal}-question session</span></div>
            <div><small>Answered accuracy</small><strong>{attemptedAccuracy}%</strong><span>{score} correct from {sessionAnsweredCount} answered</span></div>
            <div><small>Answer status</small><strong>{sessionAnsweredCount}/{sessionTotal}</strong><span>{incorrectAnswered} incorrect · {sessionTotal - sessionAnsweredCount} unanswered · {flagged.length} flagged</span></div>
            <div><small>Attempt mode</small><strong>{mode === "exam" ? "Timed" : "Study"}</strong><span>The same complete review is provided in either mode</span></div>
          </div>
          <div className="report-section-title"><p className="eyebrow">Performance report</p><h2>Results by exam area</h2><p>Overall scoring treats unanswered questions as incorrect. Answered accuracy isolates the questions you attempted.</p></div>
          <div className="domain-results">
            {activeExam.domains.map((domain) => {
              const set = orderedQuestions.filter((q) => q.domain === domain);
              if (!set.length) return null;
              const correct = set.filter((q) => isCorrect(q, answers[q.id])).length;
              const pct = Math.round(correct / set.length * 100);
              return <div className="domain-row" key={domain}><span className="domain-badge">{domain}</span><div><b>{activeExam.domainMeta[domain]?.name}</b><small>{correct} of {set.length} correct</small></div><div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div><strong>{pct}%</strong></div>;
            })}
          </div>
          <div className="report-section-title"><p className="eyebrow">Diagnostic detail</p><h2>Results by task</h2><p>Use this view to find the exact workflow areas that deserve another pass.</p></div>
          <div className="task-results">
            {taskResults.map((item) => <div className="task-row" key={item.task}><div><b>{item.task}</b><small>{item.correct} correct · {item.attempted} answered · {item.total} total</small></div><div className="bar" aria-hidden="true"><i style={{ width: `${item.percent}%` }} /></div><strong>{item.percent}%</strong></div>)}
          </div>
          <div className="review-head">
            <div><p className="eyebrow">Detailed evidence review</p><h2>Question-by-question</h2><p>Open any row for your response, the best answer, teaching explanation, study takeaway, and choice-by-choice reasoning.</p></div>
            <div className="filter-chips" role="group" aria-label="Filter question review">
              {(["missed", "all", ...activeExam.domains] as const).map((filter) => <button type="button" key={filter} className={reviewFilter === filter ? "active" : ""} aria-pressed={reviewFilter === filter} onClick={() => setReviewFilter(filter)}>{filter === "missed" ? "Missed" : filter === "all" ? "All" : `Area ${filter}`}</button>)}
            </div>
          </div>
          <div className="review-list">
            {filtered.length === 0 ? (
              <div className="review-empty" role="status">
                <p>{reviewFilter === "missed" ? "Every question in this session was answered accurately — no missed items to review." : "No questions in this session match the selected filter."}</p>
                {reviewFilter !== "all" && <button type="button" className="secondary-btn compact" onClick={() => setReviewFilter("all")}>Show all {sessionTotal} questions</button>}
              </div>
            ) : filtered.map((q) => {
              const correct = isCorrect(q, answers[q.id]);
              return <details className={`review-item ${correct ? "right" : "wrong"}`} key={q.id}><summary><span aria-label={correct ? "Correct" : "Needs review"}>{correct ? "✓" : "×"}</span><b>{q.collection === "final-cram" ? `FC${q.legacyId}` : String(q.id).padStart(3, "0")}</b><p>{visiblePrompt(q)}</p><small>{q.topic}</small></summary><div className="review-content"><div><small>Your response</small><p>{responseLabel(q, answers[q.id])}</p></div><div><small>Best answer</small><p>{correctLabel(q)}</p></div><div className="explanation"><small>Why</small><p>{q.explanation}</p><cite>{q.source}</cite></div><div className="study-takeaway"><small>Study takeaway</small><p>{q.studyNote ?? q.explanation}</p></div>{q.rationales?.length ? <div className="choice-review"><small>Choice-by-choice reasoning</small><ol>{q.rationales.map((rationale, index) => <li key={index}><b>{letters[index]}. {q.choices?.[index]}</b><p>{rationale}</p></li>)}</ol></div> : q.interactionRationale ? <div className="choice-review"><small>Interaction reasoning</small><p>{q.interactionRationale}</p></div> : null}</div></details>;
            })}
          </div>
          <div className="results-actions">
            {score < sessionTotal && <button type="button" className="primary-btn" onClick={practiceMissed}>Practice {sessionTotal - score} review items</button>}
            <button type="button" className="secondary-btn" onClick={() => start(mode, questionIds)}>Retake this session</button>
            <button type="button" className="secondary-btn" onClick={downloadResults}>Download CSV report</button>
            <button type="button" className="secondary-btn" onClick={printResults}>Print / save PDF</button>
            <button type="button" className="text-btn results-home" onClick={() => setScreen("start")}>Build another session</button>
          </div>
        </section>
        <NarrationPlayer context="results" examId={selectedExam} />
        {showSources && <SourcesModal exam={activeExam} onClose={() => setShowSources(false)} />}
      </main>
    );
  }

  const isChecked = checked.includes(question.id);
  const correctNow = isCorrect(question, response);
  const progress = ((currentIndex + 1) / orderedQuestions.length) * 100;

  return (
    <main className={`exam-page ${activeExam.themeClass}`}>
      <a className="skip-link" href="#main-content">Skip to current question</a>
      <header className="exam-header">
        <button type="button" className="brand-button" aria-label={`Return to ${activeExam.code} session builder (progress is saved)`} onClick={() => setScreen("start")}><img className="seal small" src="./favicon-512.png" alt="" /><span>Aureum Study Hall</span><em className="header-exam-badge">{activeExam.code}</em></button>
        <div className="header-progress" aria-label={`Question ${currentIndex + 1} of ${sessionTotal}`}><span aria-hidden="true" style={{ width: `${progress}%` }} /><b>{currentIndex + 1}</b><small>of {sessionTotal}</small>{shuffleOn && <em>Set {sessionSeed}</em>}</div>
        <div className="header-tools">
          {mode === "exam" && <div className={`timer ${timeLeft < 900 ? "urgent" : ""}`} aria-label={`Time remaining ${formatTime(timeLeft)}`}><span>Time</span><b>{formatTime(timeLeft)}</b></div>}
          <button type="button" className="icon-btn" onClick={() => setShowSources(true)} aria-label="Open sources">⌁</button>
          <button type="button" className="navigator-btn" aria-label={`Open question navigator, ${sessionAnsweredCount} of ${sessionTotal} answered`} onClick={() => setShowNavigator(true)}>Navigator <b>{sessionAnsweredCount}/{sessionTotal}</b></button>
        </div>
      </header>

      <div className={`exam-layout ${railOpen ? "" : "rail-closed"}`}>
        <aside className="question-meta" aria-label="Question blueprint metadata">
          <div className="rail-head"><b>Question rail</b><button type="button" onClick={() => setRailOpen(false)} aria-label="Close question rail">×</button></div>
          <span className="domain-badge large" aria-hidden="true">{question.domain}</span>
          <p className="eyebrow">Exam area {question.domain}</p>
          <h3>{activeExam.domainMeta[question.domain]?.name}</h3>
          <div className="meta-rule" />
          <small>Blueprint task</small><p>{question.task}</p>
          <small>Topic</small><p>{question.topic}</p>
          <small>Question style</small><p>{questionStyle(question)}</p>
          <div className="rail-navigator">
            <small>Jump to position</small>
            <form onSubmit={submitJump}><input aria-label="Question position" type="number" min="1" max={sessionTotal} value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} placeholder={`1–${sessionTotal}`} /><button type="submit">Go</button></form>
            <div className="rail-list-head"><b>Current order</b><span>{shuffleOn ? "Shuffled" : "Standard"}</span></div>
            <p className="rail-click-hint">Click any question to move around</p>
            <div className="rail-question-list" aria-label="Current question order">
              {orderedQuestions.map((item, index) => <button type="button" key={item.id} aria-current={currentIndex === index ? "step" : undefined} className={`${currentIndex === index ? "current" : ""} ${answered(item, answers[item.id]) ? "done" : ""} ${flagged.includes(item.id) ? "flag" : ""}`} onClick={() => goToQuestion(index)}><b>{index + 1}</b><span>{item.collection === "final-cram" ? `FC${item.legacyId}` : `Q${item.id}`} · {item.domain}</span></button>)}
            </div>
            <button type="button" className="rail-end" onClick={() => setShowSubmit(true)}><small>Finished for now?</small><b>End test &amp; see full report</b></button>
          </div>
        </aside>

        <section className="question-stage" id="main-content" tabIndex={-1}>
          {!railOpen && <button type="button" className="rail-reopen" onClick={() => setRailOpen(true)}><small>Click here to</small><span>Open question rail →</span></button>}
          <div className="question-number">
            <span>{String(currentIndex + 1).padStart(3, "0")}</span>
            {mode === "exam" && <b className={`mobile-timer ${timeLeft < 900 ? "urgent" : ""}`} aria-label={`Time remaining ${formatTime(timeLeft)}`}>{formatTime(timeLeft)}</b>}
            <button type="button" className={flagged.includes(question.id) ? "flagged" : ""} aria-pressed={flagged.includes(question.id)} onClick={toggleFlag}>{flagged.includes(question.id) ? "◆ Flagged" : "◇ Flag for review"}</button>
          </div>
          <h1>{visiblePrompt(question)}</h1>
          <div className={`hint-key ${controlHeld || hintLens ? "active" : ""}`}>
            <div className="hint-instruction">
              <kbd>Ctrl</kbd>
              <span className="desktop-hint-copy">{hintLens ? "Answer help is on · choose an option to see why" : controlHeld ? "Answer help is active" : "Hold Control to preview why · press 1–4 to answer"}</span>
              <span className="touch-hint-copy">{hintLens ? "Answer help is on · tap an option to see why without answering" : <><b>Press and hold</b> any option to preview why</>}</span>
            </div>
            <button type="button" className={`hint-lens-btn ${hintLens ? "active" : ""}`} aria-pressed={hintLens} onClick={() => setHintLens((value) => !value)}><span aria-hidden="true">{hintLens ? "×" : "?"}</span>{hintLens ? "Close answer help" : "Answer help"}</button>
          </div>
          {question.type !== "single" && <div className="practice-format-note"><b>Study activity</b><span>This interaction teaches the concept in a hands-on format. The {activeExam.code} exam itself uses four choices and one best answer.</span></div>}
          <QuestionInput question={question} response={response} setResponse={setResponse} moveStep={moveStep} controlHeld={controlHeld} hintLens={hintLens} examId={selectedExam} />
          {mode === "study" && isChecked && (
            <div className={`feedback ${correctNow ? "correct" : "incorrect"}`} role="status" aria-live="polite">
              <b>{correctNow ? "Correct." : "Not quite."}</b>
              {!correctNow && <p><strong>Best answer:</strong> {correctLabel(question)}</p>}
              <p>{question.studyNote ?? question.explanation}</p><cite>{question.source}</cite>
            </div>
          )}
          <NarrationPlayer context="exam" question={question} reviewAvailable={mode === "study" && isChecked} examId={selectedExam} />
          <footer className="question-actions">
            <button type="button" className="secondary-btn compact" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}>← Previous</button>
            {mode === "study" && <button type="button" className="check-btn" disabled={!answered(question, response)} onClick={() => setChecked((all) => all.includes(question.id) ? all : [...all, question.id])}>Check answer</button>}
            {currentIndex < orderedQuestions.length - 1 ? <button type="button" className="primary-btn compact" onClick={() => goToQuestion(currentIndex + 1)}>Next question →</button> : <button type="button" className="primary-btn compact" onClick={() => setShowSubmit(true)}>Submit all</button>}
          </footer>
        </section>
      </div>

      <div className="bottom-rail"><button type="button" onClick={() => setShowNavigator(true)}><span aria-hidden="true" style={{ width: `${sessionAnsweredCount / sessionTotal * 100}%` }} />Answered {sessionAnsweredCount} · Flagged {flagged.length} · Open {sessionTotal - sessionAnsweredCount}</button></div>
      {showNavigator && <Navigator orderedQuestions={orderedQuestions} current={currentIndex} answers={answers} flagged={flagged} onChoose={(index) => { goToQuestion(index); setShowNavigator(false); }} onClose={() => setShowNavigator(false)} onSubmit={() => { setShowNavigator(false); setShowSubmit(true); }} />}
      {showSubmit && <SubmitModal total={sessionTotal} answeredCount={sessionAnsweredCount} flagged={flagged.length} onCancel={() => setShowSubmit(false)} onSubmit={submit} />}
      {showSources && <SourcesModal exam={activeExam} onClose={() => setShowSources(false)} />}
    </main>
  );
}

function QuestionInput({ question, response, setResponse, moveStep, controlHeld, hintLens, examId = "cts" }: { question: BaseQuestion; response: AnswerValue; setResponse: (value: AnswerValue) => void; moveStep: (index: number, direction: -1 | 1) => void; controlHeld: boolean; hintLens: boolean; examId?: ExamId }) {
  const [pinnedHint, setPinnedHint] = useState<number | null>(null);
  const spokenRationales = useMemo(() => rationaleNarrationClips(question, examId), [question, examId]);

  useEffect(() => setPinnedHint(null), [question.id, hintLens]);

  const chooseOrHint = (index: number, select: () => void) => {
    if (!hintLens) {
      select();
      return;
    }
    setPinnedHint((current) => current === index ? null : index);
    if (spokenRationales[index]) requestNarrationClip(spokenRationales[index]);
  };

  const narrateHint = (index: number) => {
    if (spokenRationales[index]) requestNarrationClip(spokenRationales[index]);
  };

  if (question.type === "single") return (
    <div className={`choice-list ${controlHeld ? "hints-on" : ""}`} role="group" aria-label="Answer choices">
      {question.choices?.map((choice, index) => (
        <ChoiceOption key={index} label={letters[index]} option={choice} hint={choiceRationale(question, index)} selected={response === index} forcedHint={hintLens && pinnedHint === index} onHint={() => narrateHint(index)} onSelect={() => chooseOrHint(index, () => setResponse(index))} />
      ))}
    </div>
  );
  if (question.type === "multi") {
    const selected = (response as number[]) ?? [];
    return (
      <div className={`choice-list multi-list ${controlHeld ? "hints-on" : ""}`} role="group" aria-label="Multiple-answer choices">
        {question.choices?.map((choice, index) => (
          <ChoiceOption key={index} label={selected.includes(index) ? "✓" : letters[index]} option={choice} hint={choiceRationale(question, index)} selected={selected.includes(index)} forcedHint={hintLens && pinnedHint === index} onHint={() => narrateHint(index)} onSelect={() => chooseOrHint(index, () => setResponse(selected.includes(index) ? selected.filter((n) => n !== index) : [...selected, index]))} />
        ))}
      </div>
    );
  }
  if (question.type === "numeric") {
    const inputId = `numeric-answer-${question.id}`;
    const unitId = `numeric-unit-${question.id}`;
    const noteId = `numeric-note-${question.id}`;
    return <div className={`numeric-entry ${controlHeld || hintLens ? "hints-on" : ""}`}><label htmlFor={inputId}>Enter your answer{question.unit ? ` (${question.unit})` : ""}</label><div><input id={inputId} aria-describedby={`${unitId} ${noteId}`} inputMode="decimal" type="number" step="any" value={typeof response === "string" ? response : ""} onChange={(event) => setResponse(event.target.value)} /><span id={unitId}>{question.unit}</span></div><small id={noteId}>Use numbers only. A reasonable rounding tolerance is accepted where appropriate.</small><em className="interaction-rationale">{question.interactionRationale}</em></div>;
  }
  if (question.type === "order") {
    const order = (response as string[]) ?? shuffledSteps(question);
    return <div className={`order-task ${controlHeld || hintLens ? "hints-on" : ""}`} role="group" aria-label="Arrange steps in sequence"><p className="interaction-hint">Use the arrow controls to arrange the steps from first to last.</p>{order.map((step, index) => <div className="order-row" key={step}><span>{index + 1}</span><p>{step}</p><div><button type="button" aria-label={`Move step ${index + 1} up: ${step}`} disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={`Move step ${index + 1} down: ${step}`} disabled={index === order.length - 1} onClick={() => moveStep(index, 1)}>↓</button></div></div>)}<em className="interaction-rationale">{question.interactionRationale}</em></div>;
  }
  if (question.type === "hotspot") return (
    <div className={`hotspot-wrap ${controlHeld ? "hints-on" : ""}`}>
      <p className="interaction-hint">Choose one clearly labeled answer area. A check mark and “Selected” label will confirm your choice.</p>
      <div className="labeled-choice-board" role="group" aria-label="Labeled answer choices">
        {question.hotspots?.map((spot, index) => (
          <HotspotOption key={spot.id} label={letters[index]} option={spot.label} hint={choiceRationale(question, index)} selected={response === spot.id} forcedHint={hintLens && pinnedHint === index} onHint={() => narrateHint(index)} onSelect={() => chooseOrHint(index, () => setResponse(spot.id))} />
        ))}
      </div>
    </div>
  );
  if (question.type === "connect") {
    const selected = typeof response === "string" ? Number(response) : -1;
    const targetY = selected >= 0 ? ((selected + 0.5) / (question.choices?.length ?? 4)) * 100 : 50;
    return (
      <div className={`connect-task ${controlHeld ? "hints-on" : ""}`}>
        <p className="interaction-hint">Choose the destination that best matches the prompt. The line is only a study aid.</p>
        <div className="connection-board" role="group" aria-label="Matching destinations">
          <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">{selected >= 0 && <line x1="27" y1="50" x2="73" y2={targetY} />}</svg>
          <div className="source-node" aria-hidden="true"><small>Prompt</small><b>Best match</b><i /></div>
          <div className="target-list">
            {question.choices?.map((choice, index) => (
              <ConnectionOption key={index} label={letters[index]} option={choice} hint={choiceRationale(question, index)} selected={selected === index} forcedHint={hintLens && pinnedHint === index} onHint={() => narrateHint(index)} onSelect={() => chooseOrHint(index, () => setResponse(String(index)))} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function Navigator({ orderedQuestions, current, answers, flagged, onChoose, onClose, onSubmit }: { orderedQuestions: BaseQuestion[]; current: number; answers: Record<number, AnswerValue>; flagged: number[]; onChoose: (index: number) => void; onClose: () => void; onSubmit: () => void }) {
  const { panelRef, onBackdropMouseDown } = useModalDialog(onClose);
  return <div className="modal-backdrop" onMouseDown={onBackdropMouseDown}><section ref={panelRef} tabIndex={-1} className="navigator-panel" role="dialog" aria-modal="true" aria-labelledby="navigator-modal-title"><div className="modal-head"><div><p className="eyebrow">Session navigator</p><h2 id="navigator-modal-title">{orderedQuestions.length} questions</h2></div><button type="button" onClick={onClose} aria-label="Close navigator">×</button></div><div className="legend"><span><i className="done" aria-hidden="true" />Answered</span><span><i className="flag" aria-hidden="true" />Flagged</span><span><i aria-hidden="true" />Open</span></div><div className="question-grid">{orderedQuestions.map((q, index) => <button type="button" key={q.id} aria-current={current === index ? "step" : undefined} className={`${answered(q, answers[q.id]) ? "done" : ""} ${flagged.includes(q.id) ? "flag" : ""} ${current === index ? "current" : ""}`} onClick={() => onChoose(index)} aria-label={`Position ${index + 1}, ${q.collection === "final-cram" ? `Final Cram question ${q.legacyId}` : `source question ${q.id}`}${answered(q, answers[q.id]) ? ", answered" : ", open"}${flagged.includes(q.id) ? ", flagged" : ""}`}>{q.collection === "final-cram" ? q.legacyId : q.id}</button>)}</div><div className="navigator-footer"><button type="button" className="secondary-btn compact" onClick={onClose}>Return to question</button><button type="button" className="primary-btn compact" onClick={onSubmit}>End session</button></div></section></div>;
}

function SubmitModal({ total, answeredCount, flagged, onCancel, onSubmit }: { total: number; answeredCount: number; flagged: number; onCancel: () => void; onSubmit: () => void }) {
  const { panelRef, onBackdropMouseDown } = useModalDialog(onCancel);
  return <div className="modal-backdrop" onMouseDown={onBackdropMouseDown}><section ref={panelRef} tabIndex={-1} className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title"><span className="seal" aria-hidden="true">A</span><p className="eyebrow">Ready to score?</p><h2 id="submit-modal-title">End this {total}-question session</h2><p>You answered <b>{answeredCount}</b>, left <b>{total - answeredCount}</b> open, and flagged <b>{flagged}</b> for review. You will still receive a complete study report.</p><div><button type="button" className="secondary-btn" onClick={onCancel}>Keep working</button><button type="button" className="primary-btn" onClick={onSubmit}>End and score</button></div></section></div>;
}

function SourcesModal({ exam = examConfigs.cts, onClose }: { exam?: ExamConfig; onClose: () => void }) {
  const { panelRef, onBackdropMouseDown } = useModalDialog(onClose);
  const sources = exam.researchSources ?? researchSources;
  return <div className="modal-backdrop" onMouseDown={onBackdropMouseDown}><section ref={panelRef} tabIndex={-1} className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-modal-title"><div className="modal-head"><div><p className="eyebrow">Research ledger · {exam.code}</p><h2 id="sources-modal-title">Primary confirmation sources</h2></div><button type="button" onClick={onClose} aria-label="Close sources">×</button></div><p className="source-intro">{exam.sourceIntro}</p><div className="source-list">{sources.map((source, index) => <a href={source.url} target="_blank" rel="noopener noreferrer" key={`${source.label}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{source.label}</p><b aria-hidden="true">↗</b></a>)}</div><p className="fine-print">Independent study material. Not affiliated with, sponsored by, or endorsed by AVIXA. CTS®, CTS-I®, CTS-D®, and AVIXA® are marks of AVIXA, Inc. No live exam questions are included.</p></section></div>;
}
