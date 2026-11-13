import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const blockedPhrases = [
  /applied scenario \d+/i,
  /missing term or value/i,
  /\bw\s+hat\b/i,
  /which option (?:cost descriptions|types of maintenance agreements|documents would)/i,
  /which approach should (?:the av company respond|an av system designer determine|the av design ensure)/i,
];

const canonicalPrompt = (prompt) => prompt
  .toLowerCase()
  .replace(/^applied scenario \d+:\s*/, "")
  .replace(/^which option most accurately completes this statement about [^?]+\?\s*[\"'“”]*/, "")
  .replace(/^[\"'“”]*(?:a|an) [^.]{20,220}\.\s+(?=[a-z])/i, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const STOP_WORDS = new Set("a an and are as at be best by do does for from has have how in into is it its most of on one or should that the their them they this to what when which who why with would option accurately completes statement about".split(" "));
const semanticTokens = (prompt) => new Set(canonicalPrompt(prompt)
  .replace(/select the correct labeled region in the diagram/g, "")
  .replace(/draw the connection from the prompt node to the best destination/g, "")
  .split(/\s+/)
  .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
const jaccard = (left, right) => {
  const a = semanticTokens(left);
  const b = semanticTokens(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection || 1);
};
const bestAnswer = (question) => {
  if (question.type === "numeric") return `${question.numericAnswer} ${question.unit ?? ""}`;
  if (question.type === "order") return (question.steps ?? []).join("|");
  if (question.type === "multi") return ((question.answer ?? []).map((index) => question.choices?.[index]).filter(Boolean)).join("|");
  if (question.type === "hotspot") return question.hotspots?.find((spot) => spot.id === question.answer)?.label ?? "";
  return question.choices?.[Number(question.answer)] ?? "";
};

const conceptFingerprint = (question) => `${canonicalPrompt(question.topic)}|${canonicalPrompt(bestAnswer(question))}`;

function auditExam(examCode, bankPath, finalCramPath, officialPaceAllocation) {
  const bank = JSON.parse(readFileSync(bankPath, "utf8"));
  const finalCram = JSON.parse(readFileSync(finalCramPath, "utf8"));

  assert.equal(bank.length, 300, `${examCode} release bank must contain 300 questions`);
  assert.deepEqual(bank.map((question) => question.id), Array.from({ length: 300 }, (_, index) => index + 1), `${examCode} question IDs must be sequential`);
  assert.equal(finalCram.length, 75, `${examCode} Final Cram must contain 75 questions`);
  assert.deepEqual(finalCram.map((question) => question.id), Array.from({ length: 75 }, (_, index) => index + 1001), `${examCode} Final Cram IDs must be stable and sequential`);

  const seen = new Map();
  const issues = [];
  for (const question of bank) {
    for (const pattern of blockedPhrases) {
      if (pattern.test(question.prompt)) issues.push(`[${examCode}] Q${question.id}: blocked wording ${pattern}`);
    }
    const canonical = canonicalPrompt(question.prompt);
    if (seen.has(canonical)) issues.push(`[${examCode}] Q${question.id}: semantically duplicates Q${seen.get(canonical)}`);
    seen.set(canonical, question.id);
    if (!question.source || !question.chapter || !question.explanation || !question.studyNote) {
      issues.push(`[${examCode}] Q${question.id}: missing source-grounded teaching metadata`);
    }
  }

  const finalCramSeen = new Map();
  for (const question of finalCram) {
    const canonical = canonicalPrompt(question.prompt);
    if (finalCramSeen.has(canonical)) issues.push(`[${examCode}] FC${question.legacyId}: duplicates FC${finalCramSeen.get(canonical)}`);
    finalCramSeen.set(canonical, question.legacyId);
    if (question.type !== "single" || question.choices?.length !== 4 || question.rationales?.length !== 4) {
      issues.push(`[${examCode}] FC${question.legacyId}: must be a four-choice single-best-answer item with four rationales`);
    }
    if (!question.source || !question.chapter || !question.explanation || !question.studyNote) {
      issues.push(`[${examCode}] FC${question.legacyId}: missing source-grounded teaching metadata`);
    }
  }

  const semanticDuplicatePairs = [];
  for (const collection of [bank, finalCram]) {
    for (let left = 0; left < collection.length; left += 1) {
      for (let right = left + 1; right < collection.length; right += 1) {
        const a = collection[left];
        const b = collection[right];
        if (a.topic.toLowerCase() !== b.topic.toLowerCase()) continue;
        if (canonicalPrompt(bestAnswer(a)) !== canonicalPrompt(bestAnswer(b))) continue;
        const similarity = jaccard(a.prompt, b.prompt);
        if (similarity < 0.72) continue;
        const label = (question) => question.collection === "final-cram" ? `FC${question.legacyId}` : `Q${question.id}`;
        semanticDuplicatePairs.push({ first: label(a), second: label(b), similarity: Number(similarity.toFixed(3)) });
      }
    }
  }

  const uniqueSingleBestAnswerConcepts = Object.fromEntries(Object.entries(officialPaceAllocation).map(([domain, required]) => {
    const available = new Set(bank
      .filter((question) => question.domain === domain && question.type === "single")
      .map(conceptFingerprint)).size;
    if (available < required) issues.push(`[${examCode}] Exam area ${domain}: only ${available} unique single-best-answer concepts for ${required} required positions`);
    return [domain, { available, required }];
  }));

  return {
    examCode,
    questions: bank.length,
    finalCramQuestions: finalCram.length,
    uniqueCanonicalPrompts: seen.size,
    uniqueFinalCramPrompts: finalCramSeen.size,
    semanticDuplicatePairs,
    uniqueSingleBestAnswerConcepts,
    issues,
  };
}

const ctsAudit = auditExam("CTS", "audits/questions.release.json", "app/final-cram.generated.json", { A: 40, B: 35, C: 17, D: 23 });
const ctsiAudit = auditExam("CTS-I", "audits/questions-ctsi.release.json", "app/final-cram-ctsi.generated.json", { A: 20, B: 14, C: 14, D: 44, E: 14, F: 9 });
const ctsdAudit = auditExam("CTS-D", "audits/questions-ctsd.release.json", "app/final-cram-ctsd.generated.json", { A: 23, B: 32, C: 44, D: 16 });

const allIssues = [...ctsAudit.issues, ...ctsiAudit.issues, ...ctsdAudit.issues];

const report = {
  status: allIssues.length ? "FAIL" : "PASS",
  questions: ctsAudit.questions,
  finalCramQuestions: ctsAudit.finalCramQuestions,
  uniqueCanonicalPrompts: ctsAudit.uniqueCanonicalPrompts,
  uniqueFinalCramPrompts: ctsAudit.uniqueFinalCramPrompts,
  blockedWordingPatterns: blockedPhrases.length,
  semanticDuplicatePairs: ctsAudit.semanticDuplicatePairs,
  semanticDuplicatePolicy: "Variants remain available in full-bank study; timed sessions group by topic plus best answer and exhaust unique concepts before any reuse.",
  uniqueSingleBestAnswerConcepts: ctsAudit.uniqueSingleBestAnswerConcepts,
  exams: {
    cts: ctsAudit,
    "cts-i": ctsiAudit,
    "cts-d": ctsdAudit,
  },
  issues: allIssues,
};
writeFileSync("audits/quality-audit.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
assert.deepEqual(allIssues, [], allIssues.join("\n"));
console.log(JSON.stringify(report, null, 2));
