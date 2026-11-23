# MVP.md — "Never lose a lead" (build first)

**Status:** PRIMARY for the MVP track. Binds once Gate MVP-A passes. Where this file and `PRD.md` differ, this file wins until the MVP exit gate; after that `TRANSITION.md` says how each difference is resolved.
**Role:** Scope, features, screens, data, slices and exit of the MVP. The full build stays in `PRD.md` / `ARCHITECTURE.md`. Every MVP shortcut and how it is paid back is in `TRANSITION.md`.

---

## 1. Goal

In about 1 week, give the Counsellor one place where every family, its stage and its next follow-up live, plus one-tap WhatsApp messages. Nothing is sent automatically yet. Collect real numbers during a 1-week pilot so the full build automates the right things first.

## 2. Her problems → MVP answer

| # | Problem | MVP answer | Solves |
|---|---|---|---|
| 1 | New enquiries lost / late reply | Quick-add + Today "New" section with minutes-waiting timer + one-tap welcome | Mostly (night enquiries wait for morning) |
| 2 | Follow-ups forgotten | `next_action_at` required on every open admission (DB check) + Today due/overdue | Fully |
| 3 | 7–10 day journey | Board shows where each family is stuck; one-tap trial reminder, after-trial and payment messages | Partly |
| 4 | Missed calls | Quick-add after a call in ~10 seconds, follow-up created | Partly |
| 5 | Fee reminders | `next_fee_due` on each student card; Today "Fees due/overdue"; one-tap reminder; "Mark fee paid" moves the date | Mostly |
| 6 | Parent updates | One-tap absence check-in (`absence_checkin`) and progress messages (`progress_update`); no attendance tracking | Weakly |
| 7 | Handover to teacher | Child, grade + notes on the card; shared by hand | Partly |
| 8 | Counsellor overload | One Today list instead of scrolling chats | Mostly |
| 9 | Data trapped in WhatsApp | All families, notes and message logs in the business's CRM; CSV export of Parents and Admissions with the new fields (M-103) | Fully |
| 10 | No numbers | "This week" strip: enquiries, first-response time, trials, enrolled, lost by reason | Partly (baseline) |

## 3. Users

Owner and Counsellor only, both full access (upstream policies). **No Teacher accounts until full-build F-101 (role RLS) passes** (ADR-A14). Enforced, not documented:

1. **Two-staff cap (M-108):** a trigger on `sales` refuses any insert or re-enable that would create a third active row (`disabled = false`), with an error that names ADR-A14 and F-101. pgTAP: `supabase/tests/mvp_staff_cap.test.sql`. Dropped only by the F-101 slice (TRANSITION T5).
2. **First user (R-13, M-107):** sign-up is invitation-only after the first user (upstream `handle_new_user`), so the first user becomes administrator. The Owner's user is created from the Supabase dashboard before the production URL is opened or shared; `progress.md` records `sales.administrator = true` only for the Owner's row.
3. **No SSO:** Google Workspace sign-in stays off in production (`VITE_GOOGLE_WORKPLACE_DOMAIN` unset, no SSO provider), because `handle_new_user` skips the invitation check for SSO users.

Children's data (DPDP 2023): the parent is the data principal; data is held only to run admissions and fee follow-ups and is deleted on request (full-build F-208). Real student or enquiry files never enter a cloud session or git: importers are tested with synthetic CSVs, a human imports real files in the production UI, and `.gitignore` excludes `*.real.csv` and `imports/`.

## 4. Data (MVP schema)

All new data sits on existing tables (ADR-A12). Declarative schema in `supabase/schemas/01_tables.sql` + one migration.

`deals` (= Admission; one admission = one child):

| Column | Type | Notes |
|---|---|---|
| `child_name` | text | required in quick-add |
| `child_grade` | text | e.g. `IV`, `X`, `adult` |
| `board` | text | CBSE, ICSE, ISC, IGCSE, State, Other |
| `course` | text | from a fixed list in config |
| `source` | text | whatsapp, call, website, instagram, referral, other |
| `next_action_at` | timestamptz | required when stage is open |
| `lost_reason` | text | required when stage = lost |
| `trial_at` | timestamptz | set when stage = trial_booked |
| `first_response_at` | timestamptz | set on first logged WhatsApp send (baseline M1) |
| `enrolled_at` | timestamptz | set when moved to enrolled |
| `fee_amount_paise` | bigint | enrolled only |
| `fee_period` | text | monthly or quarterly |
| `next_fee_due` | date | enrolled only |

