import { mkdirSync, writeFileSync } from "node:fs";
import { buildNarrationManifest } from "../app/narration";
import { questions } from "../app/question-bank";

const clips = buildNarrationManifest(questions);
const utf8Bytes = clips.reduce((sum, clip) => sum + Buffer.byteLength(clip.ttsText, "utf8"), 0);
const words = clips.reduce((sum, clip) => sum + clip.ttsText.split(/\s+/).filter(Boolean).length, 0);
const estimatedMinutes = words / 145;
const estimatedMp3BytesAt64Kbps = Math.round(estimatedMinutes * 60 * 64_000 / 8);
const priceEstimateUsdPerMillionUtf8Bytes = 15;
const approvedVoice = {
  provider: "Fish Audio",
  model: "s2.1-pro",
  referenceId: "f3b85abdea0e4e1c9fc60b4e3063a4a0",
  approvedAt: "2026-07-22",
};

const manifest = {
  schemaVersion: 1,
  series: "Aureum Study Hall",
  project: "CTS",
  generatedAt: new Date().toISOString(),
  voiceStatus: "approved",
  approvedVoice,
  clipCount: clips.length,
  clips,
};

const audit = {
  generatedAt: manifest.generatedAt,
  questionCount: questions.length,
  clipCount: clips.length,
  clipsByKind: Object.fromEntries(["interface", "question", "rationale", "review"].map((kind) => [kind, clips.filter((clip) => clip.kind === kind).length])),
  totalUtf8Bytes: utf8Bytes,
  estimatedWords: words,
  estimatedMinutesAt145Wpm: Number(estimatedMinutes.toFixed(1)),
  estimatedMp3MegabytesAt64Kbps: Number((estimatedMp3BytesAt64Kbps / 1_000_000).toFixed(1)),
  priceEstimate: {
    basis: "Fish Audio public pricing checked 2026-07-22; verify again before generation",
    usdPerMillionUtf8Bytes: priceEstimateUsdPerMillionUtf8Bytes,
    estimatedUsd: Number((utf8Bytes / 1_000_000 * priceEstimateUsdPerMillionUtf8Bytes).toFixed(2)),
  },
  safety: {
    apiKeyInManifest: false,
    runtimeProviderCalls: false,
    generationRequiresExplicitExecuteFlag: true,
    selectedVoice: approvedVoice,
  },
};

mkdirSync("public/audio/narration", { recursive: true });
mkdirSync("audits", { recursive: true });
writeFileSync("public/audio/narration/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync("audits/narration-plan.json", `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(`Prepared ${clips.length} narration scripts for ${questions.length} questions.`);
console.log(`Dry plan: ${utf8Bytes.toLocaleString()} UTF-8 bytes, about ${audit.estimatedMinutesAt145Wpm} minutes, estimated $${audit.priceEstimate.estimatedUsd}.`);
