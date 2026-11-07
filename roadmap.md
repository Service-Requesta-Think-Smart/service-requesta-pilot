# Service-Requesta — Pilot MVP Roadmap

Status: CONTROLLED PILOT / STAGING. Not generally available. Public bookings, provider dispatch, payments, production email, and commission enforcement remain off.

## Completed in this branch

- [x] Inspected the synced Lovable source, database migration, generated Supabase types, and current routes.
- [x] Replaced the blank landing page with the Service-Requesta East London pilot experience.
- [x] Added Supabase email registration, sign-in, sign-out, email confirmation messaging, and password recovery.
- [x] Added the versioned pilot privacy consent step and profile capture through the existing database function.
- [x] Added a private customer demonstration request flow with server-side validation, idempotent creation, owner-only history, and cancellation.
- [x] Added helper checks, automated test/lint/build workflow, and a concise architecture/data-flow note.

## Deliberately out of scope for this customer pilot

- Provider registration, provider request inbox, provider verification, quote creation, and job completion.
- Public booking or dispatch, production email, electronic payment, and cash or commission enforcement.
- Admin dashboards, provider reviews, live availability, and any unsupported verification or trust claims.

## Next steps before expanding the pilot

- [ ] Run the branch checks and review the app in the Lovable preview with test accounts.
- [ ] Confirm Supabase email confirmation and password recovery redirect URLs for the preview domain.
- [ ] Review privacy notice, terms, retention, support contact, and incident handling with qualified advisers.
- [ ] Complete the provider and admin flows only after access policies and operational processes are reviewed.
- [ ] Resolve payment, settlement, commissionable base, VAT, and dispute decisions before any payment or fee feature.
- [ ] Complete the go-live checklist before enabling public bookings or production messaging.
