import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Award, Calendar, Activity, Target, Shield, Radio } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useUserStatsRealtime } from "@/hooks/useAdminRealtime";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function UserStats() {
  // Enable real-time updates
  useUserStatsRealtime();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: async () => {
      const [profiles, checkIns, goals, achievements] = await Promise.all([
        supabase.from("profiles").select("current_streak, longest_streak, level, xp, created_at"),
        supabase.from("check_ins").select("created_at", { count: "exact", head: true }),
        supabase.from("goals").select("completed", { count: "exact" }),
        supabase.from("user_achievements").select("earned_at", { count: "exact", head: true }),
      ]);

      const users = profiles.data || [];
      const streaks = users.map(u => u.current_streak || 0);
      const levels = users.map(u => u.level || 1);
      
      // Level distribution
      const levelDist: Record<number, number> = {};
      levels.forEach(l => { levelDist[l] = (levelDist[l] || 0) + 1; });
      
      // Streak distribution
      const streakBuckets = [
        { label: '0-7', min: 0, max: 7, count: 0 },
        { label: '8-30', min: 8, max: 30, count: 0 },
        { label: '31-90', min: 31, max: 90, count: 0 },
        { label: '90+', min: 91, max: 9999, count: 0 },
      ];
      streaks.forEach(s => {
        const bucket = streakBuckets.find(b => s >= b.min && s <= b.max);
        if (bucket) bucket.count++;
      });

      return {
        totalUsers: users.length,
        avgStreak: streaks.length ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0,
        maxStreak: Math.max(...streaks, 0),
        avgLevel: levels.length ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : '1',
        totalCheckIns: checkIns.count || 0,
        totalAchievements: achievements.count || 0,
        levelDistribution: Object.entries(levelDist).map(([level, count]) => ({ level: `Lvl ${level}`, count })).slice(0, 10),
        streakDistribution: streakBuckets,
      };
    },
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-4/10">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-chart-4" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">User Statistics</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Aggregated engagement metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="text-xs">Live</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span className="text-xs">Privacy-Safe</span>
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { title: "Total Users", value: stats?.totalUsers || 0, icon: Users },
          { title: "Avg Streak", value: `${stats?.avgStreak || 0} days`, icon: TrendingUp },
          { title: "Avg Level", value: stats?.avgLevel || '1', icon: Award },
          { title: "Max Streak", value: `${stats?.maxStreak || 0} days`, icon: Calendar },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-3 sm:pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 sm:mb-2">
                <m.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">{m.title}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-20" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold">{m.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Level Distribution</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Users by level</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[160px] sm:h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats?.levelDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="level" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} width={30} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px'
                    }} 
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Streak Distribution</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Users by streak duration</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[160px] sm:h-[200px]" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie 
                      data={stats?.streakDistribution || []} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={30} 
                      outerRadius={50} 
                      dataKey="count" 
                      nameKey="label" 
                      label={false}
                    >
                      {(stats?.streakDistribution || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px'
                      }}
                      formatter={(value: number, name: string) => [`${value} users`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend below chart */}
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {(stats?.streakDistribution || []).map((item, i) => (
                    <div key={item.label} className="flex items-center gap-1.5 text-xs">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">
                        {stats?.totalUsers ? Math.round((item.count / stats.totalUsers) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
