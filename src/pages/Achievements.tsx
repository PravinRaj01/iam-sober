import AchievementsGrid from "@/components/achievements/AchievementsGrid";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LevelUpDialog from "@/components/LevelUpDialog";
import { useLevelUp } from "@/hooks/useLevelUp";
import { PageHeader } from "@/components/layout/PageHeader";

const Achievements = () => {
  const { data: profile } = useQuery({
    queryKey: ["profile-level"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("level, xp, points")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  // Call hooks before any conditional logic
  const { showLevelUp, oldLevel, newLevel, closeLevelUp } = useLevelUp(profile);

  // Calculate XP needed for next level
  const currentXP = profile?.xp || 0;
  const currentLevel = profile?.level || 1;
  
  // Calculate XP thresholds for current and next level
  const getXPForLevel = (level: number): number => {
    let total = 0;
    for (let n = 2; n <= level; n++) {
      total += n * 100;
    }
    return total;
  };
  
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);
  const xpNeededForNextLevel = (currentLevel + 1) * 100; // XP required to reach next level
  const xpInCurrentLevel = currentXP - xpForCurrentLevel; // XP earned in current level
  const xpProgress = Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="Achievements" />

      <main className="container mx-auto px-4 py-8">
        {/* Level Progress */}
        <div className="mb-8">
          <div className="flex items-end gap-2 mb-2">
            <h1 className="text-4xl font-bold">Level {currentLevel}</h1>
            <p className="text-muted-foreground mb-1">
              {xpInCurrentLevel} / {xpNeededForNextLevel} XP
            </p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>

        {/* Achievement Grid */}
        <AchievementsGrid />
      </main>
      
      {/* Level Up Dialog */}
      <LevelUpDialog
        open={showLevelUp}
        onClose={closeLevelUp}
        oldLevel={oldLevel}
        newLevel={newLevel}
      />
    </div>
  );
};

export default Achievements;