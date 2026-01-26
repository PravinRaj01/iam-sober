import { supabase } from "@/integrations/supabase/client";

export async function shareMilestone(days: number, isAnonymous: boolean = false) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    await supabase.from("community_interactions").insert({
      user_id: user.id,
      type: "milestone_share",
      milestone_days: days,
      message: `${isAnonymous ? "Someone" : "A community member"} reached ${days} days of sobriety! 🎉`,
      anonymous: isAnonymous,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error sharing milestone:", error);
    return { success: false, error: error.message };
  }
}