import { createFileRoute } from '@tanstack/react-router';
import { AccountWorkspace } from '@/features/account/account-workspace';
import { pageHead } from '@/features/customer/metadata';
export const Route=createFileRoute('/_authenticated/requests')({head:()=>pageHead('My requests','Create and track private demonstration service requests in the East London pilot.'),component:AccountWorkspace});
