import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/features/customer/metadata';
import { MarketplacePreview } from '@/features/preview/demo-marketplace';

export const Route = createFileRoute('/preview')({
  head: () =>
    pageHead(
      'Marketplace preview',
      'Demo-only marketplace flow for Service-Requesta including customer, provider, admin and payment preview states.',
    ),
  component: MarketplacePreview,
});
