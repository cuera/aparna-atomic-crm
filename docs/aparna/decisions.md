# decisions.md — decision register (ADRs)

**Status:** LAW once an entry is `Accepted`. `Proposed` entries bind nothing until Gate A (or a later gate) accepts them.
**Role:** Every consequential choice: context, options, decision, consequences, and the observable trigger that would reopen it. Nothing locks silently.

Format: newest at the bottom. Short form of the loop-engineering ADR template. Upstream harness ADRs written by agents during tickets live in `adr/` — link them here when they change something in this register.

---

### ADR-A01 — Build on the Atomic CRM fork (Vite SPA), not a Next.js rewrite
Status: Proposed · Date: 2026-11-21
- Context: The founder needs a CRM fast. Our usual stack is Next.js, but this fork already ships auth, users, contacts, Kanban, tasks, notes, CSV import, tests and an agent harness on React + Vite + Supabase.
- Options: A) extend the fork — most features exist, one new dependency. B) new Next.js app — familiar stack, rebuild ~15k LOC. C) SaaS CRM (telecrm, LeadSquared) — fastest, weak fit for batches, attendance and teacher screens, monthly per-user cost.
- Decision: A.
- Consequences: we follow upstream conventions (declarative schema, ra-core resources, FakeRest emulation). Public pages stay outside the SPA (website form posts to an edge function).
- Reversal condition: we need server-rendered parent-facing pages (SEO or self-booking) that cannot be a small separate site, or upstream conventions cost more than 30% of a slice's time two slices in a row.

### ADR-A02 — Adopt the upstream agent harness as-is; add only a thin domain layer
Status: Proposed · Date: 2026-11-21
- Context: The repo ships a mature harness (orchestrator, planner, developer, quality-reviewer, merger, documentator, validation hooks, ponytail YAGNI skills, ADR skill). Writing our own would duplicate it.
- Options: A) adopt, opt-in with `#harness` / `#technical-harness`. B) strip it and use plain Claude Code. C) replace with a custom harness.
- Decision: A. Our layer = `docs/aparna/*`, one import line in `CLAUDE.md`, `.claude/rules/karpathy.md`, `.claude/skills/aparna-loop`, `.claude/agents/gate-reviewer.md`.
- Consequences: upstream rules (git policy, worktree scope, validation-commands) apply to harness agents. Main-thread work uses the loop in `project_plan.md` §5.
- Reversal condition: harness hooks block our slice work twice for reasons unrelated to quality, or upstream changes break our layer on merge.

### ADR-A03 — Domain mapping onto upstream tables
Status: Proposed · Date: 2026-11-21
- Context: Upstream models B2B sales (companies, contacts, deals). We model families, students and admissions.
- Options: A) reuse `contacts` as parents and `deals` as admissions, rename only in the UI (i18n), add `students`; hide companies. B) rename tables. C) new tables, leave upstream unused.
- Decision: A. `deals.lost_reason` is re-added on purpose (upstream dropped it). Companies are hidden from the menu, not deleted, in v1.
- Consequences: code and DB say `deals`/`contacts`; the UI says Admission/Parent. This is a known gotcha (recorded in `CLAUDE-aparna.md`).
- Reversal condition: the naming mismatch causes a production bug, or hidden companies code blocks a slice — then delete companies with the upstream `delete-initial-resource` skill.

### ADR-A04 — Deterministic automations through an outbox with send-time guards
Status: Proposed · Date: 2026-11-21
- Context: Reminders must never go out after the state changed (e.g. fee reminder after payment). Runtime LLM decisions are not needed.
- Options: A) `messages` outbox + `message_guard()` re-check + pg_cron dispatcher. B) send directly from triggers. C) external workflow tool (n8n, Zapier).
- Decision: A.
- Consequences: one place to see every message and its status; idempotency through `dedupe_key`; slightly more SQL.
- Reversal condition: dispatcher latency over 2 minutes at p95, or volume over 50,000 messages per month.

