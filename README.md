# Aureum Study Hall — CTS Practice

Aureum Study Hall is a free, independent study series. CTS is the first release: a local-first practice app with a 300-question source-grounded bank.

[Open Aureum Study Hall — CTS](https://mayowa-007.github.io/aureum-study-hall-cts/)

## What learners get

- 20-question quick drills, 60-question deep practice, a 115-question / 150-minute simulation, or the complete 300-question mastery bank.
- Blueprint-balanced sessions or focused practice for any CTS duty.
- Timed and study modes, shuffle, flags, resume, detailed rationales, and six interaction styles.
- Local attempt history, missed-question practice, CSV export, and printable/PDF-ready reports.
- Installable offline behavior after the first visit.

## Privacy and architecture

This release is a static React/Vite site. It has no backend, Firebase project, authentication, payment system, account tracking, or analytics. Session and history data are stored only in the learner's browser using `localStorage`.

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
