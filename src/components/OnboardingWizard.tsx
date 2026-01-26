import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Wine, Pill, Cigarette, MonitorPlay, Dices, Gamepad2, UtensilsCrossed, HelpCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const addictionTypes = [
  { value: "alcohol", label: "Alcohol", icon: Wine },
  { value: "drugs", label: "Drugs", icon: Pill },
  { value: "smoking", label: "Smoking", icon: Cigarette },
  { value: "pornography", label: "Pornography", icon: MonitorPlay },
  { value: "gambling", label: "Gambling", icon: Dices },
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "food", label: "Food", icon: UtensilsCrossed },
  { value: "other", label: "Other", icon: HelpCircle },
];

export const OnboardingWizard = () => {
  const [step, setStep] = useState(1);
  const [selectedAddiction, setSelectedAddiction] = useState("");
  const [sobrietyDate, setSobrietyDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth session to be established
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Please sign in first",
          description: "You need to be logged in to complete onboarding",
          variant: "destructive",
        });
        navigate("/auth");
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, [navigate, toast]);

  const handleComplete = async () => {
    if (!selectedAddiction) {
      toast({
        title: "Please select an addiction type",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("No active session. Please sign in again.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          addiction_type: selectedAddiction,
          sobriety_start_date: sobrietyDate.toISOString(),
          onboarding_completed: true,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      toast({
        title: "Welcome to I Am Sober!",
        description: "Your journey starts now. Stay strong!",
      });

      navigate("/");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error completing onboarding",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-calm">
        <Card className="w-full max-w-2xl p-8 bg-card/80 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Setting up your account...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-calm">
      <Card className="w-full max-w-2xl p-8 bg-card/80 backdrop-blur-xl border-border/50">
        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-2 flex-1 rounded-full mx-1",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">Welcome to I Am Sober</h2>
                <p className="text-muted-foreground">
                  Let's personalize your experience. What are you recovering from?
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {addictionTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedAddiction(type.value)}
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all",
                        selectedAddiction === type.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card/50 hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-8 w-8 mb-2" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!selectedAddiction}
                className="w-full"
                size="lg"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">When did you start?</h2>
                <p className="text-muted-foreground">
                  Select your sobriety start date (today or a past date)
                </p>
              </div>

              <div className="space-y-4">
                <Label>Sobriety Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !sobrietyDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {sobrietyDate ? format(sobrietyDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover/95 backdrop-blur-xl pointer-events-auto">
                    <Calendar
                      mode="single"
                      selected={sobrietyDate}
                      onSelect={(date) => date && setSobrietyDate(date)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Setting up..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
