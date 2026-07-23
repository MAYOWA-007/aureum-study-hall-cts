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

test("supports responsive mobile hint decoding without changing desktop controls", async () => {
  const [page, css, indexHtml] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);

  assert.match(indexHtml, /width=device-width, initial-scale=1\.0/);
  assert.match(page, /const LONG_PRESS_MS = 520/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /data-hint-active/);
  assert.match(page, /Press \+ hold/);
  assert.match(page, /Hint lens on/);
  assert.match(page, /chooseOrHint/);
  assert.match(css, /\.matrix-active/);
  assert.match(css, /@keyframes matrix-decode/);
  assert.match(css, /min-height:100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width:380px\)/);
});

test("prepares full static Fish narration without exposing a runtime secret or API call", async () => {
  const [page, player, narration, generator, manifest, pack, audit, serviceWorker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/narration-player.tsx", root), "utf8"),
    readFile(new URL("app/narration.ts", root), "utf8"),
    readFile(new URL("scripts/generate-fish-narration.mjs", root), "utf8"),
    readFile(new URL("public/audio/narration/manifest.json", root), "utf8"),
    readFile(new URL("public/audio/narration/pack.json", root), "utf8"),
    readFile(new URL("audits/narration-plan.json", root), "utf8"),
    readFile(new URL("public/service-worker.js", root), "utf8"),
  ]);

  const parsedManifest = JSON.parse(manifest);
  const parsedPack = JSON.parse(pack);
  const parsedAudit = JSON.parse(audit);
  assert.equal(parsedManifest.voiceStatus, "approved");
  assert.equal(parsedManifest.approvedVoice.model, "s2.1-pro");
  assert.equal(parsedManifest.approvedVoice.referenceId, "f3b85abdea0e4e1c9fc60b4e3063a4a0");
  assert.equal(parsedAudit.questionCount, 300);
  assert.equal(parsedAudit.clipsByKind.question, 300);
  assert.equal(parsedAudit.clipsByKind.review, 300);
  assert.ok(parsedManifest.clipCount > 1500, "every question, choice rationale, review, and interface guide should have a clip script");
  assert.equal(parsedPack.status, "ready");
  assert.equal(parsedPack.availableClipIds.length, parsedManifest.clipCount);
  assert.match(page, /NarrationPlayer context="exam"/);
  assert.match(player, /Auto-read new questions/);
  assert.match(player, /Playback pace/);
  assert.match(narration, /prepareSpeechText/);
  assert.match(generator, /process\.env\.FISH_AUDIO_API_KEY/);
  assert.match(generator, /args\.has\("--execute"\)/);
  assert.match(generator, /https:\/\/api\.fish\.audio\/v1\/tts/);
  assert.doesNotMatch(`${page}\n${player}\n${narration}\n${manifest}\n${pack}`, /FISH_AUDIO_API_KEY|api\.fish\.audio|Bearer /);
  assert.match(serviceWorker, /audio\/narration\/pack\.json/);
  assert.match(serviceWorker, /if \(!response\.ok\) return response/);
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
    "05-narration.png",
    "06-feedback.png",
    "07-privacy-and-link.png",
  ];
  for (const name of names) {
    const png = await readFile(new URL(`marketing/social/carousel/${name}`, root));
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${name} must be a PNG`);
    assert.equal(png.readUInt32BE(16), 1080, `${name} must be 1080 px wide`);
    assert.equal(png.readUInt32BE(20), 1350, `${name} must be 1350 px tall`);
  }
});
