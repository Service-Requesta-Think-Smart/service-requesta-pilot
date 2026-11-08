import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { supabase } from "../../integrations/supabase/client";
import type { Tables } from "../../integrations/supabase/types";
import { friendlyError, SERVICE_CATEGORIES } from "../../lib/service-requesta";
import { MarketplaceWorkspace } from "./marketplace-workspace";

type ProviderApplication = Pick<
  Tables<"provider_profiles">["Row"],
  | "user_id"
  | "business_name"
  | "contact_email"
  | "category"
  | "area"
  | "availability"
  | "qualification_summary"
  | "application_status"
  | "identity_status"
  | "trade_status"
  | "submitted_at"
  | "review_note"
  | "reviewed_at"
>;

type AdminProfile = Pick<Tables<"profiles">["Row"], "display_name" | "phone">;

type ProviderForm = {
  businessName: string;
  category: string;
  area: string;
  availability: string;
  qualificationSummary: string;
};

type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type ReviewDraft = {
  identityStatus: string;
  tradeStatus: string;
  note: string;
};

const emptyProviderForm: ProviderForm = {
  businessName: "",
  category: "plumbing",
  area: "",
  availability: "",
  qualificationSummary: "",
};

const focusField =
  "mt-1 w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus:border-brand-navy focus:outline-none";

