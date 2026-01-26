import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, differenceInHours } from "date-fns";
import { SidebarTrigger } from "@/components/ui/sidebar";
import StatCard from "@/components/StatCard";
import ActivityFeed from "@/components/ActivityFeed";
import MilestonesBadges from "@/components/MilestonesBadges";
import MotivationCard from "@/components/MotivationCard";
import SobrietyCounter from "@/components/SobrietyCounter";
import { WeeklyPatternsCard } from "@/components/AIInsightsCard";
import { Calendar, Target, Heart, TrendingUp } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import ChatbotButton from "@/components/chatbot/ChatbotButton";
import ChatbotDrawer, { ChatbotState } from "@/components/chatbot/ChatbotDrawer";

import StorageImage from "@/components/StorageImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RecentCommunityCard from "@/components/community/RecentCommunityCard";
import LevelUpDialog from "@/components/LevelUpDialog";
import { useLevelUp } from "@/hooks/useLevelUp";

import HealthStatusCard from "@/components/HealthStatusCard";
import { useSessionManager, clearSessionInfo } from "@/hooks/useSessionManager";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [chatbotState, setChatbotState] = useState<ChatbotState>('closed');
  const { backgroundImage, setBackgroundImage } = useBackground();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Session expiry check
  useSessionManager();

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      
      // Set background image only if it's different
      if (data?.background_image_url && data.background_image_url !== backgroundImage) {
        setBackgroundImage(data.background_image_url);
      }
      
      // Check onboarding
      if (!data?.onboarding_completed) {
        navigate("/onboarding");
      }
      
      return data;
    },
    enabled: !!user,
  });

  const { data: checkInsCount } = useQuery({
    queryKey: ["check-ins-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", weekAgo.toISOString());

      if (error) throw error;
      return data?.length || 0;
    },
    enabled: !!user,
  });

  const { data: goalsData } = useQuery({
    queryKey: ["goals-data", user?.id],
    queryFn: async () => {
      if (!user) return { completed: 0, total: 0 };
      
      const { data, error } = await supabase
        .from("goals")
        .select("id, completed")
        .eq("user_id", user.id);

      if (error) throw error;
      return {
        completed: data?.filter(g => g.completed).length || 0,
        total: data?.length || 0
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    clearSessionInfo();
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
  };

  // Call hooks before any conditional returns
  const { showLevelUp, oldLevel, newLevel, closeLevelUp } = useLevelUp(profile);

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-calm">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const daysSober = differenceInDays(new Date(), new Date(profile.sobriety_start_date));
  const hoursSober = differenceInHours(new Date(), new Date(profile.sobriety_start_date));

  return (
    <div className="flex-1 flex flex-col min-h-screen relative">
      {/* Global background */}
      {backgroundImage && (
        <>
          <div 
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="fixed inset-0 bg-background/70 backdrop-blur-md z-0" />
        </>
      )}
      
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40 shadow-soft">
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <SidebarTrigger className="lg:hidden" />
            <div className="hidden sm:flex items-center gap-2">
              <StorageImage
                bucket="logos"
                path="logo.png"
                alt="I Am Sober Logo"
                className="h-8 w-auto"
              />
              <div className="h-6 w-px bg-border/50" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-lg font-semibold truncate">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {profile.pseudonym}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">Keep up the amazing work on your recovery journey!</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {/* Left Column - Main Stats Grid */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Sobriety Counter - Full width prominent placement */}
            <SobrietyCounter
              startDate={profile.sobriety_start_date}
              onRelapseRecorded={refetchProfile}
            />
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Days Sober"
                value={daysSober}
                subtitle="Keep going strong!"
                icon={Calendar}
                gradient="bg-warning"
                className="col-span-2"
              />
              <StatCard
                title="Total Hours"
                value={hoursSober}
                subtitle="Hour by hour"
                icon={TrendingUp}
                gradient="bg-gradient-primary"
              />
              <StatCard
                title="Check-ins"
                value={checkInsCount || 0}
                subtitle="This week"
                icon={Heart}
                gradient="bg-success"
              />
              <StatCard
                title="Goals Met"
                value={`${goalsData?.completed || 0}`}
                subtitle={`Out of ${goalsData?.total || 0}`}
                icon={Target}
                gradient="bg-accent"
              />
              <StatCard
                title="Streak"
                value={`${daysSober}d`}
                subtitle="Current streak"
                gradient="bg-gradient-purple"
              />
            </div>

            {/* Milestones */}
            <MilestonesBadges startDate={profile.sobriety_start_date} />

            {/* Weekly Patterns Card */}
            <WeeklyPatternsCard />

            {/* Motivation Card */}
            <MotivationCard />
          </div>

          {/* Right Column - Activity Feed & Community */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <HealthStatusCard />
            <RecentCommunityCard />
            <ActivityFeed />
          </div>
        </div>
      </main>

      {/* AI Chatbot */}
      <ChatbotButton 
        onClick={() => setChatbotState(chatbotState === 'closed' ? 'mini' : 'closed')} 
        state={chatbotState} 
      />
      <ChatbotDrawer state={chatbotState} onStateChange={setChatbotState} />
      
      
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

export default Dashboard;
