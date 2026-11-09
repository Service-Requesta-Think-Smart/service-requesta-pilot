# Milestone test results

9 November 2026 UTC. 16 tests passed across customer-rules, app-routing and opt-in cloud-access test files. Live tests used the requesting user’s authorised session, never a service key. Live tests can be rerun with PILOT_TEST_TOKEN, PILOT_TEST_UID, PILOT_TEST_URL and PILOT_TEST_KEY passed privately to the test process; never commit these values.

Browser flow passed with the requesting-user session: consent when needed, request details/review, save, history readback, cancel, reload persistence, mobile width 390px without horizontal overflow, sign-out and protected-route redirect. Desktop screenshot checked at 1280px. No runtime page errors observed.

Access checks: anonymous customer rows unavailable; user only sees their own requests; unknown profile rows unavailable; self-admin denied; direct status changes leave records unchanged; unknown cancellation rejected; invalid category rejected; forged consent rejected; all five launch gates OFF; request replay returns same ID and repeat cancellation rejected.

Initial tests incorrectly required an error for RLS-hidden reads/writes; adjusted to verify the substantive outcomes (no data / no record changes), then reran successfully. Least-privilege grants additionally remove inherited anonymous and write permissions. Six intentional security-definer RPC/helper warnings are reviewed, not proof of universal security.

Unverified: interactive hosted OAuth and password login credentials, all real-job state transitions, quote acceptance, double completion adversarial tests, private document uploads, rate-limit boundary/concurrency stress, reminders, restriction enforcement, backups/restore, and payments. No production readiness claim.
