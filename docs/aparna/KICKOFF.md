# KICKOFF.md — build the MVP with Claude Code online

**Role:** Environment manual + copy-paste prompts. Who does what: **you** click setup screens and merge PRs; **Claude (cloud session)** plans, runs the local stack (Docker), writes code and tests, opens PRs; **GitHub Actions** re-runs the checks on every PR and deploys the database after merge; **Vercel** shows each PR as a preview link (fake data) and serves production (synthetic test data until handover, Part F; real data after it).

---

## Part A — One-time setup (about 1 hour, mostly clicks)

### A1. GitHub
1. Open https://github.com/cuera/aparna-atomic-crm/pull/new/plan/aparna-crm-p0 → create the PR → merge it into `main`. Every session starts from `main`.
2. Enable Actions on the fork (forks start with Actions off): Actions tab -> enable.
3. Protect main: Settings -> Branches -> classic rule for main -> require a pull request (approvals 0) and the 5 Check jobs.
4. Do **not** add any secret yet. The repository secrets are added in A2 step 6, only after Supabase sign-ups are off (R-13, ADR-A19).

### A2. Supabase (in the developer's account during build and test, ADR-A20)

Do these steps in this exact order (ADR-A19).

1. New project `aparna-crm`, region Mumbai (`ap-south-1`). Save the database password.
2. **Immediately:** Authentication → Sign In / Providers → turn **off** "Allow new users to sign up". It stays off permanently (R-13): after the first account, every account comes from an in-app invitation. Leave Google and every other SSO provider off.
3. Authentication → Emails → SMTP Settings: configure custom SMTP (Resend or Brevo) so invitation and password emails are delivered.
4. Plan: free is fine while building with synthetic data. **Upgrade to Pro before the pilot** (real families' data: backups, no auto-pause).
5. Copy: Project URL, publishable key, project ref (Settings → General). Account → Access Tokens → create one for GitHub Actions.
6. **Only now**, in GitHub → Settings → Secrets and variables → Actions, add the repository secrets used by the `Deploy` workflow: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` (project ref), `SUPABASE_URL`, `SB_PUBLISHABLE_KEY`. The next green `Check` on `main` runs `Deploy`, which pushes the schema.
7. Authentication → URL Configuration: Site URL = your Vercel production URL (after A3); add it to Redirect URLs.

### A3. Vercel
1. Add New → Project → import `cuera/aparna-atomic-crm`. Production branch: `main`.
2. Framework preset: Vite (or Other). Output directory: `dist`.
3. Build command (Preview = demo mode with fake data, Production = real data):
   ```
   if [ "$VERCEL_ENV" = "production" ]; then npm run build; else npm run build:demo; fi
   ```
4. Environment variables — Production: `VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY`, `VITE_ATTACHMENTS_BUCKET=attachments`. Preview: `VITE_IS_DEMO=true`.
5. Plan: Hobby is for non-commercial use; use Pro for the client app (the GitHub Pages deploy is removed, M-107).

### A4. Claude Code online (browser at claude.ai/code, or the Code tab in the Claude app)
1. Open claude.ai/code. First time: follow onboarding, connect GitHub and **install the Claude GitHub App** on `cuera/aparna-atomic-crm` (needed for Auto-fix and PR creation).
2. On the new-session screen, tap the **first control in the row under the message box** (the environment selector) → **New environment**.
3. Fill the **New environment** dialog:
   - Name: `aparna-crm`
   - **Network access** → **Custom** → tick **Also include default list of common package managers** → **Allowed domains** (one per line):
     ```
     cdn.playwright.dev
     playwright.download.prss.microsoft.com
     playwright.azureedge.net
     ```
     (Defaults already cover npm, GitHub, Docker Hub, ghcr.io and public.ecr.aws, which the local Supabase stack needs.)
   - **Environment variables**: leave empty. No Supabase or Vercel secrets in cloud sessions (ADR-A15).
   - **Setup script**: leave empty for now. Each session installs and starts what it needs (`/aparna-loop` START).
   - Select **Add environment**.
4. From now on, check that the selector shows `aparna-crm` before you send a session's first message.

### A5. First accounts (after the first `Deploy` run has pushed the schema)
1. Supabase → Authentication → Users → **Add user**: the first test account on a developer email alias (for example `you+owner@…`). The schema's `handle_new_user` trigger makes it administrator. (Before the first Deploy run there is no trigger, so the account would get no staff row.)
2. Check in the Table Editor that `sales` has one row with `administrator = true`; note it in `progress.md` (M-107).
3. Sign in to the app with it → Users → invite the second test account (`you+counsellor@…`). Never create it from the dashboard: with sign-ups off and a first user present, only invitations work, and the two-staff cap (M-108) allows no third active account.
4. Real people get accounts only at handover (Part F).

### A6. Outside the code (start now, they take time)
1. Fix the website: real phone number and a WhatsApp button (P-01).
2. Start Meta WhatsApp Business verification (needed later for automation, T3).
3. Ask the Owner for: current student list (parent, phone, child, course, fee, due date) and open enquiries. Real files stay with the Owner: a human imports them in the production UI (M-401). Never upload them to a cloud session or commit them (`*.real.csv` and `imports/` are git-ignored).

## Part B — How every session runs (works from a phone)

1. claude.ai/code (or Claude app → **Code**) → new session → repository `cuera/aparna-atomic-crm`, branch `main`, environment `aparna-crm`.
2. In the **mode dropdown**, choose **Plan mode**. Claude explores and proposes a plan without editing.
3. Paste COMMON + the slice block from Part C. Send.
4. Read the plan. Reply `go` (or your corrections), and switch the mode dropdown to **Accept edits** (or **Auto** if you have it) so it can build without asking at every edit.
5. Claude starts the local stack, builds, tests, pushes a branch and opens a PR titled `[M?] …`.
6. In the session's **Changes** card, open the PR's **⋮** menu and turn on **Auto-fix**: Claude then watches the GitHub `Check` run and review comments and pushes fixes by itself.
7. Open the PR → Vercel Preview link → check the one thing Claude names → merge on GitHub.
8. Next slice = new session. After M1 is merged, start M2 and M3 **at the same time** in two sessions.

Order: M0 → (you: "Gate MVP-A: go") → M1 → M2 ∥ M3 → M4 → M5.

Notes:
- A session that sits idle pauses and keeps its files; just send a message to continue. If its VM was reclaimed, reopening restores the conversation; ask Claude to run `/aparna-loop` START again to restart the stack.
- Use ordinary sessions, not a claude.ai/code **Project**, for this repo: project threads do not run the repo's `.claude/settings.json` hooks, which the upstream harness relies on.

## Part C — Prompts

Every prompt = the COMMON block + one slice block. Replace `<ID>` with the slice id.

### COMMON (paste first, every time)

```text
You are the principal engineer on the Aparna's English Coaching CRM (a fork of Atomic CRM).
Read docs/aparna/README.md, docs/aparna/CLAUDE-aparna.md, docs/aparna/MVP.md, the slice's
features in docs/aparna/features.json, and .claude/rules/karpathy.md. Then run /aparna-loop START.

Rules for this session:
- This session is slice <ID> only. Touch only the files this slice owns (MVP.md section 7 and
  the list below). If you need another file, stop and ask.
- Plan first (files, the spec file per feature, risks). No edits until I say "go".
- Light mode (ADR-A20): write each feature's verify spec with the code; no per-feature evidence pasting.
- This cloud machine has Docker: run the local stack (make start) and check locally first; the GitHub
  Actions Check run on your PR is the verifier. No secrets, no production access, synthetic data only.
  Never push to main.
- Stop condition: the PR "[<ID>] ..." is open and its Check run is green — or stop after 40 turns and
  report the blocker. After I say "go", if /goal is available, set it to exactly this condition.
- Finish with /aparna-loop CLOSE. Last message: PR link, Preview link, the one thing I should check.
```

### M0 — check + Gate MVP-A (no product code)

```text
Slice M0. No product code.
1. Baseline: npm ci, npx playwright install chromium, docker info (start Docker if needed), make start,
   make typecheck, make lint, make test, npx supabase test db. Report each as PASS/FAIL.
2. Verify these assumptions with file:line evidence and list any that are wrong:
   a) options in src/components/atomic-crm/root/defaultConfiguration.ts reach both src/App.tsx and demo/App.tsx;
   b) how dataProvider.getConfiguration() (DB-stored settings) overrides those defaults in production;
   c) the deals Kanban reads stages from configuration;
   d) where to relabel Deal -> Admission and Contact -> Parent (i18n) and how to hide Companies from the menu;
   e) src/components/atomic-crm/dataImport can host two new importers;
   f) .github/workflows/check.yml e2e job starts Supabase, so an `npx supabase test db` step can run there too;
   g) .github/workflows/deploy.yml pushes migrations with the 5 secrets; which of its other jobs need extra setup.
