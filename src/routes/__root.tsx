import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, useAccount } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Wrench, MapPin, LogOut, ArrowRight } from 'lucide-react';
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Service-Requesta" },
      { name: "description", content: "Think Smart. Service-Requesta’s private East London pilot." },
      
      { property: "og:title", content: "Service-Requesta" },
      { property: "og:description", content: "Think Smart. Service-Requesta’s private East London pilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const router = useRouter();
  const [user,setUser] = useState<User|null>(null);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = async () => { const {data} = await supabase.auth.getUser(); if(live) { setUser(data.user); setReady(true); } };
    const {data:{subscription}} = supabase.auth.onAuthStateChange(event => {
      if(event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY') return;
      void refresh();
      void router.invalidate();
      if(event !== 'SIGNED_OUT') void queryClient.invalidateQueries();
    });
    void refresh();
    return () => { live=false; subscription.unsubscribe(); };
  },[queryClient,router]);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{user,ready}}>
      <SiteHeader/>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <footer className="border-t border-border"><div className="page-wrap flex flex-wrap justify-between gap-4 py-6 text-xs text-muted-foreground"><span>© Service-Requesta · Pre-launch pilot</span><Link to="/privacy">Privacy notice</Link></div></footer>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

function SiteHeader(){
 const {user}=useAccount(); const {queryClient}=Route.useRouteContext(); const router=useRouter();
 async function signOut(){await queryClient.cancelQueries();queryClient.clear();await supabase.auth.signOut();await router.navigate({to:'/auth',replace:true});}
 return <><div className="bg-secondary text-secondary-foreground"><div className="page-wrap flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"><span>PRE-LAUNCH · PRIVATE DEMONSTRATION</span><span className="flex items-center gap-1.5"><MapPin className="size-3"/> East London, South Africa</span></div></div><header className="border-b border-border bg-background"><div className="page-wrap flex flex-wrap items-center justify-between gap-3 py-5"><Link to="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Wrench className="size-5"/></span><span className="text-lg font-extrabold">Service-Requesta<span className="ml-1 text-primary">.</span></span></Link><nav className="flex items-center gap-2" aria-label="Main navigation"><Button asChild variant="ghost"><Link to={user?'/requests':'/'}>My requests</Link></Button>{user?<Button variant="outline" onClick={signOut} aria-label="Sign out"><LogOut/><span className="hidden sm:inline">Sign out</span></Button>:<Button asChild><Link to="/auth">Sign in<ArrowRight/></Link></Button>}</nav></div></header></>;
}
