# progress.md — session handoff log

**Status:** LAW for gate outcomes. Otherwise a log.
**Role:** What each session did, the evidence, and what comes next. A fresh session reads the latest entry first. Newest at the bottom. One entry per session, max ~15 lines; quote real command output for any feature marked as passing.

## Baseline metrics (fill in S0)

| Metric | Baseline | Source | Date |
|---|---|---|---|
| M1 time to first response | unknown | | |
| M2 leads without next action | unknown | | |
| M3 enquiry → trial in 72 h | unknown | | |
| M4 trial show rate | unknown | | |
| M5 trial → enrolled | unknown | | |
| M6 days enquiry → paid | 7–10 (founder estimate) | discovery call | 2026-11-20 |
| M7 fees paid on time | unknown | | |
| M8 monthly churn | unknown | | |

## S0 checklist (outside the repo)

- [ ] Website shows the real phone and a WhatsApp button (P-01)
- [ ] One official business WhatsApp number with labels and quick replies
- [ ] Founder answers Q1, Q6 (and Q2–Q7 when possible)
- [ ] Simple sheet counting enquiries, trials, joins and leavers for 2 weeks

## Sessions

### 2026-11-21 — P0 planning pack (chat session, no product code)
- Did: researched business and team practice; inspected the upstream repo and harness; wrote PRD, ARCHITECTURE, project_plan, features.json (all `passes: false`), decisions ADR-A01..A10 (Proposed), problems P-01..P-09, risks R-1..R-12; added Claude layer (import line, Karpathy rule, aparna-loop skill, gate-reviewer agent).
- Evidence: features.json parses; 72 features, IDs unique, all `passes: false`; slice ranges in `project_plan.md` §3 match the `slice` fields; every PRD flow F1–F9 and rule AR1–AR13 maps to at least one feature (gaps found and added: F-208 family export/delete, F-411 automation settings, F-605 Today payment section; consent capture added to F-108); root `CLAUDE.md` diff is one import line; Prettier applied with repo config.
- Not done here: Gate A cold read (needs a fresh context; first step of `KICKOFF.md` Prompt 1).
- Next: run `KICKOFF.md` Prompt 1 in Claude Code (environment check + Gate A cold read). Stop at Gate A.

### 2026-11-21 — MVP track added (chat session, no product code)
- Decided: MVP first ("never lose a lead", ~1 week), full build after a pilot (ADR-A11..A16, Proposed).
- Added: `MVP.md` (scope, data, screens, slices M0–M5, file ownership), `TRANSITION.md` (T1–T12 shortcut ledger, re-verify list, how to pick the first full-build slice), 24 M- features in `features.json`, risks R-13..R-15, problems P-10 (cloud has no Docker) and P-11 (demo entry ignores `src/App.tsx`).
- Found in repo: sign-up is invitation-only after the first user (`handle_new_user`); `block-migration-writes` only blocks harness developers; upstream `check.yml` runs e2e with Supabase and `deploy.yml` pushes migrations on main → CI is the Docker-capable verifier (ADR-A15).
- Rewrote `KICKOFF.md` for Claude Code online: setup (GitHub, Supabase, Vercel, cloud environment), session flow, COMMON + per-slice prompts.
- Next: you do KICKOFF Part A, then run M0 in a cloud session.

### 2026-11-21 — Correction: cloud sessions have Docker (P-10)
- Checked the official Claude Code cloud docs: cloud sessions include docker, dockerd and docker compose, 4 vCPUs, 16 GB RAM; Trusted network covers Docker Hub, ghcr.io and public.ecr.aws. My earlier "no Docker" finding came from the planning chat sandbox, a different machine.
- Changed: ADR-A15 (cloud runs the full local stack; CI is the second verifier; hand-written migrations only as fallback), CLAUDE-aparna.md commands + Mistakes Log, MVP.md §8, TRANSITION T11, R-15, aparna-loop START/CLOSE, M-001 and M-103 acceptance, KICKOFF Part A4 (exact environment dialog steps), Part B (mode dropdown, Auto-fix), Part E (fallback).
- Next: merge the plan PR, create the `aparna-crm` environment, run M0.

### 2026-11-21 — Field visits requested by the Owner
- Added PRD §15, ADR-A17 (Proposed), risk R-16, slice SF with F-1100..F-1105. Check-ins with consent, Owner-only access, 90-day coordinate retention, production owned by the client. Ships after role RLS (F-101); not in the MVP.
- Install on phones: already supported (web app manifest + home-screen icons in `public/`); branding of icons happens in M1.

### 2026-11-23 — M0 Gate MVP-A check (cloud session, no product code)

- Baseline (cloud VM, branch `claude/dreamy-albattani-s2lxg3` at `cf031cf`):

