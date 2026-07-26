import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: node scripts/import-final-cram.mjs <Aureum-CTS-75-Question-Final-Cram-Exam.html>");
}

const html = readFileSync(resolve(sourcePath), "utf8");
const match = html.match(/<script id="question-data" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match, "The supplied HTML must contain a question-data JSON script.");

const sourceQuestions = JSON.parse(match[1]);
assert.equal(sourceQuestions.length, 75, "The Final Cram source must contain exactly 75 questions.");
assert.ok(sourceQuestions.every((question) => question.type === "single"), "Final Cram must use single-best-answer questions only.");

const tasks = {
  A1: ["A", "Conduct a customer needs analysis"],
  A2: ["A", "Conduct a site survey"],
  A3: ["A", "Develop an AV project scope"],
  A4: ["A", "Design AV solutions"],
  B1: ["B", "Integrate AV solution"],
  B2: ["B", "Manage AV integration"],
  C1: ["C", "Provide AV support"],
  D2: ["D", "Conduct maintenance activities"],
  D3: ["D", "Troubleshoot and repair AV solutions"],
};

const taskByLegacyId = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4", 5: "B1", 6: "A4", 7: "B2", 8: "B2", 9: "B1", 10: "B1",
  11: "B2", 12: "A4", 13: "A4", 14: "A4", 15: "A4", 16: "A4", 17: "A4", 18: "A4", 19: "A4", 20: "A4",
  21: "A4", 22: "A4", 23: "B1", 24: "B1", 25: "A4", 26: "A4", 27: "A4", 28: "A4", 29: "A4", 30: "A4",
  31: "A4", 32: "A4", 33: "A4", 34: "A4", 35: "A4", 36: "A4", 37: "A4", 38: "A4", 39: "A4", 40: "A4",
  41: "B1", 42: "A4", 43: "A4", 44: "A4", 45: "B1", 46: "A4", 47: "D2", 48: "A4", 49: "B2", 50: "A3",
  51: "B2", 52: "B1", 53: "B1", 54: "B2", 55: "B1", 56: "A4", 57: "A4", 58: "A4", 59: "A4", 60: "A4",
  61: "A4", 62: "A4", 63: "A4", 64: "B2", 65: "D3", 66: "D3", 67: "A4", 68: "A4", 69: "A4", 70: "D3",
  71: "C1", 72: "A4", 73: "C1", 74: "C1", 75: "D3",
};

const finalCram = sourceQuestions.map((question, index) => {
  const taskCode = taskByLegacyId[question.id];
  const [domain, task] = tasks[taskCode];
  assert.ok(domain && task, `Missing current-blueprint mapping for Final Cram item ${question.id}.`);
  assert.equal(question.choices.length, 4, `Final Cram item ${question.id} must have four choices.`);
  assert.equal(question.rationales.length, 4, `Final Cram item ${question.id} must have four rationales.`);
  assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `Final Cram item ${question.id} has an invalid answer.`);
  assert.ok(question.source && question.chapter && question.explanation, `Final Cram item ${question.id} is missing source-grounded teaching metadata.`);

  return {
    id: 1001 + index,
    legacyId: question.id,
    collection: "final-cram",
    type: "single",
    domain,
    task,
    topic: question.topic,
    prompt: question.prompt,
    choices: question.choices,
    answer: question.answer,
    explanation: question.explanation,
    studyNote: question.studyNote ?? question.explanation,
    source: question.source,
    chapter: question.chapter,
    rationales: question.rationales,
  };
});

writeFileSync("app/final-cram.generated.json", `${JSON.stringify(finalCram, null, 2)}\n`, "utf8");
console.log(`Imported ${finalCram.length} Final Cram questions from ${resolve(sourcePath)}.`);
