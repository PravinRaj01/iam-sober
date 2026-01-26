import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const moods = [
  { value: "Great", emoji: "😊", label: "Great", bgSelected: "bg-green-500/20", borderSelected: "border-green-500", textColor: "text-green-600" },
  { value: "Good", emoji: "🙂", label: "Good", bgSelected: "bg-lime-500/20", borderSelected: "border-lime-500", textColor: "text-lime-600" },
  { value: "Okay", emoji: "😐", label: "Okay", bgSelected: "bg-yellow-500/20", borderSelected: "border-yellow-500", textColor: "text-yellow-600" },
  { value: "Struggling", emoji: "😔", label: "Struggling", bgSelected: "bg-orange-500/20", borderSelected: "border-orange-500", textColor: "text-orange-600" },
  { value: "Difficult", emoji: "😢", label: "Difficult", bgSelected: "bg-red-500/20", borderSelected: "border-red-500", textColor: "text-red-600" },
];

const CheckIn = () => {
  const [selectedMood, setSelectedMood] = useState("Okay");
  const [urgeIntensity, setUrgeIntensity] = useState([5]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch current streak
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["check-in-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("profiles")
        .select("current_streak, longest_streak")
        .eq("id", user.id)
        .single();
      
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Start a transaction to handle check-in, XP, and achievements
      const { data: profileData } = await supabase
        .from("profiles")
        .select("current_streak, longest_streak, last_check_in, xp")
        .eq("id", user.id)
        .single();

      if (!profileData) throw new Error("Profile not found");

      // Calculate streaks
      let newCurrentStreak = 1;
      let newLongestStreak = profileData.longest_streak || 1;
      const lastCheckIn = profileData.last_check_in ? new Date(profileData.last_check_in) : null;
      
      if (lastCheckIn) {
        const daysSinceLastCheckIn = Math.floor(
          (new Date().getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCheckIn === 1) {
          // Consecutive day
          newCurrentStreak = (profileData.current_streak || 0) + 1;
          newLongestStreak = Math.max(newCurrentStreak, profileData.longest_streak || 0);
        } else if (daysSinceLastCheckIn > 1) {
          // Streak broken
          newCurrentStreak = 1;
        }
      }

      // Award XP based on check-in and streak
      const baseXP = 50; // Base XP for checking in
      const streakBonus = Math.min(newCurrentStreak * 10, 100); // Bonus XP for streaks, max 100
      const totalXP = baseXP + streakBonus;

      // Insert check-in
      const { error: checkInError } = await supabase.from("check_ins").insert({
        user_id: user.id,
        mood: selectedMood,
        urge_intensity: urgeIntensity[0],
        notes: notes.trim() || null,
      });

      if (checkInError) throw checkInError;

      // Update profile with new XP and streak
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          xp: (profileData.xp || 0) + totalXP,
          current_streak: newCurrentStreak,
          longest_streak: newLongestStreak,
          last_check_in: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Check for streak achievements
      const streakMilestones = [3, 7, 30]; // Matches our achievement requirements
      if (streakMilestones.includes(newCurrentStreak)) {
        const { data: achievements } = await supabase
          .from("achievements")
          .select("id, requirements")
          .eq("category", "streak");

        const matchingAchievement = achievements?.find((a: any) => {
          const reqs = a.requirements as any;
          return reqs?.streak === newCurrentStreak;
        });

        if (matchingAchievement) {
          await supabase.from("user_achievements").insert({
            user_id: user.id,
            achievement_id: matchingAchievement.id,
          });
        }
      }

      toast({
        title: "Check-in saved!",
        description: `+${totalXP} XP (${baseXP} base + ${streakBonus} streak bonus). Current streak: ${newCurrentStreak} days!`,
      });
      refetchProfile();
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-gradient-calm min-h-screen">
      <PageHeader title="Check In" />

      <main className="container mx-auto px-4 py-8 max-w-2xl animate-fade-in space-y-6">
        {/* Check-in Streak Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Check-in Streak</p>
                <p className="text-3xl font-bold text-primary">{profile?.current_streak || 0} days</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile?.longest_streak ? `Best: ${profile.longest_streak} days` : "Keep the streak going!"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Flame className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft bg-card/50 backdrop-blur-lg">
          <CardHeader>
            <CardTitle>Daily Check-In</CardTitle>
            <CardDescription>How are you feeling today?</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base">How are you feeling?</Label>
                <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
                  {moods.map((mood) => {
                    const isSelected = selectedMood === mood.value;
                    return (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => setSelectedMood(mood.value)}
                        className={`
                          flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200
                          border-2 min-w-[70px]
                          ${isSelected 
                            ? `${mood.bgSelected} ${mood.borderSelected} scale-110 shadow-lg` 
                            : 'border-border/50 hover:border-border hover:bg-muted/30'
                          }
                        `}
                      >
                        <span className={`text-3xl sm:text-4xl transition-transform ${isSelected ? 'scale-110' : 'grayscale opacity-60'}`}>
                          {mood.emoji}
                        </span>
                        <span className={`text-xs font-medium ${isSelected ? mood.textColor : 'text-muted-foreground'}`}>
                          {mood.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Urge Intensity</Label>
                  <span className="text-2xl font-bold text-primary">{urgeIntensity[0]}/10</span>
                </div>
                <Slider
                  value={urgeIntensity}
                  onValueChange={setUrgeIntensity}
                  max={10}
                  min={0}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>None</span>
                  <span>Extreme</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="How was your day? Any challenges or wins?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Check-In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CheckIn;