| Step | Result | Key line |
|---|---|---|
| `npm ci` | PASS (2nd try) | 1st: `ENOTEMPTY … node_modules/faker/locale` exit 217 → `rm -rf node_modules && npm ci` exit 0 (P-12) |
| `npx playwright install chromium` | PASS | `chromium-headless-shell v1248 downloaded`; must run after `npm ci` (P-14) |
| `docker info` | PASS after start | down at start; `sudo service docker start` blocked by hook (P-13); `sudo dockerd` → `Server Version: 29.10.0`, `CPUs: 4`, `Total Memory: 15.71GiB` |
| `make start` | PASS | 34 migrations applied; `VITE v8.3.5 ready … http://localhost:5173/` |
| `make typecheck` | PASS | `tsc --noEmit --project tsconfig.app.json` exit 0 |
| `make lint` | PASS | eslint exit 0; `All matched files use Prettier code style!` |
| `make test` | PASS (2nd run) | 1st: 614/614 green but exit 2 on missing headless shell 1248 (P-14); 2nd: `Test Files 93 passed (93)`, `Tests 942 passed / 1 skipped`; functions `Test Files 7 passed`, `Tests 194 passed` |
| `npx supabase test db` | FAIL (expected) | `Result: NOTESTS — no pgTAP tests found in supabase/tests` (folder created by M-105). Throwaway probe: 1 failing assertion → `Result: FAIL`, exit 1 |

- Assumptions (a–g), with file:line evidence in `problems.md` P-15..P-20:
  - (a) right: both entries use the defaults through `CRM.tsx` and `ConfigurationContext.tsx:23-29`.
  - (b) right with a caveat (P-15): once Settings is saved, DB keys win permanently.
  - (c) right with a caveat (P-16): the Kanban reads config, but `opportunity` and `won` are hard-coded elsewhere.
  - (d) **wrong** (P-17): hiding Companies is not enough, because the deal form requires a company.
  - (e) **partly wrong** (P-18): the registry is keyed by resource and there is no dry run.
  - (f) **partly wrong** (P-19): the e2e Supabase runs in `.supabase-e2e`, so the step needs `--workdir` and a copy of the tests.
  - (g) right, plus extra jobs (P-20): the GitHub Pages, doc and demo deploys need disabling for Vercel.
- Gate MVP-A (gate-reviewer, MODE gate, fresh context): **FAIL, score 60** (capped; uncapped about 69). Scorecard below, findings condensed to one line each and personal-name quotes redacted (the full text was relayed in the session):

```
VERDICT: FAIL
SCORE: 60 (capped; uncapped ~69) | Completeness 72 | Traceability 76 | YAGNI 88 | Buildability 76 | Security & privacy 45 | Verification quality 55
FINDINGS:
- [blocking] features.json:235 (M-305) — Mark fee paid not idempotent → compare-and-set on next_fee_due + vitest (double submit = one advance, one note)
- [blocking] KICKOFF.md:51, decisions.md:126 — Owner named personally (<redacted>) → "the Owner" / "the Owner's account"; CLAUDE-aparna.md line: trade name only
- [high] ADR-A14 docs-only (users/index.ts:133 invites anyone; 02_functions.sql:261 SSO skips invite check) → M-107: SSO off, sales count = 2; or pgTAP/trigger cap or hide invite
- [high] M-107 / R-13 — first sign-up race → Owner signs up before URL is shared, or email sign-up off until then; record administrator row
- [high] M-304 / MVP.md:55 — whatsapp_opt_in stored but not honoured → buttons disabled when false; Parent form toggle; TRANSITION row for consent back-fill (F-105)
- [high] M-401/M-402 — real children's CSVs not kept out of cloud/git → synthetic CSVs only; human imports in prod UI; .gitignore *.real.csv, imports/; DPDP note in MVP.md §3
- [medium] M-202/203/204/401/402 verify whole folders → point verify at new spec files
- [medium] M-301/305/306 share one verify → one spec each
- [medium] M-105 verify does not prove red fails the PR → cite a CI run with a deliberately failing pgTAP test
- [medium] M-101/M-106 verify = make test → named specs for config parity and generator coverage
- [medium] MVP.md:93 — Admission detail page unowned; Today quick-add needs M2's component → assign show page to M3; Today button after M2 merges
- [medium] MVP.md:22,24,72 — progress template, level/batch, CSV export unmapped → add progress_update key; reword problem 7; export in M-103
- [medium] M-202 — timezone not set from country guess → acceptance + US/UK test
- [medium] M-001 says A11-A15 vs A11-A16; accepting ADRs not in M-001 → fix + "ADR-A11..A16 Accepted" line
- [low] TRANSITION.md:22 T11 closes with "—" → drift check in M-503 or MVP.md §9
- [low] MVP.md:74 per-template follow-up defaults undefined → list them
- [low] .claude/settings.json no deny rules for supabase link / db push / .env.production → add deny rules
```

- Not changed (per M0 rules): `MVP.md`, `TRANSITION.md`, `decisions.md`, `features.json`, `CLAUDE-aparna.md`.
- Next: the Owner reviews the proposed fixes (P-12..P-21 + the findings above) and replies "Gate MVP-A: go" with the approved list. Then this session applies them, re-runs the gate, and marks ADR-A11..A16 Accepted. M-001 stays `passes: false` until then.
