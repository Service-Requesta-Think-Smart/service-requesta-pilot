import { describe, expect, it } from 'vitest';
import {
  acceptRequest,
  advanceJob,
  approveApplication,
  approveQuote,
  confirmCompletion,
  initialPreviewState,
  submitQuote,
} from './preview-state';

function readyForQuote() {
  const reviewed = approveApplication({ ...initialPreviewState, identityReview: 'approved', tradeReview: 'approved' });
  return acceptRequest(reviewed);
}

describe('demo marketplace workflow state', () => {
  it('requires both independent application reviews before provider approval', () => {
    expect(approveApplication({ ...initialPreviewState, identityReview: 'approved' }).status).toBe('application_pending');
    expect(approveApplication({ ...initialPreviewState, identityReview: 'approved', tradeReview: 'approved' }).status).toBe('application_approved');
  });

  it('rejects request, quote and job actions out of sequence', () => {
    expect(acceptRequest(initialPreviewState)).toEqual(initialPreviewState);
    expect(submitQuote(initialPreviewState)).toEqual(initialPreviewState);
    expect(approveQuote(initialPreviewState)).toEqual(initialPreviewState);
    expect(advanceJob(initialPreviewState)).toEqual(initialPreviewState);
  });

  it('runs application review through itemised quote approval and job start', () => {
    const state = approveQuote({ ...readyForQuote(), ...submitQuote(readyForQuote()) });
    expect(state.status).toBe('quote_approved');
    expect(state.quoteApproved).toBe(true);
    expect(advanceJob(state).status).toBe('in_progress');
  });

  it('requires both parties to confirm completion', () => {
    const awaiting = { ...initialPreviewState, status: 'awaiting_customer_confirmation' as const };
    const oneConfirmation = confirmCompletion(awaiting, 'provider');
    expect(oneConfirmation.status).toBe('awaiting_customer_confirmation');
    expect(confirmCompletion(oneConfirmation, 'customer').status).toBe('completed');
  });
});
