import { mkdirSync, writeFileSync } from "node:fs";
import { buildNarrationManifest } from "../app/narration";
import {
  allQuestions,
  ctsdAllQuestions,
  ctsdFinalCramQuestions,
  ctsdQuestions,
  ctsiAllQuestions,
  ctsiFinalCramQuestions,
  ctsiQuestions,
  finalCramQuestions,
  questions,
} from "../app/question-bank";

const priceEstimateUsdPerMillionUtf8Bytes = 15;
const approvedVoice = {
  provider: "Fish Audio",
  model: "s2.1-pro",
  referenceId: "f3b85abdea0e4e1c9fc60b4e3063a4a0",
  approvedAt: "2026-07-22",
};

function buildExamPlan(project: string, examId: "cts" | "cts-i" | "cts-d", allBank: typeof allQuestions, masteryBank: typeof questions, cramBank: typeof finalCramQuestions) {
  const clips = buildNarrationManifest(allBank, examId);
  const utf8Bytes = clips.reduce((sum, clip) => sum + Buffer.byteLength(clip.ttsText, "utf8"), 0);
  const words = clips.reduce((sum, clip) => sum + clip.ttsText.split(/\s+/).filter(Boolean).length, 0);
  const estimatedMinutes = words / 145;
  const estimatedMp3BytesAt64Kbps = Math.round(estimatedMinutes * 60 * 64_000 / 8);
  const generatedAt = new Date().toISOString();

  const manifest = {
    schemaVersion: 1,
    series: "Aureum Study Hall",
    project,
    generatedAt,
    voiceStatus: "approved",
    approvedVoice,
    clipCount: clips.length,
    clips,
  };

  const audit = {
    generatedAt,
    questionCount: allBank.length,
    masteryBankQuestionCount: masteryBank.length,
    finalCramQuestionCount: cramBank.length,
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

  return { manifest, audit };
}

const ctsPlan = buildExamPlan("CTS", "cts", allQuestions, questions, finalCramQuestions);
const ctsiPlan = buildExamPlan("CTS-I", "cts-i", ctsiAllQuestions, ctsiQuestions, ctsiFinalCramQuestions);
const ctsdPlan = buildExamPlan("CTS-D", "cts-d", ctsdAllQuestions, ctsdQuestions, ctsdFinalCramQuestions);

mkdirSync("public/audio/narration", { recursive: true });
mkdirSync("audits", { recursive: true });

writeFileSync("public/audio/narration/manifest.json", `${JSON.stringify(ctsPlan.manifest, null, 2)}\n`, "utf8");
writeFileSync("audits/narration-plan.json", `${JSON.stringify(ctsPlan.audit, null, 2)}\n`, "utf8");

writeFileSync("public/audio/narration/manifest-cts-i.json", `${JSON.stringify(ctsiPlan.manifest, null, 2)}\n`, "utf8");
writeFileSync("public/audio/narration/pack-cts-i.json", `${JSON.stringify({
  schemaVersion: 1,
  project: "CTS-I",
  status: "awaiting_generation",
  voice: approvedVoice,
  availableClipIds: [],
  missingClipIds: ctsiPlan.manifest.clips.map((clip) => clip.id),
  files: {},
}, null, 2)}\n`, "utf8");

writeFileSync("public/audio/narration/manifest-cts-d.json", `${JSON.stringify(ctsdPlan.manifest, null, 2)}\n`, "utf8");
writeFileSync("public/audio/narration/pack-cts-d.json", `${JSON.stringify({
  schemaVersion: 1,
  project: "CTS-D",
  status: "awaiting_generation",
  voice: approvedVoice,
  availableClipIds: [],
  missingClipIds: ctsdPlan.manifest.clips.map((clip) => clip.id),
  files: {},
}, null, 2)}\n`, "utf8");

writeFileSync("audits/narration-plan-multi.json", `${JSON.stringify({
  cts: ctsPlan.audit,
  "cts-i": ctsiPlan.audit,
  "cts-d": ctsdPlan.audit,
}, null, 2)}\n`, "utf8");

console.log(`Prepared narration manifests: CTS (${ctsPlan.manifest.clipCount} clips), CTS-I (${ctsiPlan.manifest.clipCount} clips), CTS-D (${ctsdPlan.manifest.clipCount} clips).`);
