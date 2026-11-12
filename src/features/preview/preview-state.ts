export type PreviewStatus =
  | 'application_pending'
  | 'application_approved'
  | 'accepted'
  | 'quote_submitted'
  | 'quote_approved'
  | 'in_progress'
  | 'awaiting_customer_confirmation'
  | 'completed';

export type ReviewState = 'pending' | 'approved' | 'needs_changes';
export type PaymentState = 'not_started' | 'demo_paid';

export interface QuoteSnapshot {
  scope: string;
  assumptions: string;
  timing: string;
  calloutCents: number;
  labourCents: number;
  partsCents: number;
  totalCents: number;
  approved: boolean;
  createdAt: string;
}

export interface PreviewState {
  status: PreviewStatus;
  identityReview: ReviewState;
  tradeReview: ReviewState;
  response: 'pending' | 'accepted' | 'declined';
  quote: QuoteSnapshot | null;
  quoteSubmitted: boolean;
  quoteApproved: boolean;
  providerConfirmed: boolean;
  customerConfirmed: boolean;
  payment: PaymentState;
  supportOpen: boolean;
  supportResolved: boolean;
  events: string[];
}

export const demoQuote: QuoteSnapshot = {
  scope: 'Inspect and repair the leaking kitchen tap',
  assumptions: 'Standard replacement washer and basic plumbing labour',
  timing: 'Within 3 working days',
  calloutCents: 15000,
  labourCents: 55000,
  partsCents: 30000,
  totalCents: 100000,
  approved: false,
  createdAt: '2026-11-12T09:00:00Z',
};

export const initialPreviewState: PreviewState = {
  status: 'application_pending',
  identityReview: 'pending',
  tradeReview: 'pending',
  response: 'pending',
  quote: null,
  quoteSubmitted: false,
  quoteApproved: false,
  providerConfirmed: false,
  customerConfirmed: false,
  payment: 'not_started',
  supportOpen: false,
  supportResolved: false,
  events: ['Demo application submitted for admin review'],
};

export function setApplicationReview(state: PreviewState, kind: 'identityReview' | 'tradeReview', value: ReviewState): PreviewState {
  if (state.status !== 'application_pending' && state.status !== 'application_approved') return state;
  const next = { ...state, [kind]: value };
  if (next.identityReview === 'approved' && next.tradeReview === 'approved') {
    return approveApplication(next);
  }
  return appendEvent(next, `Admin updated ${kind === 'identityReview' ? 'identity/contact' : 'trade-evidence'} review to ${value.replace('_', ' ')}`);
}

export function approveApplication(state: PreviewState): PreviewState {
  if (state.identityReview !== 'approved' || state.tradeReview !== 'approved') return state;
  return appendEvent({ ...state, status: 'application_approved' }, 'Admin approved identity and trade evidence separately');
}

export function declineRequest(state: PreviewState): PreviewState {
  if (state.status !== 'application_approved' || state.response !== 'pending') return state;
  return appendEvent({ ...state, response: 'declined', quote: null, quoteSubmitted: false, quoteApproved: false }, 'Provider declined the demo request');
}

export function acceptRequest(state: PreviewState): PreviewState {
  if (state.status !== 'application_approved' || state.response !== 'pending') return state;
  return appendEvent({ ...state, response: 'accepted', status: 'accepted' }, 'Provider accepted the demo request');
}

export function submitQuote(state: PreviewState): PreviewState {
  if (state.status !== 'accepted') return state;
  const quote = {
    ...demoQuote,
    approved: false,
    createdAt: new Date().toISOString(),
  };
  return appendEvent({ ...state, quote, quoteSubmitted: true, quoteApproved: false, status: 'quote_submitted' }, 'Provider sent an itemised demo quote');
}

export function approveQuote(state: PreviewState): PreviewState {
  if (state.status !== 'quote_submitted' || !state.quote || !state.quoteSubmitted) return state;
  const quote = { ...state.quote, approved: true };
  return appendEvent({ ...state, quote, quoteApproved: true, status: 'quote_approved' }, 'Customer approved the fixed-scope quote snapshot');
}

export function advanceJob(state: PreviewState): PreviewState {
  if (state.status !== 'quote_approved' && state.status !== 'in_progress') return state;
  const status = state.status === 'quote_approved' ? 'in_progress' : 'awaiting_customer_confirmation';
  return appendEvent({ ...state, status }, status === 'in_progress' ? 'Provider marked the demo job in progress' : 'Provider marked demo work complete');
}

export function confirmCompletion(state: PreviewState, party: 'customer' | 'provider'): PreviewState {
  if (state.status !== 'awaiting_customer_confirmation') return state;
  const next = {
    ...state,
    customerConfirmed: state.customerConfirmed || party === 'customer',
    providerConfirmed: state.providerConfirmed || party === 'provider',
  };
  if (next.customerConfirmed && next.providerConfirmed) {
    return appendEvent({ ...next, status: 'completed' }, 'Both demo parties confirmed completion');
  }
  return appendEvent(next, `${party === 'customer' ? 'Customer' : 'Provider'} confirmed demo completion`);
}

export function appendEvent(state: PreviewState, event: string): PreviewState {
  return { ...state, events: [event, ...state.events].slice(0, 20) };
}
