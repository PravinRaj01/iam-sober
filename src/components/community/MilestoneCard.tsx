import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, User, Heart, MessageCircle, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CommentsDialog from "./CommentsDialog";
import EditMilestoneDialog from "./EditMilestoneDialog";

interface MilestoneCardProps {
  interactionId: string;
  pseudonym?: string;
  milestone: string;
  message?: string;
  createdAt: string;
  isAnonymous: boolean;
  userLevel?: number;
  userXp?: number;
}

interface ReactionCounts {
  loves: number;
  comments: number;
}

const MilestoneCard = ({ 
  interactionId,
  pseudonym, 
  milestone, 
  message, 
  createdAt, 
  isAnonymous,
  userLevel,
  userXp
}: MilestoneCardProps) => {
  const [reactions, setReactions] = useState<ReactionCounts>({ loves: 0, comments: 0 });
  const [hasLoved, setHasLoved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOwnPost, setIsOwnPost] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const { toast } = useToast();

  // Extract days from milestone message
  const daysMatch = milestone.match(/(\d+)\s+days?/i);
  const days = daysMatch ? parseInt(daysMatch[1]) : 0;
  
  // Determine milestone badge
  const getMilestoneBadge = (days: number) => {
    if (days >= 365) return { text: "1 Year+", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
    if (days >= 180) return { text: "6 Months", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    if (days >= 90) return { text: "90 Days", color: "bg-green-500/10 text-green-500 border-green-500/20" };
    if (days >= 30) return { text: "30 Days", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
    if (days >= 7) return { text: "7 Days", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
    return { text: "New", color: "bg-primary/10 text-primary border-primary/20" };
  };

  const badge = getMilestoneBadge(days);

  // Random avatar color for anonymous users
  const getAvatarColor = () => {
    const colors = [
      "bg-red-500/20",
      "bg-blue-500/20",
      "bg-green-500/20",
      "bg-purple-500/20",
      "bg-yellow-500/20",
      "bg-pink-500/20"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const avatarColor = getAvatarColor();

  // Fetch reactions and comments count
  useEffect(() => {
    fetchReactions();
    checkOwnership();
    
    // Subscribe to real-time updates for reactions
    const reactionsChannel = supabase
      .channel(`reactions-${interactionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_reactions",
          filter: `interaction_id=eq.${interactionId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    // Subscribe to comments
    const commentsChannel = supabase
      .channel(`comments-count-${interactionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_comments",
          filter: `interaction_id=eq.${interactionId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [interactionId]);

  const checkOwnership = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-ownership', {
        body: { interactionId }
      });
      if (!error && data) {
        setIsOwnPost(data.isOwner || false);
      }
    } catch (error) {
      console.error("Error checking ownership:", error);
    }
  };

  const fetchReactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const [lovesResult, commentsResult, myReactions] = await Promise.all([
        supabase
          .from("community_reactions")
          .select("id", { count: "exact", head: true })
          .eq("interaction_id", interactionId),
        supabase
          .from("community_comments")
          .select("id", { count: "exact", head: true })
          .eq("interaction_id", interactionId),
        user ? supabase
          .from("community_reactions")
          .select("id")
          .eq("interaction_id", interactionId)
          .eq("user_id", user.id) : Promise.resolve({ data: [] })
      ]);

      setReactions({
        loves: lovesResult.count || 0,
        comments: commentsResult.count || 0,
      });
      setHasLoved(myReactions.data && myReactions.data.length > 0);
    } catch (error) {
      console.error("Error fetching reactions:", error);
    }
  };

  const handleLove = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to love posts",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (hasLoved) {
        // Remove love
        await supabase
          .from("community_reactions")
          .delete()
          .eq("interaction_id", interactionId)
          .eq("user_id", user.id);
      } else {
        // Add love
        const { error } = await supabase
          .from("community_reactions")
          .insert({
            interaction_id: interactionId,
            user_id: user.id,
            reaction_type: "love",
          });

        if (error) throw error;

        toast({
          title: "❤️ Loved!",
          description: "Your support means a lot",
        });
      }
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

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("community_interactions")
        .delete()
        .eq("id", interactionId);

      if (error) throw error;

      toast({
        title: "Post deleted",
        description: "Your milestone has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-lg border-primary/20 animate-fade-in hover:shadow-soft transition-all">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Avatar className={`h-10 w-10 ${isAnonymous ? avatarColor : 'bg-muted'}`}>
                <AvatarFallback className={isAnonymous ? avatarColor : 'bg-muted'}>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">
                    {isAnonymous ? "Anonymous Warrior" : (pseudonym || "Community Member")}
                  </p>
                  {!isAnonymous && userLevel && (
                    <Badge variant="outline" className="text-xs">
                      Lvl {userLevel}
                    </Badge>
                  )}
                  <Badge className={`text-xs ${badge.color} border`}>
                    {badge.text}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            
            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEdit(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteAlert(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border-l-4 border-primary bg-primary/5 rounded-r-lg space-y-2">
          <div className="flex items-start gap-2">
            <Award className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-lg text-primary">
                {milestone}
              </p>
              {message && (
                <p className="text-sm text-muted-foreground italic mt-2">
                  "{message}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reaction buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLove}
            disabled={loading}
            className={`gap-1.5 ${hasLoved ? "bg-red-500/10 text-red-500" : ""}`}
          >
            <Heart className={`h-4 w-4 ${hasLoved ? "fill-current" : ""}`} />
            <span className="text-xs">{reactions.loves > 0 ? reactions.loves : "Love"}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(true)}
            className="gap-1.5"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{reactions.comments > 0 ? reactions.comments : "Comment"}</span>
          </Button>
        </div>
      </CardContent>
    </Card>

    <CommentsDialog
      open={showComments}
      onClose={() => setShowComments(false)}
      interactionId={interactionId}
      isAnonymous={isAnonymous}
    />

    <EditMilestoneDialog
      open={showEdit}
      onClose={() => setShowEdit(false)}
      interactionId={interactionId}
      currentMessage={milestone}
      onUpdated={fetchReactions}
    />

    <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this milestone? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};

export default MilestoneCard;
