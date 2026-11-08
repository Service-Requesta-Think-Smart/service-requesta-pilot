import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/auth/auth-context";
import { getAccountRole } from "./account.functions";
import { CustomerWorkspace } from "@/features/customer/customer-workspace";
import { ProviderWorkspace, AdminProviderReviewConsole } from "@/components/service-requesta/provider-workspace";
import { AdminMarketplaceSupportConsole } from "@/components/service-requesta/marketplace-workspace";

export function AccountWorkspace() {
  const { user, ready } = useAccount();
  const getRole = useServerFn(getAccountRole);
  const query = useQuery({
    queryKey: ["account-role", user?.id],
    queryFn: () => getRole(),
    enabled: ready && !!user,
    retry: false,
  });

  if (!ready || (user && query.isPending)) {
    return <main className="page-wrap py-16"><p className="text-muted-foreground">Loading your secure workspace…</p></main>;
  }
  if (!user) return <CustomerWorkspace privateView />;
  if (query.isError) {
    return <main className="page-wrap py-16"><p role="alert">Your workspace could not be loaded.</p><Button onClick={() => void query.refetch()} className="mt-4"><RefreshCw /> Try again</Button></main>;
  }
  if (query.data === "provider") return <CustomerWorkspace privateView providerMode />;
  if (query.data === "admin") {
    return <main className="page-wrap py-8"><AdminProviderReviewConsole /><AdminMarketplaceSupportConsole /></main>;
  }
  return <CustomerWorkspace privateView />;
}

export function HomeWorkspace() {
  const { user } = useAccount();
  return user ? <AccountWorkspace /> : <CustomerWorkspace />;
}
