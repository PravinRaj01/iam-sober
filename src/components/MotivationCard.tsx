import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Lightbulb, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { getAddictionContent } from "@/utils/addictionContent";

const MotivationCard = () => {
  const { data: profile } = useQuery({
    queryKey: ["profile-addiction"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("addiction_type")
        .eq("id", user.id)
        .single();

      if (error) return null;
      return data;
    },
  });

  const { data: motivationData, refetch, isLoading, error } = useQuery({
    queryKey: ["ai-motivation", profile?.addiction_type],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-motivation", {
          body: { timestamp: Date.now() } // Force new generation each time
        });
        
        if (error) {
          console.error("Generate motivation error:", error);
          throw error;
        }
        
        return {
          message: data.message,
          timestamp: new Date().toISOString(),
          fromAI: true,
        };
      } catch (error: any) {
        console.error("AI motivation failed, using fallback:", error);
        // Fallback to static quotes if AI fails
        const content = getAddictionContent(profile?.addiction_type || null);
        const quotes = content.quotes;
        return {
          message: quotes[Math.floor(Math.random() * quotes.length)],
          timestamp: new Date().toISOString(),
          fromAI: false,
        };
      }
    },
    retry: 1,
    gcTime: 0, // Don't cache
    staleTime: 0, // Always consider stale
  });

  if (error && !motivationData) {
    return (
      <Card className="p-6 border-destructive/50">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>AI Unavailable</AlertTitle>
          <AlertDescription>
            Unable to generate AI motivation. Please try again later.
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              className="mt-2 w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 backdrop-blur-xl">
      <div className="flex items-start space-x-4">
        <Lightbulb className="h-6 w-6 text-primary mt-1 shrink-0" />
        <div className="space-y-2 flex-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            AI-Powered Motivation
          </h3>
          {isLoading ? (
            <p className="text-foreground italic text-lg animate-pulse">Generating inspiration...</p>
          ) : (
            <>
              <p className="text-foreground italic text-lg">{motivationData?.message}</p>
              {motivationData?.timestamp && (
                <p className="text-xs text-muted-foreground mt-1">
                  {motivationData.fromAI ? "AI Generated" : "Inspiration"} • {new Date(motivationData.timestamp).toLocaleTimeString()}
                </p>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 hover:bg-primary/10"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Generate New
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MotivationCard;