### ADR-A05 — WhatsApp Cloud API with Coexistence, called with fetch
Status: Proposed · Date: 2026-11-21
- Context: Parents are global and live on WhatsApp. Human chats must continue in the WhatsApp Business app.
- Options: A) Cloud API + Coexistence on the existing number. B) BSP platform (AiSensy, Interakt, WATI) with its own inbox and fees. C) New dedicated API-only number.
- Decision: A, pending spike F-400 on the onboarding path.
- Consequences: companion devices may be unlinked on connect (R-8); templates need Meta approval; per-message pricing.
- Reversal condition: F-400 shows direct onboarding is not possible for this account → choose B for onboarding only, still sending through our outbox if the BSP exposes an API.

### ADR-A06 — Razorpay Payment Links + webhook
Status: Proposed · Date: 2026-11-21
- Context: Razorpay is already set up. We need a link per invoice and automatic status.
- Options: A) Payment Links + `payment_link.paid` webhook. B) Subscriptions API. C) Manual reconciliation.
- Decision: A. Subscriptions later only if most families pay the same amount on a fixed cycle.
- Consequences: one link per invoice; idempotent webhook; international cards must be enabled for parents abroad.
- Reversal condition: more than 70% of active students on the same recurring plan for 3 months.

### ADR-A07 — Roles on `sales.role` and RLS per role
Status: Proposed · Date: 2026-11-21
- Context: Teachers need logins but must not see fees or other teachers' students. Upstream RLS is open to all authenticated users.
- Options: A) `role` column + `staff_role()` DEFINER helper + per-role policies. B) separate teacher app/schema. C) frontend-only hiding.
- Decision: A. C is rejected (not security).
- Consequences: upstream `using (true)` policies are replaced; every policy gets a pgTAP test per role.
- Reversal condition: a policy bug found in production — then add a hook that blocks merging any schema change without a matching `supabase/tests/rls_*.sql` change.

### ADR-A08 — Time handling and quiet hours
Status: Proposed · Date: 2026-11-21
- Decision: store UTC; parent has an IANA time zone; batches defined in IST; display both; no business-initiated sends 20:00–09:00 parent local; replies within 24 h exempt; native `Intl` only.
- Reversal condition: parents complain about message timing, or a time-zone bug reaches production.

### ADR-A09 — Verification stack and the "passes" rule
Status: Proposed · Date: 2026-11-21
- Decision: Vitest (app, functions), pgTAP via `npx supabase test db`, Playwright for one happy path per release. A feature's `passes` flips only with pasted green output of its `verify` command (`features.json` rules).
- Reversal condition: pgTAP setup costs more than half a day in S1 → fall back to Vitest integration tests against local Supabase with per-role JWTs.

### ADR-A10 — Where our project memory lives
Status: Proposed · Date: 2026-11-21
- Context: Root `CLAUDE.md` and `AGENTS.md` are upstream-owned; root `CHANGELOG.md` is regenerated by `npm run update-changelog`.
- Decision: our editable memory is `docs/aparna/CLAUDE-aparna.md`, imported by one line in root `CLAUDE.md`. Our changelog is `docs/aparna/CHANGELOG.md`.
- Reversal condition: the import line is lost in an upstream merge twice → move the import into `.claude/CLAUDE.md`.

### ADR-A11 — MVP first ("never lose a lead"), full build after a pilot
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21
- Context: The full build is 8–10 weeks at part-time pace. The founder's pain (lost leads, forgotten follow-ups) can be relieved in about 1 week without automation.
- Options: A) MVP in ~1 week, pilot, then full build chosen by pilot numbers. B) Full build straight away. C) Spreadsheet + WhatsApp labels only.
- Decision: A. Scope in `MVP.md`; every shortcut and its payback in `TRANSITION.md`.
- Consequences: planned data debt (A12) and manual sending (A13); real baseline numbers before automation.
- Reversal condition: the pilot shows the Counsellor still loses leads with the MVP (M2 > 0 on 3 of 5 days) → stop and fix adoption before any full-build slice.

