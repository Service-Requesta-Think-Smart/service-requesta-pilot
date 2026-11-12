# Service-Requesta build progress

## Done
- Added a direct `/preview` route for a clearly labelled, fictional marketplace workflow walkthrough.
- Added browser-local demo flows for separate identity/trade reviews, provider request acceptance, itemised quote approval, job progression, dual completion confirmation, support case resolution logging, and a simulated Yoco outcome. The preview does not call a payment API or move money.
- Added unit tests for the demo workflow transition rules.

## In progress
- Lovable preview availability depends on the connected project syncing the repository's `main` branch and completing its own build/deploy. The route is intended to be opened at `/preview` on the Lovable preview URL.

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