3. Dispatch the gate-reviewer agent, MODE gate, gate "MVP-A", files: docs/aparna/MVP.md, TRANSITION.md,
   decisions.md (ADR-A11..A16, A18..A20), features.json (M- features), CLAUDE-aparna.md, .claude/skills/aparna-loop/SKILL.md.
   Do not review it yourself; relay its scorecard verbatim.
4. Record results in progress.md; wrong assumptions and findings -> problems.md with proposed fixes.
   Do not edit MVP.md, TRANSITION.md or decisions.md yet.
5. Open PR "[M0] Gate MVP-A check" with only these doc changes. Show me in under 20 lines: baseline,
   wrong assumptions, score, proposed fixes, decisions needing my go. Then stop.
```

After M0 you reply in the same session: `Gate MVP-A: go. Apply the fixes I approved, mark ADR-A11..A16, A18..A20 Accepted, record the gate in progress.md, update the PR.` Then merge it.

### M1 — Foundation (schema frozen when merged)

```text
Slice M1 (features M-101..M-109).
Owned files: the M1 row of MVP.md section 7.
Notes: generate the migration with `npx supabase db diff --local -f mvp_fields` (ADR-A15); keep contacts_summary
valid; the schema includes the stage trigger (stage_changed_at, enrolled_at), the next_action_at default,
the two-staff cap and mark_fee_paid, each with its pgTAP spec; fix any upstream e2e spec you break;
demo data must be realistic (Indian and foreign parents, all stages, enrolled students with fees).
Prove on the local stack that an invitation works with sign-ups off.
M-107 is manual: at the end give me the exact clicks for KICKOFF.md Part A steps A2 and A5 in that order.
```

### M2 — Capture and discipline (run in parallel with M3, after M1 is merged)

```text
Slice M2 (features M-201..M-206). Depends on M1 merged.
Owned files: the M2 row of MVP.md section 7, their tests, and package.json/package-lock.json for
libphonenumber-js only (respect .npmrc min-release-age). Do NOT touch root/CRM.tsx, types.ts or schema files.
Stage data entry (M-206): trial_at on trial_booked; fee amount, period and next due date on enrolled; the
admission name is the child name and its field is hidden.
```

### M3 — Today and one-tap WhatsApp (run in parallel with M2, after M1 is merged)

```text
Slice M3 (features M-301..M-306). Depends on M1 merged.
Owned files: the M3 row of MVP.md section 7 (today/, whatsapp/, misc/time.ts, the desktop and mobile
dashboard lines in root/CRM.tsx, deals/DealShow.tsx buttons, the opt-in switch in contacts/ContactInputs.tsx,
and the markFeePaid method in both data providers, which calls the M1 function mark_fee_paid).
For wa.me links use contacts.phone_e164 without the "+"; do not import M2's phone helper.
Template texts: short, warm, plain English, signed "Aparna's English Coaching". List them in the PR body
so the Owner can approve the wording.
```

### M4 — Import and Today quick-add (after M2 and M3 are merged)

```text
Slice M4 (features M-401..M-403). Depends on M2 (phone helper, quick-add) and M3 (today/) merged.
Owned files: the M4 row of MVP.md section 7. One admissions importer with stage and trial_at columns;
the validation pass writes nothing if any row fails and lists each row error. Synthetic CSVs only.
```

### M5 — Pilot week

```text
Slice M5 (features M-501..M-504).
1. Write docs/aparna/COUNSELLOR-GUIDE.md: one page, plain language, numbered steps for a day's work
   (open Today, add an enquiry, send a message, set the next follow-up, mark fee paid, move to Lost).
   Include: a disabled Counsellor is replaced only by a new Counsellor; Teachers wait for F-101.
   Before the pilot's first real enquiry, walk me through the handover checklist (KICKOFF.md Part F, M-504).
