import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const bank = JSON.parse(readFileSync("audits/questions.release.json", "utf8"));
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

assert.equal(bank.length, 300, "release bank must contain 300 questions");
assert.deepEqual(bank.map((question) => question.id), Array.from({ length: 300 }, (_, index) => index + 1), "question IDs must be sequential");

const seen = new Map();
const issues = [];
for (const question of bank) {
  for (const pattern of blockedPhrases) {
    if (pattern.test(question.prompt)) issues.push(`Q${question.id}: blocked wording ${pattern}`);
  }
  const canonical = canonicalPrompt(question.prompt);
  if (seen.has(canonical)) issues.push(`Q${question.id}: semantically duplicates Q${seen.get(canonical)}`);
  seen.set(canonical, question.id);
  if (!question.source || !question.chapter || !question.explanation || !question.studyNote) {
    issues.push(`Q${question.id}: missing source-grounded teaching metadata`);
  }
}

const report = {
  status: issues.length ? "FAIL" : "PASS",
  questions: bank.length,
  uniqueCanonicalPrompts: seen.size,
  blockedWordingPatterns: blockedPhrases.length,
  issues,
};
writeFileSync("audits/quality-audit.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
assert.deepEqual(issues, [], issues.join("\n"));
console.log(JSON.stringify(report, null, 2));
