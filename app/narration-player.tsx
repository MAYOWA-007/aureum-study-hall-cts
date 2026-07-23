"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BaseQuestion } from "./question-bank";
import {
  interfaceNarrationClips,
  NARRATION_REQUEST_EVENT,
  questionNarrationClip,
  reviewNarrationClip,
  type NarrationClip,
  type NarrationPackDescriptor,
} from "./narration";

type NarrationContext = "landing" | "exam" | "results";
type PlaybackState = "idle" | "loading" | "playing" | "paused" | "ended" | "gesture" | "pending" | "error";

const NARRATION_PREFERENCES_KEY = "aureum-study-hall-cts-narration-v1";

function contextClip(context: NarrationContext, question?: BaseQuestion) {
  if (context === "exam" && question) return questionNarrationClip(question);
  return interfaceNarrationClips.find((clip) => clip.id === (context === "results" ? "interface-results" : "interface-welcome")) ?? interfaceNarrationClips[0];
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

export function NarrationPlayer({ context, question, reviewAvailable = false }: { context: NarrationContext; question?: BaseQuestion; reviewAvailable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [rate, setRate] = useState(1);
  const [pack, setPack] = useState<NarrationPackDescriptor | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [currentClip, setCurrentClip] = useState<NarrationClip>(() => contextClip(context, question));
  const [activeSegment, setActiveSegment] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentClipRef = useRef(currentClip);
  const questionClip = useMemo(() => contextClip(context, question), [context, question]);
  const reviewClip = useMemo(() => question ? reviewNarrationClip(question) : null, [question]);
  const guideClip = useMemo(() => interfaceNarrationClips.find((clip) => clip.id === (context === "exam" ? "interface-exam-controls" : context === "landing" ? "interface-session-builder" : "")) ?? null, [context]);
  const availableClipIds = useMemo(() => new Set(pack?.availableClipIds ?? []), [pack]);
  const packReady = pack?.status === "ready" || pack?.status === "partial";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NARRATION_PREFERENCES_KEY) ?? "{}");
      setEnabled(Boolean(saved.enabled));
      setAutoRead(Boolean(saved.autoRead));
      if ([0.85, 1, 1.15].includes(saved.rate)) setRate(saved.rate);
    } catch {}

    void fetch(new URL("./audio/narration/pack.json", document.baseURI), { cache: "no-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Narration pack unavailable")))
      .then((value: NarrationPackDescriptor) => setPack(value))
      .catch(() => setPack({ schemaVersion: 1, status: "awaiting_voice", provider: "Fish Audio", model: null, voiceReferenceId: null, generatedAt: null, availableClipIds: [] }));
  }, []);

  useEffect(() => {
    localStorage.setItem(NARRATION_PREFERENCES_KEY, JSON.stringify({ enabled, autoRead, rate }));
  }, [enabled, autoRead, rate]);

  useEffect(() => {
    currentClipRef.current = currentClip;
  }, [currentClip]);

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
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, currentClip]);

  const playClip = useCallback(async (clip: NarrationClip, restart = false) => {
    currentClipRef.current = clip;
    setCurrentClip(clip);
    setActiveSegment(0);
    if (!enabled || !packReady || !availableClipIds.has(clip.id)) {
      setPlayback("pending");
      setOpen(true);
      return;
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
  }, [availableClipIds, enabled, packReady, playback, rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentClip(questionClip);
    setActiveSegment(0);
    setPlayback("idle");
    if (context === "exam" && enabled && autoRead && packReady && availableClipIds.has(questionClip.id)) {
      void playClip(questionClip, true);
    }
  }, [questionClip.id]); // Auto-read only when the question itself changes.

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      setPlayback("idle");
    }
  }, [enabled]);

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
      return;
    }
    void playClip(currentClip.id === questionClip.id || currentClip.id === reviewClip?.id ? currentClip : questionClip);
  };

  const statusCopy = !pack
    ? "Checking voice pack…"
    : pack.status === "awaiting_voice"
      ? "Scripts ready · awaiting your Fish voice"
      : pack.status === "awaiting_generation"
        ? "S2.1 Pro voice selected · generation pending"
        : playback === "playing"
        ? `Reading ${currentClip.label}`
        : playback === "gesture"
          ? "Tap play once to allow audio"
          : playback === "pending"
            ? "This clip is queued for the voice pack"
            : playback === "error"
              ? "Audio could not be loaded"
              : enabled ? "Narrator on · ready" : "Narrator off";

  return (
    <aside className={`narrator-dock ${open ? "open" : ""} ${enabled ? "enabled" : ""}`} aria-label="Study narrator">
      {open && (
        <section className="narrator-panel">
          <div className="narrator-head">
            <div><span className="narrator-kicker">Aureum voice layer</span><h2>Study narrator</h2></div>
            <button className="narrator-close" onClick={() => setOpen(false)} aria-label="Close narrator controls">×</button>
          </div>

          <button className="narrator-power" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)}>
            <span className="voice-orb" aria-hidden="true"><i /><i /><i /><i /></span>
            <span><b>{enabled ? "Narration on" : "Narration off"}</b><small>{statusCopy}</small></span>
            <em aria-hidden="true"><i /></em>
          </button>

          <div className="narrator-transcript" aria-live="polite">
            <span>{currentClip.segments[activeSegment]?.label ?? "Ready"}</span>
            <p>{currentClip.segments[activeSegment]?.text ?? currentClip.text}</p>
          </div>

          <div className="narrator-controls">
            <button onClick={togglePlayback} disabled={!enabled || !packReady} aria-label={playback === "playing" ? "Pause narration" : "Play narration"}>{playback === "playing" ? "Ⅱ" : "▶"}<span>{playback === "playing" ? "Pause" : "Read"}</span></button>
            <button onClick={() => void playClip(currentClip, true)} disabled={!enabled || !packReady} aria-label="Restart narration">↺<span>Restart</span></button>
            {guideClip && <button onClick={() => void playClip(guideClip, true)} disabled={!enabled || !packReady} aria-label="Read interface guide">◇<span>{context === "exam" ? "Controls" : "Session guide"}</span></button>}
            {context === "exam" && reviewClip && <button onClick={() => void playClip(reviewClip, true)} disabled={!enabled || !packReady || !reviewAvailable} aria-label="Read study review">◎<span>Review</span></button>}
          </div>

          <div className="narrator-settings">
            <button className={autoRead ? "active" : ""} aria-pressed={autoRead} onClick={() => setAutoRead((value) => !value)}><span>Auto-read new questions</span><b>{autoRead ? "On" : "Off"}</b></button>
            <label><span>Playback pace</span><select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.85}>Calm · 0.85×</option><option value={1}>Standard · 1×</option><option value={1.15}>Focused · 1.15×</option></select></label>
          </div>

          {!packReady && <p className="voice-pack-note"><b>No voice has been chosen.</b> The complete scripts and private generation pipeline are ready; this public page cannot contact Fish Audio or spend credits.</p>}
        </section>
      )}
      <button className="narrator-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="voice-orb compact-orb" aria-hidden="true"><i /><i /><i /><i /></span>
        <span><b>Narrator</b><small>{pack?.status === "awaiting_voice" ? "Voice pending" : pack?.status === "awaiting_generation" ? "S2.1 Pro queued" : enabled ? playback === "playing" ? "Reading now" : "On" : "Off"}</small></span>
        <em>{open ? "×" : "⌃"}</em>
      </button>
    </aside>
  );
}