2. During the pilot I will paste issues here. For each: fix it in this slice if small and inside MVP scope,
   otherwise add a row to problems.md and defer it. Keep the PR updated.
3. At the end, fill the baseline table in progress.md from the This-week strip numbers I give you,
   and propose the first full-build slice using TRANSITION.md section 3.
```

### When Claude gets something wrong (any session)

```text
Encode this fix: <what went wrong>. Add a row to docs/aparna/problems.md and put the fix at the strongest
layer that holds it (hook or DB constraint > .claude/rules > docs/aparna/CLAUDE-aparna.md > skill). Show the diff.
```

### Later — start the full build

```text
Start the full build. Read docs/aparna/TRANSITION.md and the pilot numbers in progress.md. Propose the slice
order using TRANSITION.md section 3 (T5 before any Teacher account), re-run the verify of every feature in
TRANSITION.md section 2, then run Gate A with the gate-reviewer. Stop for my go.
```

## Part D — How the orchestration fits together

1. **Loop** = one slice. MVP from M1 (light mode, ADR-A20): plan → your go → build → PR → `Check` green → you check the Preview → you merge. Full build: `project_plan.md` §5.
2. **Graph of loops** = the slice dependency graph with gates (`project_plan.md` §2). You are the gate.
3. **Parallel** = separate cloud sessions (each its own machine and branch), only after the schema is frozen, max 2, with file ownership (ADR-A16).
4. **Stop conditions** = `/goal` or the stop sentence in COMMON; provable from the PR's green `Check` run.
5. **Fresh-context review** = `gate-reviewer` at gates (not on MVP slice plans), `quality-reviewer` inside the harness, or `@claude` on the PR.
6. **Hard rules** = hooks (upstream), DB constraints and CI checks; docs alone enforce nothing (R-1).
7. **Memory** = `docs/aparna/CLAUDE-aparna.md` + `progress.md` + `features.json`, updated by `/aparna-loop` CLOSE.
8. **Big slices later** = upstream agent team in one session: `#technical-harness GATE: plan`.

