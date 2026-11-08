import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Clock3, LoaderCircle, MapPin, ShieldCheck, Wrench } from "lucide-react";

import { supabase } from "../../integrations/supabase/client";
import type { Database, Tables } from "../../integrations/supabase/types";
import {
  categoryLabel,
  createIdempotencyKey,
  formatPilotDate,
  friendlyError,
  normalizeSouthAfricanPhone,
  parseZarToCents,
  formatZarCents,
  SERVICE_CATEGORIES,
  statusLabel,
  timingLabel,
  type ServiceCategory,
  type RequestTiming,
} from "../../lib/service-requesta";

type Role = "customer" | "provider";
type RequestRow = Pick<
  Tables<"service_requests">["Row"],
  "id" | "customer_id" | "category" | "title" | "description" | "area" | "timing" | "status" | "is_demo" | "created_at"
>;
type QuoteRow = Pick<
  Tables<"quotes">["Row"],
  "id" | "request_id" | "provider_id" | "scope" | "labour_cents" | "callout_cents" | "parts_cents" | "total_cents" | "assumptions" | "timing" | "created_at"
>;
type ApprovedRow = Pick<Tables<"approved_quotes">["Row"], "request_id" | "quote_id" | "snapshot">;
type ConfirmationRow = Pick<Tables<"completion_confirmations">["Row"], "request_id" | "user_id">;
type LedgerRow = Pick<Tables<"commission_ledger">["Row"], "id" | "request_id" | "base_cents" | "fee_cents" | "created_at">;
type FeeNoticeRow = Pick<Tables<"fee_notices">["Row"], "id" | "ledger_id" | "notice_at" | "due_at" | "disputed" | "final_notice_at">;
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type Contact = { service_address: string; contact_phone: string };

type RequestDraft = {
  category: ServiceCategory;
  title: string;
  description: string;
  area: string;
  timing: RequestTiming;
  serviceAddress: string;
  phone: string;
};

type QuoteDraft = {
  scope: string;
  labour: string;
  callout: string;
  parts: string;
  assumptions: string;
  timing: string;
};

const emptyDraft: RequestDraft = {
  category: "plumbing",
  title: "",
  description: "",
  area: "",
  timing: "flexible",
  serviceAddress: "",
  phone: "",
};

const focusField =
  "mt-1 w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus:border-brand-navy focus:outline-none";

