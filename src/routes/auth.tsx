import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAccount } from "@/features/auth/auth-context";
import { pageHead } from "@/features/customer/metadata";
import "@lovable.dev/cloud-auth-js/styles.css";

type AuthMode = "sign_in" | "sign_up" | "forgot";
type SignupType = "customer" | "provider";

export const Route = createFileRoute("/auth")({
  head: () => pageHead("Sign in or create an account", "Create a Service-Requesta customer or provider account."),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [signupType, setSignupType] = useState<SignupType>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [applyingProviderRole, setApplyingProviderRole] = useState(false);
  const roleResolutionUser = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      roleResolutionUser.current = null;
      return;
    }
    if (recoveryMode || applyingProviderRole || roleResolutionUser.current === user.id) return;
    roleResolutionUser.current = user.id;
    const wantedProvider = window.sessionStorage.getItem("service-requesta-new-provider") === "yes";
    if (!wantedProvider) {
      void navigate({ to: "/requests", replace: true });
      return;
    }

    window.sessionStorage.removeItem("service-requesta-new-provider");
    setApplyingProviderRole(true);
    void supabase.rpc("select_account_type", { p_account_type: "provider" })
      .then(({ error: roleError }) => {
        if (roleError) {
          setError("This account already has activity. Continue to its existing workspace or sign out and create a separate provider account.");
          return;
        }
        void navigate({ to: "/requests", replace: true });
      })
      .catch(() => setError("The provider account path could not be selected. Please try again."))
      .finally(() => setApplyingProviderRole(false));
  }, [user?.id, recoveryMode, applyingProviderRole, navigate]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || cleanEmail.length > 255 || !cleanEmail.includes("@")) {
        throw new Error("Enter a valid email address.");
      }

      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin + "/auth",
        });
        if (resetError) throw new Error("Password reset could not be requested. Please try again.");
        setMessage("If that email has an account, reset instructions will be sent.");
        return;
      }

      if (mode === "sign_up") {
        if (password.length < 10 || password.length > 128) {
          throw new Error("Choose a password from 10 to 128 characters.");
        }
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: { account_type: signupType },
          },
        });
        if (signupError) throw new Error("Account creation could not be completed. Try signing in or resetting your password.");
        setPassword("");
        setConfirmPassword("");
        if (data.session) {
          setMessage("Your account is ready. Continue to your Service-Requesta workspace.");
          void navigate({ to: "/requests", replace: true });
        } else {
          setMessage("Check your email to confirm your address, then return here to continue.");
        }
        return;
      }

      const { error: signinError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signinError) throw new Error("Sign-in failed. Check your email and password.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function signInSocial(provider: "google" | "lovable") {
    setError("");
    setMessage("");
    setBusy(true);
    if (mode === "sign_up" && signupType === "provider") {
      window.sessionStorage.setItem("service-requesta-new-provider", "yes");
    } else {
      window.sessionStorage.removeItem("service-requesta-new-provider");
    }
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
    } catch {
      window.sessionStorage.removeItem("service-requesta-new-provider");
      setBusy(false);
      setError("Sign-in could not be completed. Please try again.");
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 10 || newPassword.length > 128) {
      setError("Choose a password from 10 to 128 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error("The new password could not be saved. Request a fresh reset link.");
      setRecoveryMode(false);
      setNewPassword("");
      setMessage("Your password has been updated. You can now sign in.");
      await supabase.auth.signOut();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The password could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (recoveryMode) {
    return (
      <main className="page-wrap py-12">
        <div className="mx-auto max-w-md">
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h1 className="mt-3 text-3xl font-semibold">Choose a new password</h1>
          <form onSubmit={(event) => void updatePassword(event)} className="mt-8 space-y-5">
            <label className="field-label">New password
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={128} required autoComplete="new-password" />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button disabled={busy} className="h-11 w-full">{busy ? "Saving…" : "Update password"}<ArrowRight /></Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap py-12">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">SERVICE-REQUESTA · THINK SMART</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {mode === "sign_up" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {mode === "sign_up"
            ? "Customers and providers use one app, with a different workspace after sign-up."
            : mode === "forgot"
              ? "We’ll send a private reset link if the account exists."
              : "Sign in to save and track your Service-Requesta activity."}
        </p>

        <div className="my-6 border-l-4 border-primary bg-accent p-4 text-sm">
          <ShieldCheck className="mb-2 size-5" />
          <strong>Controlled pilot.</strong> Public bookings, dispatch, payments, and commission charges remain closed until launch checks are complete.
        </div>

        {mode === "sign_up" && (
          <fieldset className="mb-5">
            <legend className="field-label mb-2">Choose your account path</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={signupType === "customer" ? "secondary" : "outline"} aria-pressed={signupType === "customer"} onClick={() => setSignupType("customer")}>Customer</Button>
              <Button type="button" variant={signupType === "provider" ? "secondary" : "outline"} aria-pressed={signupType === "provider"} onClick={() => setSignupType("provider")}>Service provider</Button>
            </div>
          </fieldset>
        )}

        {mode !== "forgot" && (
          <>
            <div className="space-y-3">
              <Button variant="outline" className="google-auth h-11 w-full" disabled={busy || applyingProviderRole} onClick={() => void signInSocial("google")}>
                Continue with Google
              </Button>
              <Button className="lovable-auth-button h-11 w-full" disabled={busy || applyingProviderRole} onClick={() => void signInSocial("lovable")}>
                Continue with Lovable
              </Button>
            </div>
            <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> OR USE EMAIL <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={(event) => void submitEmail(event)} className="space-y-5">
          <label className="field-label">Email address
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} autoComplete="email" />
          </label>
          {mode !== "forgot" && (
            <label className="field-label">Password
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "sign_up" ? 10 : 1} maxLength={128} autoComplete={mode === "sign_up" ? "new-password" : "current-password"} />
            </label>
          )}
          {mode === "sign_up" && (
            <label className="field-label">Confirm password
              <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
          {user && error && <Button type="button" variant="outline" onClick={() => void navigate({ to: "/requests", replace: true })}>Continue to this account</Button>}
          <Button disabled={busy || applyingProviderRole} className="h-11 w-full">
            {busy || applyingProviderRole ? "Please wait…" : mode === "sign_up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            <ArrowRight />
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-3 text-sm">
          {mode === "sign_in" && <button type="button" className="text-left underline underline-offset-4" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot your password?</button>}
          <button type="button" className="text-left font-semibold text-primary underline underline-offset-4" onClick={() => { setMode(mode === "sign_up" ? "sign_in" : "sign_up"); setError(""); setMessage(""); }}>
            {mode === "sign_up" ? "Already have an account? Sign in" : mode === "forgot" ? "Back to sign in" : "Create a new account"}
          </button>
        </div>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          By continuing, you agree to review the <Link to="/privacy" className="underline">pilot privacy notice</Link> before using your workspace. Use test details and do not enter a street address in demonstration mode.
        </p>
      </div>
    </main>
  );
}
