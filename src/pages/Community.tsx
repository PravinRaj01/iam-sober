import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, TrendingUp, Clock, User, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import MilestoneCard from "@/components/community/MilestoneCard";
import ShareMilestoneDialog from "@/components/community/ShareMilestoneDialog";
import CommunityStatsDialog from "@/components/community/CommunityStatsDialog";
import { PageHeader } from "@/components/layout/PageHeader";

const Community = () => {
  const navigate = useNavigate();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [daysSober, setDaysSober] = useState(0);
  const [activeTab, setActiveTab] = useState("latest");
  const [popularFilter, setPopularFilter] = useState<"likes" | "comments">("likes");

  const { data: profile } = useQuery({
    queryKey: ["profile-community"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("sobriety_start_date")
        .eq("id", user.id)
        .single();

      if (error) return null;
      return data;
    },
  });

  useEffect(() => {
    if (profile?.sobriety_start_date) {
      const days = differenceInDays(new Date(), new Date(profile.sobriety_start_date));
      setDaysSober(days);
    }
  }, [profile]);

  const { data: interactions, refetch } = useQuery({
    queryKey: ["community-interactions", activeTab, popularFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from("community_interactions")
        .select(`
          id,
          message,
          anonymous,
          created_at,
          type,
          public_profiles(pseudonym, level, xp)
        `)
        .eq("type", "milestone");

      // Apply filters based on active tab
      if (activeTab === "my-posts" && user) {
        query = query.eq("user_id", user.id);
      } else if (activeTab === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      }

      // Apply sorting
      if (activeTab === "most-supported") {
        // We'll sort by love + comment count client-side
        query = query.order("created_at", { ascending: false }).limit(50);
      } else {
        query = query.order("created_at", { ascending: false }).limit(20);
      }

      const { data, error } = await query;
      if (error) throw error;

      // If most-supported tab, fetch love and/or comment counts and sort
      if (activeTab === "most-supported" && data) {
        const interactionIds = data.map(d => d.id);
        
        if (popularFilter === "likes") {
          // Sort by most liked only
          const lovesResult = await supabase
            .from("community_reactions")
            .select("interaction_id")
            .in("interaction_id", interactionIds);

          const likeCounts = new Map<string, number>();
          lovesResult.data?.forEach(r => {
            likeCounts.set(r.interaction_id, (likeCounts.get(r.interaction_id) || 0) + 1);
          });

          return data
            .sort((a, b) => {
              const countA = likeCounts.get(a.id) || 0;
              const countB = likeCounts.get(b.id) || 0;
              return countB - countA;
            })
            .slice(0, 20);
        } else {
          // Sort by most commented only
          const commentsResult = await supabase
            .from("community_comments")
            .select("interaction_id")
            .in("interaction_id", interactionIds);

          const commentCounts = new Map<string, number>();
          commentsResult.data?.forEach(c => {
            commentCounts.set(c.interaction_id, (commentCounts.get(c.interaction_id) || 0) + 1);
          });

          return data
            .sort((a, b) => {
              const countA = commentCounts.get(a.id) || 0;
              const countB = commentCounts.get(b.id) || 0;
              return countB - countA;
            })
            .slice(0, 20);
        }
      }

      return data;
    },
  });

  // Set up real-time subscription for all changes + presence tracking
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      channel = supabase
        .channel("community-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "community_interactions",
          },
          () => {
            refetch();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "community_interactions",
          },
          () => {
            refetch();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "community_interactions",
          },
          () => {
            refetch();
          }
        )
        .on("presence", { event: "sync" }, () => {
          // Presence state changed
        })
        .on("presence", { event: "join" }, () => {
          // New user joined
        })
        .on("presence", { event: "leave" }, () => {
          // User left
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && user) {
            // Track this user's presence
            await channel?.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refetch]);

  return (
    <div className="flex-1 bg-gradient-calm min-h-screen">
      <PageHeader 
        title="Community" 
        actions={
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatsDialogOpen(true)}
            >
              <Info className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Stats</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => setShareDialogOpen(true)}
              className="bg-gradient-primary"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Share</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      />

      <main className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-card/50 h-auto">
            <TabsTrigger value="latest" className="gap-1 py-2 px-2 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Latest</span>
            </TabsTrigger>
            <TabsTrigger value="most-supported" className="gap-1 py-2 px-2 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Popular</span>
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1 py-2 px-2 text-xs sm:text-sm">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Week</span>
            </TabsTrigger>
            <TabsTrigger value="my-posts" className="gap-1 py-2 px-2 text-xs sm:text-sm">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Mine</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="latest" className="space-y-4">
            {!interactions || interactions.length === 0 ? (
              <Card className="text-center py-16 bg-card/50 backdrop-blur-lg">
                <div className="max-w-md mx-auto">
                  <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No milestones yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Be the first to share your progress with the community!
                  </p>
                  <Button
                    onClick={() => setShareDialogOpen(true)}
                    className="bg-gradient-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Share Your Milestone
                  </Button>
                </div>
              </Card>
            ) : (
              interactions.map((interaction: any) => (
                <MilestoneCard
                  key={interaction.id}
                  interactionId={interaction.id}
                  pseudonym={interaction.public_profiles?.pseudonym}
                  milestone={interaction.message}
                  createdAt={interaction.created_at}
                  isAnonymous={interaction.anonymous}
                  userLevel={interaction.public_profiles?.level}
                  userXp={interaction.public_profiles?.xp}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="most-supported" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={popularFilter === "likes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPopularFilter("likes")}
                >
                  Most Liked
                </Button>
                <Button
                  variant={popularFilter === "comments" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPopularFilter("comments")}
                >
                  Most Commented
                </Button>
              </div>
            </div>
            {!interactions || interactions.length === 0 ? (
              <Card className="text-center py-16 bg-card/50 backdrop-blur-lg">
                <div className="max-w-md mx-auto">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No popular posts yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start supporting community members to see popular posts!
                  </p>
                </div>
              </Card>
            ) : (
              interactions.map((interaction: any) => (
                <MilestoneCard
                  key={interaction.id}
                  interactionId={interaction.id}
                  pseudonym={interaction.public_profiles?.pseudonym}
                  milestone={interaction.message}
                  createdAt={interaction.created_at}
                  isAnonymous={interaction.anonymous}
                  userLevel={interaction.public_profiles?.level}
                  userXp={interaction.public_profiles?.xp}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="week" className="space-y-4">
            {!interactions || interactions.length === 0 ? (
              <Card className="text-center py-16 bg-card/50 backdrop-blur-lg">
                <div className="max-w-md mx-auto">
                  <RefreshCw className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No milestones this week</h3>
                  <p className="text-muted-foreground mb-6">
                    Be the first to share a milestone this week!
                  </p>
                  <Button
                    onClick={() => setShareDialogOpen(true)}
                    className="bg-gradient-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Share Your Milestone
                  </Button>
                </div>
              </Card>
            ) : (
              interactions.map((interaction: any) => (
                <MilestoneCard
                  key={interaction.id}
                  interactionId={interaction.id}
                  pseudonym={interaction.public_profiles?.pseudonym}
                  milestone={interaction.message}
                  createdAt={interaction.created_at}
                  isAnonymous={interaction.anonymous}
                  userLevel={interaction.public_profiles?.level}
                  userXp={interaction.public_profiles?.xp}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="my-posts" className="space-y-4">
            {!interactions || interactions.length === 0 ? (
              <Card className="text-center py-16 bg-card/50 backdrop-blur-lg">
                <div className="max-w-md mx-auto">
                  <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">You haven't shared any milestones</h3>
                  <p className="text-muted-foreground mb-6">
                    Share your progress and inspire the community!
                  </p>
                  <Button
                    onClick={() => setShareDialogOpen(true)}
                    className="bg-gradient-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Share Your First Milestone
                  </Button>
                </div>
              </Card>
            ) : (
              interactions.map((interaction: any) => (
                <MilestoneCard
                  key={interaction.id}
                  interactionId={interaction.id}
                  pseudonym={interaction.public_profiles?.pseudonym}
                  milestone={interaction.message}
                  createdAt={interaction.created_at}
                  isAnonymous={interaction.anonymous}
                  userLevel={interaction.public_profiles?.level}
                  userXp={interaction.public_profiles?.xp}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <ShareMilestoneDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        daysSober={daysSober}
        onShared={refetch}
      />

      <CommunityStatsDialog
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
      />
    </div>
  );
};

export default Community;
