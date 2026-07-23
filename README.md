# Aureum Study Hall — CTS Practice

Aureum Study Hall is a free, independent study series. CTS is the first release: a local-first practice app with a 300-question source-grounded bank.

[Open Aureum Study Hall — CTS](https://mayowa-007.github.io/aureum-study-hall-cts/)

## What learners get

- 20-question quick drills, 60-question deep practice, a 115-question / 150-minute simulation, or the complete 300-question mastery bank.
- Blueprint-balanced sessions or focused practice for any CTS duty.
- Timed and study modes, shuffle, flags, resume, detailed rationales, and six interaction styles.
- Responsive mobile exam layouts with press-and-hold rationale decoding, an accessible Hint Lens, and the existing desktop Control shortcut.
- Full Fish Audio narration architecture with question, response, rationale, review, and interface scripts; clear mobile/desktop controls; auto-read; replay; and three playback speeds.
- Local attempt history, missed-question practice, CSV export, and printable/PDF-ready reports.
- Installable offline behavior after the first visit.

## Privacy and architecture

This release is a static React/Vite site. It has no backend, Firebase project, authentication, payment system, account tracking, or analytics. Session and history data are stored only in the learner's browser using `localStorage`.

The deployed app never sends text or credentials to Fish Audio. Narration is generated privately into static MP3 files, then played and cached on demand by the browser. The Fish API key must remain in the private shell environment and must never be added to this repository.

## Narration workflow

The complete, voice-independent script pack is rebuilt with the app:

```powershell
npm run narration:manifest
npm run narration:dry-run
```

`audits/narration-plan.json` records clip count, text volume, estimated duration, file size, and estimated provider cost. The live voice pack is pinned to the user-approved Fish Audio S2.1 Pro voice reference. Actual generation is deliberately gated: `npm run narration:generate` does nothing useful unless `FISH_AUDIO_API_KEY`, `FISH_REFERENCE_ID`, and `FISH_TTS_MODEL` are present in the private process environment, and the underlying generator receives its explicit `--execute` flag.

Generated audio belongs in `public/audio/narration/clips/`. The app reads `pack.json`, never a private configuration file. Until a pack is present, the UI states that scripts are ready and the voice is pending rather than pretending narration is available.

## Run locally

Requires Node.js 22.13 or newer.

```powershell
npm install
npm test
npm run dev
```

`npm run build` writes the deployable site to `dist/`.

## Study-material integrity

The questions are original practice items developed from the *CTS Certified Technology Specialist Exam Guide, Third Edition* and checked against the current official outline and primary technical sources. The copyrighted guide itself and live exam questions are not included.

Independent study material. Not affiliated with, sponsored by, or endorsed by AVIXA. CTS® and AVIXA® are marks of AVIXA, Inc. No practice product can guarantee a pass or predict a live exam.
