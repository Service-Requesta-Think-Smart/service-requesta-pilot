import { createFileRoute } from '@tanstack/react-router';
import { CustomerWorkspace } from '@/features/customer/customer-workspace';
import { pageHead } from '@/features/customer/metadata';
export const Route=createFileRoute('/')({head:()=>pageHead('East London service requests','Local skills. Clear requests. Better connections. Private demonstration requests for plumbing, electrical work and motor mechanics in East London.'),component:CustomerWorkspace});
