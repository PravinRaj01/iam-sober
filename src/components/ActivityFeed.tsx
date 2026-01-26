import { Card } from "@/components/ui/card";
import { Trophy, Heart, BookOpen, Target, AlertCircle, MessageSquare, Users } from "lucide-react";
import { CommunityMilestone } from "./CommunityMilestone";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInDays } from "date-fns";

const ActivityFeed = () => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const activityList: Array<{
        type: string;
        icon: any;
        message: string;
        time: string;
        color: string;
        timestamp: Date;
        milestone_days?: number;
        anonymous?: boolean;
      }> = [];

      // Get profile for milestone calculations
      const { data: profile } = await supabase
        .from("profiles")
        .select("sobriety_start_date")
        .eq("id", user.id)
        .single();

      if (profile) {
        const daysSober = differenceInDays(new Date(), new Date(profile.sobriety_start_date));
        const milestones = [1, 7, 30, 90, 180, 365];
        const achievedMilestones = milestones.filter(m => daysSober >= m && daysSober <= m + 7);
        
        if (achievedMilestones.length > 0) {
          const latestMilestone = Math.max(...achievedMilestones);
          activityList.push({
            type: "milestone",
            icon: Trophy,
            message: `${latestMilestone}-day milestone achieved!`,
            time: "Recently",
            color: "text-success",
            timestamp: new Date(),
          });
        }
      }

      // Get recent check-ins
      const { data: checkIns } = await supabase
        .from("check_ins")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (checkIns && checkIns.length > 0) {
        activityList.push({
          type: "checkin",
          icon: Heart,
          message: "Completed daily check-in",
          time: formatDistanceToNow(new Date(checkIns[0].created_at), { addSuffix: true }),
          color: "text-primary",
          timestamp: new Date(checkIns[0].created_at),
        });
      }

      // Get recent journal entries
      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (journalEntries && journalEntries.length > 0) {
        activityList.push({
          type: "journal",
          icon: BookOpen,
          message: "Added new journal entry",
          time: formatDistanceToNow(new Date(journalEntries[0].created_at), { addSuffix: true }),
          color: "text-accent",
          timestamp: new Date(journalEntries[0].created_at),
        });
      }

      // Get recent goals progress
      const { data: goals } = await supabase
        .from("goals")
        .select("created_at, completed")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Get community interactions
      const { data: communityInteractions } = await supabase
        .from("community_interactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (communityInteractions) {
        communityInteractions.forEach((interaction) => {
          if (interaction.type === "milestone_share") {
            activityList.push({
              type: "community_milestone",
              icon: Users,
              message: interaction.message || "Milestone achieved!",
              time: formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true }),
              color: "text-success",
              timestamp: new Date(interaction.created_at),
              anonymous: interaction.anonymous,
            });
          } else if (interaction.type === "support_given" || interaction.type === "support_received") {
            activityList.push({
              type: "community_support",
              icon: MessageSquare,
              message: interaction.message || "Community support",
              time: formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true }),
              color: "text-primary",
              timestamp: new Date(interaction.created_at),
            });
          }
        });
      }

      if (goals && goals.length > 0) {
        activityList.push({
          type: "goal",
          icon: Target,
          message: goals[0].completed ? "Goal completed!" : "Goal progress updated",
          time: formatDistanceToNow(new Date(goals[0].created_at), { addSuffix: true }),
          color: "text-warning",
          timestamp: new Date(goals[0].created_at),
        });
      }

      // Get recent relapses
      const { data: relapses } = await supabase
        .from("relapses")
        .select("relapse_date")
        .eq("user_id", user.id)
        .order("relapse_date", { ascending: false })
        .limit(1);

      if (relapses && relapses.length > 0) {
        activityList.push({
          type: "relapse",
          icon: AlertCircle,
          message: "Recorded relapse - back on track",
          time: formatDistanceToNow(new Date(relapses[0].relapse_date), { addSuffix: true }),
          color: "text-destructive",
          timestamp: new Date(relapses[0].relapse_date),
        });
      }

      // Sort by most recent
      return activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
    },
  });

  return (
    <Card className="p-4 bg-card/60 backdrop-blur-xl border-border/40">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
        Activity
      </h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>No recent activity</p>
          <p className="text-xs mt-1">Start by logging a check-in!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={index} className="flex items-start gap-3 animate-fade-in">
                <div className={`p-2 rounded-lg bg-muted/30 backdrop-blur-sm ${activity.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default ActivityFeed;
