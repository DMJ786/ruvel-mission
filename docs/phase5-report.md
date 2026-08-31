# PHASE 5 — SUBMISSION ASSET REPORT

Preparation date: 2026-09-01 (Australia/Sydney). **Submission assets and public GitHub repository prepared; Devpost not submitted and final video not recorded.** The deployed product remains frozen at application commit `a576248`.

## GitHub

Repository: [github.com/DMJ786/ruvel-mission](https://github.com/DMJ786/ruvel-mission)  
Public: **Yes**  
Branch: `main`  
Submission-asset HEAD before this report: `6b111eb218c7df74966bd7708f80e9c20990b46a`  
Application deployment commit: `a5762485f8a3349ef0171e90dceb464961975218`  
Secret scan: **PASS**  
Licence: **MIT**, root `LICENSE`, linked from README

GitHub was created through the authenticated GitHub CLI account `DMJ786` using its OS-keyring credential. No password or token was entered into the Sites repository host or written into the workspace. The repository is a new, separate public `github` remote. The local repository had no configured Sites remote, and no Sites deployment configuration was changed.

The release gate verified `c0fc3c2` differed from deployed `a576248` only by `docs/phase4-report.md`. Phase 5 then added only README, documentation, screenshots and a public-audit utility. `git diff a576248..HEAD` remains empty for `apps`, `packages`, E2E, package manifests and the lockfile.

The final pre-report public audit checked **117 tracked files across 16 commits** for forbidden artifacts, ignore coverage, private keys, common token formats, credentials in URLs, validation Mission handles, local user paths and non-empty secret assignments. The rotated-credential fingerprint audit checked **5,575 text files, 316 Git objects and 308 trace entries** across source, history, expanded builds and ignored validation evidence. Both passed.

## README

Status: **Final and public.**

The opening explains the product in under 30 seconds with the approved narrative:

- Ruvel Mission
- Say it once.
- Life crosses organisations. Websites don't.
- Humans delegate outcomes. Sites retain authority. Agents coordinate capabilities.

It includes what the product is, the problem and scenario, why WebMCP is essential, Mission Passport, BrightEnergy dynamic authority, CivicAid session identity, NextStep, Mission Receipt, a Mermaid architecture diagram, all four public URLs, judge quickstart, local development, tests, runtime requirements, security boundaries, Phase 0 findings and MIT licence. Claims remain limited to the deployed fictional demo and tested Codex runtime.

## Screenshots

All shortlist images contain only fictional demo data and omit browser chrome, console, localhost and debug surfaces. Screenshots 1–7 were captured during one dedicated fresh deployed rehearsal at a consistent desktop viewport. Screenshot 8 uses the clean full-page Receipt from the validated deployed Phase 4 golden path because the current in-app browser's long-page stitch duplicated sections; it is real canonical output, not reconstructed or generated.

1. [`01-hero.png`](screenshots/01-hero.png) — Ruvel Mission hero, “Say it once.”, product thesis and active Mission Passport.
2. [`02-mission-passport.png`](screenshots/02-mission-passport.png) — all three partners' bounded permissions with BrightEnergy plan change still “ask me when needed”.
3. [`03-civicaid.png`](screenshots/03-civicaid.png) — `check_eligibility({})`, `prepare_support_claim({})`, prepared result, session-as-reference and zero supplied identifiers.
4. [`04-brightenergy-before.png`](screenshots/04-brightenergy-before.png) — two actual Site Tools; Read account and Apply hardship available; Change plan absent.
5. [`05-brightenergy-after.png`](screenshots/05-brightenergy-after.png) — three actual Site Tools after the mission-only grant, with Change plan present.
6. [`06-human-approval.png`](screenshots/06-human-approval.png) — Saver Flex human decision, fictional $31/month saving, Approve and Not now.
7. [`07-three-organisations-complete.png`](screenshots/07-three-organisations-complete.png) — CivicAid, BrightEnergy and NextStep all COMPLETE in one viewport.
8. [`08-mission-receipt.png`](screenshots/08-mission-receipt.png) — strongest result image: MISSION COMPLETE, 3 organisations, 3/3, 7 actions, 3 decisions, zero identity-bearing arguments, authority history and human timeline.

Captions and selection guidance are in [`docs/screenshots/README.md`](screenshots/README.md). Screenshot 8 is the recommended lead result image; Screenshot 5 is the recommended technical-signature image.

## Video

Target length: **2:45** (safe target range 2:35–2:50; hard limit under 3:00).  
Storyboard: **Final**, [`docs/video-storyboard.md`](video-storyboard.md).  
Recording readiness: **PASS for rehearsal; final recording not started.**  
Known risks: public-network latency, runtime-specific Site Tools visibility, long waiting sections if not trimmed, and browser notification/credential UI appearing during capture.

The storyboard is timed around Problem → Mission → Passport → CivicAid → BrightEnergy 2→3 → human approval → NextStep → Receipt. BrightEnergy is the centerpiece. It supplies exact narration, shots, allowed edits, recovery steps and a pre-recording checklist.

The dedicated screenshot Mission also served as the required full rehearsal. A fresh Passport was approved, all three public partner origins exposed and executed their native tools, BrightEnergy changed from two to three actual registrations, Saver Flex required an independent human-facing approval, all organisations completed, and Ruvel produced the canonical Receipt. The rehearsal browser warn/error log was empty.

## Devpost

Draft status: **Complete but not submitted**, [`docs/submission-draft.md`](submission-draft.md).  
Judging criteria mapping: **Complete** for WebMCP Leverage, Execution, Potential Impact, and Creativity & Ambition.  
Missing fields: **final public video URL**; final Devpost form entry/upload and submission confirmation intentionally remain undone.

The draft includes every requested factual section: project name, tagline, one-line description, problem, solution, WebMCP, human/agent collaboration, implementation, Passport, dynamic authority, session identity, Receipt, architecture, Phase 0 learning, challenges, potential, public demo, GitHub, testing, boundaries and credits. The public repository URL is final; the video field remains an explicit placeholder.

## Public Demo

Ruvel: [ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site](https://ruvel-phase1-mission-dhili.jmsd0811.chatgpt.site)  
CivicAid: [ruvel-civicaid-dhili.jmsd0811.chatgpt.site](https://ruvel-civicaid-dhili.jmsd0811.chatgpt.site)  
BrightEnergy: [ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site](https://ruvel-phase1-brightenergy-dhili.jmsd0811.chatgpt.site)  
NextStep: [ruvel-nextstep-dhili.jmsd0811.chatgpt.site](https://ruvel-nextstep-dhili.jmsd0811.chatgpt.site)

Judges are directed to start from Ruvel Mission. All four trusted HTTPS origins responded during the native rehearsal. No deployment was changed in Phase 5.

## Final Risks

1. **Video still required:** no final video file or public URL exists. The storyboard and rehearsal are ready, but the take must still be recorded, edited below three minutes and reviewed.
2. **Runtime and network variance:** native WebMCP is proven in the tested Codex runtime, not every browser. Public calls take several seconds; trim waiting time without faking interactions or obscuring the 2→3 state change.
3. **Submission is deliberately incomplete:** Devpost screenshots, text and video URL have not been uploaded or submitted. A final human review must confirm captions, audio, public links and competition form requirements.

## Recommended Phase 6

After explicit approval, record one clean final take using the storyboard, make only the allowed simple edits, publish the video, replace the single video placeholder, and perform a final human review before entering/uploading the prepared package in Devpost. Keep application commit `a576248` and the deployed product frozen; do not add features or change architecture.

**STOP — waiting for Phase 5 review. Devpost has not been submitted.**