### ADR-A12 — MVP stores child and fee data on the admission (temporary)
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21 · Temporarily departs from ADR-A03 (students table)
- Options: A) child + fee columns on `deals`. B) build `students`/`enrolments` now. C) store in notes text.
- Decision: A. One admission = one child. Payback: `TRANSITION.md` T1, T2.
- Reversal condition: a family with 2+ children enrols, or the full build starts — whichever comes first.

### ADR-A13 — MVP sends WhatsApp with one-tap `wa.me` links (temporary)
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21 · Defers ADR-A05
- Options: A) `wa.me` prefilled links + logged note. B) Cloud API now. C) A BSP inbox.
- Decision: A. No Meta verification, templates or message costs in the MVP. Meta business verification starts on MVP day 1 anyway (it can take days to weeks). Payback: `TRANSITION.md` T3.
- Reversal condition: more than 40 one-tap sends per day during the pilot, or night enquiries waiting more than 8 hours on most days.

### ADR-A14 — MVP has two staff users and no Teacher accounts (temporary, hard rule)
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21 · Defers ADR-A07
- Context: Upstream RLS gives every signed-in user full access. Sign-up is invitation-only after the first user (`handle_new_user`).
- Decision: only Owner and Counsellor accounts in the MVP. **No Teacher account may be created until F-101 (role RLS) passes.** Sign-ups are off in Supabase Auth from project creation (R-13, ADR-A19).
- Enforcement (Gate MVP-A, ADR-A18): trigger `sales_mvp_two_staff_cap` refuses a third active `sales` row with an error naming this ADR and F-101 (M-108, pgTAP `mvp_staff_cap.test.sql`); "Allow new users to sign up" is off before any GitHub secret exists, the first account is created from the Supabase dashboard after the first Deploy run, every later account only by in-app invitation (M-107, ADR-A19); SSO / Google Workspace sign-in stays off in production because `handle_new_user` skips the invitation check for SSO users.
- Consequences: the cap counts active accounts, not roles (there is no role column before F-101). Disabling the Counsellor and inviting a Teacher would pass the trigger. This residual risk is accepted: only the administrator can do it, and the rule is that a disabled Counsellor is replaced only by a new Counsellor (Counsellor guide, M-501).
- Reversal condition: none — this rule is lifted only by F-101 passing.

### ADR-A15 — Cloud development workflow
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21 · Revised 2026-11-21 (P-10)
- Context: Claude Code cloud sessions include Docker (docker, dockerd, docker compose), 4 vCPUs and 16 GB RAM; the Trusted allowlist covers Docker Hub, ghcr.io and public.ecr.aws. The repo's GitHub Actions `Check` (lint, typecheck, unit, e2e with local Supabase) and `Deploy` (`supabase db push` on main) also run with Docker.
- Options: A) cloud sessions run the full local stack and follow upstream conventions; CI is the independent second verifier; Vercel Preview (demo mode) for visual checks. B) cloud writes code only, CI runs everything Docker needs, migrations hand-written. C) all work on WSL.
- Decision: A. Migrations are generated with `npx supabase db diff --local -f <name>` as upstream intends. No production secrets in cloud environments.
- Consequences: each session spends a few minutes on `make start` (image pulls); faster feedback than waiting on CI.
- Reversal condition: M0 shows Docker or `make start` does not work in the cloud environment → fall back to option B (hand-written migrations, CI as the only Docker).

### ADR-A16 — Parallel work = separate cloud sessions with file ownership
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-21
- Decision: after a slice that freezes the schema merges, independent slices run in separate cloud sessions (each its own VM and branch). Each slice owns a list of files (`MVP.md` §7); touching another slice's file means stop and ask. Max 2 parallel sessions (R-5). The upstream `#technical-harness` (worktrees inside one session) is reserved for big full-build slices.
- Reversal condition: a merge conflict between parallel slices costs more than 30 minutes → run that pair sequentially next time.

