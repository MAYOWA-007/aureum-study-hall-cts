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

  assert.match(page, /SESSION_SIZES: SessionSize\[\] = \[20, 60, 75, 115, 300\]/);
  assert.match(page, /Final Cram/);
  assert.match(page, /finalCramQuestions/);
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
  assert.match(page, /setControlHeld\(false\)/);
  assert.match(page, /visibilitychange/);
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
  assert.match(page, /Press and hold/);
  assert.match(page, /Answer help is on/);
  assert.match(page, /chooseOrHint/);
  assert.match(css, /\.matrix-active/);
  assert.match(css, /@keyframes matrix-decode/);
  assert.match(css, /\.narrator-dock \{[^}]*pointer-events:none/);
  assert.match(css, /\.narrator-trigger \{[^}]*pointer-events:auto/);
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
  assert.equal(parsedAudit.questionCount, 375);
  assert.equal(parsedAudit.masteryBankQuestionCount, 300);
  assert.equal(parsedAudit.finalCramQuestionCount, 75);
  assert.equal(parsedAudit.clipsByKind.question, 375);
  assert.equal(parsedAudit.clipsByKind.review, 375);
  assert.equal(parsedManifest.clipCount, 2211, "every mastery and Final Cram question, choice rationale, review, and interface guide should have a clip script");
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

test("blocks repeated concepts in timed sessions and keeps custom interactions in study mode", async () => {
  const [page, quality, cram, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("audits/quality-audit.json", root), "utf8"),
    readFile(new URL("app/final-cram.generated.json", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  const parsedQuality = JSON.parse(quality);
  const parsedCram = JSON.parse(cram);
  assert.equal(parsedQuality.status, "PASS");
  assert.equal(parsedQuality.finalCramQuestions, 75);
  assert.ok(parsedQuality.semanticDuplicatePairs.length > 0, "the known concept variants should remain explicitly audited");
  for (const domain of ["A", "B", "C", "D"]) {
    assert.ok(parsedQuality.uniqueSingleBestAnswerConcepts[domain].available >= parsedQuality.uniqueSingleBestAnswerConcepts[domain].required);
  }
  assert.equal(parsedCram.length, 75);
  assert.ok(parsedCram.every((question) => question.type === "single" && question.choices.length === 4 && question.rationales.length === 4));
  assert.match(page, /question\.type === "single"/);
  assert.match(page, /question\.topic\} \$\{correctLabel\(question\)/);
  assert.match(page, /Timed practice now follows that response format/);
  assert.match(css, /\.choice-list>button\.selected i:after \{ content:"✓"/);
  assert.match(css, /\.labeled-choice-board/);
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

test("supports trinary CTS / CTS-I / CTS-D exam switcher, color themes, and full 300+75 specialty banks", async () => {
  const [page, css, bankSource, ctsiGen, ctsiCram, ctsdGen, ctsdCram, quality] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/question-bank.ts", root), "utf8"),
    readFile(new URL("app/questions-ctsi.generated.json", root), "utf8"),
    readFile(new URL("app/final-cram-ctsi.generated.json", root), "utf8"),
    readFile(new URL("app/questions-ctsd.generated.json", root), "utf8"),
    readFile(new URL("app/final-cram-ctsd.generated.json", root), "utf8"),
    readFile(new URL("audits/quality-audit.json", root), "utf8"),
  ]);

  assert.match(page, /useState<ExamId>\("cts"\)/, "must default to basic CTS exam mode");
  assert.match(page, /className="exam-switcher"/);
  assert.match(page, /Select certification exam/);
  assert.match(css, /\.emerald-theme/);
  assert.match(css, /\.crimson-theme/);
  assert.match(css, /\.sapphire-theme/);
  assert.match(css, /\.exam-switcher/);
  assert.match(bankSource, /EXAM_ORDER: ExamId\[\] = \["cts", "cts-i", "cts-d"\]/);

  const parsedCtsi = JSON.parse(ctsiGen);
  const parsedCtsiCram = JSON.parse(ctsiCram);
  const parsedCtsd = JSON.parse(ctsdGen);
  const parsedCtsdCram = JSON.parse(ctsdCram);
  const parsedQuality = JSON.parse(quality);

  assert.equal(parsedCtsi.length, 300, "CTS-I mastery bank must contain 300 questions");
  assert.equal(parsedCtsiCram.length, 75, "CTS-I Final Cram must contain 75 questions");
  assert.equal(parsedCtsd.length, 300, "CTS-D mastery bank must contain 300 questions");
  assert.equal(parsedCtsdCram.length, 75, "CTS-D Final Cram must contain 75 questions");
  assert.equal(parsedQuality.exams["cts-i"].questions, 300);
  assert.equal(parsedQuality.exams["cts-d"].questions, 300);
});

test("enforces WCAG 2.2 AA accessibility, modal focus trapping, LAN/private-browsing safety, and cross-device safeguards", async () => {
  const [page, player, css, indexHtml, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/narration-player.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/service-worker.js", root), "utf8"),
  ]);

  assert.match(indexHtml, /viewport-fit=cover/, "safe-area-inset requires viewport-fit=cover on notched/home-indicator devices");
  assert.match(indexHtml, /rel="apple-touch-icon"/);

  const parsedManifest = JSON.parse(manifest);
  assert.ok(parsedManifest.icons.every((icon) => icon.purpose !== "any maskable"), "PWA icons should separate 'any' and 'maskable' purposes");

  assert.match(serviceWorker, /pack-cts-i\.json/);
  assert.match(serviceWorker, /pack-cts-d\.json/);
  assert.match(serviceWorker, /if \(response\.status !== 200\) return response/, "service worker must skip 206 Partial Content audio responses before cache.put");

  assert.match(page, /function useModalDialog/, "all modal dialogs should trap focus, lock scroll, and restore focus");
  assert.match(page, /aria-labelledby="navigator-modal-title"/);
  assert.match(page, /aria-labelledby="submit-modal-title"/);
  assert.match(page, /aria-labelledby="sources-modal-title"/);
  assert.match(page, /className="skip-link"/);
  assert.match(page, /htmlFor=\{inputId\}/, "numeric input must have an associated label");
  assert.match(page, /role="status" aria-live="polite"/, "study-mode check-answer feedback must announce via polite live region");
  assert.match(page, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return/, "modifier-chord shortcuts like Ctrl+1 must not select answers");
  assert.match(page, /crypto\.getRandomValues/, "session seed generator must fall back when crypto.randomUUID is unavailable over HTTP LAN");
  assert.match(page, /start\(mode, questionIds\)/, "retaking a session must preserve study vs timed mode");
  assert.match(page, /className=\{`mobile-timer/, "timed mode must keep a visible timer on <=900px viewports");

  assert.match(player, /prepareSpeechText\(clip\.text\)/, "Web Speech fallback should use phonetic AV acronym rules");
  assert.match(player, /utterance\.onboundary/, "Web Speech fallback should advance live transcript segments");

  assert.match(css, /--gold-dark:#7a5818/, "gold-dark token must meet 4.5:1 AA contrast on warm paper");
  assert.match(css, /--muted:#555a53/, "muted text token must meet 4.5:1 AA contrast on warm paper");
  assert.match(css, /@media \(pointer:coarse\)/, "coarse pointers should use 16px form controls to prevent iOS Safari auto-zoom");
});

