# Service-Requesta — Pilot MVP Roadmap

Status: PILOT / STAGING. Not generally available. No public bookings.

## Phase 0 inspection (done)
- Exists: blank TanStack Start + Tailwind v4 + shadcn template, no backend, no auth, no routes beyond placeholder.
- Missing: everything product-specific.
- No earlier Service-Requesta repository is present in this project; a previous external app could NOT be audited. To review one: connect it via GitHub to a separate Lovable project or share source; compare against docs/architecture.md.
- Risks: legal (POPIA, CPA, ECTA), unregistered company, cash commission enforcement, verification overclaiming, payment architecture undecided.

## Milestones
- [x] SEO heading correction: descriptive single H1 for homepage, sign-in and every customer state.
- [ ] Payments: built-in providers unavailable for ZA service marketplace; external processor and release approval required. Live payments stay off.
- [x] Current ask: correct and verify schema/RLS/server rules; consent-based sign-in and private demonstration customer create/track flow.
- [x] M0 Inspection, plan, Lovable Cloud backend enabled
- [x] M1a Corrected core schema applied; RLS and triggers inspected; explicit least-privilege grants applied. Future quote/provider/commission workflows are not operational yet.
- [x] M1b Mobile customer workspace, pilot banner, existing email/social sign-in, consent/onboarding. No production email activated.
- [x] M2 Private demo request creation, review, tracking/history, cancellation and persistence. Verified through requesting-user account.
- [ ] M3 Provider profile, verification checks, request inbox accept/decline
- [ ] M4 Quotes, immutable approved snapshot, job state machine (DB-enforced), completion/disputes
- [ ] M5 Commission ledger (cents, configurable rate, feature-flagged enforcement)
- [ ] M6 Admin: checks, jobs, reports/cases, ledger, flags, audit log, metrics
- [ ] M7 Tests (state machine, commission, due dates), docs, go-live gate checklist

## Unresolved decisions (need professional advice)
- Payment processor / split settlement / fee payer / chargebacks
- Commissionable base (labour, call-out, parts, discounts, VAT)
- VAT treatment; retention periods; legal terms; dispute process
- Language translations (only reviewed ones)

## Milestone verification (9 November 2026 UTC)
- 16 tests passed: 6 unit/routing and 10 live authenticated access/transaction checks.
- Browser: authenticated create → history readback → cancel → reload persistence → mobile overflow check → sign-out protection passed.
- Core database tables have RLS; customer ownership, consent, no self-admin and blocked direct writes tested. Explicit least-privilege grants remove inherited anonymous access.
- Customer profile creation verified for existing accounts; hosted OAuth popup round-trip and email-password credential sign-in were not exercised.
- Installed job-transition, immutable records, dual-completion and money/notice triggers inspected; their full adversarial real-job tests remain future work.
- Test-only requests are labelled demonstration and cancelled; no providers or money involved.
- Latest automated build reported OK. Thirteen authenticated security-definer functions were reported in the latest advisor check; these remain warnings and require continued security review.
- Payment task blocked: built-in payment providers unavailable for ZA service marketplace. External processor, legal/company approval and settlement decisions required. No payments enabled.
