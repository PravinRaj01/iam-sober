import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Shield, ArrowLeft } from "lucide-react";

/**
 * Separate Admin Login Page
 * 
 * This is a dedicated login for administrators only.
 * After login, validates admin role via edge function before granting access.
 * 
 * If someone is already logged in (regular user), they'll be signed out
 * before they can attempt admin login.
 */
const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // On mount, check if already an admin; otherwise sign out any existing session
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check if user is admin
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

          if (response.ok) {
            const data = await response.json();
            if (data.isAdmin) {
              // Already logged in as admin, go to admin panel
              navigate("/admin", { replace: true });
              return;
            }
          }

          // Not an admin - sign them out so they can login as admin
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // On error, sign out to be safe
        await supabase.auth.signOut();
      } finally {
        setCheckingAuth(false);
      }
    };

    checkExistingSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.session) {
        throw new Error("No session created");
      }

      // Verify admin status
      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/check-admin-status`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authData.session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Sign out if admin check fails
        await supabase.auth.signOut();
        throw new Error("Failed to verify admin status");
      }

      const data = await response.json();

      if (!data.isAdmin) {
        // Sign out non-admin users
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "This login is for administrators only.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome, Admin!",
        description: "Redirecting to admin dashboard...",
      });

      navigate("/admin", { replace: true });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-muted/50 mx-auto w-fit animate-pulse">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-8 bg-card/80 backdrop-blur-xl border-border/50">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <Shield className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-muted-foreground mt-1">Restricted access area</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Sign In as Admin"
            )}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Main App
            </Button>
          </div>
        </form>

        <div className="mt-6 p-3 rounded-lg bg-muted/30 border border-dashed border-border">
          <p className="text-xs text-muted-foreground text-center">
            This is a restricted area. Only authorized administrators can access this panel.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AdminLogin;
