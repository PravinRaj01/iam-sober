import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Wind, ClipboardCheck, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProactiveInterventionProps {
  onOpenChat?: () => void;
}

export function ProactiveIntervention({ onOpenChat }: ProactiveInterventionProps) {
  const [open, setOpen] = useState(false);
  const [dismissedInterventionId, setDismissedInterventionId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: interventionData } = useQuery({
    queryKey: ["proactive-check"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/proactive-check`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    // Only open if intervention exists, not already dismissed in this session, and not already open
    const interventionId = interventionData?.intervention?.id;
    if (
      interventionData?.needs_intervention && 
      interventionId && 
      interventionId !== dismissedInterventionId
    ) {
      setOpen(true);
    }
  }, [interventionData, dismissedInterventionId]);

  // When dialog is closed without action, mark as dismissed for this session
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && interventionData?.intervention?.id) {
      // Mark as dismissed so it won't reopen on refetch
      setDismissedInterventionId(interventionData.intervention.id);
      // Also acknowledge in database so it doesn't persist
      acknowledgeMutation.mutate({ actionTaken: "dismissed" });
    }
    setOpen(newOpen);
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ actionTaken, wasHelpful }: { actionTaken?: string; wasHelpful?: boolean }) => {
      if (!interventionData?.intervention?.id) return;
      
      await supabase
        .from("ai_interventions")
        .update({
          was_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          action_taken: actionTaken,
          was_helpful: wasHelpful,
        })
        .eq("id", interventionData.intervention.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive-check"] });
    },
  });

  const handleAction = (action: string) => {
    acknowledgeMutation.mutate({ actionTaken: action });
    setOpen(false);

    switch (action) {
      case "talk_to_coach":
        onOpenChat?.();
        break;
      case "try_coping_tool":
      case "try_meditation":
        navigate("/coping");
        break;
      case "do_check_in":
        navigate("/check-in");
        break;
      default:
        toast({
          title: "Thanks for checking in",
          description: "Remember, we're here whenever you need support.",
        });
    }
  };

  const handleFeedback = (wasHelpful: boolean) => {
    acknowledgeMutation.mutate({ wasHelpful, actionTaken: "feedback_only" });
    setOpen(false);
    toast({
      title: wasHelpful ? "Glad I could help!" : "Thanks for the feedback",
      description: wasHelpful 
        ? "Keep going strong! 💪" 
        : "I'll try to be more helpful next time.",
    });
  };

  const intervention = interventionData?.intervention;
  const suggestedActions = intervention?.suggested_actions || [];

  const actionConfig: Record<string, { label: string; icon: any; variant: "default" | "outline" | "secondary" }> = {
    talk_to_coach: { label: "Talk to Coach", icon: MessageCircle, variant: "default" },
    try_coping_tool: { label: "Try Coping Tool", icon: Heart, variant: "secondary" },
    try_meditation: { label: "Meditation", icon: Wind, variant: "secondary" },
    do_check_in: { label: "Quick Check-in", icon: ClipboardCheck, variant: "outline" },
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary animate-pulse" />
            Your Recovery Coach
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {intervention?.message || "I noticed you might need some support. How can I help?"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {suggestedActions.map((action: string) => {
            const config = actionConfig[action];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <Button
                key={action}
                variant={config.variant}
                className="w-full justify-start gap-2"
                onClick={() => handleAction(action)}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </Button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <span className="text-sm text-muted-foreground">Was this helpful?</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleFeedback(true)}>
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleFeedback(false)}>
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProactiveIntervention;
