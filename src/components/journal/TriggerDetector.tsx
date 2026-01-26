import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, Brain, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAddictionContent } from "@/utils/addictionContent";
import { supabase } from "@/integrations/supabase/client";

interface TriggerDetectorProps {
  content: string;
  addictionType: string | null;
}

const TriggerDetector = ({ content, addictionType }: TriggerDetectorProps) => {
  const [detectedTriggers, setDetectedTriggers] = useState<string[]>([]);
  const [aiTrigger, setAiTrigger] = useState<string | null>(null);
  const [aiStrategies, setAiStrategies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get common trigger keywords based on addiction type
    const getTriggerKeywords = () => {
      const commonTriggers = ["stress", "anxiety", "lonely", "bored", "tired", "angry", "sad", "depressed"];
      
      const specificTriggers: Record<string, string[]> = {
        alcohol: ["drink", "party", "bar", "wine", "beer", "drunk", "hangover"],
        drugs: ["high", "dealer", "party", "cocaine", "weed", "pills"],
        smoking: ["cigarette", "smoke", "nicotine", "vape", "lighter"],
        gambling: ["bet", "casino", "lottery", "poker", "slots"],
        gaming: ["game", "level up", "grind", "raid", "online"],
        pornography: ["porn", "sexual", "aroused", "tempted"],
        food: ["binge", "hungry", "craving", "diet", "weight"]
      };

      const addictionTriggers = addictionType ? specificTriggers[addictionType] || [] : [];
      return [...commonTriggers, ...addictionTriggers];
    };

    // Keyword-based detection (always runs as fallback)
    const keywords = getTriggerKeywords();
    const lowerContent = content.toLowerCase();
    const found = keywords.filter(keyword => lowerContent.includes(keyword));
    setDetectedTriggers([...new Set(found)]);

    // AI-based detection (debounced)
    if (!content || content.length < 50) {
      setAiTrigger(null);
      setAiStrategies([]);
      return;
    }

    const detectAiTriggers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("detect-triggers", {
          body: { text: content },
        });

        if (error) {
          console.error("AI trigger detection error:", error);
          return;
        }

        if (data?.trigger) {
          setAiTrigger(data.trigger);
          setAiStrategies(data.copingStrategies || []);
        } else {
          setAiTrigger(null);
          setAiStrategies([]);
        }
      } catch (error: any) {
        console.error("Error calling detect-triggers:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(detectAiTriggers, 1500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [content, addictionType]);

  if (detectedTriggers.length === 0 && !aiTrigger && !loading) return null;

  const copingStrategies = getAddictionContent(addictionType).copingStrategies;

  return (
    <div className="space-y-3">
      {/* AI Trigger Analysis */}
      {(aiTrigger || loading) && (
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <Brain className={loading ? "h-4 w-4 animate-pulse text-primary" : "h-4 w-4 text-primary"} />
          <AlertDescription>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-sm">AI is analyzing for emotional triggers...</span>
              </div>
            ) : aiTrigger ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">AI detected trigger:</span>
                  <Badge className="bg-primary/20 text-primary border-primary/30 capitalize">
                    {aiTrigger}
                  </Badge>
                </div>
                {aiStrategies.length > 0 && (
                  <div className="mt-2 p-2 bg-card/50 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-xs font-semibold">AI Coping Suggestions:</span>
                    </div>
                    <ul className="text-xs space-y-1 ml-5 list-disc">
                      {aiStrategies.map((strategy, idx) => (
                        <li key={idx}>{strategy}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {/* Keyword-based detection */}
      {detectedTriggers.length > 0 && (
        <Alert variant="destructive" className="bg-warning/10 border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">Potential triggers detected:</span>
                {detectedTriggers.slice(0, 3).map((trigger) => (
                  <Badge key={trigger} variant="outline" className="text-warning border-warning/30">
                    {trigger}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 p-3 bg-card/50 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Coping Strategies:</span>
                </div>
                <ul className="text-sm space-y-1 ml-6 list-disc">
                  {copingStrategies.slice(0, 3).map((strategy, idx) => (
                    <li key={idx}>{strategy}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TriggerDetector;
