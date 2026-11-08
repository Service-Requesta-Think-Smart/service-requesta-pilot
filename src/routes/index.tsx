import { createFileRoute } from '@tanstack/react-router';
import { HomeWorkspace } from '@/features/account/account-workspace';
import { pageHead } from '@/features/customer/metadata';
export const Route=createFileRoute('/')({head:()=>pageHead('East London service requests','Think Smart. Private Service-Requesta demonstration requests for plumbing, electrical work and motor mechanics in East London.'),component:HomeWorkspace});
