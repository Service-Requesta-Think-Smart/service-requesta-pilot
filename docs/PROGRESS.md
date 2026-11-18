# Service-Requesta build progress

## Done
- Added Microsoft (Azure), Apple and SMS phone-code options to `/auth`, while preserving the existing Google, Lovable and email/password sign-in paths.
- Added South African phone number normalisation to the existing `+27` profile format, with a six-digit SMS code verification flow.
- Added `docs/auth-provider-setup.md` with provider console, Supabase redirect, SMS and ngrok setup guidance. No credentials or secrets were added to source.
- Added a direct /preview route for a clearly labelled, fictional marketplace workflow walkthrough.
- Added browser-local demo flows for separate identity/trade reviews, provider request acceptance, itemised quote approval, job progression, dual completion confirmation, support case resolution logging, and a simulated Yoco outcome. The preview does not call a payment API or move money.
- Added unit tests for the demo workflow transition rules.

## In progress
- The new Microsoft, Apple and phone sign-in code is in place, but end-to-end sign-in is not yet verified. Microsoft and Apple require their provider credentials in Supabase and external-console callback configuration; phone OTP requires an enabled SMS provider, credentials, delivery configuration and abuse limits. These account settings have not been changed by this code update.
- OAuth returns to the current app origin at `/auth`. For ngrok, add the active HTTPS ngrok `/auth` URL to Supabase Auth's redirect allowlist; the ngrok hostname is not present in this repository and may change between tunnels.
- Build and lint verification for the authentication update is pending. No tests were run as part of this change.
- Lovable Git Sync remains connected to Service-Requesta-Think-Smart/service-requesta-pilot (repository ID 1449315236) on main. Lovable's settings still show the former owner path siyolisenovuna08-greatest/service-requesta-pilot; GitHub resolves it to the same repository ID and canonical organization owner. The existing project link was preserved.
- The backup-before-sync branch points to the original GitHub main commit e09dbea8bc43a876a63e5fdc221252377e95433e, captured before reconciliation.
- At the last sync check before this note was updated, GitHub main was at 8858954219afa8393502a191e1c3d2b690349483 and Lovable still reported 80f3ba8662bb9870cc9fb00aa6716739dabacaeb. GitHub's commit comparison showed 10 commits ahead and 0 behind; Lovable's Git settings showed 9 commits ahead and said GitHub commits had not been pulled. Lovable also reported the last sync was 3 days ago. The count discrepancy remains unresolved.
- The Lovable GitHub App is installed for Service-Requesta-Think-Smart with access limited to service-requesta-pilot. The documentation commit 8858954219afa8393502a191e1c3d2b690349483, pushed after installation, did not advance Lovable. This follow-up note will create another docs-only commit; that push also needs to be checked before sync can be considered reconciled.
- GitHub-to-Lovable sync remains unverified and currently out of sync. The reverse Lovable-to-GitHub edit is unverified because the project is out of credits and Lovable reports that work is paused.
- 18 November 2026: After Lovable Support identified the missing workspace-level GitHub connection as the likely cause, the owner completed that connection for Service-Requesta-Think-Smart. The latest observed state was GitHub main at 98661b2dbb7406cccf22e98bb929219f853e1607 and Lovable at 80f3ba8662bb9870cc9fb00aa6716739dabacaeb (11 commits ahead on GitHub, 0 behind). This docs-only commit is a fresh push after the connection; verify the pull before treating sync as restored.

## Missing / known limitations
- Demo state is local to the current browser and is not shared across roles, users, devices, or the real Supabase database.
- The Yoco control only changes local demo presentation; no Yoco integration is implemented.
- No real provider/customer data, messaging, document upload, legal approval, or production payment flow is included.
- Build, lint and tests have not been run in this tool environment.

## Decisions
- Keep preview-only data in localStorage; make no database migrations or production feature-flag changes.
- Do not expose private contact details or a residential street address.
- Display the proposed 15% commission only as an illustrative calculation.

## Next three steps
1. Ask Lovable Support to diagnose why GitHub pushes are not being pulled and why the former owner path is still displayed, while keeping the current repository link and branch history intact.
2. After pull sync is restored and Lovable credits are available, make a minimal documentation edit in Lovable and confirm its commit appears on GitHub main.
3. Confirm the Lovable and GitHub main commit SHAs match before relying on two-way sync.
# Service-Requesta build progress

## Done
- Added a direct /preview route for a clearly labelled, fictional marketplace workflow walkthrough.
- Added browser-local demo flows for separate identity/trade reviews, provider request acceptance, itemised quote approval, job progression, dual completion confirmation, support case resolution logging, and a simulated Yoco outcome. The preview does not call a payment API or move money.
- Added unit tests for the demo workflow transition rules.

## In progress
- Lovable Git Sync remains connected to Service-Requesta-Think-Smart/service-requesta-pilot (repository ID 1449315236) on main. Lovable's settings still show the former owner path siyolisenovuna08-greatest/service-requesta-pilot; GitHub resolves it to the same repository ID and canonical organization owner. The existing project link was preserved.
- The backup-before-sync branch points to the original GitHub main commit e09dbea8bc43a876a63e5fdc221252377e95433e, captured before reconciliation.
- At the last sync check before this note was updated, GitHub main was at 8858954219afa8393502a191e1c3d2b690349483 and Lovable still reported 80f3ba8662bb9870cc9fb00aa6716739dabacaeb. GitHub's commit comparison showed 10 commits ahead and 0 behind; Lovable's Git settings showed 9 commits ahead and said GitHub commits had not been pulled. Lovable also reported the last sync was 3 days ago. The count discrepancy remains unresolved.
- The Lovable GitHub App is installed for Service-Requesta-Think-Smart with access limited to service-requesta-pilot. The documentation commit 8858954219afa8393502a191e1c3d2b690349483, pushed after installation, did not advance Lovable. This follow-up note will create another docs-only commit; that push also needs to be checked before sync can be considered reconciled.
- GitHub-to-Lovable sync remains unverified and currently out of sync. The reverse Lovable-to-GitHub edit is unverified because the project is out of credits and Lovable reports that work is paused.
- 18 November 2026: After Lovable Support identified the missing workspace-level GitHub connection as the likely cause, the owner completed that connection for Service-Requesta-Think-Smart. The latest observed state was GitHub main at 98661b2dbb7406cccf22e98bb929219f853e1607 and Lovable at 80f3ba8662bb9870cc9fb00aa6716739dabacaeb (11 commits ahead on GitHub, 0 behind). This docs-only commit is a fresh push after the connection; verify the pull before treating sync as restored.

## Missing / known limitations
- Demo state is local to the current browser and is not shared across roles, users, devices, or the real Supabase database.
- The Yoco control only changes local demo presentation; no Yoco integration is implemented.
- No real provider/customer data, messaging, document upload, legal approval, or production payment flow is included.
- Build, lint and tests have not been run in this tool environment.

## Decisions
- Keep preview-only data in localStorage; make no database migrations or production feature-flag changes.
- Do not expose private contact details or a residential street address.
- Display the proposed 15% commission only as an illustrative calculation.

## Next three steps
1. Ask Lovable Support to diagnose why GitHub pushes are not being pulled and why the former owner path is still displayed, while keeping the current repository link and branch history intact.
2. After pull sync is restored and Lovable credits are available, make a minimal documentation edit in Lovable and confirm its commit appears on GitHub main.
3. Confirm the Lovable and GitHub main commit SHAs match before relying on two-way sync.
