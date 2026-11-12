import { useEffect, useState } from 'react';
import { Check, ClipboardList, CreditCard, Hammer, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  acceptRequest,
  advanceJob,
  approveApplication,
  approveQuote,
  confirmCompletion,
  initialPreviewState,
  submitQuote,
  type PreviewState,
  type ReviewState,
} from './preview-state';

const STORAGE_KEY = 'service-requesta-marketplace-preview-v1';
const amount = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);

function readSavedState(): PreviewState {
  if (typeof window === 'undefined') return initialPreviewState;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialPreviewState, ...JSON.parse(saved) } : initialPreviewState;
  } catch {
    return initialPreviewState;
  }
}

const stages = [
  ['application_pending', 'Provider application'],
  ['application_approved', 'Admin review'],
  ['accepted', 'Request response'],
  ['quote_submitted', 'Itemised quote'],
  ['quote_approved', 'Customer approval'],
  ['in_progress', 'Work in progress'],
  ['awaiting_customer_confirmation', 'Completion checks'],
  ['completed', 'Payment preview & receipt'],
] as const;

export function MarketplacePreview() {
  const [state, setState] = useState<PreviewState>(initialPreviewState);
  const [role, setRole] = useState<'customer' | 'provider' | 'admin'>('customer');
  const [supportNote, setSupportNote] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => setState(readSavedState()), []);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateReview = (kind: 'identityReview' | 'tradeReview', value: ReviewState) => {
    setState(current => {
      const revised = { ...current, [kind]: value };
      if (revised.identityReview === 'approved' && revised.tradeReview === 'approved') return approveApplication(revised);
      return { ...revised, events: [`Admin updated ${kind === 'identityReview' ? 'identity/contact' : 'trade-evidence'} review: ${value.replace('_', ' ')}`, ...revised.events].slice(0, 20) };
    });
  };

  const reset = () => {
    setState({ ...initialPreviewState, events: [...initialPreviewState.events] });
    setRole('customer'); setSupportNote(''); setSupportMessage(''); setPaymentMessage('');
  };

  const createSupportCase = () => {
    if (!supportNote.trim()) return;
    setState(current => ({ ...current, supportOpen: true, supportResolved: false, events: [`Demo support case opened: ${supportNote.trim()}`, ...current.events].slice(0, 20) }));
    setSupportMessage('Demo case opened for admin review.');
    setSupportNote('');
  };

  const resolveSupportCase = () => {
    setState(current => ({ ...current, supportOpen: false, supportResolved: true, events: ['Admin resolved the demo support case (audit event recorded)', ...current.events].slice(0, 20) }));
    setSupportMessage('Demo case resolved; resolution added to the activity log.');
  };

  const simulateYoco = () => {
    setPaymentMessage('Preview only: no Yoco connection, checkout, charge or payment was made.');
    if (state.status === 'completed') setState(current => ({ ...current, payment: 'demo_paid', events: ['Yoco test-payment outcome simulated locally — no money moved', ...current.events].slice(0, 20) }));
  };

  const activeStage = stages.findIndex(([id]) => id === state.status);
  const button = (label: string, onClick: () => void, disabled = false) => <Button type="button" onClick={onClick} disabled={disabled}>{label}</Button>;

  return <main className="page-wrap py-8 sm:py-12">
    <div className="mb-6 rounded-lg border-2 border-dashed border-primary bg-accent p-4 text-sm" role="note">
      <strong>DEMO PREVIEW — fictional data only.</strong> This interactive flow stores sample state in this browser only. It is not connected to customers, providers, the production database, or Yoco. No money moves. Legal and operational approval is still required before launch.
    </div>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">SERVICE-REQUESTA · THINK SMART</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Marketplace workflow preview</h1><p className="mt-2 max-w-2xl text-muted-foreground">Explore the customer, provider and admin views of one clearly fictional plumbing request.</p></div>
      <Button variant="outline" onClick={reset}>Reset demo</Button>
    </header>

    <section className="mt-8 rounded-xl border bg-card p-5 sm:p-6" aria-label="Demo progress">
      <div className="flex items-center gap-2"><ClipboardList className="size-5"/><h2 className="text-lg font-semibold">Demo request · SR-DEMO-001</h2><span className="status-tag">Sample</span></div>
      <p className="mt-2 font-medium">Kitchen tap repair <span className="font-normal text-muted-foreground">· Plumbing · East London</span></p>
      <p className="mt-1 text-sm text-muted-foreground">Fictional request. Suburb only; no street address or real contact details are shown.</p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{stages.map(([id, label], index) => <li key={id} className={`rounded-md border p-3 text-sm ${index <= activeStage ? 'border-primary bg-accent' : 'bg-muted/40'}`}><span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground">{index < activeStage ? <Check className="size-3"/> : index + 1}</span>{label}</li>)}</ol>
    </section>

    <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Demo role">
      {(['customer', 'provider', 'admin'] as const).map(item => <Button key={item} role="tab" aria-selected={role === item} variant={role === item ? 'default' : 'outline'} onClick={() => setRole(item)}>{item === 'customer' ? <UserRound/> : item === 'provider' ? <Wrench/> : <ShieldCheck/>}{item[0].toUpperCase() + item.slice(1)} view</Button>)}
    </div>

    <section className="mt-4 rounded-xl border bg-card p-5 sm:p-6" aria-live="polite">
      {role === 'admin' && <div>
        <p className="eyebrow">ADMIN REVIEW CONSOLE · DEMO ONLY</p><h2 className="mt-1 text-2xl font-semibold">Provider application review</h2><p className="mt-2 text-sm text-muted-foreground">Fictional applicant: Demo Tradesperson · Plumbing · East London. Review identity/contact and trade evidence independently.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ReviewCard title="Identity & contact check" value={state.identityReview} onChange={value => updateReview('identityReview', value)} />
          <ReviewCard title="Trade-evidence review" value={state.tradeReview} onChange={value => updateReview('tradeReview', value)} />
        </div>
        <p className="mt-4 text-sm">Application state: <strong>{state.status === 'application_pending' ? 'Awaiting both reviews' : 'Approved for this demo'}</strong></p>
        <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Support case queue</h3>{state.supportOpen ? <div className="mt-3 rounded-md bg-muted p-4"><p className="text-sm">Open fictional case · customer request SR-DEMO-001</p>{button('Resolve and record in audit log', resolveSupportCase)}</div> : <p className="mt-2 text-sm text-muted-foreground">{state.supportResolved ? 'No open cases. Latest demo case is resolved and logged.' : 'No demo cases are open.'}</p>}{supportMessage && <p className="mt-2 text-sm" role="status">{supportMessage}</p>}</div>
      </div>}

      {role === 'provider' && <div>
        <p className="eyebrow">PROVIDER WORKSPACE · DEMO ONLY</p><h2 className="mt-1 text-2xl font-semibold">Application and request inbox</h2>
        <div className="mt-4 rounded-md bg-muted p-4"><p className="font-medium">Demo Tradesperson <span className="status-tag">Fictional sample</span></p><p className="mt-1 text-sm text-muted-foreground">Plumbing · East London · Availability: flexible</p><p className="mt-3 text-sm">Identity/contact review: <strong>{state.identityReview.replace('_', ' ')}</strong> · Trade evidence: <strong>{state.tradeReview.replace('_', ' ')}</strong></p></div>
        {state.status === 'application_approved' && state.response === 'pending' && <div className="mt-5 rounded-md border p-4"><h3 className="font-semibold">Request inbox</h3><p className="mt-1 text-sm">SR-DEMO-001 · Kitchen tap repair · Beacon Bay area</p><div className="mt-3">{button('Accept demo request', () => setState(current => acceptRequest(current)))}</div></div>}
        {state.response === 'declined' && <p className="mt-4 text-sm">You declined this demo request; it is not assigned.</p>}
        {state.status === 'accepted' && <div className="mt-5 rounded-md border p-4"><h3 className="font-semibold">Prepare itemised quote</h3><QuoteSummary/><p className="mt-3">{button('Send quote to customer', () => setState(current => submitQuote(current)))}</p></div>}
        {state.status === 'quote_submitted' && <p className="mt-4 text-sm">Your itemised quote is awaiting the customer's decision.</p>}
        {state.status === 'quote_approved' && <div className="mt-4">{button('Start job', () => setState(current => advanceJob(current)))}</div>}
        {state.status === 'in_progress' && <div className="mt-4">{button('Mark work complete', () => setState(current => advanceJob(current)))}</div>}
        {state.status === 'awaiting_customer_confirmation' && <div className="mt-4">{button(state.providerConfirmed ? 'Provider completion confirmed' : 'Confirm completion (provider)', () => setState(current => confirmCompletion(current, 'provider')), state.providerConfirmed)}</div>}
        {state.quoteApproved && <div className="mt-5 rounded-md border border-primary p-4"><h3 className="font-semibold">Private details</h3><p className="mt-1 text-sm">Unlocked only after customer quote approval. Demo contact and address are deliberately omitted.</p></div>}
      </div>}

      {role === 'customer' && <div>
        <p className="eyebrow">CUSTOMER WORKSPACE · DEMO ONLY</p><h2 className="mt-1 text-2xl font-semibold">Review the request and quote</h2>
        {state.status === 'application_pending' && <p className="mt-3 text-sm text-muted-foreground">The provider application is awaiting separate admin identity and trade-evidence reviews.</p>}
        {state.status === 'application_approved' && <p className="mt-3 text-sm">A demo provider has been approved and can respond to the sample request.</p>}
        {state.response === 'accepted' && !state.quoteSubmitted && <p className="mt-3 text-sm">A demo provider accepted your request and is preparing a quote.</p>}
        {state.quoteSubmitted && <div className="mt-4"><QuoteSummary/><p className="mt-2 text-xs text-muted-foreground">This quote is a fictional, immutable snapshot for this preview; it is not an offer for real services.</p>{state.status === 'quote_submitted' && <div className="mt-4">{button('Approve scope and price', () => setState(current => approveQuote(current)))}</div>}</div>}
        {state.quoteApproved && <div className="mt-4 rounded-md border border-primary p-4"><h3 className="font-semibold">Private details unlocked in this demo</h3><p className="mt-1 text-sm text-muted-foreground">The flow unlocks private details after approval. No real phone number or residential street address is stored or displayed.</p></div>}
        {state.status === 'awaiting_customer_confirmation' && <div className="mt-4">{button(state.customerConfirmed ? 'Customer completion confirmed' : 'Confirm completion (customer)', () => setState(current => confirmCompletion(current, 'customer')), state.customerConfirmed)}</div>}
        {state.status === 'completed' && <div className="mt-5 rounded-md border p-4"><h3 className="font-semibold">Payment summary · demo only</h3><p className="mt-2 text-sm">Quote total: {amount(100000)} · Preview commission at proposed 15%: {amount(15000)} · Illustrative provider remainder: {amount(85000)}</p><p className="mt-2 text-sm">No fee is charged or owed. Rate and calculation are illustrative, not approved terms.</p><Button className="mt-3" variant="outline" onClick={simulateYoco}><CreditCard className="mr-2 size-4"/>Simulate Yoco test outcome</Button>{paymentMessage && <p className="mt-2 text-sm" role="status">{paymentMessage}</p>}{state.payment === 'demo_paid' && <p className="mt-2 text-sm font-medium">Simulated test result only — no payment or receipt from Yoco.</p>}<p className="mt-4 border-t pt-3 text-sm">Demo completion record · SR-DEMO-001 · No real transaction receipt.</p></div>}
        <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Need help?</h3><p className="mt-1 text-sm text-muted-foreground">Open a fictional support case for the admin preview.</p><label className="mt-3 block text-sm font-medium" htmlFor="support-note">Case details</label><textarea id="support-note" className="form-textarea mt-1 w-full" value={supportNote} onChange={event => setSupportNote(event.target.value)} maxLength={300} placeholder="Describe a demo issue"/><Button className="mt-2" variant="outline" disabled={!supportNote.trim() || state.supportOpen} onClick={createSupportCase}>Open demo support case</Button>{supportMessage && <p className="mt-2 text-sm" role="status">{supportMessage}</p>}{state.supportResolved && <p className="mt-2 text-sm">The demo case is marked resolved.</p>}</div>
      </div>}
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 font-semibold"><Hammer className="size-4"/>Workflow activity</h2><ol className="mt-3 space-y-2">{state.events.map((event, index) => <li key={`${event}-${index}`} className="border-l-2 border-primary pl-3 text-sm">{event}</li>)}</ol></div><div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Payment provider status</h2><p className="mt-2 text-sm text-muted-foreground">Yoco is shown as a requested demonstration concept only. No API credentials, SDK, checkout session, webhook, or real transaction is configured in this preview.</p><p className="mt-3 text-sm font-medium">Preview payment: {state.payment === 'demo_paid' ? 'simulated locally' : 'not started'}</p><p className="mt-2 text-xs text-muted-foreground">Real payment processing must remain disabled until a provider is confirmed and the integration is separately approved.</p></div></section>
  </main>;
}

function ReviewCard({ title, value, onChange }: { title: string; value: ReviewState; onChange: (value: ReviewState) => void }) {
  return <div className="rounded-md border p-4"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm">Status: <strong>{value.replace('_', ' ')}</strong></p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onChange('approved')}>Approve</Button><Button size="sm" variant="outline" onClick={() => onChange('needs_changes')}>Request changes</Button><Button size="sm" variant="ghost" onClick={() => onChange('pending')}>Reset</Button></div></div>;
}

function QuoteSummary() {
  return <div className="rounded-md border p-4"><h3 className="font-semibold">Itemised quote · Demo version 1</h3><p className="mt-3 flex justify-between text-sm"><span>Call-out</span><strong>{amount(15000)}</strong></p><p className="mt-2 flex justify-between text-sm"><span>Labour</span><strong>{amount(55000)}</strong></p><p className="mt-2 flex justify-between text-sm"><span>Parts</span><strong>{amount(30000)}</strong></p><p className="mt-3 flex justify-between border-t pt-3"><span>Total</span><strong>{amount(100000)}</strong></p><p className="mt-2 text-xs text-muted-foreground">Scope: inspect and repair a leaking kitchen tap. Assumption: standard replacement washer. Fictional sample pricing.</p></div>;
}
