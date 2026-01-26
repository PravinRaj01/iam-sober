import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditMilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  interactionId: string;
  currentMessage: string;
  onUpdated: () => void;
}

const EditMilestoneDialog = ({ 
  open, 
  onClose, 
  interactionId, 
  currentMessage,
  onUpdated 
}: EditMilestoneDialogProps) => {
  const [message, setMessage] = useState(currentMessage);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    setLoading(true);
    try {
      // Moderate content
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

      const { error } = await supabase
        .from("community_interactions")
        .update({ message: message.trim() })
        .eq("id", interactionId);

      if (error) throw error;

      toast({
        title: "Milestone updated",
        description: "Your post has been updated successfully",
      });
      onUpdated();
      onClose();
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              placeholder="Update your milestone..."
              className="min-h-[120px] resize-none"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {message.length}/280
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || loading}>
              {loading ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMilestoneDialog;
