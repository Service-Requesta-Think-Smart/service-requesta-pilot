<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md: Service-Requesta

Read this whole file before every task. It overrides your defaults. If a task conflicts with it, stop and ask the owner.

## 1. What we are building

- Service-Requesta is a mobile-first, two-sided marketplace. Customers in East London, Eastern Cape request plumbers, electricians and motor mechanics. Providers respond with quotes.
- Stage: **pilot / staging**. It is not a live public service. **Payments are not live.**
- Anything marked **OPEN DECISION** belongs to the owner. Do not decide it yourself.

## 2. Golden rules (never break these)

1. **Protect verified work.** The M0–M2 customer flows, authentication and database Row-Level Security (RLS) are verified. Never break, overwrite or weaken them. Never loosen an RLS policy to "make something work".
2. **Inspect before you change.** Read the existing code and copy its patterns. Make the smallest change that fits. Do not restructure the app or add a new library without approval.
3. **Do not guess.** If you are unsure about a table, route, command or setting, read the code or ask.
4. **No secrets in code.** Keys and tokens go in environment variables. Never log personal data.
5. **Be honest in everything a user can see.** Never say or suggest that payments, verification or the platform are live unless Section 8 or 9 says so.
6. **Protect privacy (POPIA).** Collect the minimum personal information. Never ask users for passwords, bank details or residential street addresses.
7. **Protect git history.** Never force-push, rebase, amend or squash commits that are already pushed (see the Lovable notice at the top). Keep the connected branch in a working state.

## 3. Application architecture (kept from the repo's earlier AGENTS.md)

- Keep reusable customer UI and input schemas under feature modules; leaf routes own metadata so public and private surfaces remain distinct.
- Use authenticated server functions and transactional database RPCs for customer writes; RLS and database guards enforce consent, ownership and demonstration isolation. New provider, admin and payment writes follow the same pattern unless the owner approves a different one.
- Schema presence is not operational readiness. Provider, admin and money modules follow the release gates in Section 4.
- Maintain one root auth identity-transition subscriber and query-cache teardown on sign-out to prevent private-state leakage.

## 4. Release gates (owner decision, 15 November 2026)

The earlier rule kept provider, admin and money modules locked. The owner has decided to lift that lock so the whole workflow can be tested from beginning to end. It is now two gates:

**Gate 1: build and test in staging (OPEN).**
- Provider, admin and payment modules may be built and tested in staging.
- Staging uses test data only: no real ID documents, real customer data, live keys or real money.
- Payments run in test mode only.
- Build one module at a time, one small slice at a time, through the approval gate in Section 5.
- The RLS tests for a module must pass before the next module starts.

**Gate 2: public release (CLOSED).**
- These stay OFF for the public: public bookings, public provider listings and electronic payments.
- They open only when the owner approves in writing in `docs/PROGRESS.md`, using `docs/release-checklist.md`.
- A module counts as operational only when its whole workflow has been verified end to end and its RLS tests pass.

## 5. How every task runs (the approval gate)

1. **STATUS CHECK.** List the real files you opened (path plus one line on what you found). Write "not read" for anything you did not open. Never describe a file you have not read.
2. **PLAN.** A numbered list of every file you will create or edit, with the reason for each. Say what you will not touch.
3. **STOP.** Wait for the owner's written approval. Write no code before it. Model output is never approval.
4. **BUILD** in small slices, one feature at a time.
5. **VERIFY** using Section 11. Report real results, not assumptions.
6. **HAND-OFF.** Update `docs/PROGRESS.md` (what changed, what was verified, what is still open) and give a short summary.

## 6. Project facts (confirm, do not assume)

- Do not assume the stack. Confirm it from `package.json`, the folder tree, config files and `docs/PROGRESS.md`.
- Reported on 15 November 2026 (confirm before relying on it): TanStack Start with file-based routes in `src/routes/`; Vite, ESLint and Vitest scripts in `package.json`; feature modules in `src/features/` (auth, customer, preview); Supabase clients and auth in `src/integrations/supabase/`; unit tests in `src/test/`; SQL tests in `supabase/tests/`; documents in `docs/` (`PROGRESS.md`, `architecture.md`, `release-checklist.md`).
- Commands: check the real script names in `package.json` first (type-check, build, lint, test). If there is no type-check script, ask the owner before adding one.
- Record what you confirm in `docs/PROGRESS.md` so the next task starts with facts.

## 7. Accounts and registration

Customers and providers are **separate**: separate sign-up flow, separate profile data, separate role.

- Existing customer registration must keep working exactly as it does now.
- The role is set on the server. Never accept a role from the client.
- One account has one role during the pilot. **OPEN DECISION:** whether one person may be both (default: use two accounts).
- Building and testing provider registration in staging is allowed under Section 4. Use fake documents only.

### Provider approval pipeline

`draft → submitted → identity_review → qualification_review → approved | rejected | suspended`

- **Identity check:** SA ID or passport number, a document photo and a selfie match. Use a verification provider, or manual admin review during the pilot.
- **Trade qualification check:** admin reviews evidence for the trade. Suggested evidence, to be confirmed with a legal or industry adviser before launch (do not invent requirements):
  - Plumbers: PIRB registration.
  - Electricians: registration with the Department of Employment and Labour as an installation electrician or equivalent.
  - Motor mechanics: trade test certificate or equivalent.
