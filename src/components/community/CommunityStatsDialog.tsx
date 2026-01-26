import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Users, Award, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CommunityStatsDialogProps {
  open: boolean;
  onClose: () => void;
}

const CommunityStatsDialog = ({ open, onClose }: CommunityStatsDialogProps) => {
  const { data: stats } = useQuery({
    queryKey: ["community-stats-detailed"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const [membersResult, milestonesResult, reactionsResult, commentsResult, onlineMembersResult] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("community_interactions")
          .select("id", { count: "exact", head: true })
          .eq("type", "milestone")
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("community_reactions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("community_comments")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
        supabase.rpc("count_online_members"),
      ]);

      return {
        totalMembers: membersResult.count || 0,
        milestonesThisWeek: milestonesResult.count || 0,
        lovesThisWeek: reactionsResult.count || 0,
        commentsThisWeek: commentsResult.count || 0,
        onlineMembers: onlineMembersResult.data || 0,
      };
    },
    enabled: open,
    refetchInterval: 10000, // Refetch every 10 seconds when dialog is open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Community Stats</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Community Members</p>
                <p className="text-3xl font-bold mt-2">{stats?.totalMembers || 0}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-xs text-muted-foreground">
                    {stats?.onlineMembers || 0} online now
                  </p>
                </div>
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-3xl font-bold mt-2">{stats?.milestonesThisWeek || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Milestones shared</p>
              </div>
              <Award className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Loves Given</p>
                <p className="text-3xl font-bold mt-2">{stats?.lovesThisWeek || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">This week</p>
              </div>
              <Heart className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comments</p>
                <p className="text-3xl font-bold mt-2">{stats?.commentsThisWeek || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">This week</p>
              </div>
              <Award className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommunityStatsDialog;
