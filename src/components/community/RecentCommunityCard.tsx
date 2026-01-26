import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const RecentCommunityCard = () => {
  const navigate = useNavigate();

  const { data: recentMilestones } = useQuery({
    queryKey: ["recent-community"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_interactions")
        .select(`
          id,
          message,
          anonymous,
          created_at,
          type,
          public_profiles(pseudonym, level, xp)
        `)
        .eq("type", "milestone")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data;
    },
  });

  if (!recentMilestones || recentMilestones.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-lg overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 min-w-0 flex-1">
            <Users className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Community Milestones</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/community")}
            className="text-primary shrink-0 gap-1"
          >
            <span className="hidden sm:inline">View All</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentMilestones.map((milestone: any) => (
          <div
            key={milestone.id}
            className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg overflow-hidden"
          >
            <div className="p-2 bg-primary/10 rounded-full shrink-0">
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate">
                {milestone.anonymous ? "Anonymous" : (milestone.public_profiles?.pseudonym || "Community Member")}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                {milestone.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {formatDistanceToNow(new Date(milestone.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RecentCommunityCard;
