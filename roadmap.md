# Service-Requesta MVP readiness

**Brand:** Service-Requesta · **Slogan:** Think Smart  
**Status:** Controlled pilot. Public bookings and provider dispatch remain closed.

## Implemented in code

- Shared customer/provider authentication with separate post-sign-up paths.
- Customer privacy consent and private demonstration requests.
- Provider application, separate identity/contact and trade-evidence review, and admin audit.
- Gated matching, provider accept/decline, written quotes, customer approval, job progression, completion confirmation, disputes, and support review.
- Integer-cent quote and commission calculations.
- Provider commission statements and dispute records, conditional on legally approved configuration.

## Required before live use

1. Apply and verify the provider onboarding and marketplace migrations in the linked Supabase project.
2. Review the customer/provider journeys in the Lovable preview after GitHub sync.
3. Obtain South African legal and accounting approval for provider terms, the proposed 15% commission, its base, cancellations/refunds, tax treatment, data retention, complaints, and cash collection.
4. Configure the approved commission version and test with controlled accounts.
5. Review authentication email delivery, support ownership, provider checks, operational response, and backup/monitoring.
6. Only then consider enabling public_bookings, legal_approval, and commission_enforcement together.

## Deliberately unavailable

No electronic payment processor, cash-transfer verification, email reminders, automatic debt collection, automated provider matching by availability, or automatic provider restrictions are included. No fee is charged for a demo, lead, incomplete job, or cancelled job.
