# Service-Requesta — Pilot MVP Roadmap

Status: PILOT / STAGING. Not generally available. No public bookings.

## Phase 0 inspection (done)
- Exists: blank TanStack Start + Tailwind v4 + shadcn template, no backend, no auth, no routes beyond placeholder.
- Missing: everything product-specific.
- No earlier Service-Requesta repository is present in this project; a previous external app could NOT be audited. To review one: connect it via GitHub to a separate Lovable project or share source; compare against docs/architecture.md.
- Risks: legal (POPIA, CPA, ECTA), unregistered company, cash commission enforcement, verification overclaiming, payment architecture undecided.

## Milestones
- [ ] M1 Backend, design system, landing (pilot banner), auth, roles, consent/onboarding
- [ ] M2 Customer request flow + dashboard
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
