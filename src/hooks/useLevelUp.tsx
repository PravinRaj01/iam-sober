import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Profile {
  xp: number;
  level: number;
}

// Calculate total XP needed to reach a given level (cumulative)
const getXPForLevel = (level: number): number => {
  // Level 1 = 0 XP, Level 2 = 200 XP, Level 3 = 500 XP, etc.
  // Formula: sum of (n * 100) for n = 2 to level
  let total = 0;
  for (let n = 2; n <= level; n++) {
    total += n * 100;
  }
  return total;
};

// Calculate what level a user should be based on their total XP
const calculateLevelFromXP = (totalXP: number): number => {
  let level = 1;
  let xpNeeded = 0;
  
  while (true) {
    const nextLevelXP = (level + 1) * 100;
    if (xpNeeded + nextLevelXP > totalXP) {
      break;
    }
    xpNeeded += nextLevelXP;
    level++;
  }
  
  return level;
};

export const useLevelUp = (profile: Profile | null | undefined) => {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [oldLevel, setOldLevel] = useState(1);
  const [newLevel, setNewLevel] = useState(1);
  const queryClient = useQueryClient();
  const lastCheckedXP = useRef<number | null>(null);

  useEffect(() => {
    const checkAndLevelUp = async () => {
      if (!profile) return;

      const { xp, level } = profile;
      
      // Avoid re-checking the same XP value
      if (lastCheckedXP.current === xp) return;
      lastCheckedXP.current = xp;

      // Calculate what level the user should be based on total XP
      const calculatedLevel = calculateLevelFromXP(xp);

      if (calculatedLevel > level) {
        // Update the profile in the database
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from("profiles")
          .update({ level: calculatedLevel })
          .eq("id", user.id);

        if (!error) {
          setOldLevel(level);
          setNewLevel(calculatedLevel);
          setShowLevelUp(true);
          
          // Invalidate queries to refresh the data
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["profile-level"] });
        }
      }
    };

    checkAndLevelUp();
  }, [profile, queryClient]);

  const closeLevelUp = () => {
    setShowLevelUp(false);
  };

  return {
    showLevelUp,
    oldLevel,
    newLevel,
    closeLevelUp,
  };
};