Checks: `deals_open_needs_next_action` = `stage not in ('enrolled','lost')` ⇒ `next_action_at is not null` (a closed list, so an unknown stage such as the upstream `opportunity` is still caught, P-16) and `deals_lost_needs_reason`. `deals.company_id` stays nullable and the form no longer requires it (M-102).

`contacts` (= Parent): `country` text, `timezone` text default `Asia/Kolkata` (quick-add sets it from the country guess, editable), `phone_e164` text unique (partial index), `whatsapp_opt_in` boolean default true for existing families (consent is re-confirmed before any automation, TRANSITION T13).

`sales`: trigger `sales_mvp_two_staff_cap` (§3, M-108).

Domain options (stages, task types, courses, boards, sources, lost reasons, currency INR, title) go in `src/components/atomic-crm/root/defaultConfiguration.ts`, because `demo/App.tsx` does not use `src/App.tsx` (P-11). `dealPipelineStatuses = ["enrolled"]` and a new admission defaults to `enquiry`. Settings page: a saved DB configuration overrides the defaults per key, permanently (P-15), so during the MVP the Settings page shows stages read-only (the DB check hard-codes them) and saving it must keep the MVP keys (M-101).

## 5. Screens

1. **Today** (landing page): New (not yet contacted, timer) · Follow-ups due/overdue · Trials today/tomorrow (IST + parent local) · Payment pending · Fees due in ≤ 3 days / overdue · "This week" strip.
2. **Admissions board** (upstream Kanban, relabelled): card shows child, course, next action (red when overdue), days in stage. Moving to Lost asks for a reason; moving to an open stage without next action asks for one.
3. **Quick-add enquiry** (button on the board header in M2; the same button on Today in M4): parent name, WhatsApp number, country (guessed from number), time zone (from the country, editable), child name, grade, board, course, source, note → parent + admission in `enquiry`, `next_action_at = now + 2 h`. Duplicate number → links the existing parent and warns.
4. **Admission detail** (upstream show page): fields above, notes timeline, WhatsApp buttons and "Mark fee paid" (both M3).
5. **Parents** (upstream contacts, relabelled; the Parent form can switch `whatsapp_opt_in` off). **Import**: one admissions importer with a `stage` column (enrolled rows = current students, other stages = enquiries). It validates every row first; if any row fails it writes nothing and lists the row errors (the dry run).

Companies: hidden from the menu, not deleted; an admission no longer needs a company.

## 6. One-tap WhatsApp

1. Templates are constants in `src/components/atomic-crm/whatsapp/templates.ts` (English, plain, short). Owner asks for wording changes through a PR.
2. Keys (9) and the default next follow-up each one sets (editable in the dialog):

   | Key | Default next follow-up |
   |---|---|
   | `welcome` | now + 1 day |
   | `trial_confirm` | `trial_at` + 2 h |
   | `trial_reminder` | `trial_at` + 2 h |
   | `after_trial` | now + 2 days |
   | `payment_link` | now + 2 days |
   | `payment_followup` | now + 3 days |
   | `fee_reminder` | now + 3 days |
   | `absence_checkin` | now + 2 days |
   | `progress_update` | now + 7 days |

3. Button opens `https://wa.me/<digits>?text=<encoded>` in a new tab (WhatsApp app or Web). Buttons sit on the Admission detail page and on Today rows.
4. When the user comes back, a small dialog: "Sent?" → Yes logs a note `WhatsApp: <key>`, sets `first_response_at` if empty, and sets the next follow-up (default above, editable). Two taps in total.
5. `payment_link` and `fee_reminder` ask the user to paste the Razorpay link into the dialog before opening WhatsApp.
6. When the parent's `whatsapp_opt_in` is false, the buttons are disabled with a visible reason.

## 7. Slices (graph of loops)

```
M0 Check (no code) ─► M1 Foundation (schema + config + CI + deploy; schema FROZEN at merge)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        M2 Capture & discipline     M3 Today + one-tap WhatsApp      (2 cloud sessions in parallel)
                 └────────────┬────────────┘
                              ▼
        M4 Import + Today quick-add (needs M2 phone helper and quick-add, M3 today/)
                              ▼
                 M5 Pilot week + fixes ─► [Gate MVP exit]
```

