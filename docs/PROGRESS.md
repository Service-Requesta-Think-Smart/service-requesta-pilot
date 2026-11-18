# Service-Requesta build progress

## Done
- Added a direct `/preview` route for a clearly labelled, fictional marketplace workflow walkthrough.
- Added browser-local demo flows for separate identity/trade reviews, provider request acceptance, itemised quote approval, job progression, dual completion confirmation, support case resolution logging, and a simulated Yoco outcome. The preview does not call a payment API or move money.
- Added unit tests for the demo workflow transition rules.

## In progress
- Lovable Git Sync is linked to GitHub repository `Service-Requesta-Think-Smart/service-requesta-pilot` (repository ID `1449315236`) and uses `main` as its active branch. The Lovable settings page still displays the former owner path `siyolisenovuna08-greatest/service-requesta-pilot`; GitHub resolves that path to the same repository ID and canonical organization owner. The existing project link was preserved.
- The `backup-before-sync` branch points to the original GitHub `main` commit `e09dbea8bc43a876a63e5fdc221252377e95433e`, captured before reconciliation.
- As of 2026-11-18, GitHub `main` is at `16912502803bd569372c05a1fc64a0545dca2344`; Lovable still reports `80f3ba8662bb9870cc9fb00aa6716739dabacaeb`. GitHub's commit comparison reports 9 commits ahead and 0 behind. Lovable's sync card reports 8 commits ahead and says the GitHub commits have not been pulled. The count discrepancy is unresolved.
- The Lovable GitHub App is now installed for `Service-Requesta-Think-Smart` with repository access limited to `service-requesta-pilot`. This documentation commit is intended to trigger a fresh GitHub push event after that connection was added. Confirm that Lovable advances to the resulting GitHub commit before treating sync as reconciled.
- The GitHub-to-Lovable pull remains unverified. The reverse Lovable-to-GitHub edit also remains unverified because the Lovable project is out of credits.

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
1. Run `bun run test`, `bun run lint`, and `bun run build` in the connected Lovable/GitHub project and address any failures.
2. Open `/preview` in the Lovable preview and inspect the role-by-role demo on desktop and a small mobile viewport.
3. After the preview is accepted, plan any persistent multi-user demo workflow as a separate task, with database/RLS changes reviewed before implementation.
