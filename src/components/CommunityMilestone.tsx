import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Heart, Share2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CommunityMilestoneProps {
  days: number;
  isAnonymous?: boolean;
}

export function CommunityMilestone({ days, isAnonymous = false }: CommunityMilestoneProps) {
  const [supportCount, setSupportCount] = useState(0);
  const [hasGivenSupport, setHasGivenSupport] = useState(false);
  const { toast } = useToast();

  const handleGiveSupport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("community_interactions").insert({
        user_id: user.id,
        type: "support_given",
        message: `Supported ${isAnonymous ? "someone" : "a community member"}'s ${days}-day milestone`,
        anonymous: false,
      });

      setSupportCount(prev => prev + 1);
      setHasGivenSupport(true);

      toast({
        title: "Support given! 💪",
        description: "Your encouragement means a lot to the community.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-success/20 hover:border-success/40 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-success" />
            </div>
            <div>
              <h4 className="font-semibold text-success mb-1">
                {days}-Day Milestone! 🎉
              </h4>
              <p className="text-sm text-muted-foreground">
                {isAnonymous ? "Someone" : "A community member"} reached {days} days of sobriety
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGiveSupport}
            disabled={hasGivenSupport}
            className={hasGivenSupport ? "text-success" : ""}
          >
            <Heart className={`h-4 w-4 mr-2 ${hasGivenSupport ? "fill-current" : ""}`} />
            {supportCount > 0 ? supportCount : "Support"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}