import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminAuthState {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for server-side validated admin authentication.
 * 
 * SECURITY: This hook calls an edge function for server-side validation.
 * NEVER trust client-side storage (localStorage, sessionStorage) for admin checks.
 */
export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setState({ isAdmin: false, isLoading: false, error: null });
          return;
        }

        // Call edge function for server-side validation
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
        setState({ isAdmin: data.isAdmin, isLoading: false, error: null });
      } catch (error: any) {
        console.error("Admin auth check failed:", error);
        setState({ isAdmin: false, isLoading: false, error: error.message });
      }
    };

    checkAdminStatus();

    // Re-check on auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
