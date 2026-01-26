import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ShareMilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  daysSober: number;
  onShared?: () => void;
}

const ShareMilestoneDialog = ({ open, onClose, daysSober, onShared }: ShareMilestoneDialogProps) => {
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const maxChars = 280;
  const remainingChars = maxChars - message.length;

  const handleShare = async () => {
    setLoading(true);
    try {
      // Moderate content first
      const moderationResponse = await supabase.functions.invoke('moderate-content', {
        body: { content: message, type: 'milestone' }
      });

      if (moderationResponse.data?.appropriate === false) {
        toast({
          title: "Content not allowed",
          description: moderationResponse.data.reason || "Please keep messages supportive and constructive",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("community_interactions").insert({
        user_id: user.id,
        type: "milestone",
        message: message.trim() || `${daysSober} days sober!`,
        anonymous,
      });

      if (error) throw error;

      toast({
        title: "Milestone shared! 🎉",
        description: "Your achievement has been shared with the community.",
      });

      setMessage("");
      onShared?.();
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to share",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-popover/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Your Milestone
          </DialogTitle>
          <DialogDescription>
            Celebrate your {daysSober} days of sobriety with the community!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Your Message (optional)</Label>
              <span className={`text-xs ${remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {remainingChars} characters left
              </span>
            </div>
            <Textarea
              id="message"
              placeholder="Share your thoughts, feelings, or tips for others..."
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setMessage(e.target.value);
                }
              }}
              rows={4}
              disabled={loading}
              maxLength={maxChars}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="anonymous" className="text-sm font-medium">
                Post Anonymously
              </Label>
              <p className="text-xs text-muted-foreground">
                Hide your name from other users
              </p>
            </div>
            <Switch
              id="anonymous"
              checked={anonymous}
              onCheckedChange={setAnonymous}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              className="flex-1 bg-gradient-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Milestone
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareMilestoneDialog;
