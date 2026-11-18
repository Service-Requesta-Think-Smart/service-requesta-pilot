# Authentication provider setup

This guide configures the sign-in methods in the Service-Requesta pilot. The app uses Supabase Auth for Microsoft, Apple, phone OTP and email/password. The existing Google and Lovable buttons continue to use the Lovable auth integration.

Provider buttons need credentials and provider settings in the connected Supabase project before they can complete sign-in. No provider secrets belong in the repository, browser code, ngrok command line or chat.

## 1. Confirm the app and Supabase project

1. Open the Service-Requesta project in Lovable and confirm which Supabase project it uses.
2. In Supabase, open **Authentication → URL Configuration** and note the project Auth callback URL. It normally has the form `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Start the app through the intended HTTPS ngrok tunnel and copy its public origin, for example `https://<your-ngrok-domain>`.
4. The app sends users back to `<current-app-origin>/auth` after Microsoft, Apple or phone sign-in. In **Authentication → URL Configuration → Redirect URLs**, allow the exact app callback such as `https://<your-ngrok-domain>/auth`. Also add the Lovable preview or stable app callback that the team uses. Keep the existing Site URL; add allowed redirects rather than replacing it with a temporary ngrok address.

An ephemeral ngrok hostname can change when a tunnel restarts. If it changes, add the new `/auth` URL to Supabase's redirect allowlist and update any provider console that uses the app domain. A reserved ngrok domain avoids repeated allowlist updates. Keep the allowlist as narrow as possible.
## 2. Configure Microsoft sign-in

1. In Microsoft Entra, register a web application for the correct organisation and account types for the pilot.
2. Add the Supabase Auth callback from step 1 as the application's **Web redirect URI**. Microsoft returns to Supabase first; Supabase then returns to the app's allowed `/auth` URL.
3. Create a client secret in Entra and copy it directly into **Supabase → Authentication → Sign In / Providers → Azure (Microsoft)**. Do not put it in a `VITE_` variable or source file.
4. Enable the Azure provider in Supabase, enter the client ID and secret, and save. The app requests the `email` scope.
5. Try **Continue with Microsoft** from the HTTPS app origin and verify that a new test account reaches the private requests area.

Use Microsoft's official [Supabase Azure provider guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-azure) and [Microsoft identity platform app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) for current console labels and tenant choices.

## 3. Configure Apple sign-in

1. In the Apple Developer account, configure Sign in with Apple for the app's web Service ID and associated primary App ID.
2. In Apple's web configuration, use the Supabase project host as the domain and register the Supabase Auth callback as the return URL (for example, `https://<project-ref>.supabase.co` and `https://<project-ref>.supabase.co/auth/v1/callback`). The ngrok app URL is the next redirect after Supabase, so allow it in Supabase's Redirect URLs list in step 1.
3. Create the Apple client secret (JWT) using the Sign in with Apple key and team details. Enter the Service ID, team ID, key ID and secret in **Supabase → Authentication → Sign In / Providers → Apple**.
4. Enable Apple in Supabase and save. Keep the signing key private and plan for Apple's client-secret expiry/rotation requirements.
5. Test using an Apple account authorised for the app. Apple may provide a private relay address; make sure the account still reaches the expected customer experience.

Follow the current [Supabase Apple provider guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple) and [Apple Sign in with Apple configuration guide](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/).

## 4. Configure South African phone OTP

1. In Supabase, open **Authentication → Sign In / Providers → Phone**, enable phone sign-in, and choose/configure an SMS provider supported by the project (for example Twilio, Vonage or MessageBird, subject to South African delivery and account requirements).
2. Enter the SMS provider credentials in Supabase's protected provider settings. Do not put them in the app or commit them.
3. Configure an SMS message template containing Supabase's one-time code placeholder. Confirm sender ID/number registration and destination-country permissions with the SMS provider.
4. Set conservative OTP expiry, resend and per-user/IP rate limits. Enable CAPTCHA or the project's equivalent abuse protection before inviting public users.
5. Send a code to a test South African number. Local forms such as `082 123 4567`, `27 82 123 4567`, `0027 82 123 4567`, and `+27 82 123 4567` are normalised to the profile format `+27821234567`.
6. Confirm delivery, code verification, retry limits and the new account's expected customer role. The server-side profile trigger remains responsible for the role.

Read the current [Supabase phone login guide](https://supabase.com/docs/guides/auth/phone-login) and [Supabase Auth rate limits guide](https://supabase.com/docs/guides/auth/rate-limits). SMS charges and coverage depend on the selected provider and destination.

## 5. Keep the pilot private

- Require account sign-in for private requests; do not make request data public to make provider sign-in work.
- New social/phone accounts use the existing server-side customer profile and role flow. Do not set a role from client-side metadata.
- Public bookings, public provider listings and electronic payments remain off. This work only adds authentication options.
- The ngrok URL exposes the running app to anyone who can reach that URL. Share it only with intended pilot participants and close the tunnel when it is not needed.
- The app configuration and provider credentials are separate: adding a button does not by itself activate a provider in Supabase or its external console.
