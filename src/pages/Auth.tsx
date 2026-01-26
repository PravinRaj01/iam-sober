import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import StorageImage from "@/components/StorageImage";
import { setSessionInfo } from "@/hooks/useSessionManager";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: "", color: "" };
    if (password.length < 6) return { strength: "Weak", color: "text-destructive" };
    if (password.length < 10) return { strength: "Medium", color: "text-warning" };
    return { strength: "Strong", color: "text-success" };
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password");
          }
          throw error;
        }

        // Store session info based on "Remember me" choice
        setSessionInfo(rememberMe);

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });

        navigate("/");
      } else {
        const redirectUrl = `${window.location.origin}/onboarding`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              pseudonym: pseudonym || "Anonymous",
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            throw new Error("This email is already registered. Please sign in.");
          }
          throw error;
        }

        // Wait a moment for the session to be established
        if (data?.session) {
          // Store session info for new signups (default to remember)
          setSessionInfo(true);
          
          toast({
            title: "Account created!",
            description: "Please complete the onboarding to personalize your experience.",
          });

          // Small delay to ensure session is fully established
          setTimeout(() => {
            navigate("/onboarding");
          }, 500);
        } else {
          toast({
            title: "Check your email",
            description: "Please confirm your email address to continue.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-calm">
      <Card className="w-full max-w-md p-8 bg-card/80 backdrop-blur-xl border-border/50">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <StorageImage
              bucket="logos"
              path="logo.png"
              alt="I Am Sober"
              className="h-20 w-20"
            />
          </div>
          <h1 className="text-2xl font-alfa-slab text-teal-600">i am sober.</h1>
          <p className="text-muted-foreground text-neutral-300">Your recovery journey starts here</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(email)}
                className={emailError ? "border-destructive" : ""}
                required
              />
              {emailError && (
                <p className="text-sm text-destructive mt-1">{emailError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={() => validatePassword(password)}
                  className={passwordError ? "border-destructive pr-10" : "pr-10"}
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
              {passwordError && (
                <p className="text-sm text-destructive mt-1">{passwordError}</p>
              )}
              {!isLogin && password && (
                <p className={`text-sm mt-1 ${getPasswordStrength(password).color}`}>
                  {getPasswordStrength(password).strength && `Password Strength: ${getPasswordStrength(password).strength}`}
                </p>
              )}
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {!isLogin && (
              <div>
                <Label htmlFor="pseudonym">Display Name (optional)</Label>
                <Input
                  id="pseudonym"
                  type="text"
                  placeholder="How you want to be called"
                  value={pseudonym}
                  onChange={(e) => setPseudonym(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Remember Me Checkbox - Only show for login */}
          {isLogin && (
            <div className="flex items-center space-x-3">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="h-5 w-5 rounded-md border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-sm font-medium cursor-pointer text-foreground"
              >
                Remember me
              </Label>
            </div>
          )}

          <div className="space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                isLogin ? "Sign In" : "Sign Up"
              )}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmailError("");
                  setPasswordError("");
                }}
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Auth;
