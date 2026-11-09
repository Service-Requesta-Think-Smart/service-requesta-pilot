# Service-Requesta private pilot

## Data flow
Browser → authenticated TanStack server functions → user-scoped Cloud client → transactional PostgreSQL functions and RLS.
Public / is a usable customer workspace; /auth and /privacy are public. /requests is under the client-only managed authentication gate. The root has one identity-transition subscription. Sign-out cancels queries, clears cached private records, signs out, then replaces the URL.

## Rules
All 17 application tables have RLS. Customer request creation and cancellation use authenticated transactional functions; direct writes are not permitted by policy. Creation is serialized per user, limited to five per hour, and idempotent. Every created request is hardcoded demonstration-only; no route creates real jobs. Consent records are timestamped in the database. Accounts auto-create private profiles and customer roles; admin is not assignable by users.
Future quote, completion, ledger, support and document schema is present but has no client write policies or operational provider/admin workflow. Immutable snapshots, audit/history/ledger triggers and job-state/dual-completion validation are installed. Commission has integer-cent calculation and an approved-version guard. These foundations are not a verified production money-collection system.

## Current limitations
OAuth providers enabled; email sign-in is existing-account only. No email signup/reset/invitations or production email sender was activated. OAuth popup round-trips require hosted interactive provider sign-in; local authenticated tests use a minted requesting-user session.
Identity-document metadata is private; no upload bucket or document upload flow exists yet. No retention/deletion process, support staff workflow, reminders, restriction enforcement or payment processor exists. Approved quote submission and job-operation functions remain for a later milestone.

## Payments
Built-in provider eligibility check rejected Stripe for ZA and Paddle for this human-service marketplace. No payment integration was enabled. External South African processor eligibility, settlement to providers, fee responsibility, refunds/chargebacks, commission base and VAT require decisions and professional review. Never collect live payments or represent test success before that setup and release gates are complete.
