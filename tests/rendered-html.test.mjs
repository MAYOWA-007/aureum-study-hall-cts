import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the complete audited question bank in a static build", async () => {
  const [generated, bankSource, page, built, builtInfo] = await Promise.all([
    readFile(new URL("app/questions.generated.json", root), "utf8"),
    readFile(new URL("app/question-bank.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("dist/index.html", root), "utf8"),
    stat(new URL("dist/index.html", root)),
  ]);

  assert.equal(JSON.parse(generated).length, 295);
  assert.match(bankSource, /id: 300/);
  assert.match(page, /const TOTAL_QUESTIONS = questions\.length/);
  assert.match(built, /Aureum Study Hall/);
  assert.ok(builtInfo.size > 500, "Vite should emit a real HTML entry point");
});

test("includes high-value local study modes and offline support", async () => {
  const [page, css, packageJson, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/service-worker.js", root), "utf8"),
  ]);

  assert.match(page, /SESSION_SIZES: SessionSize\[\] = \[20, 60, 115, 300\]/);
  assert.match(page, /buildQuestionOrder/);
  assert.match(page, /Practice \{sessionTotal - score\} review items/);
  assert.match(page, /Download CSV report/);
  assert.match(page, /Print \/ save PDF/);
  assert.match(page, /HISTORY_KEY/);
  assert.match(page, /No account, analytics, or cloud sync/);
  assert.match(css, /\.session-builder/);
  assert.match(css, /\.local-progress/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(packageJson, /firebase|stripe|next|drizzle|cloudflare|wrangler/i);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(serviceWorker, /aureum-study-hall-cts-v\d+/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
});

test("preserves question navigation, rationale, and detailed reporting contracts", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /setControlHeld\(true\)/);
  assert.match(page, /submitJump/);
  assert.match(page, /Close question rail/);
  assert.match(page, /Click any question to move around/);
  assert.match(page, /Answered accuracy/);
  assert.match(page, /Results by task/);
  assert.match(page, /Choice-by-choice reasoning/);
  assert.match(page, /aria-pressed/);
});

test("ships CTS-specific branding and a ready-to-upload social carousel", async () => {
  const indexHtml = await readFile(new URL("index.html", root), "utf8");
  const posts = await readFile(new URL("marketing/social/POSTS.md", root), "utf8");
  const pageSource = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(indexHtml, /aureum-study-hall-cts/);
  assert.match(posts, /https:\/\/mayowa-007\.github\.io\/aureum-study-hall-cts\//);
  assert.match(pageSource, /favicon-512\.png/);

  const names = [
    "01-cover.png",
    "02-session-options.png",
    "03-practice-modes.png",
    "04-interactions.png",
    "05-feedback.png",
    "06-privacy-and-link.png",
  ];
  for (const name of names) {
    const png = await readFile(new URL(`marketing/social/carousel/${name}`, root));
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${name} must be a PNG`);
    assert.equal(png.readUInt32BE(16), 1080, `${name} must be 1080 px wide`);
    assert.equal(png.readUInt32BE(20), 1350, `${name} must be 1350 px tall`);
  }
});
