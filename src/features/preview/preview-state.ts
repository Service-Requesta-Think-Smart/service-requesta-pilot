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

export interface PreviewState {
  status: PreviewStatus;
  identityReview: ReviewState;
  tradeReview: ReviewState;
  response: 'pending' | 'accepted' | 'declined';
  quoteSubmitted: boolean;
  quoteApproved: boolean;
  providerConfirmed: boolean;
  customerConfirmed: boolean;
  payment: PaymentState;
  supportOpen: boolean;
  supportResolved: boolean;
  events: string[];
}

export const initialPreviewState: PreviewState = {
  status: 'application_pending',
  identityReview: 'pending',
  tradeReview: 'pending',
  response: 'pending',
  quoteSubmitted: false,
  quoteApproved: false,
  providerConfirmed: false,
  customerConfirmed: false,
  payment: 'not_started',
  supportOpen: false,
  supportResolved: false,
  events: ['Demo application submitted for admin review'],
};

export function approveApplication(state: PreviewState): PreviewState {
  if (state.identityReview !== 'approved' || state.tradeReview !== 'approved') return state;
  return appendEvent({ ...state, status: 'application_approved' }, 'Admin approved identity and trade evidence separately');
}

export function acceptRequest(state: PreviewState): PreviewState {
  if (state.status !== 'application_approved' || state.response !== 'pending') return state;
  return appendEvent({ ...state, response: 'accepted', status: 'accepted' }, 'Provider accepted the demo request');
}

export function submitQuote(state: PreviewState): PreviewState {
  if (state.status !== 'accepted') return state;
  return appendEvent({ ...state, quoteSubmitted: true, status: 'quote_submitted' }, 'Provider sent an itemised demo quote');
}

export function approveQuote(state: PreviewState): PreviewState {
  if (state.status !== 'quote_submitted' || !state.quoteSubmitted) return state;
  return appendEvent({ ...state, quoteApproved: true, status: 'quote_approved' }, 'Customer approved the fixed-scope quote snapshot');
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
