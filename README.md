# Aureum Study Hall — CTS, CTS-I & CTS-D Practice

Aureum Study Hall is a free, independent study series. This release expands the local-first practice app into a 1,125-question suite across three AVIXA certifications—**CTS®** (General), **CTS-I®** (Installation), and **CTS-D®** (Design)—each with a 300-question source-grounded mastery bank plus a 75-question Final Cram collection. The app defaults to **CTS®** and provides a trinary exam selector in the hero bar.

[Open Aureum Study Hall — CTS](https://mayowa-007.github.io/aureum-study-hall-cts/)

## What learners get

- 20-question quick drills, 60-question deep practice, a curated Final Cram 75, a 115-question / 150-minute simulation, or the complete 300-question mastery bank.
- Trinary exam switcher (`CTS` | `CTS-I` | `CTS-D`, defaulting to `CTS`) with blueprint-balanced sessions or focused practice for any exam area (`A–D` for CTS and CTS-D; `A–F` for CTS-I).
- Exam-faithful timed sessions with four choices and one best answer; clearly labeled custom interactions remain in study mode.
- Deterministic shuffle sets that group by concept and best answer, preventing semantically repeated variants in normal timed sessions.
- Responsive mobile and tablet layouts with larger question text, visible timed-exam clock on narrow screens, notched safe-area insets, 16px touch inputs to prevent iOS Safari auto-zoom, press-and-hold answer help, a plain-language Answer Help button, and the desktop Control shortcut.
- WCAG 2.2 AA accessibility: high-contrast text and focus-visible rings across light and dark surfaces, keyboard skip links, modal focus trapping with Escape/backdrop dismissal, and screen-reader live status announcements.
- Complete Fish Audio S2.1 Pro read-aloud coverage: 2,211 static question, response, rationale, review, and interface clips; auto-read; replay; and three playback speeds.
- Tokenized site-wide exam themes (`Emerald` for CTS, `Crimson` for CTS-I, `Sapphire` for CTS-D) paired with neutral gold selected states and explicit check marks, so decorative color is never mistaken for correctness.
- Local attempt history, missed-question practice, CSV export, and printable/PDF-ready reports.
- Installable offline behavior after the first visit.

## Privacy and architecture

This release is a static React/Vite site with per-bank bundle splitting (`vendor`, `bank-cts`, `bank-ctsi`, `bank-ctsd` via `vite.config.ts`). It has no backend, Firebase project, authentication, payment system, account tracking, or analytics. Session and history data are stored only in the learner's browser using isolated per-exam `localStorage` keys (`aureum-study-hall-cts-*`, `aureum-study-hall-cts-i-*`, `aureum-study-hall-cts-d-*`), with graceful fallback when storage is restricted or full, and deterministic seed generation that works over both HTTPS and plain HTTP LAN dev servers.

The deployed app never sends text or credentials to Fish Audio. Narration is generated privately into static MP3 files, then played and cached on demand by the browser (skipping partial `206` audio range responses so service-worker caching stays error-free across mobile and desktop browsers). The Fish API key must remain in the private shell environment and must never be added to this repository.

## Narration workflow

The complete, voice-independent script pack is rebuilt with the app:

```powershell
npm run narration:manifest
npm run narration:dry-run
```

`audits/narration-plan.json` records CTS clip count, text volume, estimated duration, file size, and estimated provider cost, while `audits/narration-plan-multi.json` tracks all three exam tracks (`2,211` clips per exam) and writes per-exam manifests (`manifest.json`, `manifest-cts-i.json`, `manifest-cts-d.json`) and packs (`pack.json`, `pack-cts-i.json`, `pack-cts-d.json`). The live voice pack is pinned to the user-approved Fish Audio S2.1 Pro voice reference. Actual generation is deliberately gated: `npm run narration:generate` does nothing useful unless `FISH_AUDIO_API_KEY`, `FISH_REFERENCE_ID`, and `FISH_TTS_MODEL` are present in the private process environment, and the underlying generator receives its explicit `--execute` flag.

Generated audio belongs in `public/audio/narration/clips/`. The app reads `pack.json`, never a private configuration file. When static MP3 clips are pending generation, the player automatically falls back to built-in browser Web Speech synthesis using phonetic AV acronym rules (DISCAS, ISCR, EDID, HDCP, SDVoE, AES67, AVB, WLL, RT60, PAG/NAG, EPR) with live transcript segment highlighting.

The Final Cram importer keeps the supplied standalone HTML as the review source while producing normalized, stable IDs:

```powershell
node scripts/import-final-cram.mjs <path-to-Aureum-CTS-75-Question-Final-Cram-Exam.html>
```

## Run locally

Requires Node.js 22.13 or newer.

```powershell
npm install
npm test
npm run dev
```

`npm run build` writes the deployable site to `dist/`.

## Study-material integrity

The CTS® questions are original practice items developed from the *CTS Certified Technology Specialist Exam Guide, Third Edition* and checked against the current official outline and primary technical sources. The CTS-I® 300-question mastery bank and 75-question Final Cram collection cover AVIXA's 6-duty installation blueprint (Duties A–F) grounded in the *CTS-I Certified Technology Specialist–Installation Exam Guide, Second Edition*. The CTS-D® 300-question mastery bank and 75-question Final Cram collection cover AVIXA's 4-duty design blueprint (Duties A–D) and AV engineering formulas grounded in the *CTS-D Certified Technology Specialist–Design Exam Guide, Second Edition*. The copyrighted guides themselves and live exam questions are not included.

Independent study material. Not affiliated with, sponsored by, or endorsed by AVIXA. CTS®, CTS-I®, CTS-D®, and AVIXA® are marks of AVIXA, Inc. No practice product can guarantee a pass or predict a live exam.
