import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Award, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CommunityStats = () => {
  const { data: stats } = useQuery({
    queryKey: ["community-stats"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [interactionsResult, profilesResult, reactionsResult] = await Promise.all([
        supabase
          .from("community_interactions")
          .select("id", { count: "exact" })
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("profiles")
          .select("id", { count: "exact" }),
        supabase
          .from("community_reactions")
          .select("id", { count: "exact" })
          .gte("created_at", weekAgo.toISOString())
      ]);

      return {
        milestonesThisWeek: interactionsResult.count || 0,
        totalMembers: profilesResult.count || 0,
        lovesGiven: reactionsResult.count || 0,
      };
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-card/50 backdrop-blur-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Community Members</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
          <p className="text-xs text-muted-foreground">
            Supporting each other
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.milestonesThisWeek || 0}</div>
          <p className="text-xs text-muted-foreground">
            Milestones shared
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Loves Given</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">{stats?.lovesGiven || 0}</div>
          <p className="text-xs text-muted-foreground">
            Love reactions this week
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunityStats;