### ADR-A17 — Field visits use consented point-in-time check-ins, Owner-only access
Status: Proposed · Date: 2026-11-21
- Context: the Owner asked for field activity tracking of staff. Location data about employees is personal data (DPDP 2023: notice and consent) and can be misused by anyone who can read it.
- Options: A) check-in/check-out snapshots with consent, Owner-only RLS, 90-day coordinate retention. B) continuous background tracking (needs a native app and store approval for background location; far more intrusive). C) no location, visit log only.
- Decision: A, with C as the automatic fallback for staff who do not consent.
- Consequences: needs role RLS first (after T5/F-101); production Supabase project and its keys owned by the Owner's account from handover (M-504, ADR-A20) onward, not by Intrigues; developers work on staging and demo data only.
- Reversal condition: the Owner shows a concrete need that check-ins cannot meet; any move toward B needs a new ADR, written staff consent and a legal check.

### ADR-A18 — Gate MVP-A amendments
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-23 · Amends `MVP.md`, `TRANSITION.md`, `features.json` (M- features) under `features.json` `_rules`
- Context: the Gate MVP-A cold read failed (score 60, capped; two blocking findings), and M0 found wrong assumptions (`problems.md` P-15..P-21). `_rules` forbid rewording features except through this register.
- Options: A) amend the M- features and the MVP plan now, before M1 freezes the schema. B) keep the wording and fix it during M1–M4 (agents would build to the old acceptance). C) re-plan the MVP.
- Decision: A, exactly as the Owner decided on 2026-11-23:
  1. M-305 "Mark fee paid" is idempotent (compare-and-set on the shown `next_fee_due`; a second submit changes nothing and logs no second note).
  2. The Owner is referred to by role in committed files; the trade name "Aparna's English Coaching" stays.
  3. Ownership (`MVP.md` §7): M1 = labels, menu, company not required, default stage `enquiry`, Settings stages read-only, CI pgTAP step, deploy jobs, exporters; M2 = phone helper, quick-add (board header only), next action + lost reason, card; M3 = `today/`, `whatsapp/`, time helper, Admission detail buttons, Parent opt-in switch; M4 = `dataImport/` + the Today quick-add button (new M-403).
  4. DB check `deals_open_needs_next_action` = `stage not in ('enrolled','lost')` ⇒ `next_action_at is not null`; stages read-only in Settings during the MVP.
  5. Deploy: `deploy-doc`, `deploy-demo` and the GitHub Pages steps removed (Vercel replaces them); migration push kept; SSO off in production.
  6. ADR-A14 enforced by a trigger and pgTAP (new M-108); R-13 enforced by creating the Owner's user from the Supabase dashboard before the URL is shared (M-107) — superseded by ADR-A19 item 1.
  7. One admissions importer with a `stage` column (M-401 reworded, title "Import admissions") and an all-or-nothing validation pass that lists row errors (M-402 reworded, title "Import validation pass (dry run)"); synthetic CSVs only; `*.real.csv` and `imports/` git-ignored.
  8. M-304 honours `whatsapp_opt_in` and the Parent form can switch it off (TRANSITION T13, closes with F-105); `progress_update` template added (M-303: 9 templates, per-template follow-up defaults in `MVP.md` §6); problem 7 reworded to "grade + notes"; M-103 adds CSV export of new fields; M-202 sets the parent time zone from the country guess (US and UK tests).
  9. Every M- verify names its own spec file (M-101, M-102, M-106, M-202, M-203, M-204, M-205, M-301, M-303, M-304, M-305, M-306, M-401, M-402, M-403). M-103 is the only feature that names two specs (one pgTAP for the schema, one vitest for the export), and no spec is shared between features. M-105's verify (`manual:` shape, since it is a link recorded in `progress.md`) cites a Check run where a deliberately failing pgTAP test turned red. `deals/DealInputs.tsx`: M1 edits only the company and default-stage lines; M2 owns the rest of the file after M1 merges. M-503 and `MVP.md` §9 add the `supabase db diff` drift check. M-001 names ADR-A11..A16 and adds "ADR-A11..A16 marked Accepted".
  10. `.claude/settings.json` denies `supabase link`, `supabase db push` and reading `.env.production*`.
