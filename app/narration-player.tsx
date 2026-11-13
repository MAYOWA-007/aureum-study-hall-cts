"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BaseQuestion, ExamId } from "./question-bank";
import {
  getInterfaceNarrationClips,
  interfaceNarrationClips,
  NARRATION_REQUEST_EVENT,
  prepareSpeechText,
  questionNarrationClip,
  reviewNarrationClip,
  type NarrationClip,
  type NarrationPackDescriptor,
} from "./narration";

type NarrationContext = "landing" | "exam" | "results";
type PlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "gesture" | "pending" | "error";

const NARRATION_PREFERENCES_KEY = "aureum-study-hall-cts-narration-v1";

function contextClip(context: NarrationContext, question?: BaseQuestion, examId: ExamId = "cts") {
  if (context === "exam" && question) return questionNarrationClip(question, examId);
  const clips = getInterfaceNarrationClips(examId);
  const targetSuffix = context === "results" ? "interface-results" : "interface-welcome";
  return clips.find((clip) => clip.id.endsWith(targetSuffix)) ?? clips[0] ?? interfaceNarrationClips[0];
}

function segmentAtProgress(clip: NarrationClip, progress: number) {
  const weights = clip.segments.map((segment) => Math.max(1, segment.text.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = Math.max(0, Math.min(1, progress)) * total;
  let elapsed = 0;
  for (let index = 0; index < weights.length; index += 1) {
    elapsed += weights[index];
    if (target <= elapsed) return index;
  }
  return Math.max(0, clip.segments.length - 1);
}

export function NarrationPlayer({ context, question, reviewAvailable = false, examId = "cts" }: { context: NarrationContext; question?: BaseQuestion; reviewAvailable?: boolean; examId?: ExamId }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [rate, setRate] = useState(1);
  const [pack, setPack] = useState<NarrationPackDescriptor | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [currentClip, setCurrentClip] = useState<NarrationClip>(() => contextClip(context, question, examId));
  const [activeSegment, setActiveSegment] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentClipRef = useRef(currentClip);
  const questionClip = useMemo(() => contextClip(context, question, examId), [context, question, examId]);
  const reviewClip = useMemo(() => question ? reviewNarrationClip(question, examId) : null, [question, examId]);
  const guideClip = useMemo(() => {
    const clips = getInterfaceNarrationClips(examId);
    const suffix = context === "exam" ? "interface-exam-controls" : context === "landing" ? "interface-session-builder" : "";
    return suffix ? clips.find((clip) => clip.id.endsWith(suffix)) ?? null : null;
  }, [context, examId]);
  const availableClipIds = useMemo(() => new Set(pack?.availableClipIds ?? []), [pack]);
  const packReady = pack?.status === "ready" || pack?.status === "partial";
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const canRead = packReady || speechSupported;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NARRATION_PREFERENCES_KEY) ?? "{}");
      setEnabled(Boolean(saved.enabled));
      setAutoRead(Boolean(saved.autoRead));
      if ([0.85, 1, 1.15].includes(saved.rate)) setRate(saved.rate);
    } catch {}
  }, []);

  useEffect(() => {
    const packUrl = examId === "cts" ? "./audio/narration/pack.json" : `./audio/narration/pack-${examId}.json`;
    void fetch(new URL(packUrl, document.baseURI), { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Narration pack unavailable")))
      .then((value: NarrationPackDescriptor) => setPack(value))
      .catch(() => setPack({ schemaVersion: 1, status: "awaiting_voice", provider: "Fish Audio", model: null, voiceReferenceId: null, generatedAt: null, availableClipIds: [] }));
  }, [examId]);

  useEffect(() => {
    try {
      localStorage.setItem(NARRATION_PREFERENCES_KEY, JSON.stringify({ enabled, autoRead, rate }));
    } catch {}
  }, [enabled, autoRead, rate]);

  useEffect(() => {
    currentClipRef.current = currentClip;
  }, [currentClip]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    const updateProgress = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      setActiveSegment(segmentAtProgress(currentClipRef.current, audio.currentTime / audio.duration));
    };
    audio.addEventListener("loadstart", () => setPlayback("loading"));
    audio.addEventListener("playing", () => setPlayback("playing"));
    audio.addEventListener("pause", () => setPlayback((state) => state === "ended" ? state : "paused"));
    audio.addEventListener("ended", () => { setPlayback("ended"); setActiveSegment(Math.max(0, currentClipRef.current.segments.length - 1)); });
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("error", () => setPlayback("error"));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
      utteranceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, currentClip]);

  const playClip = useCallback(async (clip: NarrationClip, restart = false) => {
    currentClipRef.current = clip;
    setCurrentClip(clip);
    setActiveSegment(0);
    if (!enabled) {
      setPlayback("pending");
      setOpen(true);
      return;
    }
    if (!packReady || !availableClipIds.has(clip.id)) {
      if (speechSupported) {
        audioRef.current?.pause();
        try { window.speechSynthesis.cancel(); } catch {}
        const spoken = prepareSpeechText(clip.text);
        const utterance = new SpeechSynthesisUtterance(spoken);
        utteranceRef.current = utterance;
        utterance.rate = rate;
        utterance.onstart = () => {
          if (utteranceRef.current === utterance) setPlayback("playing");
        };
        utterance.onboundary = (event) => {
          if (utteranceRef.current !== utterance || spoken.length <= 0) return;
          setActiveSegment(segmentAtProgress(clip, event.charIndex / spoken.length));
        };
        utterance.onend = () => {
          if (utteranceRef.current !== utterance) return;
          setPlayback("ended");
          setActiveSegment(Math.max(0, clip.segments.length - 1));
        };
        utterance.onerror = (event) => {
          if (utteranceRef.current !== utterance) return;
          if (event.error === "canceled" || event.error === "interrupted") return;
          setPlayback("pending");
        };
        window.speechSynthesis.speak(utterance);
        return;
      }
      setPlayback("pending");
      setOpen(true);
      return;
    }
    if (speechSupported) {
      utteranceRef.current = null;
      try { window.speechSynthesis.cancel(); } catch {}
    }
    const audio = audioRef.current;
    if (!audio) return;
    const nextSource = new URL(clip.audioPath, document.baseURI).href;
    if (audio.src !== nextSource) {
      audio.src = nextSource;
      audio.load();
    } else if (restart || playback === "ended") {
      audio.currentTime = 0;
    }
    audio.playbackRate = rate;
    try {
      await audio.play();
    } catch {
      setPlayback("gesture");
      setOpen(true);
    }
  }, [availableClipIds, enabled, packReady, playback, rate, speechSupported]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (speechSupported) {
      utteranceRef.current = null;
      try { window.speechSynthesis.cancel(); } catch {}
    }
    setCurrentClip(questionClip);
    setActiveSegment(0);
    setPlayback("idle");
    if (context === "exam" && enabled && autoRead && ((packReady && availableClipIds.has(questionClip.id)) || speechSupported)) {
      void playClip(questionClip, true);
    }
  }, [questionClip.id]); // Auto-read only when the question itself changes.

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      if (speechSupported) {
        utteranceRef.current = null;
        try { window.speechSynthesis.cancel(); } catch {}
      }
      setPlayback("idle");
    }
  }, [enabled, speechSupported]);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const clip = (event as CustomEvent<{ clip?: NarrationClip }>).detail?.clip;
      if (enabled && clip) void playClip(clip, true);
    };
    window.addEventListener(NARRATION_REQUEST_EVENT, handleRequest);
    return () => window.removeEventListener(NARRATION_REQUEST_EVENT, handleRequest);
  }, [enabled, playClip]);

  const togglePlayback = () => {
    if (playback === "playing") {
      audioRef.current?.pause();
      if (speechSupported) {
        utteranceRef.current = null;
        try { window.speechSynthesis.cancel(); } catch {}
      }
      setPlayback("paused");
      return;
    }
    void playClip(currentClip.id === questionClip.id || currentClip.id === reviewClip?.id ? currentClip : questionClip);
  };

  const statusCopy = !pack
    ? "Checking voice pack…"
    : playback === "playing"
      ? `Reading ${currentClip.label}`
      : pack.status === "awaiting_voice"
        ? "Scripts ready · awaiting your Fish voice"
        : pack.status === "awaiting_generation"
          ? enabled ? "Browser voice ready · Fish S2.1 Pro queued" : "S2.1 Pro voice selected · generation pending"
          : playback === "gesture"
            ? "Tap play once to allow audio"
            : playback === "pending"
              ? "This clip is queued for the voice pack"
              : playback === "error"
                ? "Audio could not be loaded"
                : enabled ? "Read aloud is on · ready" : "Read aloud is off";

  return (
    <aside className={`narrator-dock ${open ? "open" : ""} ${enabled ? "enabled" : ""}`} aria-label="Read-aloud controls">
      {open && (
        <section className="narrator-panel">
          <div className="narrator-head">
            <div><span className="narrator-kicker">Aureum voice layer</span><h2>Read aloud</h2></div>
            <button type="button" className="narrator-close" onClick={() => setOpen(false)} aria-label="Close read-aloud controls">×</button>
          </div>

          <button type="button" className="narrator-power" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)}>
            <span className="voice-orb" aria-hidden="true"><i /><i /><i /><i /></span>
            <span><b>{enabled ? "Read aloud on" : "Read aloud off"}</b><small>{statusCopy}</small></span>
            <em aria-hidden="true"><i /></em>
          </button>

          <div className="narrator-transcript" aria-live="polite">
            <span>{currentClip.segments[activeSegment]?.label ?? "Ready"}</span>
            <p>{currentClip.segments[activeSegment]?.text ?? currentClip.text}</p>
          </div>

          <div className="narrator-controls">
            <button type="button" onClick={togglePlayback} disabled={!enabled || !canRead} aria-label={playback === "playing" ? "Pause reading" : "Read this aloud"}>{playback === "playing" ? "Ⅱ" : "▶"}<span>{playback === "playing" ? "Pause" : "Read"}</span></button>
            <button type="button" onClick={() => void playClip(currentClip, true)} disabled={!enabled || !canRead} aria-label="Restart reading">↺<span>Restart</span></button>
            {guideClip && <button type="button" onClick={() => void playClip(guideClip, true)} disabled={!enabled || !canRead} aria-label="Read interface guide">◇<span>{context === "exam" ? "Controls" : "Session guide"}</span></button>}
            {context === "exam" && reviewClip && <button type="button" onClick={() => void playClip(reviewClip, true)} disabled={!enabled || !canRead || !reviewAvailable} aria-label="Read study review">◎<span>Review</span></button>}
          </div>

          <div className="narrator-settings">
            <button type="button" className={autoRead ? "active" : ""} aria-pressed={autoRead} onClick={() => setAutoRead((value) => !value)}><span>Auto-read new questions</span><b>{autoRead ? "On" : "Off"}</b></button>
            <label><span>Playback pace</span><select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.85}>Calm · 0.85×</option><option value={1}>Standard · 1×</option><option value={1.15}>Focused · 1.15×</option></select></label>
          </div>

          {!packReady && <p className="voice-pack-note"><b>{pack?.status === "awaiting_generation" ? "Static MP3 pack pending." : "No voice has been chosen."}</b> The complete scripts and private generation pipeline are ready; browser speech is available now without contacting Fish Audio or spending credits.</p>}
        </section>
      )}
      <button type="button" className="narrator-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="voice-orb compact-orb" aria-hidden="true"><i /><i /><i /><i /></span>
        <span><b>Read aloud</b><small>{playback === "playing" ? "Reading now" : pack?.status === "awaiting_voice" ? "Voice pending" : pack?.status === "awaiting_generation" ? (enabled ? "Browser voice" : "S2.1 Pro queued") : enabled ? "On" : "Off"}</small></span>
        <em aria-hidden="true">{open ? "×" : "⌃"}</em>
      </button>
    </aside>
  );
}
