# risks.md — named risks

**Status:** INVARIANT for review: every gate re-reads this list.
**Role:** Risks we cannot remove, named so they get reviewed. Format: R-# — failure mode. Mitigation. Reviewed: every gate.

- **R-1 — Chat-layer rules enforce nothing.** Anything written only in docs or CLAUDE.md can be ignored. Mitigation: 100%-compliance rules live in hooks, DB constraints or RLS (e.g. `next_action_at` check, teacher column guard); the human is the hook at gates.
- **R-2 — Same-context review is biased.** Mitigation: `gate-reviewer` and `quality-reviewer` always run in fresh context with files only.
- **R-3 — Stale imports.** Agent/config files copied from other projects carry old protocols. Mitigation: never import; only upstream + this pack are canon.
- **R-4 — Silent hooks on Windows.** A hook that never fires looks like a pass. Mitigation: on Windows/WSL prove each hook fires once (dummy failure) before trusting a gate; prefer running Claude Code inside WSL.
- **R-5 — Solo-dev parallelism.** More parallel worktrees than one person can review. Mitigation: max 2 parallel slices.
- **R-6 — Pilot adoption.** The counsellor keeps working in WhatsApp out of habit; the CRM goes stale. Mitigation: Gate R1 pilot with M2 = 0 daily; Today must be faster than WhatsApp search; training session before pilot.
- **R-7 — WhatsApp onboarding path unknown.** Coexistence may need a BSP or Tech Provider status. Mitigation: spike F-400 before any S4 code.
- **R-8 — Coexistence unlinks companion devices.** Staff using WhatsApp Web on several devices may lose them on connect. Mitigation: confirm with Owner before onboarding; schedule the switch on a quiet day.
- **R-9 — Message cost and template rejection.** Meta pricing changes and template category disputes (utility vs marketing). Mitigation: keep templates strictly transactional; monthly cost check from `messages`.
- **R-10 — Children's data.** Storing minors' data under DPDP 2023. Mitigation: minimal fields, parental consent timestamp, export/delete on request, RLS; no marketing to children.
- **R-11 — Payment edge cases.** Partial payments, refunds, currency mismatch. Mitigation: v1 supports full payment per link only; refunds handled in Razorpay dashboard and noted manually; reconcile at Gate C.
- **R-12 — Upstream drift.** Pulling upstream Atomic CRM changes may conflict with our schema and UI renames. Mitigation: merge upstream only between slices, on a branch, with the full verify set green.

- **R-13 — First sign-up takes the Owner role.** On a fresh Supabase project the first person to sign up becomes administrator; later sign-ups are blocked unless invited. Mitigation (ADR-A19): "Allow new users to sign up" is off in Supabase Auth from project creation, before any GitHub secret exists; the first account is created from the Supabase dashboard after the first Deploy run; every later account comes only by invitation; M-107 records `sales` (administrator = true only for the first account).
- **R-14 — MVP debt hardens.** The longer the MVP runs, the more data sits in temporary columns (ADR-A12). Mitigation: start T1 within 8 weeks of MVP go-live or before the first multi-child family, whichever is first.
- **R-15 — One verifier fails silently.** If the cloud stack or GitHub Actions breaks, a slice could merge with only one layer of checks. Mitigation: a PR merges only with a green `Check` run (from M1, light mode makes it the evidence, ADR-A20) after the slice ran its checks locally; check Actions usage monthly.
- **R-16 — Location data misuse.** Staff coordinates could be read by someone who should not see them. Mitigation: ADR-A17 (consent, Owner-only RLS with pgTAP tests, 90-day retention, production owned by the Owner from handover onward (M-504), no developer access to production data).
- **R-17 — Deny rules can be bypassed.** The `.claude/settings.json` deny rules match command prefixes and the Read tool only: `cat .env.production` or `cd x && npx supabase db push` can get past them. Known limit, accepted (ADR-A19): the deny rules are hardening; the real control is that cloud environments hold no secrets (`KICKOFF.md` A4, ADR-A15). No extra rules are added.

## Provenance & audit
Sources: loop-engineering default risks R-1..R-5 (renamed to fit), project analysis.
Checked: each risk names a mitigation that exists in a file, a feature or a gate (R-13, R-15, R-16 updated and R-17 added by ADR-A19/A20, 23 Nov 2026).
