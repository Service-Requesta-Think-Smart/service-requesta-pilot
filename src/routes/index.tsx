import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  Clock3,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  Wrench,
  Zap,
  CarFront,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { supabase } from "../integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import {
  categoryLabel,
  createIdempotencyKey,
  formatPilotDate,
  friendlyError,
  normalizeSouthAfricanPhone,
  SERVICE_CATEGORIES,
  statusLabel,
  timingLabel,
  validateRequestDraft,
  type RequestDraft,
  type RequestErrors,
  type RequestTiming,
  type ServiceCategory,
} from "../lib/service-requesta";

type Profile = Pick<Tables<"profiles">["Row"], "display_name" | "phone">;
type ServiceRequest = Pick<
  Tables<"service_requests">["Row"],
  "id" | "category" | "title" | "description" | "area" | "timing" | "status" | "is_demo" | "created_at"
>;
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type AuthMode = "sign_in" | "sign_up" | "forgot";

const emptyDraft: RequestDraft = {
  category: "plumbing",
  title: "",
  description: "",
  area: "",
  timing: "flexible",
};

const focusField =
  "mt-1 w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus:border-brand-navy focus:outline-none";

export const Route = createFileRoute("/")({
  component: ServiceRequestaHome,
});

function ServiceRequestaHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountLoadFailed, setAccountLoadFailed] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [draftErrors, setDraftErrors] = useState<RequestErrors>({});
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      const authListener = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setSessionLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
        if (event === "SIGNED_OUT") {
          setRecoveryMode(false);
          setHasConsent(false);
          setProfile(null);
          setRequests([]);
          setRefreshTick((value) => value + 1);
        }
      });
      unsubscribe = () => authListener.data.subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setNotice({ kind: "error", text: "We could not check your sign-in. Please refresh." });
          } else {
            setSession(data.session);
          }
          setSessionLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setSessionLoading(false);
          setNotice({
            kind: "error",
            text: "The pilot account service is not connected yet. Please contact the project owner.",
          });
        });
    } catch {
      setSessionLoading(false);
      setNotice({
        kind: "error",
        text: "The pilot account service is not connected yet. Please contact the project owner.",
      });
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (profile) {
      setProfileName(profile.display_name);
      setProfilePhone(profile.phone ?? "");
    }
  }, [profile]);

  useEffect(() => {
    let active = true;

    if (!session) {
      setProfile(null);
      setHasConsent(false);
      setRequests([]);
      setAccountLoading(false);
      setAccountLoadFailed(false);
      return () => {
        active = false;
      };
    }

    async function loadAccount() {
      setAccountLoading(true);
      setAccountLoadFailed(false);

      try {
        const [profileResult, consentResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name,phone")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase.from("consents").select("user_id").eq("user_id", session.user.id).maybeSingle(),
        ]);

        if (profileResult.error || consentResult.error) throw new Error("Account lookup failed");
        if (!active) return;

        setProfile(profileResult.data);
        const accepted = Boolean(consentResult.data);
        setHasConsent(accepted);

        if (!accepted) {
          setRequests([]);
          return;
        }

        const requestResult = await supabase
          .from("service_requests")
          .select("id,category,title,description,area,timing,status,is_demo,created_at")
          .order("created_at", { ascending: false });

        if (requestResult.error) throw new Error("Request lookup failed");
        if (!active) return;
        setRequests((requestResult.data ?? []) as ServiceRequest[]);
      } catch {
        if (!active) return;
        setAccountLoadFailed(true);
        setNotice({
          kind: "error",
          text: "We could not load your pilot account. Try again in a moment.",
        });
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, [session?.user.id, refreshTick]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setAuthBusy(true);

    try {
      const email = authEmail.trim().toLowerCase();
      if (authMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice({
          kind: "success",
          text: "If that email has a pilot account, password reset instructions are on the way.",
        });
      } else if (authMode === "sign_up") {
        if (authPassword.length < 10) {
          setNotice({ kind: "error", text: "Choose a password with at least 10 characters." });
          return;
        }
        if (authPassword !== confirmPassword) {
          setNotice({ kind: "error", text: "The passwords do not match." });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          setNotice({
            kind: "success",
            text: "Your pilot account is ready. Add your details to continue.",
          });
        } else {
          setNotice({
            kind: "info",
            text: "Check your email to confirm your address, then return here to continue.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
        setNotice({ kind: "success", text: "You are signed in." });
      }
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 10) {
      setNotice({ kind: "error", text: "Choose a password with at least 10 characters." });
      return;
    }

    setAuthBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoveryMode(false);
      setNewPassword("");
      setNotice({ kind: "success", text: "Your password has been updated." });
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleConsentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!privacyAccepted) {
      setNotice({ kind: "error", text: "Please read and accept the pilot privacy notice to continue." });
      return;
    }

    const cleanName = profileName.trim();
    if (cleanName.length < 1 || cleanName.length > 100) {
      setNotice({ kind: "error", text: "Enter a name of up to 100 characters." });
      return;
    }

    const cleanPhone = profilePhone.trim() ? normalizeSouthAfricanPhone(profilePhone) : null;
    if (profilePhone.trim() && !cleanPhone) {
      setNotice({
        kind: "error",
        text: "Enter a valid South African number, such as 082 123 4567.",
      });
      return;
    }

    setConsentBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.rpc("accept_pilot_privacy", {
        p_name: cleanName,
        ...(cleanPhone ? { p_phone: cleanPhone } : {}),
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Your pilot profile has been saved." });
      setPrivacyAccepted(false);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setConsentBusy(false);
    }
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateRequestDraft(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;

    let idempotencyKey = requestKey;
    try {
      idempotencyKey ??= createIdempotencyKey();
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
      return;
    }

    setRequestKey(idempotencyKey);
    setRequestBusy(true);
    setNotice(null);

    try {
      const { error } = await supabase.rpc("create_service_request", {
        p_category: draft.category as ServiceCategory,
        p_title: draft.title.trim(),
        p_description: draft.description.trim(),
        p_area: draft.area.trim(),
        p_timing: draft.timing as RequestTiming,
        p_key: idempotencyKey,
      });
      if (error) throw error;
      setDraft(emptyDraft);
      setDraftErrors({});
      setRequestKey(null);
      setNotice({
        kind: "success",
        text: "Your demonstration request was saved. It has not been sent to a service provider.",
      });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setRequestBusy(false);
    }
  }

  async function handleCancelRequest(requestId: string) {
    if (!window.confirm("Cancel this saved demonstration request?")) return;
    setNotice(null);

    try {
      const { error } = await supabase.rpc("cancel_service_request", { p_id: requestId });
      if (error) throw error;
      setNotice({ kind: "success", text: "The demonstration request was cancelled." });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setNotice({ kind: "info", text: "You have signed out." });
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    }
  }

  const isReady = Boolean(session && hasConsent && !accountLoading && !accountLoadFailed);

  return (
    <div className="min-h-screen bg-brand-cream text-foreground">
      <header className="border-b border-border/80 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3" aria-label="Service-Requesta home">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-navy text-sm font-black tracking-tight text-white">
              SR
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-brand-navy">
                Service-Requesta
              </span>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                East London pilot
              </span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-brand-gold/60 bg-brand-gold/15 px-3 py-1.5 text-xs font-semibold text-brand-navy sm:inline-flex">
              Controlled pilot · not publicly available
            </span>
            {session && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-navy hover:bg-brand-sky"
              >
                <LogOut aria-hidden="true" size={16} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              "mb-6 rounded-2xl border px-4 py-3 text-sm font-medium " +
              (notice.kind === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : notice.kind === "success"
                  ? "border-emerald-700/20 bg-emerald-50 text-emerald-900"
                  : "border-brand-navy/15 bg-brand-sky text-brand-navy")
            }
          >
            {notice.text}
          </div>
        )}

        {sessionLoading ? (
          <LoadingPanel label="Checking your pilot account…" />
        ) : recoveryMode ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-9">
            <Eyebrow>Account recovery</Eyebrow>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-navy">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use at least 10 characters. Your password is handled by the secure account service.
            </p>
            <form onSubmit={(event) => void handlePasswordUpdate(event)} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                New password
                <input
                  required
                  minLength={10}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={focusField}
                />
              </label>
              <button disabled={authBusy} className="primary-button w-full">
                {authBusy ? <LoaderCircle className="animate-spin" size={18} /> : "Update password"}
              </button>
            </form>
          </section>
        ) : !session ? (
          <div className="grid items-start gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
            <section className="pt-2 lg:pt-8">
              <Eyebrow>Local skills. Clear requests. Better connections.</Eyebrow>
              <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-navy sm:text-5xl lg:text-6xl">
                A clearer way to ask for local help.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Service-Requesta is preparing a small East London pilot for plumbing, electrical,
                and motor mechanic requests.
              </p>
              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-brand-gold/50 bg-brand-gold/15 p-4 text-sm leading-6 text-brand-navy">
                <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
                <p>
                  <strong>Private demonstration only.</strong> Requests saved here stay in your
                  account and are not sent to providers. No booking, payment, or provider response
                  is created.
                </p>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {SERVICE_CATEGORIES.map((category) => {
                  const Icon =
                    category.value === "plumbing"
                      ? Wrench
                      : category.value === "electrical"
                        ? Zap
                        : CarFront;
                  return (
                    <div
                      key={category.value}
                      className="rounded-2xl border border-border bg-white p-4 shadow-sm"
                    >
                      <Icon size={20} className="text-brand-navy" aria-hidden="true" />
                      <p className="mt-3 font-bold text-brand-navy">{category.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {category.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin size={16} aria-hidden="true" />
                East London · Buffalo City Metropolitan Municipality
              </p>
            </section>

            <section className="rounded-3xl border border-border bg-white p-5 shadow-xl sm:p-8">
              <div className="flex gap-2 rounded-xl bg-brand-sky p-1">
                <AuthTab active={authMode === "sign_in"} onClick={() => setAuthMode("sign_in")}>
                  Sign in
                </AuthTab>
                <AuthTab active={authMode === "sign_up"} onClick={() => setAuthMode("sign_up")}>
                  Create account
                </AuthTab>
              </div>
              <div className="mt-6">
                <Eyebrow>{authMode === "forgot" ? "Password help" : "Customer account"}</Eyebrow>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-navy">
                  {authMode === "sign_up"
                    ? "Join the pilot"
                    : authMode === "forgot"
                      ? "Reset your password"
                      : "Welcome back"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {authMode === "sign_up"
                    ? "Create an account to save private demonstration requests."
                    : authMode === "forgot"
                      ? "We will send a reset link if that email has an account."
                      : "Sign in to view your saved pilot requests."}
                </p>
              </div>
              <form onSubmit={(event) => void handleAuthSubmit(event)} className="mt-6 space-y-4">
                <label className="block text-sm font-semibold">
                  Email address
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className={focusField}
                    placeholder="you@example.com"
                  />
                </label>
                {authMode !== "forgot" && (
                  <label className="block text-sm font-semibold">
                    Password
                    <input
                      required
                      minLength={10}
                      type="password"
                      autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      className={focusField}
                      placeholder="At least 10 characters"
                    />
                  </label>
                )}
                {authMode === "sign_up" && (
                  <label className="block text-sm font-semibold">
                    Confirm password
                    <input
                      required
                      minLength={10}
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={focusField}
                    />
                  </label>
                )}
                <button disabled={authBusy} className="primary-button w-full">
                  {authBusy ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <>
                      {authMode === "sign_up"
                        ? "Create pilot account"
                        : authMode === "forgot"
                          ? "Send reset link"
                          : "Sign in"}
                      <ArrowRight size={17} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
              {authMode !== "forgot" ? (
                <button
                  type="button"
                  onClick={() => setAuthMode("forgot")}
                  className="mt-4 min-h-10 text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
                >
                  Forgot your password?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode("sign_in")}
                  className="mt-4 min-h-10 text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
                >
                  Back to sign in
                </button>
              )}
              <p className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                This pilot is limited to East London. Account creation does not make a real booking
                or contact a service provider.
              </p>
            </section>
          </div>
        ) : accountLoading ? (
          <LoadingPanel label="Loading your private pilot account…" />
        ) : accountLoadFailed ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-border bg-white p-7 text-center shadow-sm">
            <h1 className="text-2xl font-extrabold text-brand-navy">Your account could not load</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your requests have not been changed. Try loading the account again.
            </p>
            <button
              type="button"
              onClick={() => setRefreshTick((value) => value + 1)}
              className="primary-button mt-5"
            >
              Try again
            </button>
          </section>
        ) : !hasConsent ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-9">
            <Eyebrow>One last step</Eyebrow>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-navy">
              Set up your pilot profile
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add a name and, if you want, a South African contact number for your account.
            </p>
            <form onSubmit={(event) => void handleConsentSubmit(event)} className="mt-7 space-y-5">
              <label className="block text-sm font-semibold">
                Name
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className={focusField}
                />
              </label>
              <label className="block text-sm font-semibold">
                Phone number <span className="font-normal text-muted-foreground">(optional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  className={focusField}
                  placeholder="082 123 4567"
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  South African numbers only. It is not shared with providers in this pilot.
                </span>
              </label>
              <div className="rounded-2xl border border-border bg-brand-cream p-4 text-sm leading-6 text-muted-foreground">
                <p className="font-bold text-brand-navy">Pilot privacy notice</p>
                <p className="mt-1">
                  Your name, optional phone number, and request details are stored so you can use
                  this pilot account. Demonstration requests are not sent to providers. Do not enter
                  a street address or sensitive personal information.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
                <input
                  required
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  className="mt-1 size-4 accent-brand-navy"
                />
                <span>I have read and accept this pilot privacy notice.</span>
              </label>
              <button disabled={consentBusy} className="primary-button w-full sm:w-auto">
                {consentBusy ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <>
                    Save profile and continue
                    <ArrowRight size={17} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </section>
        ) : isReady ? (
          <div className="space-y-7">
            <section className="flex flex-col justify-between gap-5 rounded-3xl bg-brand-navy p-6 text-white shadow-lg sm:flex-row sm:items-end sm:p-9">
              <div>
                <Eyebrow light>Private East London pilot</Eyebrow>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {profile?.display_name ? "Hello, " + profile.display_name : "Your pilot workspace"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                  Save and review demonstration requests for plumbing, electrical, or motor mechanic
                  services. They are not sent to providers.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
                <ShieldCheck size={16} aria-hidden="true" />
                Private demo mode
              </span>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Eyebrow>New request</Eyebrow>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-navy">
                      Describe what needs attention
                    </h2>
                  </div>
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-gold/20 text-brand-navy">
                    <Plus size={21} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Keep it simple. Add an area or suburb only; do not include a street address.
                </p>

                <form onSubmit={(event) => void handleRequestSubmit(event)} className="mt-6 space-y-4">
                  <label className="block text-sm font-semibold">
                    Service type
                    <select
                      value={draft.category}
                      onChange={(event) =>
                        setDraft({ ...draft, category: event.target.value as ServiceCategory })
                      }
                      className={focusField}
                      aria-invalid={Boolean(draftErrors.category)}
                    >
                      {SERVICE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    {draftErrors.category && <FieldError>{draftErrors.category}</FieldError>}
                  </label>

                  <label className="block text-sm font-semibold">
                    Short title
                    <input
                      required
                      minLength={5}
                      maxLength={120}
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      className={focusField}
                      placeholder="For example, leaking kitchen tap"
                      aria-invalid={Boolean(draftErrors.title)}
                    />
                    {draftErrors.title && <FieldError>{draftErrors.title}</FieldError>}
                  </label>

                  <label className="block text-sm font-semibold">
                    What is the issue?
                    <textarea
                      required
                      minLength={20}
                      maxLength={2000}
                      rows={4}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      className={focusField + " resize-y"}
                      placeholder="Tell us what happened and any useful details."
                      aria-invalid={Boolean(draftErrors.description)}
                    />
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {draft.description.length}/2,000 characters. Do not include sensitive details.
                    </span>
                    {draftErrors.description && <FieldError>{draftErrors.description}</FieldError>}
                  </label>

                  <label className="block text-sm font-semibold">
                    Area or suburb
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={draft.area}
                      onChange={(event) => setDraft({ ...draft, area: event.target.value })}
                      className={focusField}
                      placeholder="For example, Southernwood"
                      aria-invalid={Boolean(draftErrors.area)}
                    />
                    {draftErrors.area && <FieldError>{draftErrors.area}</FieldError>}
                  </label>

                  <label className="block text-sm font-semibold">
                    When do you need help?
                    <select
                      value={draft.timing}
                      onChange={(event) => setDraft({ ...draft, timing: event.target.value })}
                      className={focusField}
                      aria-invalid={Boolean(draftErrors.timing)}
                    >
                      <option value="flexible">Flexible</option>
                      <option value="this_week">This week</option>
                      <option value="as_soon_as_possible">As soon as possible</option>
                    </select>
                    {draftErrors.timing && <FieldError>{draftErrors.timing}</FieldError>}
                  </label>

                  <div className="rounded-xl bg-brand-sky px-4 py-3 text-xs leading-5 text-brand-navy">
                    This is a demonstration request. It stays private, is not sent to a provider, and
                    does not create a booking or fee.
                  </div>
                  <button disabled={requestBusy} className="primary-button w-full">
                    {requestBusy ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <>
                        Save demonstration request
                        <ArrowRight size={17} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </section>

              <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Eyebrow>Your activity</Eyebrow>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-navy">
                      Saved requests
                    </h2>
                  </div>
                  <span className="rounded-full bg-brand-sky px-3 py-1.5 text-xs font-bold text-brand-navy">
                    {requests.length} {requests.length === 1 ? "request" : "requests"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Only you can see these requests in the pilot. They are not visible to providers.
                </p>

                {requests.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-border bg-brand-cream px-5 py-9 text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-brand-navy shadow-sm">
                      <Wrench size={21} aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-bold text-brand-navy">Nothing saved yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                      Your saved demonstration requests will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-6 space-y-3">
                    {requests.map((request) => (
                      <li
                        key={request.id}
                        className="rounded-2xl border border-border bg-white p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-brand-sky px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-brand-navy">
                                {categoryLabel(request.category)}
                              </span>
                              {request.is_demo && (
                                <span className="rounded-full bg-brand-gold/20 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-brand-navy">
                                  Demo only
                                </span>
                              )}
                            </div>
                            <h3 className="mt-3 break-words text-lg font-bold text-brand-navy">
                              {request.title}
                            </h3>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                              {request.description}
                            </p>
                          </div>
                          <span
                            className={
                              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold " +
                              (request.status === "cancelled"
                                ? "bg-muted text-muted-foreground"
                                : "bg-emerald-50 text-emerald-900")
                            }
                          >
                            {statusLabel(request.status)}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} aria-hidden="true" />
                            {request.area}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 size={14} aria-hidden="true" />
                            {timingLabel(request.timing)}
                          </span>
                          <span>{formatPilotDate(request.created_at)}</span>
                        </div>
                        {request.is_demo && request.status === "submitted" && (
                          <button
                            type="button"
                            onClick={() => void handleCancelRequest(request.id)}
                            className="mt-4 min-h-10 rounded-lg px-2 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-brand-navy"
                          >
                            Cancel saved request
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : (
          <LoadingPanel label="Finishing account setup…" />
        )}
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Service-Requesta · East London, Buffalo City</span>
          <span>Controlled pilot. No public bookings, provider dispatch, or payments.</span>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={
        "text-xs font-extrabold uppercase tracking-[0.16em] " +
        (light ? "text-brand-gold" : "text-brand-navy")
      }
    >
      {children}
    </p>
  );
}

function AuthTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "min-h-11 flex-1 rounded-lg px-3 text-sm font-bold transition " +
        (active
          ? "bg-white text-brand-navy shadow-sm"
          : "text-muted-foreground hover:text-brand-navy")
      }
    >
      {children}
    </button>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs font-medium text-destructive">{children}</span>;
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-3xl border border-border bg-white p-8 text-sm font-semibold text-brand-navy shadow-sm">
      <LoaderCircle className="mr-3 animate-spin" size={20} aria-hidden="true" />
      {label}
    </div>
  );
}
