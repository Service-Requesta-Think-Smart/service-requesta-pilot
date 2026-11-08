import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccountRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error || !data?.length) throw new Error("Your account role could not be loaded. Please try again.");
    const roles = data.map((item) => item.role);
    if (roles.includes("admin")) return "admin" as const;
    if (roles.includes("provider")) return "provider" as const;
    return "customer" as const;
  });
