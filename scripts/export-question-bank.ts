import { mkdirSync, writeFileSync } from "node:fs";
import { questions } from "../app/question-bank";

mkdirSync("audits", { recursive: true });
writeFileSync("audits/questions.release.json", `${JSON.stringify(questions, null, 2)}\n`, "utf8");
console.log(`Exported ${questions.length} questions to audits/questions.release.json`);
