import { useEffect, useState } from "react";
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, Share2 } from "lucide-react";
import ShareMilestoneDialog from "./community/ShareMilestoneDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { shareMilestone } from "@/utils/shareMilestone";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface SobrietyCounterProps {
  startDate: string;
  onRelapseRecorded: () => void;
}

const SobrietyCounter = ({ startDate, onRelapseRecorded }: SobrietyCounterProps) => {
  const [time, setTime] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  useEffect(() => {
    const updateTime = async () => {
      const start = new Date(startDate);
      const now = new Date();

      const days = differenceInDays(now, start);
      const hours = differenceInHours(now, start) % 24;
      const minutes = differenceInMinutes(now, start) % 60;
      const seconds = differenceInSeconds(now, start) % 60;

      setTime({ days, hours, minutes, seconds });

      // Check for milestones
      const milestones = [1, 7, 30, 90, 180, 365];
      if (days > 0 && milestones.includes(days)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("privacy_settings")
            .eq("id", user.id)
            .single();

          const privacySettings = profile?.privacy_settings as any;
          const shareAnonymously = !privacySettings?.share_milestones;
          await shareMilestone(days, shareAnonymously);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [startDate]);

  const handleRelapse = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Record relapse
      const { error: relapseError } = await supabase.from("relapses").insert({
        user_id: user.id,
        relapse_date: new Date().toISOString(),
      });

      if (relapseError) throw relapseError;

      // Update profile with new start date
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ sobriety_start_date: new Date().toISOString() })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "Recorded",
        description: "It's okay. What matters is that you're back on track.",
      });

      onRelapseRecorded();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 md:p-8 bg-card/50 backdrop-blur-lg border-warning/30 shadow-elegant relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-success/5" />
      <div className="relative text-center space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/progress")} className="h-8 w-8">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
          </Button>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Days Sober</h2>
          <div className="w-8" />
        </div>
        
        <div className="space-y-2">
          <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-warning animate-counter">{time.days}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Keep going strong!</div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-border/50">
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{time.hours}</div>
            <div className="text-xs text-muted-foreground">Hours</div>
          </div>
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{time.minutes}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{time.seconds}</div>
            <div className="text-xs text-muted-foreground">Seconds</div>
          </div>
        </div>

        <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row gap-2">
          <Button 
            className="flex-1 bg-success hover:bg-success/90 text-sm sm:text-base"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Milestone
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 text-sm sm:text-base" 
                disabled={loading}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                I Relapsed
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Record a Relapse?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset your sobriety counter and record the relapse. Remember, recovery is a journey, not perfection. You can start again right now.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRelapse} disabled={loading} className="bg-destructive hover:bg-destructive/90">
                  Record Relapse
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <ShareMilestoneDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        daysSober={time.days}
      />
    </Card>
  );
};

export default SobrietyCounter;
