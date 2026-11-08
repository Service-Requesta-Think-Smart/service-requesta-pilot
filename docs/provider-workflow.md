# Service-Requesta provider and job workflow

**Business/app:** Service-Requesta  
**Slogan:** Think Smart  
**Pilot:** East London, Buffalo City Metropolitan Municipality  
**Categories:** plumbing, electrical work, and motor mechanics

## Account and provider application

Customers and providers use the same app and email authentication. New account creation offers separate customer and provider paths. The database assigns the role; users cannot grant themselves admin access.

Provider path:

1. Create a provider account and confirm the email address.
2. Complete the shared account profile and accept the pilot privacy notice.
3. Submit one service category, one local service area, availability, business/trading name, and a self-reported summary of experience or qualifications.
4. Wait for an authorised reviewer. Identity/contact checks and trade-evidence review are recorded separately.
5. Approval requires both check statuses and a reviewer note. The decision and reviewer are audited.

The application does not collect identity document uploads or ID numbers. An identity check does not certify trade competence; relevant licences must be checked separately where work requires them.

## Customer request and job sequence

The live marketplace workflow is implemented in the app and database, but is closed by default:

1. A customer submits a request in one of the three categories, with the suburb, issue description, and timing.
2. The customer separately agrees to share the exact service address and phone with the provider whose quote they approve. Those details are stored separately and remain hidden from providers until quote approval.
3. Matching, fully reviewed providers may accept or decline. The first provider to accept locks the request to that provider.
4. The selected provider submits a written quote with work scope, labour, call-out, parts estimate, assumptions, and timing. Money is handled as integer cents.
5. The customer approves the quote before work starts. The selected quote and agreed scope are stored as an immutable snapshot.
6. The provider records start and readiness for completion. Both customer and provider confirm the approved total and recorded cash method. The app records each statement; it cannot verify a cash transfer.
7. A participant can open a support case. The job pauses as disputed until an authorised administrator records a resolution. Admin resolution can resume the prior step, return a job awaiting completion to confirmation, or cancel it.
8. Only a real, completed, non-demo job can create a commission ledger entry.

## Privacy, money, and launch gates

The business plan proposes a 15% commission on completed jobs. Before launch, an authorised operator must create a legally and accounting-approved commission version, including its calculation basis. The current gate accepts only a version whose basis is explicitly recorded as the approved quote total. No commercial assumption is enabled by this code alone.

The marketplace opens only when the public_bookings, legal_approval, and commission_enforcement flags are enabled and an approved commission version exists. The migration inserts these flags as disabled and preserves existing flag values. Do not enable them until professional review and operational setup are complete.

When commission enforcement is enabled, a completed eligible job creates an in-app statement with a seven-calendar-day due date. A provider may dispute it. An administrator can record a final notice after the due date; there is no email sender, payment processor, automatic collection, or automatic restriction in this MVP. Electronic payments remain off. Demo requests can never become real jobs or incur a fee.

## Source alignment

This workflow uses only the relevant application and operational steps from the latest Service-Requesta business plan. Funding budgets, marketing copy, personal biographies, and unrelated business-plan material are not app instructions. The name remains **Service-Requesta** and the slogan remains **Think Smart**.
