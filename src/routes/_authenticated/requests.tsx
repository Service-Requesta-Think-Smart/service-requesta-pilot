import { createFileRoute } from '@tanstack/react-router';
import { CustomerWorkspace } from '@/features/customer/customer-workspace';
import { pageHead } from '@/features/customer/metadata';
export const Route=createFileRoute('/_authenticated/requests')({head:()=>pageHead('My requests','Create and track private demonstration service requests in the East London pilot.'),component:()=> <CustomerWorkspace privateView/>});
