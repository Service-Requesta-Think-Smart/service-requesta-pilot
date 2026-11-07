# Service-Requesta Pilot

Build Service-Requesta as a secure, mobile-first South African local-services marketplace MVP. Treat this as a real functional full-stack application, not only a landing page or static mock-up. Use the project’s supported TypeScript/React/Tailwind/shadcn stack and a real PostgreSQL backend/authentication (use Lovable’s supported Supabase integration if available). Do not expose secrets in frontend code. Do not publish or enable public bookings yet.

PRODUCT / LAUNCH BOUNDARY
- Brand: Service-Requesta. Tagline: “Local skills. Clear requests. Better connections.” Visual identity: professional, welcoming, navy and yellow, mobile-first, clear South African English.
- Initial service area: East London, within Buffalo City Metropolitan Municipality, Eastern Cape, South Africa.
- Initial categories ONLY: plumbers, electricians, motor mechanics. Do not launch extra categories in the MVP.
- Target users: South African residents/customers and independent local service providers/SMEs. Use ZAR (R), South African date/time conventions (Africa/Johannesburg), +27 phone handling, local area/province fields, accessible forms and low-data/mobile-friendly screens. Keep text simple and transparent. Make the interface ready for future accurate language localisation, but do not invent unreviewed translations.
- The company is pre-launch and not yet legally registered according to the business plan. Use staging/pilot mode and clear “pilot / not generally available” states. Never claim the app is live, providers are all trustworthy, jobs are instantly available, or market results have been proven. Identity verification must not imply competence/certification.
- First goal is a controlled pilot, not nationwide scale. Later areas/categories remain disabled until reviewed and deliberately enabled.

PHASE 0 — INSPECT AND PLAN
1. Inspect this project’s existing files, routes, dependencies, data model and auth/security configuration before major edits. Produce a concise checklist of what exists, what is missing, risks, and a priority backlog. If no earlier Service-Requesta repository/source code is present in this project, clearly note that a previous external app cannot be audited from here; do not pretend it was reviewed. Build the MVP in this project and leave a documented path for importing/reviewing an existing repo.
2. Keep scope minimal and dependable. Write a short architecture/data-flow note and a list of acceptance tests. Record unresolved decisions rather than guessing (especially payment processor, payment settlement, exact commission base, VAT treatment, retention periods and legal terms). Keep the build modular so these can be configured after professional advice.

PHASE 1 — AUTHENTICATION AND ROLES
3. Implement real registration, sign-in, sign-out, email verification/recovery and protected routes. A user has a role: customer, provider, or admin. Enforce roles on the server/database, not just by hiding UI.
4. Customers and providers must only access their own private records, except explicitly permitted job-related information. Admin access must be restricted to authorised admins and be audited. Use least privilege, secure sessions, input validation, rate limiting where available, and database row-level security/policies. Never put service-role keys or secrets in the browser.
5. Create clear onboarding with consent and a privacy notice before collecting personal information. Collect only what is needed. Sensitive identity documents must be private, access-limited and never exposed through public profile URLs.

PHASE 2 — CUSTOMER EXPERIENCE
6. Build a mobile-first customer dashboard and a clear “Request a service” flow:
   a. select plumbing, electrical work or motor mechanics;
   b. describe the problem and requested work;
   c. provide the service area/location and contact details with appropriate consent;
   d. review the request and submit it;
   e. see request/job status, provider responses, quotations, messages/notifications, agreed terms and history.
7. Provide accessible validation and useful loading, empty, offline/network, success and error states. Prevent duplicate submission on repeated taps. Do not invent providers, ratings, pricing or availability. Use real stored records; any demo data must be clearly marked and never treated as real traction.

PHASE 3 — PROVIDER ONBOARDING AND REQUESTS
8. Providers can create/edit a service profile with name/business name, contact details, service categories (limited to initial three), service area, availability and relevant evidence. Make clear which checks are complete:
   - identity/contact check;
   - trade qualification/licence check where required for the specific work;
   - reference check if actually performed;
   - verified review only after a genuine completed job.
Do not label identity-only checks as professional certification. An authorised reviewer records check type, status, reviewer, date and notes; private documents remain protected.
9. Providers receive in-app request notifications (and an email notification if safely configured), can see relevant request details, and accept or decline. Show only suitable requests according to category, area and configured availability. Record response time and decision. Do not promise instant matching.

