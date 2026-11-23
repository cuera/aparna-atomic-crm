---
name: aparna-loop
description: Start or close one build session of the Aparna's English Coaching CRM (MVP slices M0-M5, full-build slices S1-S10). Use at the START of every session (orient, run checks, confirm the slice and its owned files) and at the END of every slice (PR, green Check, passes, one-line log). Trigger on "/aparna-loop", "start session", "next slice", "close the loop", "wrap up".
---

# aparna-loop

One session = one slice = one branch = one PR. Handoff between sessions = `features.json` + `progress.md` + git history. From M1 on, MVP slices run in **light mode** (ADR-A20): plan → the human's go → build → PR → CI `Check` green → the human checks the Vercel Preview → the human merges. Full-build slices follow `project_plan.md` §5.

## START

1. `git status --short`, `git branch --show-current`, `git log --oneline -5`.
2. Read: the last entry of `docs/aparna/progress.md`; the slice's features in `docs/aparna/features.json`; its row and file ownership in `docs/aparna/MVP.md` §7.
3. Every slice it depends on is merged into `main` (`git log origin/main`); if not, stop and say which.
4. Set up: `npm ci` (on `ENOTEMPTY`: `rm -rf node_modules`, repeat; P-12); then `npx playwright install chromium` (after `npm ci`, P-14); if `docker info` fails: `sudo sh -c 'nohup dockerd > /tmp/dockerd.log 2>&1 &'` and poll `docker info` (P-13); `make start` in the background. Run `make typecheck`, `make lint`, `make test`. Red baseline → report and stop.
5. Report in ≤ 5 lines (slice, features, owned files, baseline, open questions), then the plan: files and the spec file per feature. No edits until "go".

## CLOSE

1. Each feature's verify spec exists; run the slice's specs locally once. No evidence pasting.
2. Commit, push, open a PR titled `[<slice>] <summary>` listing the feature IDs and the one thing to check on the Preview.
3. Wait for the `Check` run. Red → fix and push (max 3 rounds on the same cause, then stop and ask).
4. Green → set `passes: true` for the slice's `cmd:` and `ci:` features (`_rules`); `manual:` features only after the human confirms.
5. Append one line to `docs/aparna/progress.md`: date, slice, PR link, features passed. A surprise or a human correction → a row in `problems.md`, encoded at the strongest layer (DB constraint or hook > `.claude/rules` > `CLAUDE-aparna.md` > skill). User-visible change → `docs/aparna/CHANGELOG.md`.
6. Tell the human: PR link, Preview link, the one thing to check. The human merges.

## Hard rules (never relaxed by light mode)

- Sign-ups stay off in Supabase Auth; new accounts only by invitation (ADR-A19).
- Synthetic data only until handover (M-504); real files never enter a cloud session or git.
- "Mark fee paid" goes only through `mark_fee_paid` (compare-and-set, M-109).
- CI `Check` green before merge. Never push to `main`.

## Stop conditions

- Same failure after 3 focused attempts → stop, log in `problems.md`, ask.
- The change needs a file another slice owns, or contradicts an Accepted ADR → stop and ask.
- A step needs secrets or production access → stop; it belongs to CI or the human.
- M1 spends more than one day fighting the fork's conventions → stop and propose the ADR-A20 reversal (fresh Next.js + Supabase rebuild with `MVP.md` as the spec).