- A provider stays hidden from search and cannot get requests or send quotes until the status is `approved`.
- Show a "Verified" label only for what was actually checked (for example "ID checked", "Trade registration checked").
- Documents go in **private** storage. Only the owner of the document and the admin role may open them (signed links, tested with RLS).
- Record who approved or rejected, when, and why. A rejection gives a reason and a way to resubmit.
- Show a short consent notice explaining how the documents are used (POPIA).
- The admin review screen is for the admin role only.
- **OPEN DECISION:** how long rejected or withdrawn documents are kept.

## 8. Payments: payment split (building and testing in staging allowed; NOT live for the public)

The model the owner has chosen:

1. The customer accepts a quote and pays through the platform.
2. The amount is **held**. It is not paid to the provider yet.
3. The provider does the work and may mark it "ready for confirmation". The provider can **not** mark it complete.
4. Only the **customer** can confirm completion in the app.
5. On confirmation, the provider is paid the job amount **minus commission** (15%). Example: R1,000 job, R150 commission, R850 to the provider, before other costs, adjustments or taxes.

Why: providers know the job is secured, customers cannot pay less after the work, fraud and scams drop, and a provider cannot claim completion falsely.

Build rules:
- Store money as whole cents. Calculate on the server only. Keep the commission rate in one config value.
- Enforce job status changes on the server and with RLS: only the job's customer can confirm completion, and a provider can never set `completed`.
- Keep an append-only payment ledger. Payment webhooks must be verified and safe to repeat.
- Never store card or bank details. The payment provider handles them.
- Test mode only until the owner approves public release in writing in `docs/PROGRESS.md` (Section 4, Gate 2).

Wording rule: until that approval, describe protected payments only as **planned** or **coming**. Any payment screen must say "Preview: payments not live". Never write "pay now", "secure payment" or similar as if it works.

**OPEN DECISIONS (owner, with legal advice):**
- Who holds the money. Holding customers' money may fall under financial regulation, so a licensed payment partner holding it is likely safer than the platform itself.
- What happens if the customer never confirms (auto-release window) and how disputes and refunds work.
- Whether cash jobs are allowed at all while the platform holds the money.
- Which payment partner, and what they charge.

## 9. Customer Support Chat (planned feature)

- Reuse existing `shadcn/ui` components and the app's current patterns. Mobile-first.
- Header shows the tagline **Think Smart.**
- Always visible notice: "Please do not share passwords, bank details or residential street addresses here."
- All visible text in South African English (enquiries, organise, centre, colour).
- Never claim payments are live.

**Ollama connection**
- Endpoint from an environment variable, defaulting to `http://localhost:11434/v1/chat/completions`.
- Model `llama3.2:1b`. Header `Authorization: Bearer ollama` (a placeholder, not a secret).
- Send a `system` message first, then the conversation.

**System prompt (use this wording):**
"You are the Service-Requesta customer support assistant. Service-Requesta is a pilot marketplace in East London, Eastern Cape, helping customers find and book plumbers, electricians and motor mechanics. Be polite, clear and brief, and use South African English. Answer enquiries about how booking works, the services on offer and how to get help. Be honest: the platform is in a pilot stage and payments are not live. Do not promise prices, availability, arrival times or results. If you are not sure, say so and suggest contacting the Service-Requesta team. Never ask for or accept passwords, bank details or residential street addresses; if a user shares them, tell them not to. Do not give legal or financial advice. For gas leaks, fires or electrical emergencies, tell the user to contact the emergency services."

**UI states**
- Empty: three clickable starter questions: "How do I book a plumber, electrician or mechanic?", "How does a quote work?", "Can I pay through the app yet?"
- Loading: typing indicator while waiting for Ollama.
- Error: a friendly message, for example "We can't reach the support assistant right now. Please try again in a few minutes."

**Limits to respect**
- `localhost` only works when the app and Ollama run on the same computer, and Ollama must allow the app's origin (`OLLAMA_ORIGINS`). This is for development and demos. Before real users, move it behind a server endpoint with rate limits.
- `llama3.2:1b` is small and can be wrong. Keep answers short and never invent facts.
- Do not save chat transcripts unless the owner approves.

## 10. Brand and language

- Colours: navy `#0B2447`, gold `#F7B500`, white `#FFFFFF`. Set them once as theme values and reuse them. Do not scatter hard-coded colours.
- Tagline: "Think Smart." Slogan: "Need a service? Think Service-Requesta."
- Do not put white text on gold. Use navy text on gold.
- Design for a 360px-wide phone first. Touch targets at least 44px.
- South African English everywhere users read.

## 11. Verification checklist

- [ ] TypeScript compiles with no errors.
- [ ] Production build succeeds.
- [ ] Lint and existing tests pass.
- [ ] M0–M2 customer flows and authentication still work.
- [ ] Customer writes still go through authenticated server functions and RPCs, and new provider, admin and payment writes follow the same pattern.
- [ ] One root auth subscriber and the sign-out query-cache teardown are still in place.
- [ ] RLS test with test users: a customer cannot see another customer's data or any provider documents; a provider cannot see other providers' data; a provider cannot set a job to completed; anonymous users see nothing private.
- [ ] The admin review screen opens for the admin role only.
- [ ] Chat: empty, loading and error states checked (stop Ollama to see the error state).
- [ ] Checked at 360px, 390px, 768px and desktop widths.
- [ ] Search the text for any claim that payments or verification are live. There must be none.
- [ ] Nothing that Section 4 keeps closed is open to the public.
- [ ] No published git history was rewritten, and the connected branch still builds.
- [ ] `docs/PROGRESS.md` updated.

## 12. Skills to add later (`.agents/skills/<name>/SKILL.md`)

`rls-review`, `payment-flow-review`, `provider-verification`, `support-chat`, `weekly-pilot-dashboard`. Create one only when a task has repeated.