- Consequences: two new feature ids (M-108 in M1, M-403 in M4); M4 now waits for M2 and M3; no `passes` changed. The P-16 dashboard charts (`dashboard/DealsChart.tsx`, which hard-codes `won`) are not in scope: Today replaces the dashboard as the landing page (M-301).
- Reversal condition: a gate re-review or a slice plan review finds an amendment that contradicts an Accepted ADR or makes a feature unverifiable → amend again through a new ADR.

### ADR-A19 — Gate MVP-A re-review fixes
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-23 · Amends ADR-A14, ADR-A18, `MVP.md`, `TRANSITION.md`, `KICKOFF.md`, `features.json` (M- features and `_rules`)
- Context: two fresh re-reviews of Gate MVP-A after ADR-A18 failed (78; then 60, capped by one security finding). The open findings were the R-13 sign-up window, missing stage and enrolment timestamps, no owned mechanism for the fee compare-and-set, no data entry for trial and fee fields, an M1 change that breaks an upstream e2e spec, `deals.name` without a source, and several low findings.
- Options: A) fix them in the plan before M1 freezes the schema. B) accept them as known gaps and narrow `MVP.md` §2. C) defer to M1 planning.
- Decision: A, as the Owner decided on 2026-11-23:
  1. R-13: "Allow new users to sign up" is OFF in Supabase Auth from project creation, permanently. Setup order (KICKOFF.md Part A): create project → sign-ups off → custom SMTP (Resend or Brevo) → only then add GitHub secrets → first Deploy pushes the schema → the developer creates the first test account (owner email alias) from the Supabase dashboard (the trigger makes it administrator) → the second test account (counsellor email alias) only by in-app invitation. M-107 checks the order, proves an invitation works with sign-ups off on the local stack, and records administrator = true only for the first account.
  2. `deals.stage_changed_at` is set by a trigger on insert and on every stage change; the same trigger sets `enrolled_at` when the stage becomes `enrolled` (M1, M-103, pgTAP).
  3. M1 database function `mark_fee_paid(deal_id, shown_due)`: one `UPDATE … WHERE next_fee_due = shown_due` plus the note insert in the same transaction; returns whether it applied; pgTAP double call = one advance, one note (new M-109). M3 calls it through a custom dataProvider method `markFeePaid` with a FakeRest equivalent (M-305).
  4. M2 owns stage data entry (new M-206): moving to `trial_booked` asks for `trial_at`; moving to `enrolled` asks for fee amount, period and next due date (`enrolled_at` from the trigger); the edit form shows child and fee fields. The M4 importer gets a `trial_at` column.
  5. M1 fixes any upstream e2e spec it breaks. `next_action_at` gets a PERMANENT DB default of `now() + interval '1 day'`; the check still blocks clearing it on open stages. Every open admission always has a next action (default tomorrow, editable); M-203 reworded.
  6. `deals.name` = child name, set automatically by forms and the importer; the name field is hidden.
  7. All low findings applied: the M-108 error names ADR-A14; M-001 lists A18, A19 and A20; `_rules` defines ` + ` in a verify; ADR-A14 records that the cap counts accounts, not roles; the gate-reviewer label uses the trade name; `.gitignore` covers `*.real.*`; Today replaces both dashboards and M1 relabels the dashboard tab. Exception: the deny-rule bypass (`cat`, `cd … &&`) is recorded in `risks.md` (R-17) as a known limit, with no extra rules.
