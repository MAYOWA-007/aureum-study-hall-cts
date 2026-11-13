import { mkdirSync, writeFileSync } from "node:fs";
import { ctsdQuestions, ctsiQuestions, questions } from "../app/question-bank";

mkdirSync("audits", { recursive: true });
writeFileSync("audits/questions.release.json", `${JSON.stringify(questions, null, 2)}\n`, "utf8");
writeFileSync("audits/questions-ctsi.release.json", `${JSON.stringify(ctsiQuestions, null, 2)}\n`, "utf8");
writeFileSync("audits/questions-ctsd.release.json", `${JSON.stringify(ctsdQuestions, null, 2)}\n`, "utf8");
console.log(`Exported ${questions.length} CTS, ${ctsiQuestions.length} CTS-I, and ${ctsdQuestions.length} CTS-D questions to audits/`);
