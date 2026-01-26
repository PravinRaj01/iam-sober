import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AISuggestionsSkeleton } from "./AISuggestionsSkeleton";

interface AISuggestDialogProps {
  open: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
}

interface Suggestion {
  title: string;
  description: string;
  target_days: number;
}

const AISuggestDialog = ({ open, onClose, onGoalCreated }: AISuggestDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [userPrompt, setUserPrompt] = useState("");
  const { toast } = useToast();

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-recovery-goals", {
        body: { userPrompt }
      });
      
      if (error) {
        console.error("AI suggestion error:", error);
        
        // Provide specific error messages
        if (error.message?.includes("429")) {
          throw new Error("Rate limit reached. Please try again in a minute.");
        } else if (error.message?.includes("402")) {
          throw new Error("AI credits depleted. Please add credits in Settings.");
        }
        
        throw error;
      }
      
      setSuggestions(data.suggestions || []);
      
      if (!data.suggestions || data.suggestions.length === 0) {
        toast({
          title: "No suggestions generated",
          description: "Try describing your goals more specifically.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to generate suggestions",
        description: error.message || "Unable to connect to AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (suggestion: Suggestion) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + suggestion.target_days);

      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        title: suggestion.title,
        description: suggestion.description,
        target_days: suggestion.target_days,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Goal created!",
        description: "AI-suggested goal added to your list",
      });

      onGoalCreated();
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to create goal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle>AI Goal Suggestions</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-primary/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Personalized recovery goals based on your journey
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt input and generate button at top */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="goal-prompt">Describe your goals or interests (optional)</Label>
              <Textarea
                id="goal-prompt"
                placeholder="e.g., I want to focus on fitness and mindfulness, or hobbies like painting..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={fetchSuggestions} 
              className="bg-gradient-primary w-full"
              disabled={loading}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Generating..." : suggestions.length > 0 ? "Generate More Suggestions" : "Generate Suggestions"}
            </Button>
          </div>

          {loading && (
            <div className="space-y-4 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-9 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="bg-card/50 backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                    <CardDescription>{suggestion.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Target: {suggestion.target_days} days
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleAddGoal(suggestion)}
                        className="bg-gradient-primary"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Goal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISuggestDialog;
