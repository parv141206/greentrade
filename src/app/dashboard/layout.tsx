import type { ReactNode } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { AccessBlockedPage } from "~/components/access-blocked-page.tsx";
import { auth } from "~/server/auth";
import { supabase } from "~/lib/supabase";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth();

  // --- Your existing server-side verification logic ---
  const userPan = session?.user?.pan;
  const isAdmin = session?.user?.role === "admin";

  if (!isAdmin) {
    if (!userPan) {
      return <AccessBlockedPage status="suspended" />;
    }
    const { data: company, error } = await supabase
      .from("companies")
      .select("verified")
      .eq("pan", userPan)
      .maybeSingle();
    if (error) {
      console.error("Layout Protection Error:", error);
      return <AccessBlockedPage status="suspended" />;
    }
    if (company && !company.verified) {
      return <AccessBlockedPage status="suspended" />;
    }
  }
  // --- End of verification logic ---

  return (
    <div className="">
      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  );
}