export function ProviderWorkspace({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const [application, setApplication] = useState<ProviderApplication | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyProviderForm);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);

    void supabase
      .from("provider_profiles")
      .select(
        "user_id,business_name,contact_email,category,area,availability,qualification_summary,application_status,identity_status,trade_status,submitted_at,review_note,reviewed_at",
      )
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLoadFailed(true);
          setNotice({
            kind: "error",
            text: "We could not load your provider application. Please try again.",
          });
          return;
        }

        const nextApplication = data as ProviderApplication | null;
        setApplication(nextApplication);
        if (nextApplication?.application_status === "rejected") {
          setForm({
            businessName: nextApplication.business_name,
            category: nextApplication.category,
            area: nextApplication.area,
            availability: nextApplication.availability,
            qualificationSummary: nextApplication.qualification_summary,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setNotice({
          kind: "error",
          text: "We could not load your provider application. Please try again.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, refreshTick]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const businessName = form.businessName.trim();
    const area = form.area.trim();
    const availability = form.availability.trim();
    const qualificationSummary = form.qualificationSummary.trim();

    if (businessName.length < 2 || businessName.length > 120) {
      setNotice({ kind: "error", text: "Enter a business or trading name from 2 to 120 characters." });
      return;
    }
    if (area.length < 2 || area.length > 100) {
      setNotice({ kind: "error", text: "Enter one East London suburb or service area." });
      return;
    }
    if (availability.length < 2 || availability.length > 500) {
      setNotice({ kind: "error", text: "Describe your availability in 2 to 500 characters." });
      return;
    }
    if (qualificationSummary.length < 10 || qualificationSummary.length > 1200) {
      setNotice({
        kind: "error",
        text: "Describe relevant training, qualifications, or experience in 10 to 1,200 characters.",
      });
      return;
    }
    if (!privacyAccepted) {
      setNotice({
        kind: "error",
        text: "Read and accept the provider application privacy notice before submitting.",
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.rpc("submit_provider_application", {
        p_business_name: businessName,
        p_category: form.category,
        p_area: area,
        p_availability: availability,
        p_qualification_summary: qualificationSummary,
        p_accept_privacy: true,
      });
      if (error) throw error;

      setPrivacyAccepted(false);
      setNotice({
        kind: "success",
        text: "Your provider application was submitted for review.",
      });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  }

  const legacyApplicationNeedsDetails =
    application?.application_status === "pending_review" &&
    (!application.business_name.trim() ||
      !application.availability.trim() ||
      application.qualification_summary.trim().length < 10);
  const canApply =
    !application ||
    application.application_status === "rejected" ||
    legacyApplicationNeedsDetails;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            "rounded-2xl border px-4 py-3 text-sm font-medium " +
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

      {loading ? (
        <LoadingPanel label="Loading your provider application…" />
      ) : loadFailed ? (
        <section className="rounded-3xl border border-border bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-brand-navy">Your application could not load</h1>
          <button
            type="button"
            onClick={() => setRefreshTick((value) => value + 1)}
            className="primary-button mt-5"
          >
            Try again
          </button>
        </section>
      ) : canApply ? (
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">
            {application && !legacyApplicationNeedsDetails ? "Update your application" : "Provider application"}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-navy">
            {displayName ? "Welcome, " + displayName : "Join as a local service provider"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Apply to offer plumbing, electrical, or motor mechanic services in East London. A
            Service-Requesta reviewer must record separate identity/contact and trade-evidence checks
            before approving the application.
          </p>

          {application?.review_note && (
            <div className="mt-5 rounded-2xl border border-brand-gold/50 bg-brand-gold/15 p-4 text-sm leading-6 text-brand-navy">
              <strong>Review note:</strong> {application.review_note}
            </div>
          )}

          <form onSubmit={(event) => void submitApplication(event)} className="mt-7 space-y-4">
            <label className="block text-sm font-semibold">
              Business or trading name
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.businessName}
                onChange={(event) => setForm({ ...form, businessName: event.target.value })}
                className={focusField}
                autoComplete="organization"
              />
            </label>

            <label className="block text-sm font-semibold">
              Main service category
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={focusField}
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold">
              Service area
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.area}
                onChange={(event) => setForm({ ...form, area: event.target.value })}
                className={focusField}
                placeholder="For example, Southernwood"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Enter one suburb or local area only. Do not enter a street address.
              </span>
            </label>

            <label className="block text-sm font-semibold">
              Availability
              <textarea
                required
                minLength={2}
                maxLength={500}
                rows={3}
                value={form.availability}
                onChange={(event) => setForm({ ...form, availability: event.target.value })}
                className={focusField + " resize-y"}
                placeholder="For example, weekdays after 16:00 and Saturday mornings"
              />
            </label>

            <label className="block text-sm font-semibold">
              Relevant training, qualifications, or experience
              <textarea
                required
                minLength={10}
                maxLength={1200}
                rows={4}
                value={form.qualificationSummary}
                onChange={(event) =>
                  setForm({ ...form, qualificationSummary: event.target.value })
                }
                className={focusField + " resize-y"}
                placeholder="Describe your relevant background accurately"
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                This is self-reported. Do not include an ID number or upload private documents.
                Required licences will be checked separately where applicable.
              </span>
            </label>

            <div className="rounded-2xl border border-border bg-brand-cream p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-bold text-brand-navy">Provider application privacy notice</p>
              <p className="mt-1">
                Your application details and account contact information are used to review your
                application and contact you about its outcome. This demo does not collect identity
                documents. Identity/contact checks do not prove trade competence.
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
              <span>I have read and accept the provider application privacy notice.</span>
            </label>

            <button disabled={busy} className="primary-button w-full sm:w-auto">
              {busy ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : application && !legacyApplicationNeedsDetails ? (
                "Resubmit for review"
              ) : (
                "Submit provider application"
              )}
            </button>
          </form>
        </section>
      ) : application.application_status === "approved" ? (
        <MarketplaceWorkspace userId={userId} role="provider" displayName={displayName} />
      ) : (
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-sky text-brand-navy">
              <ShieldCheck size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">
                Provider application
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-navy">
                {application.application_status === "approved"
                  ? "Your application is approved"
                  : "Your application is under review"}
              </h1>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 rounded-2xl bg-brand-cream p-5 text-sm sm:grid-cols-2">
            <Detail label="Business" value={application.business_name} />
            <Detail
              label="Service category"
              value={
                SERVICE_CATEGORIES.find((category) => category.value === application.category)
                  ?.label ?? application.category
              }
            />
            <Detail label="Service area" value={application.area} />
            <Detail label="Contact email" value={application.contact_email} />
            <Detail label="Availability" value={application.availability} />
            <Detail label="Identity/contact check" value={statusLabel(application.identity_status)} />
            <Detail label="Trade-evidence review" value={statusLabel(application.trade_status)} />
            <Detail label="Submitted" value={dateLabel(application.submitted_at)} />
            {application.reviewed_at && (
              <Detail label="Reviewed" value={dateLabel(application.reviewed_at)} />
            )}
          </dl>

          {application.application_status === "pending_review" ? (
            <p className="mt-5 rounded-2xl border border-brand-gold/50 bg-brand-gold/15 p-4 text-sm leading-6 text-brand-navy">
              We will show the result here after an authorised reviewer completes the checks. You
              cannot receive requests while the application is pending.
            </p>
          ) : (
            <p className="mt-5 rounded-2xl border border-brand-navy/15 bg-brand-sky p-4 text-sm leading-6 text-brand-navy">
              Your checks are recorded separately. Identity review does not certify professional
              skill. Provider requests remain disabled in this private demo; no customer request is
              sent to you and no fee is created.
            </p>
          )}
          {application.review_note && (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <strong className="text-brand-navy">Reviewer note:</strong> {application.review_note}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function AdminProviderReviewConsole() {
  const [applications, setApplications] = useState<ProviderApplication[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, AdminProfile>>({});
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);

    async function loadQueue() {
      const { data, error } = await supabase
        .from("provider_profiles")
        .select(
          "user_id,business_name,contact_email,category,area,availability,qualification_summary,application_status,identity_status,trade_status,submitted_at,review_note,reviewed_at",
        )
        .eq("application_status", "pending_review")
        .order("submitted_at", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as ProviderApplication[];
      let nextProfiles: Record<string, AdminProfile> = {};

      if (rows.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id,display_name,phone")
          .in("id", rows.map((row) => row.user_id));
        if (profileError) throw profileError;
        nextProfiles = Object.fromEntries(
          (profiles ?? []).map((profile) => [
            profile.id,
            { display_name: profile.display_name, phone: profile.phone },
          ]),
        );
      }

      if (!active) return;
      setApplications(rows);
      setProfilesById(nextProfiles);
      setDrafts((previous) => {
        const next = { ...previous };
        for (const row of rows) {
          next[row.user_id] ??= {
            identityStatus: row.identity_status,
            tradeStatus: row.trade_status,
            note: "",
          };
        }
        return next;
      });
    }

    void loadQueue()
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setNotice({
          kind: "error",
          text: "The provider review queue could not load. Check the authorised admin account and try again.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshTick]);

  function updateDraft(userId: string, patch: Partial<ReviewDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [userId]: {
        ...(previous[userId] ?? { identityStatus: "not_checked", tradeStatus: "not_checked", note: "" }),
        ...patch,
      },
    }));
  }

  async function reviewApplication(
    application: ProviderApplication,
    decision: "approved" | "rejected",
  ) {
    const draft = drafts[application.user_id];
    if (!draft || draft.note.trim().length < 3) {
      setNotice({ kind: "error", text: "Add a short review note before recording a decision." });
      return;
    }
    if (
      decision === "approved" &&
      (draft.identityStatus !== "checked" || draft.tradeStatus !== "reviewed")
    ) {
      setNotice({
        kind: "error",
        text: "Record both the identity/contact check and trade-evidence review before approval.",
      });
      return;
    }

    setBusyId(application.user_id);
    setNotice(null);
    try {
      const { error } = await supabase.rpc("review_provider_application", {
        p_provider_id: application.user_id,
        p_decision: decision,
        p_identity_status: draft.identityStatus,
        p_trade_status: draft.tradeStatus,
        p_note: draft.note.trim(),
      });
      if (error) throw error;
      setNotice({
        kind: "success",
        text: decision === "approved" ? "Provider application approved." : "Application decision recorded.",
      });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-3xl bg-brand-navy p-6 text-white shadow-lg sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-gold">
          Service-Requesta · Think Smart
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Provider application review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
          Review identity/contact checks separately from trade evidence. Check qualifications or
          licences where required for the work. Do not treat an identity check as a skill certificate.
        </p>
      </section>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            "rounded-2xl border px-4 py-3 text-sm font-medium " +
            (notice.kind === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-emerald-700/20 bg-emerald-50 text-emerald-900")
          }
        >
          {notice.text}
        </div>
      )}

      <div className="rounded-2xl border border-brand-gold/50 bg-brand-gold/15 p-4 text-sm leading-6 text-brand-navy">
        This demo does not store identity documents. Use only an approved private check process and
        record the check result and a minimal note here. Do not put ID numbers or sensitive evidence
        into the review note.
      </div>

      {loading ? (
        <LoadingPanel label="Loading provider applications…" />
      ) : loadFailed ? (
        <section className="rounded-3xl border border-border bg-white p-7 text-center shadow-sm">
          <h2 className="text-xl font-extrabold text-brand-navy">Review queue unavailable</h2>
          <button
            type="button"
            onClick={() => setRefreshTick((value) => value + 1)}
            className="primary-button mt-5"
          >
            Try again
          </button>
        </section>
      ) : applications.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-white px-5 py-10 text-center">
          <h2 className="font-bold text-brand-navy">No applications waiting</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New provider applications will appear here for authorised review.
          </p>
        </section>
      ) : (
        <ul className="space-y-5">
          {applications.map((application) => {
            const draft = drafts[application.user_id] ?? {
              identityStatus: application.identity_status,
              tradeStatus: application.trade_status,
              note: "",
            };
            const busy = busyId === application.user_id;
            return (
              <li
                key={application.user_id}
                className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">
                      {application.business_name}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold text-brand-navy">
                      {profilesById[application.user_id]?.display_name || "Provider applicant"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{application.contact_email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profilesById[application.user_id]?.phone || "No phone number provided"}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-gold/20 px-3 py-1.5 text-xs font-bold text-brand-navy">
                    Submitted {dateLabel(application.submitted_at)}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 rounded-2xl bg-brand-cream p-4 text-sm sm:grid-cols-2">
                  <Detail
                    label="Service category"
                    value={
                      SERVICE_CATEGORIES.find((category) => category.value === application.category)
                        ?.label ?? application.category
                    }
                  />
                  <Detail label="Service area" value={application.area} />
                  <Detail label="Availability" value={application.availability} />
                  <Detail label="Experience / evidence summary" value={application.qualification_summary} />
                </dl>

                <form
                  onSubmit={(event) => { event.preventDefault(); void reviewApplication(application, "approved"); }}
                  className="mt-6 grid gap-4 sm:grid-cols-2"
                >
                  <label className="block text-sm font-semibold">
                    Identity/contact check
                    <select
                      value={draft.identityStatus}
                      onChange={(event) =>
                        updateDraft(application.user_id, { identityStatus: event.target.value })
                      }
                      className={focusField}
                    >
                      <option value="not_checked">Not checked</option>
                      <option value="pending">Pending</option>
                      <option value="checked">Checked</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">
                    Trade-evidence review
                    <select
                      value={draft.tradeStatus}
                      onChange={(event) =>
                        updateDraft(application.user_id, { tradeStatus: event.target.value })
                      }
                      className={focusField}
                    >
                      <option value="not_checked">Not checked</option>
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold sm:col-span-2">
                    Reviewer note
                    <textarea
                      required
                      minLength={3}
                      maxLength={1000}
                      rows={3}
                      value={draft.note}
                      onChange={(event) => updateDraft(application.user_id, { note: event.target.value })}
                      className={focusField + " resize-y"}
                      placeholder="Record the decision basis without sensitive ID details"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={
                        busy ||
                        draft.identityStatus !== "checked" ||
                        draft.tradeStatus !== "reviewed" ||
                        draft.note.trim().length < 3
                      }
                      className="primary-button"
                    >
                      {busy ? <LoaderCircle className="animate-spin" size={18} /> : "Approve application"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || draft.note.trim().length < 3}
                      onClick={() => void reviewApplication(application, "rejected")}
                      className="min-h-11 rounded-xl border border-border bg-white px-4 text-sm font-bold text-brand-navy hover:bg-brand-sky disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject application
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium text-brand-navy">{value || "Not provided"}</dd>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-3xl border border-border bg-white p-8 text-sm font-semibold text-brand-navy shadow-sm">
      <LoaderCircle className="mr-3 animate-spin" size={20} aria-hidden="true" />
      {label}
    </div>
  );
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}