export function MarketplaceWorkspace({
  userId,
  role,
  displayName,
}: {
  userId: string;
  role: Role;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedRow[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [feeNotices, setFeeNotices] = useState<FeeNoticeRow[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteDraft>>({});
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [disputeDrafts, setDisputeDrafts] = useState<Record<string, string>>({});
  const [disputeKinds, setDisputeKinds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const statusResult = await supabase.rpc("marketplace_is_open");
        if (active) setOpen(!statusResult.error && statusResult.data === true);

        const [requestResult, quoteResult, approvalResult, confirmationResult, ledgerResult, feeResult] = await Promise.all([
          supabase
            .from("service_requests")
            .select("id,customer_id,category,title,description,area,timing,status,is_demo,created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id,request_id,provider_id,scope,labour_cents,callout_cents,parts_cents,total_cents,assumptions,timing,created_at")
            .order("created_at", { ascending: false }),
          supabase.from("approved_quotes").select("request_id,quote_id,snapshot"),
          supabase
            .from("completion_confirmations")
            .select("request_id,user_id")
            .eq("user_id", userId),
          supabase.from("commission_ledger").select("id,request_id,base_cents,fee_cents,created_at"),
          supabase.from("fee_notices").select("id,ledger_id,notice_at,due_at,disputed,final_notice_at"),
        ]);
        if (requestResult.error || quoteResult.error || approvalResult.error || confirmationResult.error) {
          throw new Error("Marketplace records could not be loaded");
        }
        if (!active) return;
        setRequests((requestResult.data ?? []) as RequestRow[]);
        setQuotes((quoteResult.data ?? []) as QuoteRow[]);
        setApprovedQuotes((approvalResult.data ?? []) as ApprovedRow[]);
        setConfirmations((confirmationResult.data ?? []) as ConfirmationRow[]);
        if (role === "provider" && (ledgerResult.error || feeResult.error)) throw new Error("Commission notices could not be loaded");
        if (role === "provider") {
          setLedger((ledgerResult.data ?? []) as LedgerRow[]);
          setFeeNotices((feeResult.data ?? []) as FeeNoticeRow[]);
        }
      } catch {
        if (!active) return;
        setNotice({ kind: "error", text: "We could not load your marketplace activity. Please try again." });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, refreshTick]);

  const quotesByRequest = useMemo(() => {
    const map = new Map<string, QuoteRow[]>();
    for (const quote of quotes) {
      const current = map.get(quote.request_id) ?? [];
      current.push(quote);
      map.set(quote.request_id, current);
    }
    return map;
  }, [quotes]);

  const approvedByRequest = useMemo(
    () => new Map(approvedQuotes.map((item) => [item.request_id, item])),
    [approvedQuotes],
  );
  const confirmedIds = useMemo(
    () => new Set(confirmations.map((item) => item.request_id)),
    [confirmations],
  );

  async function refresh() {
    setRefreshTick((value) => value + 1);
  }

  async function perform(requestId: string, action: () => Promise<{ error: { message: string } | null }>, success: string) {
    setBusyId(requestId);
    setNotice(null);
    try {
      const result = await action();
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: success });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const description = draft.description.trim();
    const area = draft.area.trim();
    if (title.length < 5 || title.length > 120 || description.length < 20 || description.length > 2000 || area.length < 2 || area.length > 100) {
      setNotice({ kind: "error", text: "Check the title, description, and local area before submitting." });
      return;
    }
    const key = idempotencyKey.current ?? createIdempotencyKey();
    idempotencyKey.current = key;
    setBusyId("new-request");
    setNotice(null);
    try {
      if (open) {
        const phone = normalizeSouthAfricanPhone(draft.phone);
        if (!privacyAccepted || draft.serviceAddress.trim().length < 8 || draft.serviceAddress.trim().length > 300 || !phone) {
          throw new Error("Separate consent, a service address, and a valid South African contact number are required.");
        }
        const { error } = await supabase.rpc("marketplace_create_request", {
          p_category: draft.category,
          p_title: title,
          p_description: description,
          p_area: area,
          p_timing: draft.timing,
          p_service_address: draft.serviceAddress.trim(),
          p_contact_phone: phone,
          p_share_private_details: true,
          p_key: key,
        });
        if (error) throw error;
        setNotice({ kind: "success", text: "Your request was submitted. Providers see the suburb and job details; your address and phone are shared only after you approve a quote." });
        setPrivacyAccepted(false);
      } else {
        const { error } = await supabase.rpc("create_service_request", {
          p_category: draft.category,
          p_title: title,
          p_description: description,
          p_area: area,
          p_timing: draft.timing,
          p_key: key,
        });
        if (error) throw error;
        setNotice({ kind: "success", text: "Your demonstration request was saved privately. It was not sent to a provider." });
      }
      idempotencyKey.current = null;
      setDraft(emptyDraft);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setBusyId(null);
    }
  }

  function submitQuote(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const value = quoteDrafts[requestId] ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" };
    const labour = parseZarToCents(value.labour);
    const callout = parseZarToCents(value.callout);
    const parts = parseZarToCents(value.parts);
    if (value.scope.trim().length < 20 || !value.assumptions.trim() || !value.timing.trim() || labour === null || callout === null || parts === null) {
      setNotice({ kind: "error", text: "Add a clear scope, assumptions, timing, and valid Rand amounts with up to two decimal places." });
      return;
    }
    void perform(
      requestId,
      () => supabase.rpc("marketplace_submit_quote", {
        p_request_id: requestId,
        p_scope: value.scope.trim(),
        p_labour_cents: labour,
        p_callout_cents: callout,
        p_parts_cents: parts,
        p_assumptions: value.assumptions.trim(),
        p_timing: value.timing.trim(),
      }),
      "The written quote was submitted.",
    );
  }

  function confirmWork(request: RequestRow, approved: ApprovedRow) {
    const quote = quotes.find((item) => item.id === approved.quote_id);
    if (!quote || quote.total_cents === null) {
      setNotice({ kind: "error", text: "The approved quote total could not be loaded. Refresh and try again." });
      return;
    }
    void perform(
      request.id,
      () => supabase.rpc("marketplace_confirm_completion", {
        p_request_id: request.id,
        p_final_amount_cents: quote.total_cents ?? -1,
        p_payment_method: "cash",
      }),
      confirmedIds.has(request.id) ? "Your completion confirmation was updated." : "Your completion was recorded. The other party must confirm too.",
    );
  }

  async function showContact(requestId: string) {
    setBusyId(requestId);
    setNotice(null);
    try {
      const { data, error } = await supabase.rpc("marketplace_get_provider_contact", { p_request_id: requestId });
      if (error) throw error;
      const value = Array.isArray(data) ? data[0] : data;
      if (!value) throw new Error("The approved customer contact is unavailable.");
      setContacts((current) => ({ ...current, [requestId]: value as Contact }));
    } catch (error) {
      setNotice({ kind: "error", text: friendlyError(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function cancelRequest(request: RequestRow) {
    if (request.is_demo) {
      await perform(request.id, () => supabase.rpc("cancel_service_request", { p_id: request.id }), "The demonstration request was cancelled.");
    } else {
      await perform(request.id, () => supabase.rpc("marketplace_cancel_request", { p_request_id: request.id }), "The request was cancelled.");
    }
  }

  function openDispute(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const description = disputeDrafts[requestId]?.trim() ?? "";
    if (description.length < 20 || description.length > 3000) {
      setNotice({ kind: "error", text: "Describe the issue in 20 to 3,000 characters." });
      return;
    }
    void perform(
      requestId,
      () => supabase.rpc("marketplace_open_dispute", { p_request_id: requestId, p_kind: disputeKinds[requestId] ?? "completion", p_description: description }),
      "Your support case was recorded. The job is paused for review.",
    );
  }

  if (loading) return <LoadingPanel label="Loading your marketplace workspace…" />;

  const visibleRequests = role === "customer"
    ? requests.filter((request) => request.customer_id === userId)
    : requests;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {notice && (
        <div role={notice.kind === "error" ? "alert" : "status"} aria-live="polite"
          className={"rounded-2xl border px-4 py-3 text-sm font-medium " +
            (notice.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" :
              notice.kind === "success" ? "border-emerald-700/20 bg-emerald-50 text-emerald-900" : "border-brand-navy/15 bg-brand-sky text-brand-navy")}>
          {notice.text}
        </div>
      )}

      <section className="flex flex-col justify-between gap-5 rounded-3xl bg-brand-navy p-6 text-white shadow-lg sm:flex-row sm:items-end sm:p-9">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-gold">Service-Requesta · Think Smart</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {role === "provider" ? "Provider workspace" : displayName ? "Hello, " + displayName : "Your service workspace"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            {open
              ? "Requests, provider decisions, written quotes, agreed work, completion, and support are recorded in one place."
              : "The marketplace is closed for public bookings. Private demonstration requests remain available to customers."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
          <ShieldCheck size={16} aria-hidden="true" />
          {open ? "Marketplace launch gates open" : "Controlled pilot · no live dispatch"}
        </span>
      </section>

      {role === "customer" && (
        <div className="grid items-start gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">{open ? "New service request" : "Private demo"}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-navy">{open ? "Describe the work" : "Save a demonstration request"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {open ? "You approve the scope and total before work starts. Providers do not see the exact address or phone until a quote is approved." : "This record stays in your account. It will not be sent to a provider or create a fee."}
            </p>
            <form onSubmit={(event) => void submitRequest(event)} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">Service type
                <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ServiceCategory })} className={focusField}>
                  {SERVICE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Short title
                <input required minLength={5} maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={focusField} placeholder="For example, leaking kitchen tap" />
              </label>
              <label className="block text-sm font-semibold">What is the issue?
                <textarea required minLength={20} maxLength={2000} rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={focusField + " resize-y"} />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Do not include a street address or phone here. If live requests are enabled, enter contact details in the separate fields below.</span>
              </label>
              <label className="block text-sm font-semibold">Area or suburb
                <input required minLength={2} maxLength={100} value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} className={focusField} placeholder="For example, Southernwood" />
              </label>
              <label className="block text-sm font-semibold">When do you need help?
                <select value={draft.timing} onChange={(event) => setDraft({ ...draft, timing: event.target.value as RequestTiming })} className={focusField}>
                  <option value="flexible">Flexible</option><option value="this_week">This week</option><option value="as_soon_as_possible">As soon as possible</option>
                </select>
              </label>
              {open && (
                <>
                  <label className="block text-sm font-semibold">Service address
                    <input required minLength={8} maxLength={300} autoComplete="street-address" value={draft.serviceAddress} onChange={(event) => setDraft({ ...draft, serviceAddress: event.target.value })} className={focusField} />
                  </label>
                  <label className="block text-sm font-semibold">Contact phone
                    <input required type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className={focusField} placeholder="082 123 4567" />
                  </label>
                  <div className="rounded-xl bg-brand-sky px-4 py-3 text-xs leading-5 text-brand-navy">
                    Your exact address and phone are stored separately. Only the provider whose quote you approve can access them.
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
                    <input required type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-1 size-4 accent-brand-navy" />
                    <span>I agree to share my service address and phone with the selected provider after I approve a quote.</span>
                  </label>
                </>
              )}
              {!open && <div className="rounded-xl bg-brand-sky px-4 py-3 text-xs leading-5 text-brand-navy">Demo only. Do not enter a street address or sensitive information.</div>}
              <button disabled={busyId === "new-request"} className="primary-button w-full">
                {busyId === "new-request" ? <LoaderCircle className="animate-spin" size={18} /> : <>{open ? "Submit service request" : "Save demonstration request"}<ArrowRight size={17} aria-hidden="true" /></>}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">Your activity</p><h2 className="mt-2 text-2xl font-extrabold text-brand-navy">Requests and jobs</h2></div>
              <span className="rounded-full bg-brand-sky px-3 py-1.5 text-xs font-bold text-brand-navy">{visibleRequests.length} total</span>
            </div>
            <div className="mt-5 space-y-4">
              {visibleRequests.length === 0 ? <EmptyState text="Your requests will appear here." /> : visibleRequests.map((request) => (
                <RequestCard key={request.id} request={request} role={role} quotes={quotesByRequest.get(request.id) ?? []} approved={approvedByRequest.get(request.id)} currentUserId={userId} confirmed={confirmedIds.has(request.id)} busy={busyId === request.id} onCancel={() => void cancelRequest(request)} onApprove={(quoteId) => void perform(request.id, () => supabase.rpc("marketplace_approve_quote", { p_request_id: request.id, p_quote_id: quoteId }), "You approved this written quote and its scope.")} onStart={() => void perform(request.id, () => supabase.rpc("marketplace_start_work", { p_request_id: request.id }), "Work has been marked as started.")} onReady={() => void perform(request.id, () => supabase.rpc("marketplace_mark_work_ready", { p_request_id: request.id }), "Work is ready for both parties to confirm.")} onConfirm={() => { const approved = approvedByRequest.get(request.id); if (approved) confirmWork(request, approved); }} onRespond={(decision) => void perform(request.id, () => supabase.rpc("marketplace_respond_to_request", { p_request_id: request.id, p_decision: decision }), decision === "accepted" ? "You accepted the request." : "You declined the request.")} quoteDraft={quoteDrafts[request.id]} onQuoteDraft={(value) => setQuoteDrafts((current) => ({ ...current, [request.id]: value }))} onQuote={(event) => submitQuote(event, request.id)} contact={contacts[request.id]} onShowContact={() => void showContact(request.id)} disputeText={disputeDrafts[request.id] ?? ""} onDisputeText={(value) => setDisputeDrafts((current) => ({ ...current, [request.id]: value }))} disputeKind={disputeKinds[request.id] ?? "completion"} onDisputeKind={(value) => setDisputeKinds((current) => ({ ...current, [request.id]: value }))} onDispute={(event) => openDispute(event, request.id)} />
              ))}
            </div>
          </section>
        </div>
      )}

      {role === "provider" && (
        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">Matching requests and assigned work</p><h2 className="mt-2 text-2xl font-extrabold text-brand-navy">Provider jobs</h2></div>
            <span className="rounded-full bg-brand-sky px-3 py-1.5 text-xs font-bold text-brand-navy">{visibleRequests.length} visible</span>
          </div>
          {!open && <p className="mt-4 rounded-2xl border border-brand-gold/50 bg-brand-gold/15 p-4 text-sm leading-6 text-brand-navy">New requests and dispatch are closed while the launch gates are off. If you have work already assigned, its record stays available here.</p>}
          <div className="mt-5 space-y-4">
            {visibleRequests.length === 0 ? <EmptyState text={open ? "No matching requests are available right now." : "There are no assigned jobs to show."} /> : visibleRequests.map((request) => (
              <RequestCard key={request.id} request={request} role={role} quotes={quotesByRequest.get(request.id) ?? []} approved={approvedByRequest.get(request.id)} currentUserId={userId} confirmed={confirmedIds.has(request.id)} busy={busyId === request.id} onCancel={() => void cancelRequest(request)} onApprove={(quoteId) => void perform(request.id, () => supabase.rpc("marketplace_approve_quote", { p_request_id: request.id, p_quote_id: quoteId }), "Quote approved.")} onStart={() => void perform(request.id, () => supabase.rpc("marketplace_start_work", { p_request_id: request.id }), "Work has been marked as started.")} onReady={() => void perform(request.id, () => supabase.rpc("marketplace_mark_work_ready", { p_request_id: request.id }), "Work is ready for both parties to confirm.")} onConfirm={() => { const approved = approvedByRequest.get(request.id); if (approved) confirmWork(request, approved); }} onRespond={(decision) => void perform(request.id, () => supabase.rpc("marketplace_respond_to_request", { p_request_id: request.id, p_decision: decision }), decision === "accepted" ? "You accepted the request." : "You declined the request.")} quoteDraft={quoteDrafts[request.id]} onQuoteDraft={(value) => setQuoteDrafts((current) => ({ ...current, [request.id]: value }))} onQuote={(event) => submitQuote(event, request.id)} contact={contacts[request.id]} onShowContact={() => void showContact(request.id)} disputeText={disputeDrafts[request.id] ?? ""} onDisputeText={(value) => setDisputeDrafts((current) => ({ ...current, [request.id]: value }))} onDispute={(event) => openDispute(event, request.id)} />
            ))}
          </div>
        </section>
      )}
      {role === "provider" && feeNotices.length > 0 && (
        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">Completed jobs</p>
          <h2 className="mt-2 text-2xl font-extrabold text-brand-navy">Commission statements</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Only completed non-demo jobs can create a statement. These are in-app records; no email reminder or payment collection is connected.</p>
          <div className="mt-5 space-y-3">
            {feeNotices.map((notice) => {
              const item = ledger.find((entry) => entry.id === notice.ledger_id);
              return (
                <article key={notice.id} className="rounded-2xl border border-border bg-brand-cream p-4">
                  <p className="font-bold text-brand-navy">{item ? formatZarCents(item.fee_cents) + " recorded fee" : "Commission statement"}</p>
                  {item && <p className="mt-1 text-sm text-muted-foreground">Basis: {formatZarCents(item.base_cents)} · completed {formatPilotDate(item.created_at)}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">Notice: {formatPilotDate(notice.notice_at)} · due: {formatPilotDate(notice.due_at)}</p>
                  {notice.disputed ? <p className="mt-2 text-sm font-semibold text-brand-navy">Dispute recorded. The statement is not escalated automatically.</p> :
                    notice.final_notice_at ? <p className="mt-2 text-sm font-semibold text-brand-navy">Final notice recorded {formatPilotDate(notice.final_notice_at)}. Any restriction requires a separately authorised process.</p> :
                    <form onSubmit={(event) => { event.preventDefault(); const note = disputeDrafts["fee:" + notice.id]?.trim() ?? ""; if (note.length < 10) { setNotice({ kind: "error", text: "Add at least 10 characters to explain the statement dispute." }); return; } void perform("fee:" + notice.id, () => supabase.rpc("marketplace_dispute_fee_notice", { p_notice_id: notice.id, p_note: note }), "Your statement dispute was recorded."); }} className="mt-3 space-y-2">
                      <label className="block text-sm font-semibold">Dispute this statement, if needed
                        <textarea minLength={10} maxLength={1000} value={disputeDrafts["fee:" + notice.id] ?? ""} onChange={(event) => setDisputeDrafts((current) => ({ ...current, ["fee:" + notice.id]: event.target.value }))} className={focusField} />
                      </label>
                      <button disabled={busyId === "fee:" + notice.id} className="min-h-10 rounded-lg border border-border px-3 text-sm font-bold text-brand-navy hover:bg-brand-sky">Record statement dispute</button>
                    </form>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

type MarketplaceSupportCase =
  Database["public"]["Functions"]["marketplace_admin_list_cases"]["Returns"][number];

export function AdminMarketplaceSupportConsole() {
  const [cases, setCases] = useState<MarketplaceSupportCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void supabase.rpc("marketplace_admin_list_cases")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice({ kind: "error", text: "The support queue could not be loaded." });
          return;
        }
        setCases(data ?? []);
      })
      .catch(() => {
        if (active) setNotice({ kind: "error", text: "The support queue could not be loaded." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refreshTick]);

  async function resolveCase(item: MarketplaceSupportCase) {
    const note = notes[item.case_id]?.trim() ?? "";
    const outcome = outcomes[item.case_id] ?? "awaiting_confirmation";
    if (note.length < 3 || note.length > 1000) {
      setNotice({ kind: "error", text: "Add a resolution note from 3 to 1,000 characters." });
      return;
    }
    setBusyId(item.case_id);
    setNotice(null);
    try {
      const { error } = await supabase.rpc("marketplace_resolve_dispute", {
        p_case_id: item.case_id,
        p_outcome: outcome,
        p_note: note,
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "The support decision was recorded in the audit trail." });
      setRefreshTick((value) => value + 1);
    } catch {
      setNotice({ kind: "error", text: "The support decision could not be saved. Refresh and check the case status." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-7xl rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-navy">Admin support</p>
      <h2 className="mt-2 text-2xl font-extrabold text-brand-navy">Open marketplace cases</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Review the issue and choose a recorded next step. This screen does not reveal private service addresses or phone numbers.</p>
      {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={"mt-4 rounded-xl p-3 text-sm " + (notice.kind === "error" ? "bg-destructive/5 text-destructive" : "bg-brand-sky text-brand-navy")}>{notice.text}</p>}
      {loading ? <LoadingPanel label="Loading support cases…" /> : cases.length === 0 ? <EmptyState text="There are no open live marketplace cases." /> : (
        <ul className="mt-5 space-y-4">
          {cases.map((item) => (
            <li key={item.case_id} className="rounded-2xl border border-border bg-brand-cream p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase text-brand-navy">{item.kind}</span>
                <span className="text-xs text-muted-foreground">{categoryLabel(item.request_category)} · {statusLabel(item.request_status)} · {formatPilotDate(item.created_at)}</span>
              </div>
              <h3 className="mt-3 font-bold text-brand-navy">{item.request_title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <label className="block text-sm font-semibold">Next step
                  <select value={outcomes[item.case_id] ?? "awaiting_confirmation"} onChange={(event) => setOutcomes((current) => ({ ...current, [item.case_id]: event.target.value }))} className={focusField}>
                    <option value="awaiting_confirmation">Return for completion confirmation</option>
                    <option value="resume_work">Resume agreed work</option>
                    <option value="cancel">Cancel the job</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold">Resolution note
                  <input value={notes[item.case_id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.case_id]: event.target.value }))} className={focusField} maxLength={1000} />
                </label>
                <button disabled={busyId === item.case_id} onClick={() => void resolveCase(item)} className="primary-button">
                  {busyId === item.case_id ? <LoaderCircle className="animate-spin" size={18} /> : "Record decision"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestCard({
  request, role, quotes, approved, currentUserId, confirmed, busy, onCancel, onApprove,
  onStart, onReady, onConfirm, onRespond, quoteDraft, onQuoteDraft, onQuote, contact, onShowContact,
  disputeText, onDisputeText, disputeKind, onDisputeKind, onDispute,
}: {
  request: RequestRow;
  role: Role;
  quotes: QuoteRow[];
  approved?: ApprovedRow;
  currentUserId: string;
  confirmed: boolean;
  busy: boolean;
  onCancel: () => void;
  onApprove: (quoteId: string) => void;
  onStart: () => void;
  onReady: () => void;
  onConfirm: () => void;
  onRespond: (decision: "accepted" | "declined") => void;
  quoteDraft?: QuoteDraft;
  onQuoteDraft: (value: QuoteDraft) => void;
  onQuote: (event: FormEvent<HTMLFormElement>) => void;
  contact?: Contact;
  onShowContact: () => void;
  disputeText: string;
  onDisputeText: (value: string) => void;
  disputeKind: string;
  onDisputeKind: (value: string) => void;
  onDispute: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedQuote = approved ? quotes.find((quote) => quote.id === approved.quote_id) : undefined;
  const selectedProvider = selectedQuote?.provider_id === currentUserId;
  const myQuote = quotes.some((quote) => quote.provider_id === currentUserId);
  const isOpen = request.status === "submitted" && !request.is_demo;
  const canCancel = role === "customer" && ["submitted", "accepted", "quoted"].includes(request.status);
  const supportable = !request.is_demo && ["accepted", "quoted", "approved", "in_progress", "awaiting_completion", "disputed"].includes(request.status);

  return (
    <article className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-sky px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-brand-navy">{categoryLabel(request.category)}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">{request.is_demo ? "Demo only" : statusLabel(request.status)}</span>
          </div>
          <h3 className="mt-3 break-words text-lg font-bold text-brand-navy">{request.title}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{request.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-cream px-3 py-1.5 text-xs font-bold text-brand-navy">{statusLabel(request.status)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{request.area}</span>
        <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{timingLabel(request.timing)}</span>
        <span>{formatPilotDate(request.created_at)}</span>
      </div>

      {role === "provider" && isOpen && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => onRespond("accepted")} className="primary-button">Accept request</button>
          <button disabled={busy} onClick={() => onRespond("declined")} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-brand-navy hover:bg-brand-sky">Decline</button>
        </div>
      )}

      {role === "provider" && request.status === "accepted" && myQuote === false && (
        <form onSubmit={onQuote} className="mt-5 space-y-3 rounded-xl bg-brand-cream p-4">
          <p className="font-bold text-brand-navy">Write a clear quote before work starts</p>
          <label className="block text-sm font-semibold">Agreed work scope
            <textarea required minLength={20} maxLength={3000} rows={3} value={quoteDraft?.scope ?? ""} onChange={(event) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), scope: event.target.value })} className={focusField} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <MoneyInput label="Labour (R)" value={quoteDraft?.labour ?? ""} onChange={(value) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), labour: value })} />
            <MoneyInput label="Call-out (R)" value={quoteDraft?.callout ?? ""} onChange={(value) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), callout: value })} />
            <MoneyInput label="Parts estimate (R)" value={quoteDraft?.parts ?? ""} onChange={(value) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), parts: value })} />
          </div>
          <label className="block text-sm font-semibold">Parts, access, and other assumptions
            <textarea required minLength={2} maxLength={2000} rows={2} value={quoteDraft?.assumptions ?? ""} onChange={(event) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), assumptions: event.target.value })} className={focusField} />
          </label>
          <label className="block text-sm font-semibold">Expected timing
            <input required minLength={2} maxLength={500} value={quoteDraft?.timing ?? ""} onChange={(event) => onQuoteDraft({ ...(quoteDraft ?? { scope: "", labour: "", callout: "", parts: "", assumptions: "", timing: "" }), timing: event.target.value })} className={focusField} />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">The total is calculated from integer cents. The customer must approve the scope and price before work starts.</p>
          <button disabled={busy} className="primary-button">Submit written quote</button>
        </form>
      )}

      {role === "customer" && request.status === "quoted" && quotes.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="font-bold text-brand-navy">Review each written quote. Work cannot start until you approve one.</p>
          {quotes.map((quote) => (
            <div key={quote.id} className="rounded-xl border border-border bg-brand-cream p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-brand-navy">{quote.scope}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Detail label="Labour" value={formatZarCents(quote.labour_cents)} />
                <Detail label="Call-out" value={formatZarCents(quote.callout_cents)} />
                <Detail label="Parts estimate" value={formatZarCents(quote.parts_cents)} />
                <Detail label="Total" value={formatZarCents(quote.total_cents ?? -1)} />
                <Detail label="Assumptions" value={quote.assumptions} />
                <Detail label="Timing" value={quote.timing} />
              </dl>
              <button disabled={busy} onClick={() => onApprove(quote.id)} className="primary-button mt-4">Approve this scope and total</button>
            </div>
          ))}
        </div>
      )}

      {approved && selectedQuote && (
        <div className="mt-5 rounded-xl border border-brand-navy/15 bg-brand-sky p-4">
          <p className="font-bold text-brand-navy">Approved scope · {formatZarCents(selectedQuote.total_cents ?? -1)}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedQuote.scope}</p>
          {role === "provider" && selectedProvider && (
            <>
              {request.status === "approved" && <button disabled={busy} onClick={onStart} className="primary-button mt-4">Start agreed work</button>}
              {request.status === "in_progress" && <button disabled={busy} onClick={onReady} className="primary-button mt-4">Mark work ready for confirmation</button>}
              {["approved", "in_progress", "awaiting_completion", "completed", "disputed"].includes(request.status) && (
                <div className="mt-3">
                  {contact ? <p className="whitespace-pre-line text-sm leading-6 text-brand-navy">Service address: {contact.service_address}<br />Contact: {contact.contact_phone}</p> :
                    <button disabled={busy} onClick={onShowContact} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-brand-navy underline underline-offset-4">View approved job contact details</button>}
                </div>
              )}
            </>
          )}
          {request.status === "awaiting_completion" && (
            <div className="mt-4 rounded-xl bg-white p-4">
              <p className="text-sm leading-6 text-muted-foreground">Confirm only after the work and cash payment are complete. The recorded amount must match the approved quote. This records both parties’ confirmations; it does not verify a cash transfer.</p>
              <button disabled={busy} onClick={onConfirm} className="primary-button mt-3">{confirmed ? "Confirm again" : "Confirm completion and cash amount"}</button>
            </div>
          )}
          {request.status === "completed" && <p className="mt-3 text-sm font-semibold text-emerald-900">Both parties confirmed this job as complete.</p>}
        </div>
      )}

      {canCancel && <button disabled={busy} onClick={onCancel} className="mt-4 min-h-10 rounded-lg px-2 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-brand-navy">{request.is_demo ? "Cancel saved demo" : "Cancel request"}</button>}

      {supportable && (
        <form onSubmit={onDispute} className="mt-5 border-t border-border pt-4">
          <label className="block text-sm font-semibold">Support reason
            <select value={disputeKind} onChange={(event) => onDisputeKind(event.target.value)} className={focusField}>
              <option value="completion">Completion</option><option value="workmanship">Workmanship</option><option value="safety">Safety</option><option value="payment">Payment</option><option value="cancellation">Cancellation</option><option value="fraud">Fraud concern</option><option value="privacy">Privacy</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold">Describe the issue
            <textarea minLength={20} maxLength={3000} value={disputeText} onChange={(event) => onDisputeText(event.target.value)} className={focusField} placeholder="Describe the issue without including payment credentials or ID numbers." />
          </label>
          <button disabled={busy || disputeText.trim().length < 20} className="mt-3 min-h-10 rounded-lg border border-border px-3 text-sm font-bold text-brand-navy hover:bg-brand-sky">Open support case and pause job</button>
        </form>
      )}
    </article>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold">{label}
    <input required inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={focusField} placeholder="0.00" />
  </label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium text-brand-navy">{value || "Not provided"}</dd></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-brand-cream px-5 py-9 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-brand-navy shadow-sm"><Wrench size={21} aria-hidden="true" /></span><p className="mt-4 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="flex min-h-56 items-center justify-center rounded-3xl border border-border bg-white p-8 text-sm font-semibold text-brand-navy shadow-sm"><LoaderCircle className="mr-3 animate-spin" size={20} aria-hidden="true" />{label}</div>;
}
