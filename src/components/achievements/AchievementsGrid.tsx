import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Trophy, Award, Target, BookOpen, Users, Wrench } from "lucide-react";
import AchievementCard from "./AchievementCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  earned_at?: string;
}

const categories = [
  { id: "all", label: "All", icon: Trophy },
  { id: "milestone", label: "Milestones", icon: Trophy },
  { id: "streak", label: "Streaks", icon: Award },
  { id: "goals", label: "Goals", icon: Target },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "community", label: "Community", icon: Users },
  { id: "tools", label: "Tools", icon: Wrench },
];

const AchievementsGrid = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [hoveredAchievement, setHoveredAchievement] = useState<Achievement | null>(null);

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all achievements and user's earned ones
      const { data: allAchievements } = await supabase
        .from("achievements")
        .select("*")
        .order("xp_reward");

      const { data: earnedAchievements } = await supabase
        .from("user_achievements")
        .select("achievement_id, earned_at")
        .eq("user_id", user.id);

      // Merge the data
      return (allAchievements || []).map((achievement: Achievement) => ({
        ...achievement,
        earned_at: earnedAchievements?.find(
          (earned) => earned.achievement_id === achievement.id
        )?.earned_at,
      }));
    },
  });

  const filteredAchievements = achievements.filter(
    (achievement) => selectedCategory === "all" || achievement.category === selectedCategory
  );

  const earnedPoints = achievements
    .filter((a) => a.earned_at)
    .reduce((sum, a) => sum + a.xp_reward, 0);

  const totalPoints = achievements.reduce((sum, a) => sum + a.xp_reward, 0);
  const earnedCount = achievements.filter((a) => a.earned_at).length;

  if (isLoading) {
    return <div>Loading achievements...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/60 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {earnedCount} / {achievements.length}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
          </CardHeader>
        </Card>
        <Card className="bg-card/60 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {earnedPoints}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Points Earned</p>
          </CardHeader>
        </Card>
        <Card className="bg-card/60 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {Math.round((earnedPoints / totalPoints) * 100)}%
            </CardTitle>
            <p className="text-sm text-muted-foreground">Completion</p>
          </CardHeader>
        </Card>
      </div>

      {/* Category Tabs */}
      <Tabs
        defaultValue="all"
        value={selectedCategory}
        onValueChange={setSelectedCategory}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span>{category.label}</span>
                {category.id !== "all" && (
                  <span className="text-xs text-muted-foreground">
                    {achievements.filter((a) => a.category === category.id && a.earned_at).length}/
                    {achievements.filter((a) => a.category === category.id).length}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={selectedCategory}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                earned={Boolean(achievement.earned_at)}
                onHover={setHoveredAchievement}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AchievementsGrid;