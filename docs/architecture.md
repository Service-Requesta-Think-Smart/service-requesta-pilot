# Service-Requesta pilot architecture

## Current pilot boundary

The app is a controlled East London customer pilot for plumbing, electrical, and motor mechanic requests. It is not generally available. The current customer request flow saves private demonstration records only; it does not dispatch work, create provider responses, accept quotes, collect payments, or enforce commission.

## Data flow

1. Supabase Auth handles email registration, sign-in, confirmation, and password recovery. The browser uses the public publishable key; privileged keys must remain server-side and are not needed by this customer flow.
2. A database trigger creates the customer profile and customer role for a new account. The app reads only the signed-in user's profile and consent record.
3. The customer accepts the versioned pilot privacy notice. The app calls accept_pilot_privacy, which stores the profile and consent and writes an audit event.
4. A customer submits a request through create_service_request. The database validates the role and consent, enforces an idempotency key and rate limit, always marks the record as a demonstration, and records an event and audit entry.
5. Row-level security limits request reads to the owning customer. The provider request policy excludes demonstration records. Cancellation uses the database function and the database transition guard.

## Security and privacy notes

- Never put a Supabase service-role key or other privileged credential in browser code or environment values shipped to the browser.
- Keep authorization in database policies and RPC checks; the interface is not an authorization boundary.
- Collect only an area or suburb in this flow. The form warns customers not to submit a street address or sensitive personal information.
- Display clear pilot/demo language at registration, request creation, and request history. Do not imply provider availability, verification, completion, fees, or real bookings.
- Money is outside the current flow. Future money calculations must use integer cents or safe decimal arithmetic, never floating-point arithmetic.
- Legal terms, retention periods, provider checks, fees, VAT, and production launch require separate review before public bookings are enabled.

## Acceptance checks

- Registration and sign-in use Supabase Auth; the interface never stores passwords itself.
- Email confirmation and password reset work with the configured Supabase redirect URLs.
- A customer without the versioned consent cannot save a request.
- A saved request is marked demo-only, is visible to its owner, and is absent from provider access.
- Repeating the same submission with the same idempotency key does not create a duplicate.
- The server enforces the five-requests-per-hour limit and permits cancellation only for eligible owned requests.
- Only the three pilot service types and East London area copy are offered.
- Customer forms remain usable on narrow screens and expose validation and status messages to assistive technology.
