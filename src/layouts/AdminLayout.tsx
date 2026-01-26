import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertCircle, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin Layout - Protects admin routes
 * 
 * SECURITY: Uses server-side validation via edge function.
 * Any logged-in user (regular or admin) who tries to access /admin
 * will be signed out if they're not an admin, then redirected to /admin/login.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        
        // No session at all - redirect to admin login
        if (!session) {
          navigate("/admin/login", { replace: true });
          return;
        }

        // Has session - verify admin status via edge function
        const response = await fetch(
          `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/check-admin-status`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to verify admin status");
        }

        const data = await response.json();
        
        if (!data.isAdmin) {
          // User is logged in but NOT an admin
          // Sign them out completely, then redirect to admin login
          await supabase.auth.signOut();
          navigate("/admin/login", { replace: true });
          return;
        }

        // User is verified admin
        setIsAdmin(true);
      } catch (err: any) {
        console.error("Admin access check failed:", err);
        setError(err.message || "Access verification failed");
        // On error, sign out and redirect
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [navigate]);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-muted/50 mx-auto w-fit animate-pulse">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-destructive/10 mx-auto w-fit">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Access Error</h2>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Not admin (will redirect, but render nothing while redirecting)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AdminSidebar 
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header with menu trigger - only on mobile, tablet has sidebar visible */}
        <header className="md:hidden bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <span className="font-semibold">Admin Panel</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}