PHASE 4 — QUOTATIONS AND JOB STATE MACHINE
10. Once a provider accepts a request, let the provider prepare a clear quote: work scope, labour, call-out charge, estimated/known parts and materials, total amount in ZAR, assumptions, timing/availability and expiry if applicable. Avoid automatically setting a trade price. Any uncertain parts cost must be clearly marked as an estimate.
11. The customer must review and explicitly approve the scope and amount before work starts. Save an immutable snapshot of the approved quote so later edits cannot silently change the agreed amount. Notify both parties of quote approval/rejection and material revisions.
12. Implement validated job states and permitted transitions, for example:
   submitted → awaiting provider response → accepted/declined;
   accepted → quote submitted → customer approved/rejected;
   approved → scheduled/in progress → completion pending;
   completion pending → completed only after both parties confirm, OR disputed;
   cancellation/refund/dispute are explicit states with reasons and timestamps.
Do not allow work to be treated as approved before the customer accepts the quote. Log every important state change. A cancellation, complaint or disagreement must not be hidden or silently overwritten.
13. Both customer and provider can confirm completion. If they disagree, open a dispute/support case and keep the job out of “completed” until resolved under the configured, legally reviewed process. Only allow reviews tied to authentic completed jobs, and provide fair reporting/moderation.

PHASE 5 — COMMISSION AND COLLECTION LEDGER
14. The business plan proposes a 15% commission on the commissionable value of completed jobs, rather than charging providers merely to access leads. Display the proposed rate and its calculation before the provider accepts platform work; store the agreed rate/terms version against each job. Make the rate and commission base configurable, not hard-coded. The final definition of commissionable value (e.g. treatment of labour, call-out, parts/materials, discounts, refunds and tax) requires legal/accounting approval before live billing.
15. Commission is only billed for jobs arranged through the platform and confirmed completed under the process; registrations, page views, incomplete requests and cancelled jobs must not generate revenue. Example test: if a R1,000 job is commissionable in full at 15%, the commission is R150; this is only an illustrative test case.
16. Create a tamper-evident, auditable commission ledger with job reference, customer/provider, approved and final job value, configured calculation base, rate, amount due, payment method (cash/electronic), billed/paid/outstanding/disputed/waived/refunded status, statement delivery time, due date, reminders, receipts and admin adjustments with reasons. Use integer cents or safe decimal arithmetic; never use floating-point arithmetic for money.
17. For a confirmed cash-paid job, create a fee statement and outstanding commission entry. The plan proposes payment within 7 calendar days after completion confirmation and notice. Record delivery of the notice and calculate the due date from the approved configuration. Send reminders before the deadline. Allow the provider to dispute an incorrect completion record or amount and pause enforcement while the dispute is unresolved. If an undisputed/resolved fee remains unpaid after the deadline, send a final notice with a 24-hour notice period; only after that may an authorised system rule temporarily restrict acceptance of new requests until payment/resolution. Keep existing jobs and the dispute/support route accessible. No automatic penalty fee or permanent ban. Every reminder, notice, dispute, decision, payment and restriction/reactivation must be logged. Because cash payment cannot be detected automatically, require explicit recorded confirmations and reconciliation; do not claim otherwise.
18. Implement this workflow in pilot/staging but keep live collection/enforcement behind an admin/legal-readiness feature flag until a qualified South African adviser approves the terms and collection process. For electronic payments, do not build fake payment success or handle card details directly. Payment processor, marketplace/split settlement, fee payer, refunds, chargebacks, VAT and settlement are unresolved: build a clean payment-provider adapter/configuration point, transaction status fields and test-mode interface only until a provider and architecture are approved.