File ownership (prevents merge conflicts; paths under `src/components/atomic-crm/` unless they start with a top-level folder). A slice that needs a file it does not own stops and asks. M1 merges before M2 and M3 start, so its edits to shared files never run in parallel with theirs.

| Slice | Owns |
|---|---|
| M1 | `types.ts`, `supabase/schemas/`, `supabase/migrations/`, `supabase/tests/`, `root/defaultConfiguration.ts`, `root/ConfigurationContext.tsx`, `settings/SettingsPage.tsx` (stages read-only), labels (`providers/commons/englishCrmMessages.ts`, `companies/CompanyCard.tsx`), menu (`layout/Header.tsx`), `deals/DealInputs.tsx` (company not required, default stage `enquiry` only), CSV exporters (`contacts/ContactList.tsx` exporter, new admissions exporter), `providers/fakerest/dataGenerator/`, CI pgTAP step (`makefile` `start-supabase-e2e`, `.github/workflows/check.yml`), deploy jobs (`.github/workflows/deploy.yml`), `e2e/aparna/mvpLabels.spec.ts` |
| M2 | phone helper `misc/phone.ts`; quick-add (new `contacts/QuickAddEnquiry.tsx`, board header button in `deals/DealList.tsx` only); next action + lost reason (`deals/` edit form and drag handling); card `deals/DealCard.tsx`; `e2e/aparna/mvpBoardCard.spec.ts` |
| M3 | new `today/`, new `whatsapp/`, `misc/time.ts`, the route line in `root/CRM.tsx`, the Admission detail page buttons (`deals/DealShow.tsx`), the `whatsapp_opt_in` switch on the Parent form (`contacts/ContactInputs.tsx`) |
| M4 | `dataImport/` (one admissions importer), the Today quick-add button in `today/` (after M2 and M3 merge; reuses `contacts/QuickAddEnquiry.tsx`), `.gitignore` lines for real import files if still missing |

| Slice | Features | Day |
|---|---|---|
| M0 | M-001 | 0 (30 min) |
| M1 | M-101..M-108 | 1 |
| M2 ∥ M3 | M-201..M-205 ∥ M-301..M-306 | 2–3 |
| M4 | M-401..M-403 | 4 |
| M5 | M-501..M-503 | 5 + pilot week |

## 8. Where things are verified

| Check | Runs in |
|---|---|
| `make typecheck`, `make lint`, `make test`, `npm run test:unit:functions` | Cloud session |
| Local Supabase (`make start`), migrations via `supabase db diff`, pgTAP (`npx supabase test db`), Playwright e2e | Cloud session (Docker), then again in GitHub Actions `Check` on the PR (pgTAP there runs against the e2e instance: `npx supabase test db --workdir .supabase-e2e`, M-105) |
| Looks right on a phone | Vercel Preview (demo mode, fake data) |
| Real data | Production after merge (`Deploy` workflow pushes migrations) |

If M0 finds Docker unusable in the cloud environment, ADR-A15 falls back to CI as the only Docker.

## 9. Exit gate (MVP)

1. All M-features pass with evidence in `progress.md`.
2. Pilot: 5 working days, every new enquiry entered, M2 (admissions without next action) = 0 at end of each day.
3. Baseline table in `progress.md` filled from the "This week" strip.
4. Counsellor and Owner say it is faster than WhatsApp alone.
5. Next build slice chosen from the pilot numbers (see `TRANSITION.md` §3).
6. Drift check: `npx supabase db diff --local` reports no schema changes; output pasted in `progress.md` (M-503, TRANSITION T11).

## Provenance & audit

Sources: chat decisions 21 Nov 2026 (MVP-first, comparison table), repo checks (`handle_new_user` signup block, `block-migration-writes` scope, `demo/App.tsx`, `.github/workflows/check.yml` and `deploy.yml`). Amended 23 Nov 2026 by the Owner's Gate MVP-A decisions (ADR-A18, `problems.md` P-15..P-21).
Checked: every problem 1–10 maps to a section; every MVP feature in `features.json` (slices M0–M5) maps to §5–§7; file ownership has no overlap between M2 and M3 (both touch `deals/` and `contacts/`, but different files).
