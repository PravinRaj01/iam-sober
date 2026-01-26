import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Sparkles, ChevronRight } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

interface Strategy {
  title: string;
  description: string;
  actionSteps: string[];
}

export function PersonalizedStrategies() {
  const [loading, setLoading] = useState(false);
  const [situation, setSituation] = useState("");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const { toast } = useToast();

  const generateStrategies = async () => {
    if (!situation.trim()) {
      toast({
        title: "Please describe your situation",
        description: "We need some context to provide personalized strategies.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-coping-strategies", {
        body: { situation },
      });

      if (error) throw error;

      setStrategies(data.strategies || []);
      setSituation("");
    } catch (error: any) {
      toast({
        title: "Error generating strategies",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-purple-500" />
          AI Coping Strategies
        </CardTitle>
        <CardDescription>
          Get personalized strategies for challenging situations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Textarea
            placeholder="Describe what you're struggling with (e.g., 'I'm feeling triggered after seeing alcohol in a TV show')"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button
            onClick={generateStrategies}
            disabled={loading || !situation.trim()}
            className="w-full bg-gradient-primary"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Get Personalized Strategies
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <LoadingSkeleton className="h-[100px] w-full" />
            <LoadingSkeleton className="h-[100px] w-full" />
            <LoadingSkeleton className="h-[100px] w-full" />
          </div>
        ) : strategies.length > 0 ? (
          <div className="space-y-4">
            {strategies.map((strategy, idx) => (
              <Card key={idx} className="bg-white/5 hover:bg-white/10 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-lg">{strategy.title}</h4>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                  <div className="space-y-2">
                    {strategy.actionSteps.map((step, stepIdx) => (
                      <div key={stepIdx} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-1 text-purple-500" />
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}