- Consequences: two new features (M-109 in M1, M-206 in M2); M1 adds two triggers, one column, one default and one function before the schema freeze.
- Reversal condition: M1 planning shows one of these cannot be built inside the fork's conventions → amend through a new ADR before the M1 PR.

### ADR-A20 — Light mode and handover
Status: Accepted (Gate MVP-A, 2026-11-23) · Date: 2026-11-23 · Amends ADR-A01 (reversal condition), ADR-A09 (MVP slices run in light mode), ADR-A17, `features.json` `_rules` and F-1105, the aparna-loop skill, `KICKOFF.md`
- Context: the MVP is small and its rules are now enforced by the database, CI and permissions. Per-slice gate reviews and pasted evidence cost more than they catch from M1 on. The production accounts also need a clear owner.
- Options: A) light mode from M1 plus a handover checklist. B) keep the full per-slice evidence loop. C) build in the Owner's accounts from day one.
- Decision: A.
  1. Build and test phase: Supabase and Vercel live in the developer's account; test accounts use developer email aliases; synthetic data only. Handover checklist in `KICKOFF.md` Part F (new M-504 in M5, manual verify): transfer Supabase and Vercel to the Owner's accounts → rotate Supabase secret keys and update the GitHub and Vercel secrets → disable the test counsellor account → the test owner account invites the Owner as administrator → the Owner disables the test owner account and invites the Counsellor, who sets her own password → real data import starts. (The test counsellor account is disabled first because the M-108 cap refuses a third active account, and an invitation is the only way in once sign-ups are off and a first user exists.) F-1105 and ADR-A17: production is in the Owner's account from handover onward.
  2. From M1 on, per slice: plan → the human's go → build → PR → CI `Check` green → the human checks the Vercel Preview → the human merges. No gate-reviewer on slice plans, no per-feature evidence pasting; features flip `passes` when the PR's `Check` is green and runs their verify (`_rules`); `progress.md` gets one line per slice; `/aparna-loop` START and CLOSE are shortened to match.
  3. Hard rules kept: sign-ups off; synthetic data until handover; `mark_fee_paid` compare-and-set; CI green before merge.
- Consequences: faster slices; the Check run and the Preview are the evidence; full-build slices keep the process in `project_plan.md`.
- Reversal condition: if M1 spends more than one day fighting fork conventions, stop and propose a fresh Next.js + Supabase rebuild that uses `MVP.md` as the spec.

### ADR-A21 — Today opens admissions in place
Status: Accepted for the pilot (human, 2026-11-27) · Date: 2026-11-27
- Context: M-301 says every Today row opens the admission. The desktop has the Admissions board with its show route; the mobile app registers no `deals` resource, so a link to the board route would 404 on a phone, and the Counsellor works WhatsApp-first on a phone.
- Options: A) Today opens the admission in a dialog on the Today page (`?admission=<id>`), reusing the detail content, on desktop and mobile; board-only actions (archive, edit) hidden on mobile. B) desktop links to the board route, mobile gets a new `deals` resource in `root/CRM.tsx` (outside M3's owned lines). C) mobile rows do not open anything.
- Decision: A. One behaviour on both screens; the URL keeps the open admission; no change outside M3's files.
- Consequences: on a phone an admission can be read, messaged and marked paid but not edited or archived until a mobile edit exists (M2/M5 decision). The old dashboard components stay in `dashboard/` unused.
- Reversal condition: the pilot shows phone users need to edit admissions or change a stage (M5 pilot check, `KICKOFF.md` M5 step 2) → add the mobile `deals` resource and route Today rows to it.

## Provenance & audit
Sources: chat analysis 20–21 Nov 2026, upstream repo inspection, Meta and Razorpay docs.
Checked: each ADR has options, decision, consequences and an observable reversal condition; ADR IDs referenced in PRD/ARCHITECTURE exist here (A03, A07); A01–A10 stay Proposed until Gate A; A11–A16 and A18–A20 Accepted at Gate MVP-A (2026-11-23, gate-reviewer PASS 85); A17 stays Proposed.
