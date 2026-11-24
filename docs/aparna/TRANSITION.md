# TRANSITION.md — every MVP shortcut and how the full build pays it back

**Status:** PRIMARY for moving from the MVP to the full build. Each row is a decision taken for speed, with the trigger, the full-build target, and the exact steps.
**Role:** Read this before starting any full-build slice. Full-build features that the MVP already satisfies are re-verified, not rebuilt.

---

## 1. Ledger (point by point)

| # | Area | MVP decision | Full build | Switch when | Steps | Closes with |
|---|---|---|---|---|---|---|
| T1 | Students | Child fields live on the admission (`deals.child_*`); one admission = one child (ADR-A12) | `students` table linked to parent; admissions reference `student_id` (ADR-A03) | Start of full build (before teachers or siblings) | 1) create `students`; 2) `insert into students … select … from deals`; 3) set `deals.student_id`; 4) UI reads students; 5) the admissions importer (M-401) writes `students`; 6) drop `deals.child_*` one release later | F-200, F-203 |
| T2 | Fees | `fee_amount_paise`, `fee_period`, `next_fee_due` on the enrolled admission; "Mark fee paid" moves the date through `mark_fee_paid` (compare-and-set, M-109) | `enrolments` + `invoices` with Razorpay links (ADR-A06) | With S5/S7 | 1) create `courses`, `batches`, `enrolments`, `invoices`; 2) one enrolment + one open invoice per enrolled admission; 3) Today reads invoices; 4) retire `mark_fee_paid` (paying an invoice replaces it); 5) drop fee columns from `deals` later | F-700..F-704 |
| T3 | WhatsApp | One-tap `wa.me` links; a human presses send; logged as a note (ADR-A13) | Cloud API outbox with guards, quiet hours, opt-out (ADR-A04, A05) | After pilot shows message volume; Meta verification started on MVP day 1 | 1) submit MVP template texts to Meta as utility templates; 2) build outbox (S4); 3) switch rules on one by one; 4) keep `wa.me` button as manual fallback | F-400..F-411 |
| T4 | Payments | Counsellor pastes a Razorpay link; marks paid by hand | Payment Links API + verified webhook + `handle_payment` | With S5/S6 | 1) create links from the CRM; 2) webhook marks paid; 3) manual "mark paid" becomes Owner-only | F-500..F-605 |
| T5 | Users and access | Owner + Counsellor; upstream open policies; no Teacher accounts (ADR-A14), enforced by trigger `sales_mvp_two_staff_cap` (M-108); SSO off | `sales.role` + per-role RLS + pgTAP per role (ADR-A07) | **Before the first Teacher account — hard rule** | 1) add `role`; 2) replace `using (true)` policies; 3) pgTAP per role in CI; 4) drop `sales_mvp_two_staff_cap` and `mvp_staff_cap.test.sql` in the same migration; 5) then invite teachers | F-100, F-101, F-503 |
| T6 | Trials | `trial_at` on the admission; outcome as a note | `trials` table with teacher, status, feedback | With S3 | 1) create `trials`; 2) one trial per admission with `trial_at`; 3) teacher feedback screen | F-300..F-305 |
| T7 | Today | Built from admission fields, client-side | `today_items` view across tables | With S1/S3 | Replace queries section by section; keep the same UI | F-109, F-305, F-605 |
| T8 | Numbers | "This week" strip, client-side counts | Dashboard M1–M8 from views | S10 | Use pilot numbers as baselines in `progress.md` | F-1000..F-1003 |
| T9 | Lead capture | Manual quick-add | Website form edge function + WhatsApp inbound creates leads | S1 (form), S4 (inbound) | Reuse the phone helper and duplicate logic from M2 | F-108, F-405 |
| T10 | Config | Domain options in `defaultConfiguration.ts`; stages read-only on the Settings page because the DB check hard-codes them (P-15) | Same, plus Owner settings for automations; stage edits only through a migration that also updates the DB check | S4 | Add settings only for rules that exist; keep stages read-only unless the check moves to a table | F-411 |
| T11 | Dev workflow | Cloud sessions run the local stack (Docker); CI `Check` re-verifies each PR (ADR-A15); from M1, light mode: green `Check` + Preview check + human merge, no per-feature evidence (ADR-A20) | Same; add `supabase db diff` drift check at each gate | Always | Run drift check at Gate MVP exit (`MVP.md` §9) and every full-build gate | M-503 (MVP exit); repeated at each full-build gate |
| T12 | Hosting | Supabase project + Vercel (Preview = demo mode, Production = real) in the developer's account with test accounts and synthetic data until handover (M-504, ADR-A20); sign-ups off permanently (ADR-A19) | Same; Supabase Pro before real data grows; staging project when automations start | Before go-live of real data / before S4 | Handover to the Owner's accounts first (`KICKOFF.md` Part F); then upgrade plan; add a staging project and point Preview to it | M-504, F-112, F-1105 |
| T13 | Consent | Families default to `whatsapp_opt_in = true` with no consent record; the Parent form can switch it off and one-tap buttons respect it (M-304) | `consent_at` stored per parent; automated sends only to consented parents (ADR-A04) | **Before T3 sends any automated message** | 1) add `consent_at`; 2) send each MVP family a one-tap re-confirmation (manual `wa.me`); 3) set `consent_at` on yes, `whatsapp_opt_in = false` on no or no reply after 14 days; 4) only then switch on T3 rules | F-105 |

## 2. Full-build features the MVP already covers (re-verify, do not rebuild)

F-102 (relabelled board; stages differ only by name), F-103, F-104 (constraints), F-105 (parent fields, partial), F-106 (phone helper), F-107 (quick-add), F-109 (Today v1, partial), F-110 (time helper), F-111 (branding), F-112 (deploy). At the start of the full build, run each one's `verify`; flip `passes` only on green evidence.

## 3. Choosing the first full-build slice after the pilot

Read the pilot numbers in `progress.md`, then:

1. Most time lost on **sending messages** (Counsellor says so, or more than 40 one-tap sends per day) → T3 first (S4 WhatsApp outbox).
2. **Fees** late or chased by hand for more than 20% of students → T2 + T4 first (S5, S7).
3. **Teachers** need to log in (attendance, feedback) → T5 first (roles + RLS), then T1, T6.
4. Otherwise → T5, T1 (foundation for everything else), then T3.

T5 always comes before any Teacher account and before field visits (SF, ADR-A17), whichever order is chosen.

## Provenance & audit
Sources: MVP decisions (21 Nov 2026), `PRD.md`, `ARCHITECTURE.md`, ADR-A03..A15; Gate MVP-A amendments (ADR-A18..A20, 23 Nov 2026).
Checked: every MVP shortcut in `MVP.md` §3, §4, §6, §8 has a row here; every row names its closing features in `features.json`.