PHASE 6 — SUPPORT AND ADMIN
19. Build protected admin screens for provider review/checks, service-request/job monitoring, complaints, disputes, cancellations/refunds, suspected fraud/safety reports, commission ledger/reconciliation, feature flags, audit events and basic reports. Admin actions need role checks, confirmations, reason notes and an audit trail.
20. Customers/providers can report false profiles, poor workmanship, unsafe behaviour, payment disagreements or suspected fraud. Track status, priority, assigned owner, evidence access restrictions, outcome and timestamps. Show users how to contact support without exposing other users’ private details.
21. Include reporting for active approved/available providers by category, genuine requests, response time, quotes, quote-approval rate, completed/cancelled/disputed jobs, customer feedback, commission billed versus actually collected, overdue/disputed balances, operating/payment fees and cost per completed job. Exclude bots/duplicates from pilot metrics where possible. Never count registrations as active providers or requests as completed jobs. Independent providers receiving jobs are not automatically “new jobs created”; track new hires by Service-Requesta only when actual hiring happens.

PHASE 7 — PRIVACY, SECURITY, RELIABILITY
22. Prepare for qualified South African legal review of POPIA, consumer-protection and e-commerce obligations, privacy notice/consent, provider/customer terms, commission, cancellations/refunds, payment handling, records/retention/deletion and incident response. Do not claim compliance certification or legal approval unless documented. Implement data minimisation, purpose-limited collection, access controls, secure storage, configurable retention/deletion workflows, audit logging, backups/restore procedures and privacy-safe error logs.
23. Validate all input server-side; handle malformed data, auth expiry, duplicate actions, slow connections, provider notification failures, partial saves, concurrency/race conditions and database/network failures. Use transactions/idempotency for money and status changes where supported. Avoid leaking personal information or stack traces in user-facing errors.
24. Add automated tests for: sign-up/sign-in/roles; row-level data isolation; create request; provider accept/decline; quote/approval; valid/invalid state transitions; both-party completion; disputes/cancellations; commission arithmetic; cash-ledger due-date/reminders/final notice/restriction/reactivation; audit trail; review eligibility; admin permissions; privacy-sensitive document access and error recovery. Fix every reproducible critical/high bug found before calling the MVP ready. Use a disciplined debugging loop: reproduce → isolate → inspect logs/trace and data → make a minimal fix → add/regress a test → rerun relevant suites → verify the UI and database state. Do not simply suppress errors or claim tests passed when they were not run.
25. Keep performance efficient: mobile-first responsive layouts, pagination for large lists, sensible database indexes, optimised/lazy-loaded media, avoid unnecessary queries and excessive re-renders, and provide useful loading states. Test current supported Android and iOS mobile browsers plus desktop; report any untested device/browser.

PHASE 8 — DELIVERY AND GO-LIVE GATES
26. Deliver a working, maintainable codebase, database schema/migrations, environment-variable list, setup instructions, architecture/data-flow note, test suite/results, backup/restore notes, deployment steps, admin guide and maintenance guide. The company must retain source-code/design ownership or a clear written licence, repository/admin access, domain/hosting/account access, credentials through secure transfer, backups and documentation. No single contractor should control the only copy or sole production account.
27. Build the responsive/PWA-ready web MVP first unless a native mobile framework is demonstrably configured. Do not claim Google Play or Apple App Store publication from a web preview: native packaging, store-specific builds, developer enrolment, store assets and review remain separate tasks. Keep the code structured for future Android/iOS packaging, and document exactly what remains.
28. Gate all real public bookings until the following are checked off: critical workflows pass tests; no known critical/high security defects remain; legal adviser reviews terms, POPIA/privacy, relevant qualifications, commission and cash collection, payments and refunds; company registration/structure is completed for live operations; provider availability and support/incident routes exist; backups/monitoring and account handover are verified; payment architecture and fee responsibility are decided; pilot controls and roll-back plan work.
29. Pilot targets from the business plan are measurement targets, not guaranteed results: interview at least 15 local providers and 30 potential customers; aim for 15 approved providers across categories, 30 genuine requests and 15 completed jobs in the controlled cohort. Track 50 genuine expressions of customer interest. Report measured results honestly. Expand only after evidence supports request fulfilment, acceptable complaints, trustworthy verification, commission collection and viable unit economics.
30. Implement in small sequential milestones; after each, run checks and report files/features changed, tests run/results, known limitations, decisions needed and next milestone. Never invent API keys, credentials, provider data, reviews, payments, legal approval or successful test results. Start now with Phase 0 inspection and a written task plan, then implement the MVP step by step.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e004f406-7929-4c8c-93b2-85489c8f5b45).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