## Part E — If Docker does not work in the cloud (ADR-A15 fallback)

M0 reports it. Then: Claude writes the declarative schema change and a matching hand-written migration; the GitHub Actions `Check` run proves it applies, runs pgTAP and e2e; before each gate you run on WSL:

```bash
cd aparna-atomic-crm && git pull
make install && make start
npx supabase db diff --local        # expect: no schema changes (no drift)
npx supabase test db                # pgTAP
make stop
```

## Part F — Handover to the Owner's accounts (M-504, ADR-A20)

Until handover, Supabase and Vercel live in the developer's account, test accounts use developer email aliases, and all data is synthetic. Do the handover before the pilot's first real enquiry, in this order:

1. Transfer the Supabase project to the Owner's Supabase organisation, and the Vercel project to the Owner's Vercel account.
2. Rotate the Supabase secret keys and the database password; update the GitHub repository secrets and the Vercel environment variables; confirm the next `Deploy` run is green.
3. Disable the test counsellor account (the two-staff cap, M-108, refuses a third active account).
4. Signed in as the test owner account: invite the Owner with administrator on. The Owner opens the invitation and sets a password. (Sign-ups stay off; an invitation is the only way in.)
5. The Owner disables the test owner account, then invites the Counsellor, who sets her own password.
6. Check `sales`: exactly two active rows, the Owner's with `administrator = true`.
7. Only now does the real data import start (M-401, by a human in the production UI; real files never enter a cloud session or git).
8. Tick each step in `progress.md` (M-504).
